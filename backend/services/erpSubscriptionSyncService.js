const enabled = () => String(process.env.ERP_CREATE_USER_ENABLED || "false").toLowerCase() === "true";
const date = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value || "").slice(0, 10);
const advanced = (plan) => String(plan || "").trim().toLowerCase() === "advanced";

const buildPayload = (customer) => {
  const payload = { crmCustomerId: customer.id, plan: customer.subscription_plan, startDate: date(customer.subscription_start_date || customer.start_date), trialEndDate: date(customer.subscription_end_date || customer.renewal_date) };
  if (advanced(customer.subscription_plan)) Object.assign(payload, { customMembers: customer.custom_users, customProjectLimit: customer.custom_projects, customTemplateLimit: customer.custom_templates, customPrice: customer.custom_price });
  return payload;
};

const syncSubscription = async ({ db, customer, request = fetch }) => {
  if (!enabled()) return { skipped: true, reason: "ERP sync is disabled." };
  if (!customer.erp_user_id) return { skipped: true, reason: "Customer has no ERP user; ERP sync was skipped." };
  const base = String(process.env.ERP_BASE_URL || "").replace(/\/$/, "");
  try {
    if (!base || !process.env.CRM_ERP_API_KEY) throw new Error("ERP_BASE_URL and CRM_ERP_API_KEY must be configured");
    const response = await request(`${base}/api/integrations/crm/users/${encodeURIComponent(customer.erp_user_id)}/subscription`, { method: "PUT", headers: { "Content-Type": "application/json", "x-api-key": process.env.CRM_ERP_API_KEY }, body: JSON.stringify(buildPayload(customer)) });
    if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.message || `ERP subscription sync failed (${response.status})`); }
    await db.query("UPDATE customers SET sync_status='SYNCED', sync_error=NULL, sync_updated_at=NOW() WHERE id=$1", [customer.id]);
    return { synced: true };
  } catch (error) {
    const message = String(error.message || "ERP subscription sync failed").slice(0, 500);
    await db.query("UPDATE customers SET sync_status='ERP_FAILED', sync_error=$1, sync_updated_at=NOW() WHERE id=$2", [message, customer.id]);
    return { failed: true, reason: message };
  }
};
module.exports = { buildPayload, syncSubscription, enabled };
