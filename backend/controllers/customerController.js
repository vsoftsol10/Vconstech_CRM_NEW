const pool = require("../config/database");
const { formatDate } = require("../utils/validators");
const { sendSubscriptionReminderEmail, sendSubscriptionRenewedEmail, sendCustomerCredentialsEmail } = require("../utils/emailUtil");
const { createManualCustomer, syncCustomer, enabled: erpCreationEnabled, normalizeInput, validate, validateFeatureSelection, datesFor, erpResetPassword } = require("../services/manualCustomerService");
const crypto = require("crypto");
const {
  calculateSubscriptionDates,
  getPlanForSubscription,
  normalizePlanKey,
} = require("../services/subscriptionDateService");
const {
  createCustomerRecord,
  findCustomerDuplicate,
  normalizeEmail,
  normalizePhone,
  normalizePlan,
  validateCustomerPayload,
} = require("../services/customerService");
const erpApiClient = require("../integration/services/erpApiClient");
const erpSupabaseCustomerService = require("../services/erpSupabaseCustomerService");
const { syncSubscription } = require("../services/erpSubscriptionSyncService");

const sendValidationError = (res, errors) =>
  res.status(400).json({ success: false, message: "Please fix the highlighted fields.", errors });

const formattedCustomerSelect = `
  id, lead_id, erp_customer_id, customer_name, company_name, phone, email,
  renewal_date >= CURRENT_DATE AS active,
  subscription_plan, subscription_amount, custom_users, custom_projects, custom_price, gst_rate, custom_features, sync_status,
  subscription_start_date, subscription_end_date,
  payment_status, payment_method, assigned_employee, notes, channel,
  reminder_sent,
  EXISTS (
    SELECT 1 FROM subscription_history sh
    WHERE sh.customer_id = customers.id AND sh.action_type = 'RENEWED'
  ) AS has_renewed,
  TO_CHAR(start_date, 'DD Mon YYYY') AS start_date,
  TO_CHAR(renewal_date, 'DD Mon YYYY') AS renewal_date,
  TO_CHAR(reminder_sent_date, 'DD Mon YYYY') AS reminder_sent_date
`;

const unwrapErpCustomer = (response) => response?.customer || response?.data?.customer || response;
const unwrapErpCustomers = (response) =>
  response?.customers || response?.data?.customers || (Array.isArray(response) ? response : []);
const unwrapErpUsers = (response) =>
  response?.users || response?.data?.users || (Array.isArray(response) ? response : []);

const toErpPayload = (body) => ({
  customer_name: body.customer_name || body.name,
  company_name: body.company_name || body.company,
  phone: body.phone,
  email: body.email,
  address: body.address,
  location: body.location,
  subscription_plan: body.subscription_plan,
  notes: body.notes,
});

const isErpCustomerId = (id) => String(id || "").startsWith("ERP-CUST-");
const isNumericCrmId = (id) => /^\d+$/.test(String(id || "").trim());

let expiredAtColumnExists;
const hasExpiredAtColumn = async () => {
  if (expiredAtColumnExists !== undefined) return expiredAtColumnExists;
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'expired_at'
    ) AS exists`
  );
  expiredAtColumnExists = Boolean(result.rows[0]?.exists);
  if (!expiredAtColumnExists) {
    console.warn("[Subscription] customers.expired_at is unavailable; deploy the subscription migration to record expiry timestamps.");
  }
  return expiredAtColumnExists;
};

const sendReminderEmailSafely = async (payload) => {
  try {
    return await sendSubscriptionReminderEmail(payload);
  } catch (err) {
    console.error("Subscription reminder email failed:", err.message);
    return { sent: false, failed: true, reason: err.message };
  }
};

const getPlanDurationDays = (planName) => {
  const key = normalizePlanKey(planName);
  if (key === "free trial" || key === "trial" || key === "trail") return { unit: "days", value: 7 };
  if (key === "basic" || key === "premium") return { unit: "years", value: 1 };
  return null; // Advanced is custom/manual and must supply an explicit end date.
};

const getPlanPrice = async (db, planName) => {
  const planKey = normalizePlanKey(planName);
  const result = await db.query(
    `SELECT price
     FROM plans
     WHERE LOWER(TRIM(name)) = $1
        OR LOWER(TRIM(name)) = $2
     ORDER BY created_at ASC
     LIMIT 1`,
    [planKey, normalizePlanKey(planKey)]
  );
  return Number(result.rows[0]?.price || 0);
};

const pickFirst = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toDateOnly = (value) => {
  const date = toDateOrNull(value);
  return date ? formatDate(date) : null;
};

const normalizeErpPlanName = (planName) => {
  const key = normalizePlanKey(planName);
  if (key === "free trial" || key === "trial") return "Trial";
  return String(planName || "").trim();
};

const normalizeStatus = (value) => String(value || "").trim();

const getErpUserById = async (id) => {
  const data = await erpApiClient.getSuperadminUsers();
  const users = unwrapErpUsers(data);
  const target = String(id || "").trim();
  return (
    users.find((user) => {
      const userId = String(user?.id || "").trim();
      const erpUserId = String(pickFirst(user?.erp_user_id, user?.erpUserId, "")).trim();
      const erpCustomerId = String(getErpCustomerId(user, "") || "").trim();
      const clientCustomerId = user?.clientId ? `ERP-CUST-${String(user.clientId).padStart(6, "0")}` : "";
      const mappedUserId = userId ? `ERP-USER-${userId}` : "";
      return [userId, erpUserId, erpCustomerId, clientCustomerId, mappedUserId].some(
        (candidate) => candidate && candidate === target
      );
    }) || null
  );
};

const getErpUserPlan = (user) =>
  pickFirst(user?.subscriptionPlan, user?.subscription_plan, user?.package, user?.plan);

const getErpUserStatus = (user) =>
  pickFirst(user?.subscriptionStatus, user?.subscription_status, user?.accountStatus, user?.status);

const getErpUserStartDate = (user) =>
  pickFirst(user?.subscriptionStartedAt, user?.subscriptionStartDate, user?.trialStartDate);

const getErpUserEndDate = (user) =>
  pickFirst(user?.subscriptionEndDate, user?.trialEndDate, user?.renewalDate);

const getErpCustomerId = (user, fallbackId) =>
  pickFirst(user?.erp_customer_id, user?.erpCustomerId, user?.clientId ? `ERP-CUST-${String(user.clientId).padStart(6, "0")}` : "", fallbackId);

const getUserCompanyName = (user) =>
  pickFirst(user?.companyName, user?.company_name, user?.company?.name);

const findCrmCustomerIdForErp = async ({ crmCustomerId, erpCustomerId, erpUserId, email, phone }) => {
  if (isNumericCrmId(crmCustomerId)) return Number(crmCustomerId);

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPhone = String(phone || "").replace(/\D/g, "");
  const result = await pool.query(
    `SELECT id
     FROM customers
     WHERE ($1::text IS NOT NULL AND erp_customer_id = $1::text)
        OR ($2::text <> '' AND LOWER(email) = $2::text)
        OR ($3::text <> '' AND regexp_replace(phone, '\\D', '', 'g') = $3::text)
     ORDER BY id ASC
     LIMIT 1`,
    [erpCustomerId || erpUserId || null, normalizedEmail, normalizedPhone]
  );
  return result.rows[0]?.id || null;
};

const getLocalCustomerById = async (id) => {
  if (!isNumericCrmId(id)) return null;
  const result = await pool.query(
    `SELECT ${formattedCustomerSelect}
     FROM customers
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const getLocalCustomers = async () => {
  const result = await pool.query(
    `SELECT ${formattedCustomerSelect}
     FROM customers
     ORDER BY id DESC`
  );
  return result.rows;
};

const updateLocalCustomer = async (id, body) => {
  const existing = await getLocalCustomerById(id);
  if (!existing) return null;

  const { values, errors } = validateCustomerPayload(body);
  if (Object.keys(errors).length > 0) {
    const error = new Error("Please fix the highlighted fields.");
    error.status = 400;
    error.errors = errors;
    throw error;
  }

  const duplicate = await findCustomerDuplicate(pool, {
    email: values.email,
    phone: values.phone,
    excludeId: id,
  });
  if (duplicate) {
    const error = new Error("Customer already exists.");
    error.status = 409;
    error.errors = {
      ...(normalizeEmail(duplicate.email) === values.email
        ? { email: "This email address already exists." }
        : {}),
      ...(normalizePhone(duplicate.phone) === values.phone
        ? { phone: "This phone number already exists." }
        : {}),
    };
    throw error;
  }

  const planChanged = normalizePlanKey(existing.subscription_plan) !== normalizePlanKey(values.subscription_plan);
  const shouldStartPlan = planChanged || !existing.active;
  const startDate = new Date();
  const fallbackDuration = getPlanDurationDays(values.subscription_plan);
  const endDate = fallbackDuration
    ? calculateSubscriptionDates(fallbackDuration, startDate).subscription_end_date
    : existing.subscription_end_date || existing.renewal_date;
  const planPrice = shouldStartPlan ? await getPlanPrice(pool, values.subscription_plan) : existing.subscription_amount;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE customers
       SET customer_name = $1,
           company_name = $2,
           phone = $3,
           email = $4,
           subscription_plan = $5,
           subscription_amount = $6,
           start_date = CASE WHEN $8::boolean THEN $9::date ELSE start_date END,
           renewal_date = CASE WHEN $8::boolean THEN $10::date ELSE renewal_date END,
           subscription_start_date = CASE WHEN $8::boolean THEN $11::timestamptz ELSE subscription_start_date END,
           subscription_end_date = CASE WHEN $8::boolean THEN $12::timestamptz ELSE subscription_end_date END,
           payment_status = CASE WHEN $8::boolean THEN 'Subscription Active' ELSE payment_status END,
           subscription_status = CASE WHEN $8::boolean THEN 'Subscription Active' ELSE subscription_status END,
           notes = $7
       WHERE id = $13`,
      [
        values.customer_name,
        values.company_name,
        values.phone,
        values.email,
        values.subscription_plan,
        planPrice,
        values.notes || null,
        shouldStartPlan,
        formatDate(startDate),
        formatDate(endDate),
        startDate,
        endDate,
        id,
      ]
    );

    if (shouldStartPlan) {
      await client.query(
        `INSERT INTO subscription_history
         (customer_id, customer_name, plan_name, amount, action_type, start_date, end_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          values.customer_name,
          values.subscription_plan,
          planPrice,
          planChanged ? "PLAN_UPDATED" : "REACTIVATED",
          formatDate(startDate),
          formatDate(endDate),
        ]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return getLocalCustomerById(id);
};

const deleteLocalCustomer = async (id) => {
  if (!isNumericCrmId(id)) return null;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query(
      "SELECT id, lead_id FROM customers WHERE id = $1 FOR UPDATE",
      [id]
    );
    const customer = current.rows[0];
    if (!customer) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query("DELETE FROM subscription_history WHERE customer_id = $1", [id]);
    await client.query("DELETE FROM crm_erp_customer_mappings WHERE customer_id = $1", [id]);
    await client.query("DELETE FROM crm_erp_status_events WHERE crm_customer_id = $1", [id]);
    await client.query("DELETE FROM customers WHERE id = $1", [id]);

    if (customer.lead_id) {
      await client.query("UPDATE leads SET is_customer = false WHERE id = $1", [customer.lead_id]);
    }

    await client.query("COMMIT");
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const createCustomer = async (req, res) => {
  try {
    const result = await createManualCustomer({ db: pool, body: req.body, sendCredentials: credentialsMailer });
    return res.status(201).json({ success: true, customer: result.customer, message: result.message, erpEnabled: erpCreationEnabled() });
  } catch (err) {
    console.error("Manual customer creation failed:", err.message);
    res.status(err.statusCode || err.status || 500).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }
};

const credentialsMailer = (customer, temporaryPassword) => sendCustomerCredentialsEmail({
  name: customer.customer_name, email: customer.email, plan: customer.subscription_plan,
  startDate: customer.start_date, expiryDate: customer.renewal_date,
  customUsers: customer.custom_users, customProjects: customer.custom_projects,
}, temporaryPassword);

const resyncCustomer = async (req, res) => {
  try {
    if (!erpCreationEnabled()) return res.status(409).json({ success: false, message: "ERP creation is disabled. Enable ERP_CREATE_USER_ENABLED to resync." });
    const found = await pool.query("SELECT * FROM customers WHERE id = $1", [req.params.id]);
    if (!found.rows[0]) return res.status(404).json({ success: false, message: "Customer not found" });
    const customer = found.rows[0];
    if (!['ERP_PENDING', 'ERP_FAILED', 'EMAIL_FAILED'].includes(customer.sync_status)) return res.status(409).json({ success: false, message: "This customer does not need ERP resync." });
    const result = await syncCustomer({ db: pool, customer, sendCredentials: credentialsMailer });
    return res.json({ success: true, customer: result.customer, message: result.message });
  } catch (err) { return res.status(err.status || 500).json({ success: false, message: err.message }); }
};

const resetCredentials = async (req, res) => {
  try {
    if (!erpCreationEnabled()) return res.status(409).json({ success: false, message: "ERP creation is disabled. Enable ERP_CREATE_USER_ENABLED to reset credentials." });
    const found = await pool.query("SELECT * FROM customers WHERE id = $1", [req.params.id]);
    const customer = found.rows[0];
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
    if (!customer.erp_user_id) return res.status(409).json({ success: false, message: "Customer has no ERP user. Resync the customer first." });
    const temporaryPassword = crypto.randomBytes(18).toString("base64url");
    await erpResetPassword(customer.erp_user_id, temporaryPassword);
    await credentialsMailer(customer, temporaryPassword);
    await pool.query("UPDATE customers SET sync_status='SYNCED', sync_error=NULL, sync_updated_at=NOW() WHERE id=$1", [customer.id]);
    return res.json({ success: true, message: "Credentials reset and email sent." });
  } catch (err) { return res.status(502).json({ success: false, message: "Credentials reset failed: " + err.message }); }
};

// CRM-only custom plan editor. No ERP request is made from this endpoint.
const updateCustomPlan = async (req, res) => {
  try {
    const found = await pool.query("SELECT * FROM customers WHERE id = $1", [req.params.id]);
    const previous = found.rows[0];
    if (!previous) return res.status(404).json({ success: false, message: "Customer not found" });
    if (normalizePlanKey(previous.subscription_plan) !== "advanced") {
      return res.status(409).json({ success: false, message: "Custom plans can only be edited for Advanced customers." });
    }
    const value = normalizeInput({ ...req.body, subscription_plan: "Advanced" });
    const errors = validate(value);
    if (Object.keys(errors).length) return sendValidationError(res, errors);
    await validateFeatureSelection(pool, value);
    const { start, end } = datesFor(value);
    const startDate = require("../services/manualCustomerService").dateOnly(start);
    const endDate = require("../services/manualCustomerService").dateOnly(end);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(`UPDATE customers SET subscription_plan='Advanced', custom_users=$1, custom_projects=$2, custom_price=$3, gst_rate=$4, custom_features=$5::jsonb, subscription_amount=$3, start_date=$6::date, renewal_date=$7::date, subscription_start_date=$6::date, subscription_end_date=$7::date, notes=$8 WHERE id=$9 RETURNING *`, [value.custom_users, value.custom_projects, value.custom_price, value.gst_rate, JSON.stringify(value.custom_features), startDate, endDate, value.notes || null, previous.id]);
      await client.query(`INSERT INTO subscription_history (customer_id, customer_name, plan_name, amount, action_type, start_date, end_date, metadata) VALUES ($1,$2,'Advanced',$3,'CUSTOM_PLAN_UPDATED',$4::date,$5::date,$6::jsonb)`, [previous.id, previous.customer_name, value.custom_price, startDate, endDate, JSON.stringify({ old: { custom_users: previous.custom_users, custom_projects: previous.custom_projects, custom_price: previous.custom_price, gst_rate: previous.gst_rate, custom_features: previous.custom_features }, new: { custom_users: value.custom_users, custom_projects: value.custom_projects, custom_price: value.custom_price, gst_rate: value.gst_rate, custom_features: value.custom_features } })]);
      await client.query("COMMIT");
      const erp = await syncSubscription({ db: pool, customer: updated.rows[0] });
      return res.json({ success: true, customer: updated.rows[0], message: erp.failed ? "Custom plan updated in CRM, but ERP sync failed." : erp.skipped ? `Custom plan updated in CRM. ${erp.reason}` : "Custom plan updated and ERP synced.", erp });
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  } catch (error) { return res.status(error.status || 500).json({ success: false, message: error.message, errors: error.errors }); }
};

const getAllCustomers = async (req, res) => {
  try {
    const useErpSource = req.query.source === "erp";
    const localCustomers = await getLocalCustomers();
    if (!useErpSource && localCustomers.length > 0) {
      return res.json(localCustomers);
    }

    const erpSupabaseData = erpSupabaseCustomerService.isConfigured()
      ? await erpSupabaseCustomerService.getCustomers(req.query)
      : null;
    if (erpSupabaseData) {
      return res.json(erpSupabaseData.customers);
    }

    const data = await erpApiClient.getCustomers(req.query);
    return res.json(unwrapErpCustomers(data));
  } catch (err) {
    console.error("Customer source unavailable, using local CRM customers:", err.message);
    try {
      return res.json(await getLocalCustomers());
    } catch (localErr) {
      return res.status(500).json({
        success: false,
        error: localErr.message,
      });
    }
  }
};

const getConvertedLeadCustomers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${formattedCustomerSelect}
       FROM customers
       WHERE lead_id IS NOT NULL
       ORDER BY id DESC`
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const getCustomerById = async (req, res) => {
  try {
    const localCustomer = await getLocalCustomerById(req.params.id);
    if (localCustomer) {
      return res.json(localCustomer);
    }

    const erpSupabaseCustomer = erpSupabaseCustomerService.isConfigured()
      ? await erpSupabaseCustomerService.getCustomer(req.params.id)
      : null;
    if (erpSupabaseCustomer) {
      return res.json(erpSupabaseCustomer);
    }

    const data = await erpApiClient.getCustomer(req.params.id);
    return res.json(unwrapErpCustomer(data));
  } catch (err) {
    res.status(err.statusCode || 502).json({
      success: false,
      message: err.message,
      details: err.details,
    });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const localCustomer = await updateLocalCustomer(req.params.id, req.body);
    if (localCustomer) {
      const erp = await syncSubscription({ db: pool, customer: localCustomer });
      return res.json({ success: true, customer: localCustomer, message: erp.failed ? "Customer updated in CRM, but ERP sync failed." : erp.skipped ? `Customer updated in CRM. ${erp.reason}` : "Customer updated and ERP synced.", erp });
    }

    const erpSupabaseCustomer = erpSupabaseCustomerService.isConfigured()
      ? await erpSupabaseCustomerService.updateCustomer(req.params.id, toErpPayload(req.body))
      : null;
    if (erpSupabaseCustomer) {
      return res.json({ success: true, customer: erpSupabaseCustomer });
    }

    const data = await erpApiClient.updateCustomer(req.params.id, toErpPayload(req.body));
    return res.json({ success: true, customer: unwrapErpCustomer(data) });
  } catch (err) {
    if (err.errors) return sendValidationError(res, err.errors);
    res.status(err.statusCode || err.status || 502).json({
      success: false,
      message: err.message,
      details: err.details,
    });
  }
};

const updateCustomerSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const requestedPlan = pickFirst(body.planId, body.planName, body.plan, body.subscription_plan, body.subscriptionPlan);

    if (!requestedPlan) {
      return res.status(400).json({
        success: false,
        message: "Subscription plan is required",
        errors: { subscription_plan: "Plan is required" },
      });
    }

    const plan = await getPlanForSubscription(pool, requestedPlan);
    const planPrice = Number.isFinite(plan.price) ? plan.price : 0;
    const requestedErpUserId = pickFirst(body.erp_user_id, body.erpUserId);
    const requestedErpCustomerId = pickFirst(body.erp_customer_id, body.erpCustomerId);
    const erpLookupId = pickFirst(requestedErpUserId, requestedErpCustomerId, id);
    const currentErpUser = await getErpUserById(erpLookupId);

    if (!currentErpUser) {
      return res.status(404).json({
        success: false,
        message: "ERP customer not found",
      });
    }

    const previousPlan = getErpUserPlan(currentErpUser);
    const previousStatus = getErpUserStatus(currentErpUser);
    const previousStartDate = getErpUserStartDate(currentErpUser);
    const previousEndDate = getErpUserEndDate(currentErpUser);
    const newPlanForErp = normalizeErpPlanName(plan.name);
    const planChanged = normalizePlanKey(previousPlan) !== normalizePlanKey(newPlanForErp);
    const shouldStartPlan =
      typeof body.shouldStartPlan === "boolean"
        ? body.shouldStartPlan
        : planChanged || currentErpUser.isActive === false;
    const status = normalizeStatus(
      pickFirst(
        body.status,
        body.subscription_status,
        body.subscriptionStatus,
        shouldStartPlan ? "Subscription Active" : previousStatus,
        "Subscription Active"
      )
    );
    const accountStatus = pickFirst(
      body.accountStatus,
      body.account_status,
      shouldStartPlan ? "ACTIVE" : currentErpUser.accountStatus,
      "ACTIVE"
    );
    const isActive =
      typeof body.isActive === "boolean"
        ? body.isActive
        : shouldStartPlan
          ? true
          : Boolean(currentErpUser.isActive ?? true);
    const startDate =
      toDateOrNull(pickFirst(body.startDate, body.subscriptionStartDate, body.subscriptionStartedAt)) ||
      (shouldStartPlan ? new Date() : toDateOrNull(previousStartDate)) ||
      new Date();
    const endDate =
      toDateOrNull(pickFirst(body.expiryDate, body.endDate, body.renewalDate, body.subscriptionEndDate)) ||
      (!shouldStartPlan ? toDateOrNull(previousEndDate) : null) ||
      calculateSubscriptionDates(plan.durationInDays, startDate).subscription_end_date;
    const companyName = String(pickFirst(body.company_name, body.companyName, getUserCompanyName(currentErpUser), "")).trim();
    const customMembers =
      newPlanForErp === "Advanced"
        ? Number(pickFirst(body.customMembers, currentErpUser.customMembers, 1))
        : null;

    const erpPayload = {
      name: String(pickFirst(body.customer_name, body.name, currentErpUser.name, "")).trim(),
      email: String(pickFirst(body.email, currentErpUser.email, "")).trim(),
      phoneNumber: String(pickFirst(body.phoneNumber, body.phone, currentErpUser.phoneNumber, "")).replace(/\D/g, ""),
      city: String(pickFirst(body.city, body.location, currentErpUser.city, "")).trim(),
      address: String(pickFirst(body.address, currentErpUser.address, "")).trim(),
      role: pickFirst(body.role, currentErpUser.role, "Admin"),
      companyName,
      package: newPlanForErp,
      subscriptionPlan: newPlanForErp,
      customMembers,
      subscriptionStartedAt: startDate.toISOString(),
      subscriptionStartDate: startDate.toISOString(),
      subscriptionEndDate: endDate.toISOString(),
      trialStartDate: formatDate(startDate),
      trialEndDate: formatDate(endDate),
      renewalDate: formatDate(endDate),
      subscriptionStatus: status,
      accountStatus,
      isActive,
    };

    const missing = {};
    if (!erpPayload.name) missing.customer_name = "Customer name is required";
    if (!erpPayload.email) missing.email = "Email is required";
    if (!erpPayload.phoneNumber) missing.phone = "Phone is required";
    if (!erpPayload.city) missing.location = "Location is required";
    if (!erpPayload.address) missing.address = "Address is required";
    if (!erpPayload.companyName) missing.company_name = "Company is required";
    if (newPlanForErp === "Advanced" && (!customMembers || customMembers < 1)) {
      missing.customMembers = "Advanced plan requires at least one site engineer";
    }

    if (Object.keys(missing).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please fix the highlighted fields.",
        errors: missing,
      });
    }

    const erpUserId = String(pickFirst(currentErpUser.id, requestedErpUserId, id));

    const erpUpdate = await erpApiClient.updateSuperadminUser(erpUserId, erpPayload);
    const updatedErpUser = erpUpdate?.user || erpUpdate?.data?.user || erpUpdate?.customer || erpUpdate;

    if (!updatedErpUser || erpUpdate?.success === false) {
      return res.status(502).json({
        success: false,
        message: "ERP subscription update failed",
        details: erpUpdate,
      });
    }

    const statusUpdate = await erpApiClient.updateCustomerStatus(erpUserId, {
      status: "SUBSCRIPTION_ACTIVE",
      accountStatus,
      isActive,
      plan: newPlanForErp,
      subscriptionStartedAt: startDate.toISOString(),
      subscriptionStartDate: startDate.toISOString(),
      subscriptionEndDate: endDate.toISOString(),
      trialStartDate: formatDate(startDate),
      trialEndDate: formatDate(endDate),
      renewalDate: formatDate(endDate),
      startDate: formatDate(startDate),
      expiryDate: formatDate(endDate),
    });

    const statusData = statusUpdate?.data || statusUpdate?.customer || statusUpdate?.user || statusUpdate;
    if (statusUpdate?.success === false || !statusData) {
      return res.status(502).json({
        success: false,
        message: "ERP subscription status update failed",
        details: statusUpdate,
      });
    }

    const confirmedErpUser = {
      ...updatedErpUser,
      ...((await getErpUserById(erpUserId)) || {}),
      subscriptionStartedAt: pickFirst(statusData.subscriptionStartedAt, statusData.purchaseDate, startDate),
      trialStartDate: pickFirst(statusData.trialStartDate, statusData.subscriptionStartedAt, startDate),
      trialEndDate: pickFirst(statusData.trialEndDate, statusData.subscriptionEndDate, endDate),
      subscriptionPlan: pickFirst(statusData.plan, statusData.subscriptionPlan, newPlanForErp),
      subscriptionStatus: pickFirst(statusData.status, statusData.subscriptionStatus, "SUBSCRIPTION_ACTIVE"),
      accountStatus: pickFirst(statusData.accountStatus, accountStatus),
      isActive: Boolean(statusData.isActive ?? isActive),
    };
    const erpCustomerId = getErpCustomerId(confirmedErpUser, requestedErpCustomerId);
    const crmCustomerId = await findCrmCustomerIdForErp({
      crmCustomerId: pickFirst(body.crm_customer_id, body.crmCustomerId, confirmedErpUser.crmCustomerId),
      erpCustomerId,
      erpUserId,
      email: erpPayload.email,
      phone: erpPayload.phoneNumber,
    });
    const confirmedPlan = pickFirst(getErpUserPlan(confirmedErpUser), newPlanForErp);
    const confirmedStatus = pickFirst(getErpUserStatus(confirmedErpUser), status);
    const confirmedStartDate = pickFirst(getErpUserStartDate(confirmedErpUser), startDate);
    const confirmedEndDate = pickFirst(getErpUserEndDate(confirmedErpUser), endDate);
    const subscriptionChanged =
      normalizePlanKey(previousPlan) !== normalizePlanKey(confirmedPlan) ||
      normalizeStatus(previousStatus).toLowerCase() !== normalizeStatus(confirmedStatus).toLowerCase() ||
      toDateOnly(previousStartDate) !== toDateOnly(confirmedStartDate) ||
      toDateOnly(previousEndDate) !== toDateOnly(confirmedEndDate);

    let history = null;
    if (subscriptionChanged) {
      const historyResult = await pool.query(
        `INSERT INTO subscription_history
         (customer_id, customer_name, plan_name, amount, action_type, start_date, end_date,
          erp_customer_id, erp_user_id, customer_email,
          previous_plan, new_plan, previous_status, new_status,
          previous_start_date, new_start_date, previous_end_date, new_end_date,
          changed_by, erp_subscription_id, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING *`,
        [
          crmCustomerId,
          pickFirst(erpPayload.name, confirmedErpUser.name, "ERP Customer"),
          confirmedPlan,
          planPrice,
          normalizePlanKey(previousPlan) === normalizePlanKey(confirmedPlan) ? "SUBSCRIPTION_UPDATED" : "PLAN_UPDATED",
          toDateOnly(confirmedStartDate),
          toDateOnly(confirmedEndDate),
          erpCustomerId,
          erpUserId,
          erpPayload.email,
          previousPlan || null,
          confirmedPlan || null,
          previousStatus || null,
          confirmedStatus || null,
          toDateOnly(previousStartDate),
          toDateOnly(confirmedStartDate),
          toDateOnly(previousEndDate),
          toDateOnly(confirmedEndDate),
          pickFirst(body.changedBy, body.changed_by, body.adminId, body.admin_id, null),
          pickFirst(body.erpSubscriptionId, body.erp_subscription_id, confirmedErpUser.subscriptionId, null),
          {
            source: "crm_customer_page",
            crmCustomerId,
            erpCustomerId,
            erpUserId,
          },
        ]
      );
      history = historyResult.rows[0];
    }

    return res.json({
      success: true,
      message: history ? "Subscription updated successfully" : "Customer updated successfully",
      customer: confirmedErpUser,
      history,
    });
  } catch (err) {
    console.error("Subscription update failed:", err);
    if (err.errors) return sendValidationError(res, err.errors);
    return res.status(err.statusCode || err.status || 502).json({
      success: false,
      message: err.message || "Subscription update failed",
      details: err.details,
    });
  }
};

const updateCustomerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const nextStatus = active ? "Subscription Active" : "Subscription Expired";

    const erpSupabaseCustomer = erpSupabaseCustomerService.isConfigured()
      ? await erpSupabaseCustomerService.updateCustomerStatus(id, {
          status: nextStatus,
          accountStatus: active ? "ACTIVE" : "INACTIVE",
          isActive: Boolean(active),
        })
      : null;
    if (erpSupabaseCustomer) {
      return res.json({ success: true, customer: erpSupabaseCustomer });
    }

    await erpApiClient.updateCustomerStatus(id, {
      status: nextStatus,
      accountStatus: active ? "ACTIVE" : "INACTIVE",
      isActive: Boolean(active),
    });

    const data = await erpApiClient.getCustomer(id);
    res.json({ success: true, customer: unwrapErpCustomer(data) });
  } catch (err) {
    res.status(err.statusCode || err.status || 502).json({
      success: false,
      message: err.message,
      details: err.details,
    });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const localResult = await deleteLocalCustomer(id);
    if (localResult) {
      return res.json(localResult);
    }

    const erpSupabaseResult = erpSupabaseCustomerService.isConfigured()
      ? await erpSupabaseCustomerService.deleteCustomer(id)
      : null;
    if (erpSupabaseResult) {
      return res.json({ success: true });
    }

    await erpApiClient.deleteCustomer(id);
    return res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 502).json({
      success: false,
      message: err.message,
      details: err.details,
    });
  }
};

const getRenewalDetails = async (id) => {
  const customer = await pool.query("SELECT * FROM customers WHERE id = $1", [id]);
  if (customer.rows.length === 0) {
    const error = new Error("Customer not found");
    error.status = 404;
    throw error;
  }
  const data = customer.rows[0];
  const plan = await getPlanForSubscription(pool, data.subscription_plan);
  const today = new Date();
  const currentEndDate = toDateOrNull(data.subscription_end_date || data.renewal_date);
  const termStartDate = currentEndDate && currentEndDate > today ? currentEndDate : today;
  return {
    data,
    plan,
    subscriptionDates: calculateSubscriptionDates(plan.durationInDays, termStartDate),
  };
};

const previewRenewal = async (req, res) => {
  try {
    const { data, plan, subscriptionDates } = await getRenewalDetails(req.params.id);
    return res.json({
      success: true,
      preview: {
        customerName: data.customer_name,
        plan: plan.name,
        currentExpiryDate: data.renewal_date,
        newExpiryDate: subscriptionDates.subscription_end_date,
      },
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

const renewSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, plan, subscriptionDates } = await getRenewalDetails(id);

    const clearExpiredAt = await hasExpiredAtColumn() ? ", expired_at = NULL" : "";
    const updatedCustomer = await pool.query(
      `UPDATE customers
       SET start_date = $1,
           renewal_date = $2,
           subscription_start_date = $3,
           subscription_end_date = $4,
           subscription_amount = $5,
           payment_status = 'Subscription Active',
           subscription_status = 'Subscription Active'
           ${clearExpiredAt}
       WHERE id = $6
       RETURNING *`,
      [
        formatDate(subscriptionDates.subscription_start_date),
        formatDate(subscriptionDates.subscription_end_date),
        subscriptionDates.subscription_start_date,
        subscriptionDates.subscription_end_date,
        data.custom_price ?? plan.price,
        id,
      ]
    );

    await pool.query(
      `INSERT INTO subscription_history
       (customer_id, customer_name, plan_name, amount, action_type, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        id,
        data.customer_name,
        plan.name,
        data.custom_price ?? plan.price,
        "RENEWED",
        formatDate(subscriptionDates.subscription_start_date),
        formatDate(subscriptionDates.subscription_end_date),
      ]
    );

    let email;
    try {
      email = await sendSubscriptionRenewedEmail({
        name: data.customer_name,
        email: data.email,
        companyName: data.company_name,
        plan: plan.name,
        amount: data.custom_price ?? plan.price,
        gstRate: data.gst_rate ?? plan.gst_rate,
        expiryDate: subscriptionDates.subscription_end_date,
      });
    } catch (emailError) {
      console.error("Subscription renewal confirmation email failed:", emailError.message);
      email = { sent: false, failed: true, reason: emailError.message };
    }

    const erp = await syncSubscription({ db: pool, customer: updatedCustomer.rows[0] });
    res.json({ success: true, message: erp.failed ? "Subscription renewed in CRM, but ERP sync failed." : erp.skipped ? `Subscription renewed in CRM. ${erp.reason}` : "Subscription renewed and ERP synced.", customer: updatedCustomer.rows[0], delivery: { email }, erp });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

const retryErpSubscriptionSync = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM customers WHERE id=$1", [req.params.id]);
    const customer = result.rows[0];
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
    if (customer.sync_status !== "ERP_FAILED") return res.status(409).json({ success: false, message: "Only ERP_FAILED customers can retry ERP sync." });
    const erp = await syncSubscription({ db: pool, customer });
    return res.json({ success: !erp.failed, message: erp.failed ? `CRM data remains saved; ERP sync failed: ${erp.reason}` : erp.skipped ? erp.reason : "ERP sync completed.", erp });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

const sendReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const today = new Date().toISOString().split("T")[0];
    const { subject, message, channel = "both" } = req.body || {};
    const isMessageChannel = channel === "message" || channel === "whatsapp";

    if (!isNumericCrmId(id)) {
      const body = req.body || {};
      let customer = {
        id,
        customer_name: body.customerName || body.customer_name || body.name || "Customer",
        name: body.customerName || body.customer_name || body.name || "Customer",
        email: body.to || body.email || "",
        phone: body.phone || "",
        company_name: body.companyName || body.company_name || body.company || "",
        subscription_plan: body.plan || body.subscription_plan || "",
        renewal_date: body.renewalDate || body.renewal_date || body.expire || "",
      };

      if (isErpCustomerId(id)) {
        customer = { ...customer, ...unwrapErpCustomer(await erpApiClient.getCustomer(id)) };
      }
      if (!customer?.id) {
        return res.status(404).json({ success: false, message: "ERP customer not found" });
      }

      const emailStatus =
        isMessageChannel
          ? { sent: false, skipped: true }
          : await sendReminderEmailSafely({
              name: customer.customer_name || customer.name,
              email: customer.email || body.to,
              subject,
              message,
              companyName: customer.company_name || customer.companyName,
              plan: customer.subscription_plan || customer.plan,
              expiryDate: customer.renewal_date || customer.renewalDate || customer.expire,
            });

      const messageStatus =
        channel === "email"
          ? { sent: false, skipped: true }
          : { sent: true, channel: "message", phone: customer.phone || null };

      return res.json({
        success: true,
        message: "Reminder sent successfully",
        customer: {
          ...customer,
          reminder_sent: true,
          reminder_sent_date: today,
        },
        delivery: {
          email: emailStatus,
          message: messageStatus,
        },
      });
    }

    const current = await pool.query("SELECT * FROM customers WHERE id = $1", [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const customer = current.rows[0];
    const emailStatus =
      isMessageChannel
        ? { sent: false, skipped: true }
        : await sendReminderEmailSafely({
            name: customer.customer_name,
            email: customer.email,
            subject,
            message,
          });

    const messageStatus = channel === "email"
      ? { sent: false, skipped: true }
      : { sent: true, channel: "message", phone: customer.phone || null };

    const result = await pool.query(
      `UPDATE customers
       SET reminder_sent = true, reminder_sent_date = $1
       WHERE id = $2
       RETURNING *,
         renewal_date >= CURRENT_DATE AS active,
         TO_CHAR(start_date, 'DD Mon YYYY') AS start_date,
         TO_CHAR(renewal_date, 'DD Mon YYYY') AS renewal_date,
         TO_CHAR(reminder_sent_date, 'DD Mon YYYY') AS reminder_sent_date`,
      [today, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    res.json({
      success: true,
      message: "Reminder sent successfully",
      customer: result.rows[0],
      delivery: {
        email: emailStatus,
        message: messageStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createCustomer,
  resyncCustomer,
  resetCredentials,
  updateCustomPlan,
  getAllCustomers,
  getConvertedLeadCustomers,
  getCustomerById,
  updateCustomer,
  updateCustomerSubscription,
  updateCustomerStatus,
  deleteCustomer,
  renewSubscription,
  retryErpSubscriptionSync,
  previewRenewal,
  sendReminder,
};
