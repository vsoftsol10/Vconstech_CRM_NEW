const crypto = require("crypto");
const { calculateSubscriptionDates, normalizePlanKey } = require("./subscriptionDateService");

const EMAIL = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PHONE = /^[6-9]\d{9}$/;
const enabled = () => String(process.env.ERP_CREATE_USER_ENABLED || "false").toLowerCase() === "true";
const text = (value) => String(value || "").trim();
const dateOnly = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
const parseDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? new Date(`${value}T00:00:00+05:30`) : null;
const safeError = (error) => text(error?.message).slice(0, 500) || "ERP request failed";

const addYear = (start) => calculateSubscriptionDates({ unit: "years", value: 1 }, start).subscription_end_date;
const normalizeInput = (body = {}) => {
  const planKey = normalizePlanKey(body.subscription_plan || body.plan);
  const plan = planKey === "free trial" ? "Free Trial" : text(body.subscription_plan || body.plan);
  const start = text(body.startDate || body.start_date) || dateOnly();
  const advanced = planKey === "advanced";
  const end = advanced ? text(body.endDate || body.end_date) || dateOnly(addYear(parseDate(start) || new Date())) : null;
  return {
    customer_name: text(body.customer_name || body.name), company_name: text(body.company_name || body.companyName),
    email: text(body.email).toLowerCase(), phone: text(body.phone).replace(/\D/g, ""),
    city: text(body.city || body.location), subscription_plan: plan, planKey, start, end,
    custom_users: advanced ? Number(body.customMembers ?? body.custom_users) : null,
    custom_projects: advanced ? Number(body.customProjectLimit ?? body.custom_projects) : null,
    custom_price: advanced ? Number(body.customPrice ?? body.custom_price) : null,
    gst_rate: advanced ? Number(body.gstRate ?? body.gst_rate ?? 18) : null,
    custom_features: advanced ? (body.customFeatures ?? body.custom_features ?? {}) : null,
    notes: text(body.notes),
  };
};

const validate = (value) => {
  const errors = {};
  if (value.customer_name.length < 3) errors.customer_name = "Name must be at least 3 characters";
  if (!EMAIL.test(value.email)) errors.email = "Enter a valid email address";
  if (!PHONE.test(value.phone)) errors.phone = "Enter a valid 10-digit Indian mobile number";
  if (!['free trial', 'basic', 'premium', 'advanced'].includes(value.planKey)) errors.subscription_plan = "Select a valid plan";
  if (value.planKey === "advanced") {
    if (!Number.isInteger(value.custom_users) || value.custom_users < 1) errors.customMembers = "Engineers must be at least 1";
    if (!Number.isInteger(value.custom_projects) || value.custom_projects < 1) errors.customProjectLimit = "Projects must be at least 1";
    if (!Number.isFinite(value.custom_price) || value.custom_price <= 0) errors.customPrice = "Custom yearly price must be greater than 0";
    if (!Number.isFinite(value.gst_rate) || value.gst_rate < 0 || value.gst_rate > 100) errors.gstRate = "GST must be between 0 and 100";
    if (!parseDate(value.start) || !parseDate(value.end) || value.end <= value.start) errors.endDate = "End date must be after start date";
  }
  return errors;
};

const validateFeatureSelection = async (db, value) => {
  if (value.planKey !== "advanced") return;
  const selected = Array.isArray(value.custom_features?.features) ? value.custom_features.features : [];
  if (!selected.every((feature) => typeof feature === "string" && feature.trim())) {
    const error = new Error("Invalid feature selection"); error.status = 400; error.errors = { customFeatures: "Features must be catalog feature names" }; throw error;
  }
  if (!selected.length) return;
  const catalog = await db.query("SELECT feature_name FROM plan_features WHERE feature_name = ANY($1::text[])", [selected]);
  if (catalog.rows.length !== new Set(selected).size) {
    const error = new Error("One or more selected features are not in the plan features catalog"); error.status = 400; error.errors = { customFeatures: error.message }; throw error;
  }
};

const datesFor = (value) => {
  const start = parseDate(value.start) || new Date();
  if (value.planKey === "advanced") return { start, end: parseDate(value.end) };
  const dates = calculateSubscriptionDates(value.planKey === "free trial" ? { unit: "days", value: 7 } : { unit: "years", value: 1 }, start);
  return { start: dates.subscription_start_date, end: dates.subscription_end_date };
};
const password = () => crypto.randomBytes(18).toString("base64url");

const erpCreate = async (customer, temporaryPassword, request = fetch) => {
  const base = text(process.env.ERP_BASE_URL).replace(/\/$/, "");
  if (!base || !text(process.env.CRM_ERP_API_KEY)) throw new Error("ERP_BASE_URL and CRM_ERP_API_KEY must be configured");
  const response = await request(`${base}/api/integrations/crm/users`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": process.env.CRM_ERP_API_KEY }, body: JSON.stringify({ crmCustomerId: customer.id, name: customer.customer_name, email: customer.email, phone: customer.phone, companyName: customer.company_name, address: customer.address, city: customer.city, gstNumber: customer.gst_number || "", plan: customer.subscription_plan, startDate: customer.start_date, endDate: customer.renewal_date, customMembers: customer.custom_users, customProjectLimit: customer.custom_projects, customPrice: customer.custom_price, temporaryPassword }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.erpUserId) throw new Error(data.message || `ERP create failed (${response.status})`);
  return { ...data, credentialsAlreadyExist: Boolean(data.credentialsAlreadyExist || data.existingUser || data.idempotent || data.alreadyExists) };
};

const erpResetPassword = async (erpUserId, temporaryPassword, request = fetch) => {
  const base = text(process.env.ERP_BASE_URL).replace(/\/$/, "");
  if (!base || !text(process.env.CRM_ERP_API_KEY)) throw new Error("ERP_BASE_URL and CRM_ERP_API_KEY must be configured");
  const response = await request(`${base}/api/integrations/crm/users/${encodeURIComponent(erpUserId)}/reset-password`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": process.env.CRM_ERP_API_KEY }, body: JSON.stringify({ temporaryPassword }) });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || `ERP password reset failed (${response.status})`); }
};

const createManualCustomer = async ({ db, body, sendCredentials, request = fetch }) => {
  const value = normalizeInput(body); const errors = validate(value);
  if (Object.keys(errors).length) { const e = new Error("Please fix the highlighted fields."); e.status = 400; e.errors = errors; throw e; }
  await validateFeatureSelection(db, value);
  const duplicate = await db.query("SELECT id FROM customers WHERE LOWER(email) = $1 OR regexp_replace(phone, '\\D', '', 'g') = $2 LIMIT 1", [value.email, value.phone]);
  if (duplicate.rows[0]) { const e = new Error("A customer with this email or phone already exists."); e.status = 409; throw e; }
  const { start, end } = datesFor(value); const startDate = dateOnly(start); const endDate = dateOnly(end);
  const inserted = await db.query(`INSERT INTO customers (customer_name, company_name, phone, email, location, subscription_plan, subscription_amount, start_date, renewal_date, subscription_start_date, subscription_end_date, subscription_status, payment_status, custom_users, custom_projects, custom_price, gst_rate, custom_features, sync_status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9::date,$8::date,$9::date,'Subscription Active','Subscription Active',$10,$11,$12,$13,$14,'ERP_PENDING',$15) RETURNING *`, [value.customer_name, value.company_name || null, value.phone, value.email, value.city || null, value.subscription_plan, value.custom_price || 0, startDate, endDate, value.custom_users, value.custom_projects, value.custom_price, value.gst_rate, value.custom_features ? JSON.stringify(value.custom_features) : null, value.notes || null]);
  const customer = inserted.rows[0];
  await db.query("INSERT INTO subscription_history (customer_id, customer_name, plan_name, amount, action_type, start_date, end_date) VALUES ($1,$2,$3,$4,'CREATED',$5::date,$6::date)", [customer.id, customer.customer_name, customer.subscription_plan, customer.custom_price || 0, startDate, endDate]);
  await db.query("INSERT INTO crm_erp_customer_mappings (lead_id, customer_id, status, request_payload) VALUES (NULL,$1,'ERP_PENDING',$2)", [customer.id, JSON.stringify({ source: "manual" })]);
  if (!enabled()) return { customer: { ...customer, sync_status: "ERP_PENDING" }, message: "Saved in CRM. ERP sync is pending because ERP creation is disabled." };
  return syncCustomer({ db, customer, sendCredentials, request });
};

const syncCustomer = async ({ db, customer, sendCredentials, request = fetch }) => {
  if (!enabled()) { const e = new Error("ERP creation is disabled. Enable ERP_CREATE_USER_ENABLED to sync credentials."); e.status = 409; throw e; }
  const temporaryPassword = password();
  try {
    const erp = await erpCreate(customer, temporaryPassword, request);
    await db.query("UPDATE customers SET erp_user_id=$1, erp_customer_id=$2, sync_status='SYNCED', sync_error=NULL, sync_updated_at=NOW() WHERE id=$3", [erp.erpUserId, erp.clientId || null, customer.id]);
    await db.query("UPDATE crm_erp_customer_mappings SET erp_customer_id=$1, status='SYNCED', response_payload=$2, error_payload=NULL, synced_at=NOW(), updated_at=NOW() WHERE customer_id=$3", [erp.clientId || null, JSON.stringify({ erpUserId: erp.erpUserId, clientId: erp.clientId }), customer.id]);
    if (erp.credentialsAlreadyExist) return { customer: { ...customer, erp_user_id: erp.erpUserId, sync_status: "SYNCED" }, message: "ERP user synced; credentials already exist. Use Reset credentials to send a new password." };
    try { await sendCredentials({ ...customer, erp_user_id: erp.erpUserId }, temporaryPassword); }
    catch (error) { await db.query("UPDATE customers SET sync_status='EMAIL_FAILED', sync_error=$1, sync_updated_at=NOW() WHERE id=$2", [safeError(error), customer.id]); return { customer: { ...customer, erp_user_id: erp.erpUserId, sync_status: "EMAIL_FAILED" }, message: "Saved and ERP user created, but credentials email failed." }; }
    return { customer: { ...customer, erp_user_id: erp.erpUserId, sync_status: "SYNCED" }, message: "Saved in CRM, ERP user created, and credentials email sent." };
  } catch (error) { await db.query("UPDATE customers SET sync_status='ERP_FAILED', sync_error=$1, sync_updated_at=NOW() WHERE id=$2", [safeError(error), customer.id]); await db.query("UPDATE crm_erp_customer_mappings SET status='ERP_FAILED', error_payload=$1, updated_at=NOW() WHERE customer_id=$2", [JSON.stringify({ message: safeError(error) }), customer.id]); return { customer: { ...customer, sync_status: "ERP_FAILED" }, message: "Saved in CRM, but ERP user creation failed." }; }
};

module.exports = { createManualCustomer, syncCustomer, normalizeInput, validate, validateFeatureSelection, datesFor, enabled, erpCreate, erpResetPassword, dateOnly };
