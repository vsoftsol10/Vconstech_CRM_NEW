const pool = require("../../config/database");
const { sendErpInvitationEmail } = require("../../utils/emailUtil");
const erpApiClient = require("./erpApiClient");
const erpSupabaseCustomerService = require("../../services/erpSupabaseCustomerService");

const pickFirst = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const buildInvitationPayload = ({ lead, customer }) => ({
  source: "CRM",
  event: "LEAD_WON",
  idempotencyKey: `crm-lead-${lead.id}-customer-${customer.id}`,
  crmLeadId: lead.id,
  crmCustomerId: customer.id,
  customer: {
    name: customer.customer_name || lead.full_name,
    companyName: customer.company_name || lead.company,
    email: customer.email || lead.email,
    phone: customer.phone || lead.phone,
    address: customer.address || lead.address,
    location: customer.location || lead.location,
    channel: customer.channel || lead.channel,
    subscriptionPlan: customer.subscription_plan || lead.plan,
    paymentStatus: customer.payment_status,
    customMembers: customer.custom_users || null,
    customProjectLimit: customer.custom_projects || null,
    customTemplateLimit: customer.custom_templates || null,
    customPrice: customer.custom_price || null,
    gstRate: customer.gst_rate || null,
  },
  customPlan: String(customer.subscription_plan || lead.plan || "").toLowerCase().includes("advanced")
    ? {
        customMembers: customer.custom_users,
        customProjectLimit: customer.custom_projects,
        customTemplateLimit: customer.custom_templates,
        customPrice: customer.custom_price,
        gstRate: customer.gst_rate,
      }
    : null,
});

const isLegacyCrmInvitationId = (invitationId) =>
  String(invitationId || "").startsWith("CRM-ERP-INV-");

const getErpInvitationData = (response) => {
  const data = response?.data?.data || response?.data || response || {};

  return {
    invitationId: data.invitationId || data.invitation?.invitationId,
    erpCustomerId: data.erpCustomerId || data.invitation?.erpCustomerId,
    clientId: data.clientId || data.invitation?.clientId,
    status: data.status || data.invitation?.status,
    raw: response,
  };
};

const buildInvitationUrl = (invitationId) => {
  const configured =
    process.env.CRM_INVITATION_FRONTEND_URL ||
    process.env.CRM_FRONTEND_URL ||
    "http://localhost:5173/registration/invitations/:invitationId";

  if (configured.includes(":invitationId")) {
    return configured.replace(":invitationId", encodeURIComponent(invitationId));
  }

  const baseUrl = configured.endsWith("/") ? configured.slice(0, -1) : configured;
  return `${baseUrl}/registration/invitations/${encodeURIComponent(invitationId)}`;
};

const getExistingMapping = async (client, { leadId, customerId }) => {
  const result = await client.query(
    `SELECT *
     FROM crm_erp_customer_mappings
     WHERE lead_id = $1 OR customer_id = $2
     ORDER BY created_at ASC
     LIMIT 1
     FOR UPDATE`,
    [leadId, customerId]
  );

  return result.rows[0] || null;
};

const createPendingMapping = async (client, { lead, customer, payload }) => {
  const result = await client.query(
    `INSERT INTO crm_erp_customer_mappings
     (lead_id, customer_id, status, request_payload)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (lead_id) DO UPDATE
     SET customer_id = EXCLUDED.customer_id,
         status = EXCLUDED.status,
         request_payload = EXCLUDED.request_payload,
         updated_at = NOW()
     RETURNING *`,
    [lead.id, customer.id, "PENDING", payload]
  );

  return result.rows[0];
};

const markMappingPending = async (client, { mappingId, customerId, payload }) => {
  const result = await client.query(
    `UPDATE crm_erp_customer_mappings
     SET status = $1,
         customer_id = $2,
         request_payload = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    ["PENDING", customerId, payload, mappingId]
  );

  return result.rows[0];
};

const updateCustomerReference = async (
  client,
  { customerId, invitationId, erpCustomerId = null, status }
) => {
  const result = await client.query(
    `UPDATE customers
     SET erp_invitation_id = COALESCE($1, erp_invitation_id),
         erp_customer_id = COALESCE($2, erp_customer_id),
         erp_status = COALESCE($3, erp_status),
         erp_synced_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [invitationId, erpCustomerId, status, customerId]
  );

  return result.rows[0];
};

const markMappingInvited = async (client, { mappingId, invitationId, response }) => {
  const result = await client.query(
    `UPDATE crm_erp_customer_mappings
     SET invitation_id = COALESCE($1, invitation_id),
         erp_customer_id = COALESCE($5, erp_customer_id),
         status = $2,
         response_payload = $3,
         error_payload = NULL,
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [invitationId, "INVITED", response, mappingId, response?.erpCustomerId || null]
  );

  return result.rows[0];
};

const failMapping = async (mappingId, error) => {
  await pool.query(
    `UPDATE crm_erp_customer_mappings
     SET status = $1,
         error_payload = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [
      "FAILED",
      {
        message: error.message,
        code: error.code,
        details: error.details,
      },
      mappingId,
    ]
  );
};

const sendInvitationEmailSafely = async ({ name, email, invitationId, invitationUrl }) => {
  try {
    return await sendErpInvitationEmail({
      name,
      email,
      invitationId,
      invitationUrl,
    });
  } catch (error) {
    console.error("ERP Invitation Email Error:", error);
    return {
      sent: false,
      error: error.message,
      code: error.code,
      command: error.command,
    };
  }
};

const hasCompletedIntegration = (mapping) =>
  mapping &&
  ["INVITED", "REGISTERED", "CREATED", "ACTIVE", "SUCCESS"].includes(
    String(mapping.status || "").toUpperCase()
  ) &&
  mapping.invitation_id &&
  !isLegacyCrmInvitationId(mapping.invitation_id);

const triggerLeadWonInvitation = async ({ lead, customer }) => {
  if (!lead?.id || !customer?.id) {
    const error = new Error("Lead and customer are required for ERP integration");
    error.statusCode = 400;
    throw error;
  }

  const payload = buildInvitationPayload({ lead, customer });
  let mapping;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingMapping = await getExistingMapping(client, {
      leadId: lead.id,
      customerId: customer.id,
    });

    if (hasCompletedIntegration(existingMapping)) {
      await client.query("COMMIT");
      return {
        skipped: true,
        reason: "CRM invitation already exists",
        mapping: existingMapping,
        customer,
      };
    }

    if (
      existingMapping &&
      String(existingMapping.status || "").toUpperCase() === "PENDING"
    ) {
      await client.query("COMMIT");
      return {
        skipped: true,
        reason: "CRM invitation is already pending",
        mapping: existingMapping,
        customer,
      };
    }

    mapping = existingMapping
      ? await markMappingPending(client, {
          mappingId: existingMapping.id,
          customerId: customer.id,
          payload,
        })
      : await createPendingMapping(client, { lead, customer, payload });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  try {
    const erpInvitation = getErpInvitationData(
      await erpApiClient.sendInvitation(payload)
    );
    if (!erpInvitation.invitationId) {
      const error = new Error("ERP invitation response did not include an invitation ID");
      error.statusCode = 502;
      error.code = "ERP_INVITATION_ID_MISSING";
      error.details = erpInvitation.raw;
      throw error;
    }

    const invitationId = erpInvitation.invitationId;
    const erpCustomerId = erpInvitation.erpCustomerId || null;
    const invitationUrl = buildInvitationUrl(invitationId);
    const emailStatus = await sendInvitationEmailSafely({
      name: customer.customer_name || lead.full_name,
      email: customer.email || lead.email,
      invitationId,
      invitationUrl,
    });

    const updateClient = await pool.connect();
    try {
      await updateClient.query("BEGIN");

      const updatedMapping = await markMappingInvited(updateClient, {
        mappingId: mapping.id,
        invitationId,
        response: {
          invitationUrl,
          email: emailStatus,
          erpInvitation: erpInvitation.raw,
          erpCustomerId,
          erpClientId: erpInvitation.clientId || null,
        },
      });

      const updatedCustomer = await updateCustomerReference(updateClient, {
        customerId: customer.id,
        invitationId,
        erpCustomerId,
        status: "INVITED",
      });

      await updateClient.query("COMMIT");

      return {
        skipped: false,
        mapping: updatedMapping,
        customer: updatedCustomer,
        invitation: {
          invitationId,
          status: "INVITED",
          url: invitationUrl,
          email: emailStatus,
        },
      };
    } catch (error) {
      await updateClient.query("ROLLBACK");
      throw error;
    } finally {
      updateClient.release();
    }
  } catch (error) {
    await failMapping(mapping.id, error);
    throw error;
  }
};

const toPublicInvitation = (row) => {
  const payload = row.request_payload || {};
  const customerPayload = payload.customer || {};

  return {
    invitationId: row.invitation_id,
    status: row.status,
    crmLeadId: String(row.lead_id),
    crmCustomerId: String(row.customer_id),
    erpCustomerId: row.erp_customer_id || null,
    customer: {
      id: row.customer_id,
      name: pickFirst(customerPayload.name, row.customer_name),
      companyName: pickFirst(customerPayload.companyName, row.company_name),
      email: pickFirst(customerPayload.email, row.email),
      phone: pickFirst(customerPayload.phone, row.phone),
      address: pickFirst(customerPayload.address, row.address),
      location: pickFirst(customerPayload.location, row.location),
      channel: pickFirst(customerPayload.channel, row.channel),
      subscriptionPlan: pickFirst(customerPayload.subscriptionPlan, row.subscription_plan),
      paymentStatus: pickFirst(customerPayload.paymentStatus, row.payment_status),
      customMembers: pickFirst(customerPayload.customMembers, payload.customPlan?.customMembers, row.custom_users),
      customProjectLimit: pickFirst(customerPayload.customProjectLimit, payload.customPlan?.customProjectLimit, row.custom_projects),
      customTemplateLimit: pickFirst(customerPayload.customTemplateLimit, payload.customPlan?.customTemplateLimit),
      customPrice: pickFirst(customerPayload.customPrice, payload.customPlan?.customPrice, row.custom_price),
      gstRate: pickFirst(customerPayload.gstRate, payload.customPlan?.gstRate, row.gst_rate),
    },
  };
};

const getRegistrationInvitation = async (invitationId) => {
  const result = await pool.query(
    `SELECT m.*, c.customer_name, c.company_name, c.email, c.phone, c.channel,
            c.subscription_plan, c.payment_status, c.custom_users, c.custom_projects,
            c.custom_price, c.gst_rate, m.request_payload, l.address, l.location
     FROM crm_erp_customer_mappings m
     JOIN customers c ON c.id = m.customer_id
     LEFT JOIN leads l ON l.id = m.lead_id
     WHERE m.invitation_id = $1
     LIMIT 1`,
    [invitationId]
  );

  const invitation = result.rows[0];
  if (!invitation) {
    const error = new Error("Invitation not found");
    error.statusCode = 404;
    throw error;
  }

  return toPublicInvitation(invitation);
};

const markInvitationRegistered = async ({
  invitationId,
  erpCustomerId,
  erpUserId,
  erpClientId,
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const mappingResult = await client.query(
      `UPDATE crm_erp_customer_mappings
       SET erp_customer_id = COALESCE($2, erp_customer_id),
           status = 'REGISTERED',
           response_payload = response_payload || $3::jsonb,
           synced_at = NOW(),
           updated_at = NOW()
       WHERE invitation_id = $1
       RETURNING *`,
      [
        invitationId,
        erpCustomerId || null,
        {
          registration: {
            erpCustomerId,
            erpUserId,
            erpClientId,
            registeredAt: new Date().toISOString(),
          },
        },
      ]
    );

    const mapping = mappingResult.rows[0];
    if (!mapping) {
      const error = new Error("Invitation not found");
      error.statusCode = 404;
      throw error;
    }

    await updateCustomerReference(client, {
      customerId: mapping.customer_id,
      invitationId,
      erpCustomerId,
      status: "REGISTERED",
    });

    const customPlan = mapping.request_payload?.customPlan;
    if (String(mapping.request_payload?.customer?.subscriptionPlan || "").toLowerCase().includes("advanced") && customPlan) {
      await client.query(
        `UPDATE customers
         SET custom_users = $1, custom_projects = $2, custom_price = $3,
             gst_rate = $4, subscription_amount = $3
         WHERE id = $5`,
        [customPlan.customMembers, customPlan.customProjectLimit, customPlan.customPrice, customPlan.gstRate ?? 18, mapping.customer_id]
      );
    }

    await client.query("COMMIT");
    if (customPlan && erpUserId && erpSupabaseCustomerService.isConfigured()) {
      await erpSupabaseCustomerService.updateAdvancedPlan({ erpUserId, crmCustomerId: mapping.customer_id, ...customPlan });
    }
    return { success: true, invitationId, status: "REGISTERED" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getRegistrationInvitation,
  markInvitationRegistered,
  triggerLeadWonInvitation,
};
