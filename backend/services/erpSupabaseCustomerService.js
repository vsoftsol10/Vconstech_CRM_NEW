const dns = require("dns");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

let erpPool;
const getErpConnectionString = () => process.env.ERP_DATABASE_POOLER_URL || process.env.ERP_DATABASE_URL;

const getErpPool = () => {
  const connectionString = getErpConnectionString();
  if (!connectionString) return null;
  if (!erpPool) {
    erpPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
  }
  return erpPool;
};

const formatErpCustomerId = (clientId) =>
  `ERP-CUST-${String(clientId).padStart(6, "0")}`;

const formatErpUserCustomerId = (userId) => `ERP-USER-${userId}`;

const parseErpCustomerId = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^ERP-CUST-(\d+)$/i);
  const parsed = Number.parseInt(match ? match[1] : raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseErpUserId = (value) => {
  const raw = String(value || "").trim();
  return raw.replace(/^ERP-USER-/i, "") || null;
};

const formatDisplayDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const normalizeStatus = (status) => String(status || "").trim().toLowerCase();

const mapErpRowToCustomer = (row) => {
  const renewalDate = row.trialEndDate || null;
  const status = row.subscriptionStatus || row.accountStatus || "";
  const active =
    row.isActive === true ||
    ["trial active", "trial_active", "subscription active", "subscription_active", "active"].includes(
      normalizeStatus(status)
    );
  const customerId = row.erpCustomerId || (row.clientId ? formatErpCustomerId(row.clientId) : formatErpUserCustomerId(row.userId));

  return {
    id: customerId,
    erp_customer_id: customerId,
    erp_client_id: row.clientId || null,
    erp_user_id: row.userId,
    crm_customer_id: row.crmCustomerId || "",
    customer_name: row.userName || row.clientName || "",
    name: row.userName || row.clientName || "",
    company_name: row.companyName || "",
    phone: row.phoneNumber || row.clientPhone || "",
    email: row.userEmail || row.clientEmail || "",
    address: row.userAddress || row.clientAddress || "",
    role: row.userRole || "",
    client_gst: row.clientGST || "",
    channel: "ERP",
    subscription_plan: row.subscriptionPlan || row.package || "",
    subscription_amount: null,
    payment_status: status || (active ? "Active" : "Inactive"),
    payment_method: "",
    assigned_employee: "",
    notes: "",
    reminder_sent: false,
    has_renewed: false,
    active,
    custom_users: row.customMembers || null,
    custom_members: row.customMembers || null,
    custom_projects: row.customProjectLimit || null,
    custom_templates: row.customTemplateLimit || null,
    custom_price: row.customPrice || null,
    members: row.customMembers || null,
    start_date: formatDisplayDate(row.subscriptionStartedAt || row.trialStartDate || row.userCreatedAt),
    renewal_date: formatDisplayDate(renewalDate),
    reminder_sent_date: "",
    created_at: row.userCreatedAt,
    updated_at: row.userUpdatedAt,
  };
};

const baseSelect = `
  SELECT
    u.id AS "userId",
    u.name AS "userName",
    u.email AS "userEmail",
    u."phoneNumber",
    u.role AS "userRole",
    u.address AS "userAddress",
    u."clientId",
    u."erpCustomerId",
    u."crmCustomerId",
    u."subscriptionPlan",
    u.package,
    u."customMembers",
    u."customProjectLimit",
    u."customTemplateLimit",
    u."customPrice",
    u."isActive",
    u."accountStatus",
    u."subscriptionStatus",
    u."trialStartDate",
    u."trialEndDate",
    u."subscriptionStartedAt",
    u."createdAt" AS "userCreatedAt",
    u."updatedAt" AS "userUpdatedAt",
    c."clientName",
    c."companyName",
    c."clientPhone",
    c."clientEmail",
    c."clientAddress",
    c."clientGST",
    c."companyId"
  FROM "User" u
  LEFT JOIN "Client" c ON c.id = u."clientId"
`;

const isConfigured = () => Boolean(getErpConnectionString());

const getCustomers = async (query = {}) => {
  const pool = getErpPool();
  if (!pool) return null;

  const search = String(query.search || "").trim();
  const values = [];
  const where = [];

  if (search) {
    values.push(`%${search}%`);
    where.push(`(
      u.name ILIKE $${values.length}
      OR u.email ILIKE $${values.length}
      OR u."phoneNumber" ILIKE $${values.length}
      OR u."erpCustomerId" ILIKE $${values.length}
      OR u."crmCustomerId" ILIKE $${values.length}
      OR u.id::text ILIKE $${values.length}
      OR
      c."clientName" ILIKE $${values.length}
      OR c."companyName" ILIKE $${values.length}
      OR c."clientPhone" ILIKE $${values.length}
      OR c."clientEmail" ILIKE $${values.length}
    )`);
  }

  const orderColumns = {
    id: 'u."createdAt"',
    name: 'u.name',
    company: 'c."companyName"',
    email: 'u.email',
    phone: 'u."phoneNumber"',
    start_date: 'u."createdAt"',
  };
  const orderColumn = orderColumns[query.sortBy] || 'u."createdAt"';
  const orderDir = String(query.sortDir).toLowerCase() === "desc" ? "DESC" : "ASC";

  const result = await pool.query(
    `${baseSelect}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY ${orderColumn} ${orderDir}`,
    values
  );

  let customers = result.rows.map(mapErpRowToCustomer);

  if (query.status === "active") customers = customers.filter((customer) => customer.active);
  if (query.status === "inactive") customers = customers.filter((customer) => !customer.active);

  const planList = String(query.plans || "")
    .split(",")
    .map((plan) => plan.trim().toLowerCase())
    .filter(Boolean);
  if (planList.length > 0) {
    customers = customers.filter((customer) =>
      planList.includes(String(customer.subscription_plan || "").toLowerCase())
    );
  }

  return { customers };
};

const getCustomer = async (id) => {
  const pool = getErpPool();
  if (!pool) return null;

  const rawId = String(id || "").trim();
  const clientId = parseErpCustomerId(rawId);
  const userId = parseErpUserId(rawId);

  const result = clientId
    ? await pool.query(`${baseSelect} WHERE u."erpCustomerId" = $1 OR u."clientId" = $2`, [formatErpCustomerId(clientId), clientId])
    : await pool.query(`${baseSelect} WHERE u.id = $1`, [userId]);
  return result.rows[0] ? mapErpRowToCustomer(result.rows[0]) : null;
};

const getFirstCompanyId = async (client) => {
  const result = await client.query('SELECT id FROM companies ORDER BY "createdAt" ASC LIMIT 1');
  return result.rows[0]?.id || null;
};

const createErpUser = async (payload = {}, temporaryPassword) => {
  const pool = getErpPool();
  if (!pool) return null;
  if (!temporaryPassword) throw new Error("Generated ERP password is required");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      'SELECT id, "clientId", "erpCustomerId", "crmCustomerId" FROM "User" WHERE "crmCustomerId" = $1 OR LOWER(email) = LOWER($2) LIMIT 1',
      [String(payload.crmCustomerId || ""), payload.email]
    );
    const found = existing.rows[0];
    if (found) {
      if (String(found.crmCustomerId || "") !== String(payload.crmCustomerId || "")) {
        const error = new Error("An ERP user with this email already exists.");
        error.status = 409;
        throw error;
      }
      await client.query("COMMIT");
      return {
        erpUserId: found.id,
        clientId: found.clientId,
        erpCustomerId: found.erpCustomerId,
        credentialsAlreadyExist: true,
      };
    }

    const companyId = payload.companyId || payload.erpCompanyId || (await getFirstCompanyId(client));
    if (!companyId) {
      const error = new Error("No ERP company exists to attach the customer to");
      error.status = 400;
      throw error;
    }

    const clientResult = await client.query(
      `INSERT INTO "Client"
       ("companyId", "clientName", "companyName", "clientPhone", "clientEmail", "clientAddress", "clientGST")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [companyId, payload.name, payload.companyName, payload.phoneNumber, payload.email, payload.address, payload.gstNumber || ""]
    );
    const erpClientId = clientResult.rows[0].id;
    const erpCustomerId = formatErpCustomerId(erpClientId);
    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const startDate = payload.subscriptionStartedAt || payload.startDate || new Date().toISOString();
    const endDate = payload.subscriptionEndDate || payload.endDate || payload.trialEndDate || null;
    const passwordExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await client.query(
      `INSERT INTO "User" (
        id, name, email, password, "companyId", "updatedAt", role, "phoneNumber", city, address,
        package, "customMembers", "gstNumber", "isActive", "accountStatus", "clientId",
        "crmCustomerId", "erpCustomerId", "subscriptionPlan", "subscriptionStartedAt",
        "subscriptionStatus", "trialEndDate", "trialStartDate", "customProjectLimit",
        "customPrice", "mustChangePassword", "passwordExpiresAt", "customTemplateLimit"
      ) VALUES (
        $1,$2,$3,$4,$5,NOW(),$6,$7,$8,$9,$10,$11,$12,TRUE,'ACTIVE',$13,$14,$15,$16,$17,
        'Subscription Active',$18,$17,$19,$20,TRUE,$21,$22
      )`,
      [
        userId,
        payload.name,
        payload.email,
        passwordHash,
        companyId,
        payload.role || "Admin",
        payload.phoneNumber || "",
        payload.city || "",
        payload.address || "",
        payload.package || payload.plan || null,
        payload.customMembers || null,
        payload.gstNumber || "",
        erpClientId,
        String(payload.crmCustomerId || ""),
        erpCustomerId,
        payload.subscriptionPlan || payload.plan || null,
        startDate,
        endDate,
        payload.customProjectLimit || null,
        payload.customPrice ?? null,
        passwordExpiresAt,
        payload.customTemplateLimit || null,
      ]
    );

    await client.query("COMMIT");
    return { erpUserId: userId, clientId: erpClientId, erpCustomerId, credentialsAlreadyExist: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const createCustomer = async (payload = {}) => {
  const pool = getErpPool();
  if (!pool) return null;

  const client = await pool.connect();
  try {
    const companyId = payload.companyId || payload.erpCompanyId || (await getFirstCompanyId(client));
    if (!companyId) {
      const error = new Error("No ERP company exists to attach the customer to");
      error.statusCode = 400;
      throw error;
    }

    const result = await client.query(
      `INSERT INTO "Client"
       ("companyId", "clientName", "companyName", "clientPhone", "clientEmail", "clientAddress", "clientGST")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        companyId,
        payload.customer_name || payload.name || "",
        payload.company_name || payload.company || "",
        payload.phone || "",
        payload.email || "",
        payload.address || "",
        payload.client_gst || payload.clientGST || "",
      ]
    );

    return getCustomer(result.rows[0].id);
  } finally {
    client.release();
  }
};

const updateCustomer = async (id, payload = {}) => {
  const pool = getErpPool();
  if (!pool) return null;

  const rawId = String(id || "").trim();
  const clientId = parseErpCustomerId(rawId);
  const userId = parseErpUserId(rawId);

  if (clientId) {
    await pool.query(
      `UPDATE "User"
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           "phoneNumber" = COALESCE($3, "phoneNumber"),
           "subscriptionPlan" = COALESCE($4, "subscriptionPlan")
       WHERE "erpCustomerId" = $5 OR "clientId" = $6`,
      [
        payload.customer_name || payload.name || null,
        payload.email || null,
        payload.phone || null,
        payload.subscription_plan || null,
        formatErpCustomerId(clientId),
        clientId,
      ]
    );
  } else {
    await pool.query(
      `UPDATE "User"
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           "phoneNumber" = COALESCE($3, "phoneNumber"),
           "subscriptionPlan" = COALESCE($4, "subscriptionPlan")
       WHERE id = $5`,
      [
        payload.customer_name || payload.name || null,
        payload.email || null,
        payload.phone || null,
        payload.subscription_plan || null,
        userId,
      ]
    );
  }

  if (clientId) {
    await pool.query(
      `UPDATE "Client"
       SET "clientName" = COALESCE($1, "clientName"),
           "companyName" = COALESCE($2, "companyName"),
           "clientPhone" = COALESCE($3, "clientPhone"),
           "clientEmail" = COALESCE($4, "clientEmail"),
           "clientAddress" = COALESCE($5, "clientAddress"),
           "clientGST" = COALESCE($6, "clientGST")
       WHERE id = $7`,
      [
        payload.customer_name || payload.name || null,
        payload.company_name || payload.company || null,
        payload.phone || null,
        payload.email || null,
        payload.address || null,
        payload.client_gst || payload.clientGST || null,
        clientId,
      ]
    );
  }

  return getCustomer(id);
};

const updateCustomerStatus = async (id, payload = {}) => {
  const pool = getErpPool();
  if (!pool) return null;

  const rawId = String(id || "").trim();
  const clientId = parseErpCustomerId(rawId);
  const userId = parseErpUserId(rawId);

  if (clientId) {
    await pool.query(
      `UPDATE "User"
       SET "subscriptionStatus" = COALESCE($1, "subscriptionStatus"),
           "accountStatus" = COALESCE($2, "accountStatus"),
           "isActive" = COALESCE($3, "isActive")
       WHERE "erpCustomerId" = $4 OR "clientId" = $5`,
      [
        payload.status || null,
        payload.accountStatus || null,
        typeof payload.isActive === "boolean" ? payload.isActive : null,
        formatErpCustomerId(clientId),
        clientId,
      ]
    );
  } else {
    await pool.query(
      `UPDATE "User"
       SET "subscriptionStatus" = COALESCE($1, "subscriptionStatus"),
           "accountStatus" = COALESCE($2, "accountStatus"),
           "isActive" = COALESCE($3, "isActive")
       WHERE id = $4`,
      [
        payload.status || null,
        payload.accountStatus || null,
        typeof payload.isActive === "boolean" ? payload.isActive : null,
        userId,
      ]
    );
  }

  return getCustomer(id);
};

const deleteCustomer = async (id) => {
  const pool = getErpPool();
  if (!pool) return null;

  const rawId = String(id || "").trim();
  const clientId = parseErpCustomerId(rawId);
  const userId = parseErpUserId(rawId);
  if (!clientId && !userId) return null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userResult = clientId
      ? await client.query('DELETE FROM "User" WHERE "erpCustomerId" = $1 OR "clientId" = $2 RETURNING id', [
          formatErpCustomerId(clientId),
          clientId,
        ])
      : await client.query('DELETE FROM "User" WHERE id = $1 RETURNING id', [userId]);

    let clientResult = { rowCount: 0 };
    if (clientId) {
      clientResult = await client.query('DELETE FROM "Client" WHERE id = $1 RETURNING id', [clientId]);
    }
    await client.query("COMMIT");

    return { success: userResult.rowCount > 0 || clientResult.rowCount > 0 };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  createErpUser,
  createCustomer,
  deleteCustomer,
  getCustomer,
  getCustomers,
  isConfigured,
  updateCustomer,
  updateCustomerStatus,
};
