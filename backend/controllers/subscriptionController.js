const pool = require("../config/database");
const { formatDate } = require("../utils/validators");
const {
  triggerLeadWonInvitation,
} = require("../integration/services/leadWonIntegrationService");
const {
  calculateSubscriptionDates,
  getPlanForSubscription,
} = require("../services/subscriptionDateService");
const erpApiClient = require("../integration/services/erpApiClient");
const erpSupabaseCustomerService = require("../services/erpSupabaseCustomerService");

const formatIntegrationResult = (result) => ({
  skipped: result.skipped,
  reason: result.reason,
  invitationId: result.invitation?.invitationId || result.mapping?.invitation_id,
  invitationUrl: result.invitation?.url || null,
  email: result.invitation?.email || result.mapping?.response_payload?.email || null,
  erpCustomerId: result.mapping?.erp_customer_id || null,
  status: result.invitation?.status || result.mapping?.status,
});

const sendIntegrationFailure = (res, { customer, error }) =>
  res.status(error.statusCode || 502).json({
    success: false,
    message: "Lead was converted to a customer, but invitation email failed.",
    customerId: customer?.id,
    integration: {
      success: false,
      error: error.message,
      code: error.code,
      details: error.details,
    },
  });

const resolveCrmCustomerId = async (customerId) => {
  const rawId = String(customerId || "").trim();
  if (!rawId) return null;
  if (/^\d+$/.test(rawId)) return rawId;

  try {
    const directCustomer = await pool.query(
      `SELECT id
       FROM customers
       WHERE erp_customer_id = $1
       LIMIT 1`,
      [rawId]
    );
    if (directCustomer.rows[0]?.id) return directCustomer.rows[0].id;
  } catch (err) {
    console.error("Failed to resolve subscription history customer:", err.message);
  }

  try {
    const mappedCustomer = await pool.query(
      `SELECT customer_id
       FROM crm_erp_customer_mappings
       WHERE erp_customer_id = $1
       LIMIT 1`,
      [rawId]
    );
    return mappedCustomer.rows[0]?.customer_id || null;
  } catch (err) {
    console.error("Failed to resolve mapped subscription history customer:", err.message);
    return null;
  }
};

const parseDateOrToday = (value) => {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const normalizePhone = (value) => String(value || "").replace(/\D/g, "");

const getPlanAmount = async (planName, fallbackAmount = 0) => {
  const amount = Number(fallbackAmount);
  if (Number.isFinite(amount) && amount > 0) return amount;

  const result = await pool.query(
    `SELECT price
     FROM plans
     WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
     ORDER BY created_at ASC
     LIMIT 1`,
    [planName || ""]
  );
  return Number(result.rows[0]?.price || 0);
};

const upsertErpCustomerForHistory = async ({
  crmCustomerId,
  erpCustomerId,
  customerName,
  companyName,
  phone,
  email,
  planName,
  amount,
  startDate,
  endDate,
}) => {
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = String(email || "").trim().toLowerCase();

  const existing = await pool.query(
    `SELECT *
     FROM customers
     WHERE ($1::int IS NOT NULL AND id = $1::int)
        OR ($2::text IS NOT NULL AND erp_customer_id = $2::text)
        OR ($3::text <> '' AND LOWER(email) = $3::text)
        OR ($4::text <> '' AND regexp_replace(phone, '\\D', '', 'g') = $4::text)
     ORDER BY id ASC
     LIMIT 1`,
    [
      /^\d+$/.test(String(crmCustomerId || "")) ? Number(crmCustomerId) : null,
      erpCustomerId || null,
      normalizedEmail,
      normalizedPhone,
    ]
  );

  const values = [
    erpCustomerId || null,
    customerName || "ERP Customer",
    companyName || "",
    normalizedPhone,
    normalizedEmail,
    planName,
    amount,
    formatDate(startDate),
    formatDate(endDate),
    startDate,
    endDate,
  ];

  if (existing.rows[0]) {
    const result = await pool.query(
      `UPDATE customers
       SET erp_customer_id = COALESCE($1, erp_customer_id),
           customer_name = COALESCE(NULLIF($2, ''), customer_name),
           company_name = COALESCE(NULLIF($3, ''), company_name),
           phone = COALESCE(NULLIF($4, ''), phone),
           email = COALESCE(NULLIF($5, ''), email),
           subscription_plan = $6,
           subscription_amount = $7,
           start_date = $8::date,
           renewal_date = $9::date,
           subscription_start_date = $10::timestamptz,
           subscription_end_date = $11::timestamptz,
           payment_status = 'Subscription Active',
           subscription_status = 'Subscription Active'
       WHERE id = $12
       RETURNING *`,
      [...values, existing.rows[0].id]
    );
    return result.rows[0];
  }

  const result = await pool.query(
    `INSERT INTO customers
     (erp_customer_id, customer_name, company_name, phone, email,
      subscription_plan, subscription_amount,
      start_date, renewal_date, subscription_start_date, subscription_end_date,
      payment_status, subscription_status, channel)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Subscription Active','Subscription Active','ERP')
     RETURNING *`,
    values
  );
  return result.rows[0];
};

const syncErpSubscriptionHistory = async (req, res) => {
  try {
    const {
      crmCustomerId,
      erpCustomerId,
      customerName,
      companyName,
      phone,
      email,
      planName,
      amount,
      actionType = "PLAN_UPDATED",
    } = req.body || {};

    if (!erpCustomerId && !crmCustomerId) {
      return res.status(400).json({
        success: false,
        message: "ERP customer id or CRM customer id is required",
      });
    }
    if (!planName) {
      return res.status(400).json({
        success: false,
        message: "Plan name is required",
      });
    }

    const startDate = parseDateOrToday(
      req.body.startDate || req.body.subscriptionStartedAt || req.body.trialStartDate
    );
    const endDate = parseDateOrToday(
      req.body.endDate || req.body.renewalDate || req.body.trialEndDate
    );
    const planAmount = await getPlanAmount(planName, amount);
    const customer = await upsertErpCustomerForHistory({
      crmCustomerId,
      erpCustomerId,
      customerName,
      companyName,
      phone,
      email,
      planName,
      amount: planAmount,
      startDate,
      endDate,
    });

    const history = await pool.query(
      `INSERT INTO subscription_history
       (customer_id, customer_name, plan_name, amount, action_type, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        customer.id,
        customer.customer_name,
        planName,
        planAmount,
        actionType,
        formatDate(startDate),
        formatDate(endDate),
      ]
    );

    res.json({
      success: true,
      customer,
      history: history.rows[0],
    });
  } catch (err) {
    console.error("ERP subscription history sync failed:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ── POST convert lead to customer ───────────────────────────────────────────
const convertLeadToCustomer = async (req, res) => {
  const client = await pool.connect();
  let lead;
  let customer;
  let alreadyConverted = false;

  try {
    const leadId = req.params.id;

    await client.query("BEGIN");

    const result = await client.query(
      "SELECT * FROM leads WHERE id = $1 FOR UPDATE",
      [leadId]
    );
    

    lead = result.rows[0];
    if (!lead) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Lead not found" });
    }

    const existingCustomer = await client.query(
      "SELECT * FROM customers WHERE lead_id = $1 LIMIT 1",
      [leadId]
    );

    if (lead.is_customer === true || existingCustomer.rows.length > 0) {
      if (existingCustomer.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message:
            "This lead is already marked as a customer, but no customer record was found.",
        });
      }

      customer = existingCustomer.rows[0];
      alreadyConverted = true;
    } else {
      const plan = await getPlanForSubscription(client, lead.plan);
      const isAdvanced = String(plan.name || lead.plan || "").toLowerCase().includes("advanced");
      const customMembers = isAdvanced ? Number(req.body?.customMembers ?? lead.custom_members) : null;
      const customProjects = isAdvanced ? Number(req.body?.customProjectLimit ?? lead.custom_project_limit) : null;
      const customTemplates = isAdvanced ? Number(req.body?.customTemplateLimit ?? lead.custom_template_limit) : null;
      const customPrice = isAdvanced ? Number(req.body?.customPrice ?? lead.custom_price) : null;
      const gstRate = isAdvanced ? Number(req.body?.gstRate ?? 18) : null;
      if (isAdvanced && (!Number.isInteger(customMembers) || customMembers < 1 ||
          !Number.isInteger(customProjects) || customProjects < 1 ||
          !Number.isInteger(customTemplates) || customTemplates < 1 || customTemplates > 10 ||
          !Number.isFinite(customPrice) || customPrice <= 0 ||
          !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Advanced plan requires valid engineers, projects, templates (1–10), and annual price.",
        });
      }
      const { subscription_start_date, subscription_end_date } =
        calculateSubscriptionDates(plan.durationInDays);

      const customerResult = await client.query(
        `INSERT INTO customers
         (lead_id, customer_name, company_name, phone, email,
          channel, subscription_plan, subscription_amount,
          start_date, renewal_date, subscription_start_date, subscription_end_date, payment_status,
          payment_method, assigned_employee, notes, custom_users, custom_projects, custom_price, gst_rate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         RETURNING *`,
        [
          lead.id,
          lead.full_name,
          lead.company,
          lead.phone,
          lead.email,
          lead.channel,
          plan.name,
          isAdvanced ? customPrice : plan.price,
          formatDate(subscription_start_date),
          formatDate(subscription_end_date),
          subscription_start_date,
          subscription_end_date,
          "pending",
          null,
          null,
          lead.notes || lead.requirements,
          customMembers,
          customProjects,
          customPrice,
          gstRate,
        ]
      );

      customer = customerResult.rows[0];
      if (isAdvanced) customer.custom_templates = customTemplates;

      await client.query(
        `INSERT INTO subscription_history
         (customer_id, customer_name, plan_name, amount, action_type, start_date, end_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          customer.id,
          lead.full_name,
          plan.name,
          isAdvanced ? customPrice : plan.price,
          "NEW",
          formatDate(subscription_start_date),
          formatDate(subscription_end_date),
        ]
      );

      await client.query(
        "UPDATE leads SET is_customer = true WHERE id = $1",
        [leadId]
      );
    }

    await client.query("COMMIT");

    try {
      const integrationResult = await triggerLeadWonInvitation({
        lead,
        customer,
      });

      return res.json({
        success: true,
        message: alreadyConverted
          ? "Lead was already converted. ERP invitation status returned."
          : "Lead converted to customer and ERP invitation created.",
        customerId: customer.id,
        alreadyConverted,
        integration: {
          success: true,
          ...formatIntegrationResult(integrationResult),
        },
      });
    } catch (integrationError) {
      console.error("ERP Invitation Error:", integrationError);
      return sendIntegrationFailure(res, {
        customer,
        error: integrationError,
      });
    }

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Convert Customer Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ── GET subscription history ────────────────────────────────────────────────
const getSubscriptionHistory = async (req, res) => {
  try {
    const { customerId } = req.params;
    const crmCustomerId = await resolveCrmCustomerId(customerId);
    const rawCustomerId = String(customerId || "").trim();

    const result = await pool.query(
      `SELECT *
       FROM subscription_history
       WHERE ($1::int IS NOT NULL AND customer_id = $1::int)
          OR ($2::text <> '' AND erp_customer_id = $2::text)
          OR ($2::text <> '' AND erp_user_id = $2::text)
       ORDER BY created_at DESC`,
      [/^\d+$/.test(String(crmCustomerId || "")) ? Number(crmCustomerId) : null, rawCustomerId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ── GET customer stats ──────────────────────────────────────────────────────
const unwrapErpCustomers = (response) =>
  response?.customers || response?.data?.customers || (Array.isArray(response) ? response : []);

const getCustomerStats = async (req, res) => {
  try {
    const selectedYear = Number(req.query.year) || new Date().getFullYear();
    let customers = [];

    try {
      if (req.query.source === "erp") {
        const data = erpSupabaseCustomerService.isConfigured()
          ? await erpSupabaseCustomerService.getCustomers()
          : await erpApiClient.getCustomers();
        customers = unwrapErpCustomers(data);
      } else {
        const localResult = await pool.query(
          `SELECT created_at, start_date
           FROM customers
           ORDER BY id DESC`
        );
        customers = localResult.rows;
      }
    } catch (sourceErr) {
      console.error("Customer stats source unavailable, using local CRM customers:", sourceErr.message);
      const localResult = await pool.query(
        `SELECT created_at, start_date
         FROM customers
         ORDER BY id DESC`
      );
      customers = localResult.rows;
    }

    const monthCounts = new Map();

    customers.forEach((customer) => {
      const date = new Date(customer.created_at || customer.createdAt || customer.start_date);
      if (Number.isNaN(date.getTime()) || date.getFullYear() !== selectedYear) return;

      const monthNum = date.getMonth() + 1;
      monthCounts.set(monthNum, (monthCounts.get(monthNum) || 0) + 1);
    });

    const rows = Array.from(monthCounts.entries())
      .sort(([left], [right]) => left - right)
      .map(([monthNum, users]) => ({
        month: new Date(selectedYear, monthNum - 1, 1).toLocaleString("en-US", { month: "short" }),
        month_num: monthNum,
        users,
      }));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 502).json({
      success: false,
      error: err.message,
      details: err.details,
    });
  }
};

module.exports = {
  convertLeadToCustomer,
  getSubscriptionHistory,
  getCustomerStats,
  syncErpSubscriptionHistory,
};
