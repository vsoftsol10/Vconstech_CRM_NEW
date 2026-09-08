const pool = require("../config/database");
const { createWorkHistoryEntry, getReminderFields } = require("../services/reminderService");
const { createLeadUpdateEntry } = require("./leadWorkHistoryController");
const { createNotification } = require("../utils/notifications");

const getActor = (req) => req.user?.employee_id || req.user?.id || null;

const sendError = (res, err, fallback) => {
  const status = err.status || 500;
  res.status(status).json({ success: false, message: status >= 500 ? fallback : err.message });
};

const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PHONE_PATTERN = /^[6-9]\d{9}$/;

const normalizeText = (value) => String(value || "").trim();
const normalizeEmail = (value) => normalizeText(value).toLowerCase();
const normalizePhone = (value) => normalizeText(value).replace(/\D/g, "");
const todayInput = () => new Date().toISOString().split("T")[0];
const normalizeStatus = (value) => normalizeText(value).toLowerCase().replace(/\s+/g, " ");

const ACTIVE_DUPLICATE_STATUSES = new Set([
  "new",
  "open",
  "contacted",
  "in progress",
  "follow up",
  "demo scheduled",
]);

const REOPEN_AS_NEW_LEAD_STATUSES = new Set(["won", "converted", "closed"]);
const ALREADY_CUSTOMER_DUPLICATE_STATUSES = new Set(["won", "converted"]);
const OPTIONAL_DUPLICATE_TIMESTAMP_COLUMNS = ["updated_at", "last_contacted_at", "last_demo_requested_at"];
const OPTIONAL_PREVIOUS_LEAD_COLUMNS = ["previous_lead_id", "parent_lead_id", "source_lead_id", "related_lead_id"];
const WORK_HISTORY_TITLE = "Website Demo Requested Again";
const WORK_HISTORY_NOTE_PREFIX = "Customer submitted another demo request from the Vconstech website.";
const LEAD_UPDATE_NOTE = "Customer requested another demo.";
let leadsColumnCache = null;

const validateLeadPayload = (body) => {
  const values = {
    fullName: normalizeText(body.fullName),
    company: normalizeText(body.company),
    channel: body.channel?.value || body.channel || null,
    status: body.status?.value || body.status || null,
    phone: normalizePhone(body.phone),
    email: normalizeEmail(body.email),
    date: normalizeText(body.date),
    plan: body.plan?.value || body.plan || null,
    address: normalizeText(body.address),
    location: normalizeText(body.location),
    requirements: normalizeText(body.requirements),
    assignedTo: body.assignedTo?.value || body.assignedTo || null,
  };
  const errors = {};

  if (!values.fullName) errors.fullName = "Full name is required";
  else if (values.fullName.length < 3) errors.fullName = "Name must be at least 3 characters";
  if (!values.company) errors.company = "Company is required";
  if (!values.phone) errors.phone = "Phone is required";
  else if (!PHONE_PATTERN.test(values.phone)) errors.phone = "Enter a valid 10-digit mobile number";
  if (!values.email) errors.email = "Email is required";
  else if (!EMAIL_PATTERN.test(values.email)) errors.email = "Enter a valid email address";
  if (!values.status) errors.status = "Status is required";
  if (values.status !== "new" && !values.plan) errors.plan = "Plan is required";
  if (!values.channel) errors.channel = "Channel is required";
  if (!values.date) errors.date = "Date is required";
  else if (Number.isNaN(new Date(values.date).getTime())) errors.date = "Enter a valid date";
  else if (values.date > todayInput()) errors.date = "Lead date cannot be in the future";
  if (values.requirements && values.requirements.length < 10) {
    errors.requirements = "Requirements should be at least 10 characters";
  }

  return { values, errors };
};

const sendValidationError = (res, errors) =>
  res.status(400).json({ success: false, message: "Please fix the highlighted fields.", errors });

const findLeadDuplicate = async ({ email, phone, excludeId = null }) => {
  const params = [email, phone];
  let query = `
    SELECT
      l.*,
      l.follow_up_date::text AS follow_up_date_text,
      l.follow_up_time::text AS follow_up_time_text,
      EXISTS (SELECT 1 FROM customers c WHERE c.lead_id = l.id) AS has_customer
    FROM leads l
    WHERE (LOWER(l.email) = $1 OR regexp_replace(l.phone, '\\D', '', 'g') = $2)
  `;
  if (excludeId) {
    params.push(excludeId);
    query += " AND l.id <> $3";
  }
  query += " ORDER BY l.created_at DESC NULLS LAST, l.id DESC LIMIT 1";
  const result = await pool.query(query, params);
  return result.rows[0] || null;
};

const getLeadsColumns = async (db) => {
  if (leadsColumnCache) return leadsColumnCache;

  const result = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'leads'`
  );
  leadsColumnCache = new Set(result.rows.map((row) => row.column_name));
  return leadsColumnCache;
};

const buildDuplicateWorkNote = ({ channel, requirements }) => {
  const submittedAt = new Date();
  const lines = [
    WORK_HISTORY_NOTE_PREFIX,
    "",
    `Date: ${submittedAt.toISOString().split("T")[0]}`,
    `Time: ${submittedAt.toTimeString().slice(0, 8)}`,
    `Channel: ${channel || "Website"}`,
  ];

  if (requirements) {
    lines.push(`Requirements: ${requirements}`);
  }

  return lines.join("\n");
};

const insertLead = async (db, values, reminderFields, options = {}) => {
  const columns = [
    "full_name",
    "company",
    "channel",
    "status",
    "phone",
    "email",
    "lead_date",
    "plan",
    "requirements",
    "assigned_to",
    "address",
    "location",
    "follow_up_date",
    "follow_up_time",
    "reminder_enabled",
  ];
  const params = [
    values.fullName,
    values.company,
    values.channel,
    values.status,
    values.phone,
    values.email,
    values.date || null,
    values.plan,
    values.requirements || null,
    values.assignedTo,
    values.address || null,
    values.location || null,
    reminderFields.followUpDate || null,
    reminderFields.followUpTime || null,
    reminderFields.reminderEnabled,
  ];

  if (options.previousLeadId) {
    const leadColumns = await getLeadsColumns(db);
    const relationshipColumn = OPTIONAL_PREVIOUS_LEAD_COLUMNS.find((column) => leadColumns.has(column));
    if (relationshipColumn) {
      columns.push(relationshipColumn);
      params.push(options.previousLeadId);
    }
  }

  const placeholders = params.map((_, index) => `$${index + 1}`).join(",");
  const result = await db.query(
    `INSERT INTO leads
     (${columns.join(", ")})
     VALUES (${placeholders})
     RETURNING *`,
    params
  );

  return result.rows[0];
};

const updateDuplicateTimestamps = async (db, leadId) => {
  const columns = await getLeadsColumns(db);
  const timestampColumns = OPTIONAL_DUPLICATE_TIMESTAMP_COLUMNS.filter((column) => columns.has(column));
  if (!timestampColumns.length) return null;

  const assignments = timestampColumns.map((column) => `${column} = NOW()`).join(", ");
  const result = await db.query(
    `UPDATE leads
     SET ${assignments}
     WHERE id = $1
     RETURNING *`,
    [leadId]
  );

  return result.rows[0] || null;
};

const handleActiveDuplicateLead = async ({ duplicate, values, req }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lockedResult = await client.query(
      `SELECT
         l.*,
         l.follow_up_date::text AS follow_up_date_text,
         l.follow_up_time::text AS follow_up_time_text,
         EXISTS (SELECT 1 FROM customers c WHERE c.lead_id = l.id) AS has_customer
       FROM leads l
       WHERE l.id = $1
       FOR UPDATE`,
      [duplicate.id]
    );
    const lead = lockedResult.rows[0];

    if (!lead) {
      const error = new Error("Lead not found while updating duplicate request.");
      error.status = 404;
      throw error;
    }

    const note = buildDuplicateWorkNote(values);
    const reminderEnabled = Boolean(
      lead.reminder_enabled && lead.follow_up_date_text && lead.follow_up_time_text
    );
    const history = await createWorkHistoryEntry(client, {
      leadId: lead.id,
      stage: lead.status,
      note,
      followUpDate: lead.follow_up_date_text,
      followUpTime: lead.follow_up_time_text,
      reminder: reminderEnabled,
      createdBy: getActor(req),
      insertGeneralHistory: true,
      activityType: "Website Demo Request",
      title: WORK_HISTORY_TITLE,
    });

    const leadUpdate = await createLeadUpdateEntry(client, {
      leadId: lead.id,
      stage: lead.status,
      note: LEAD_UPDATE_NOTE,
      followUpDate: lead.follow_up_date_text,
      followUpTime: lead.follow_up_time_text,
      reminder: reminderEnabled,
    });

    const updatedLead = (await updateDuplicateTimestamps(client, lead.id)) || lead;

    await client.query("COMMIT");

    let notification = null;
    if (lead.assigned_to) {
      notification = await createNotification({
        teamMemberId: lead.assigned_to,
        title: `${lead.full_name || values.fullName || "Customer"} requested another website demo.`,
        message: `${lead.full_name || values.fullName || "Customer"} requested another website demo.`,
        type: "lead_duplicate_demo_request",
        relatedType: "lead",
        relatedId: String(lead.id),
        link: `/leads/${lead.id}`,
      });
    }

    return { lead: updatedLead, history, leadUpdate, notification };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Duplicate lead transaction rollback failed:", rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
};

// ── POST create lead ────────────────────────────────────────────────────────
const createLeadRecord = async (body, options = {}) => {
  const req = options.req || { body, user: options.user || null };
  const { values, errors } = validateLeadPayload(body);
  if (Object.keys(errors).length > 0) {
    const error = new Error("Please fix the highlighted fields.");
    error.status = 400;
    error.errors = errors;
    throw error;
  }

  const { followUpDate, followUpTime, reminderEnabled } = getReminderFields(body);
  const duplicate = await findLeadDuplicate(values);
  let createStatus = 201;
  let previousLeadId = null;
  if (duplicate) {
    const duplicateStatus = normalizeStatus(duplicate.status);
    const alreadyCustomerDuplicate =
      duplicate.has_customer === true || ALREADY_CUSTOMER_DUPLICATE_STATUSES.has(duplicateStatus);
    const isActiveDuplicate = ACTIVE_DUPLICATE_STATUSES.has(duplicateStatus);
    const shouldCreateNewLead =
      !isActiveDuplicate &&
      !alreadyCustomerDuplicate &&
      REOPEN_AS_NEW_LEAD_STATUSES.has(duplicateStatus);

    if (alreadyCustomerDuplicate) {
      return {
        statusCode: 200,
        body: {
          success: true,
          alreadyCustomer: true,
          leadId: duplicate.id,
          message: "You are already a Vconstech customer.",
        },
      };
    }

    if (isActiveDuplicate) {
      await handleActiveDuplicateLead({ duplicate, values, req });

      return {
        statusCode: 200,
        body: {
          success: true,
          duplicate: true,
          leadId: duplicate.id,
          message: "Existing lead updated successfully.",
        },
      };
    }

    if (!shouldCreateNewLead) {
      const error = new Error("Duplicate lead found.");
      error.status = 409;
      error.body = {
        emailExists: normalizeEmail(duplicate.email) === values.email,
        phoneExists: normalizePhone(duplicate.phone) === values.phone,
      };
      throw error;
    }

    createStatus = 200;
    previousLeadId = duplicate.id;
  }

  const lead = await insertLead(
    pool,
    values,
    { followUpDate, followUpTime, reminderEnabled },
    { previousLeadId }
  );

  return { statusCode: createStatus, body: { success: true, lead } };
};

const createLead = async (req, res) => {
  try {
    const result = await createLeadRecord(req.body, { req });
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    if (err.errors) return sendValidationError(res, err.errors);
    if (err.status === 409 && err.body) return res.status(409).json(err.body);
    console.log(err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET all leads ───────────────────────────────────────────────────────────
const getAllLeads = async (req, res) => {
  try {
    const { assigned_to } = req.query;
    const params = [];

    let whereClause = "";

    if (assigned_to) {
      // assigned_to could be:
      //   1. a numeric team_members.id  → use directly
      //   2. an employee_id string like "EMP-001" → resolve to team_members.id first
      const isNumeric = /^\d+$/.test(String(assigned_to).trim());

      if (isNumeric) {
        params.push(Number(assigned_to));
        whereClause = "WHERE l.assigned_to = $1";
      } else {
        // Resolve employee_id → team_members.id
        const memberRes = await pool.query(
          `SELECT id FROM team_members WHERE employee_id = $1 LIMIT 1`,
          [assigned_to]
        );
        if (memberRes.rows.length === 0) {
          // No matching member → return empty list, not an error
          return res.json([]);
        }
        params.push(memberRes.rows[0].id);
        whereClause = "WHERE l.assigned_to = $1";
      }
    }

    const query = `
      SELECT
        l.*,
        assignment_lookup.employee_id AS assigned_employee_id,
        customer_lookup.id AS customer_id,
        customer_lookup.erp_customer_id,
        customer_lookup.id IS NOT NULL AS is_customer
      FROM leads l
      LEFT JOIN LATERAL (
        SELECT tm.employee_id
        FROM team_members tm
        WHERE tm.id::text = l.assigned_to::text
           OR tm.employee_id::text = l.assigned_to::text
        ORDER BY CASE WHEN tm.id::text = l.assigned_to::text THEN 0 ELSE 1 END
        LIMIT 1
      ) assignment_lookup ON true
      LEFT JOIN LATERAL (
        SELECT c.id, c.erp_customer_id
        FROM customers c
        WHERE c.lead_id = l.id
        ORDER BY c.id DESC
        LIMIT 1
      ) customer_lookup ON true
      ${whereClause}
      ORDER BY l.created_at DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET single lead ─────────────────────────────────────────────────────────
const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
        l.*,
        assignment_lookup.employee_id AS assigned_employee_id,
        customer_lookup.id AS customer_id,
        customer_lookup.erp_customer_id,
        customer_lookup.id IS NOT NULL AS is_customer
       FROM leads l
       LEFT JOIN LATERAL (
         SELECT tm.employee_id
         FROM team_members tm
         WHERE tm.id::text = l.assigned_to::text
            OR tm.employee_id::text = l.assigned_to::text
         ORDER BY CASE WHEN tm.id::text = l.assigned_to::text THEN 0 ELSE 1 END
         LIMIT 1
       ) assignment_lookup ON true
       LEFT JOIN LATERAL (
         SELECT c.id, c.erp_customer_id
         FROM customers c
         WHERE c.lead_id = l.id
         ORDER BY c.id DESC
         LIMIT 1
       ) customer_lookup ON true
       WHERE l.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Lead not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT update lead ─────────────────────────────────────────────────────────
const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { values, errors } = validateLeadPayload(req.body);
    if (Object.keys(errors).length > 0) return sendValidationError(res, errors);
    const { followUpDate, followUpTime, reminderEnabled } = getReminderFields(req.body);

    const converted = await pool.query(
      "SELECT 1 FROM customers WHERE lead_id = $1 LIMIT 1",
      [id]
    );

    if (converted.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "This lead has already been converted to a customer and cannot be edited.",
      });
    }

    const duplicate = await findLeadDuplicate({ ...values, excludeId: id });
    if (duplicate) {
      return res.status(409).json({
        emailExists: normalizeEmail(duplicate.email) === values.email,
        phoneExists: normalizePhone(duplicate.phone) === values.phone,
      });
    }

    const result = await pool.query(
      `UPDATE leads
       SET full_name=$1, company=$2, channel=$3, status=$4,
           phone=$5, email=$6, lead_date=$7, plan=$8,
           requirements=$9, assigned_to=$10,
           address=$11,
           location=$12,
           follow_up_date=$13,
           follow_up_time=$14,
           reminder_enabled=$15,
           follow_up_reminder_sent_at = CASE
             WHEN follow_up_date IS DISTINCT FROM $13::date
               OR follow_up_time IS DISTINCT FROM $14::time
               OR reminder_enabled IS DISTINCT FROM $15::boolean
             THEN NULL
             ELSE follow_up_reminder_sent_at
           END,
           follow_up_reminder_sent_for_date = CASE
             WHEN follow_up_date IS DISTINCT FROM $13::date
               OR follow_up_time IS DISTINCT FROM $14::time
               OR reminder_enabled IS DISTINCT FROM $15::boolean
             THEN NULL
             ELSE follow_up_reminder_sent_for_date
           END
       WHERE id=$16
       RETURNING *`,
      [
        values.fullName,
        values.company,
        values.channel,
        values.status,
        values.phone,
        values.email,
        values.date || null,
        values.plan,
        values.requirements || null,
        values.assignedTo,
        values.address || null,
        values.location || null,
        followUpDate || null,
        followUpTime || null,
        reminderEnabled,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Lead not found" });
    }

    res.json({ success: true, lead: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE lead ─────────────────────────────────────────────────────────────
const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM leads WHERE id = $1", [id]);
    res.json({ success: true, message: "Lead deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
};

module.exports = {
  createLead,
  createLeadRecord,
  getAllLeads,
  getLeadById,
  updateLead,
  deleteLead,
};
