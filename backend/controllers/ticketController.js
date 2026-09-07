const pool = require("../config/database");
const { createNotification, getTeamMember } = require("../utils/notifications");

const ticketSelect = `
  t.*,
  tm.employee_id,
  tm.name AS employee_name,
  COALESCE(tm.department, t.department) AS department,
  COALESCE(t.state, 'Open') AS state,
  COALESCE(t.urgency, 'Medium') AS urgency,
  COALESCE(t.ticket_type, 'request') AS type
`;

const TICKET_TYPE_CONFIG = {
  incident: "INC",
  request: "REQ",
};

const normalizeTicketType = (value) => {
  const normalized = String(value || "request").trim().toLowerCase();
  if (["incident", "incident ticket"].includes(normalized)) return "incident";
  if (["request", "request ticket"].includes(normalized)) return "request";
  return null;
};

const generateTicketNumber = async (client, ticketType) => {
  const prefix = TICKET_TYPE_CONFIG[ticketType];
  const result = await client.query(
    `INSERT INTO ticket_number_counters (ticket_type, last_number)
     VALUES ($1, 1)
     ON CONFLICT (ticket_type)
     DO UPDATE SET last_number = ticket_number_counters.last_number + 1,
                   updated_at = NOW()
     RETURNING last_number`,
    [ticketType]
  );
  const nextNumber = result.rows[0].last_number;
  return `TIK-${prefix}-${String(nextNumber).padStart(4, "0")}`;
};

const getTicketRow = async (id, client = pool) => {
  const result = await client.query(
    `SELECT ${ticketSelect}
     FROM tickets t
     LEFT JOIN team_members tm ON tm.id = t.assigned_to
     WHERE t.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

const resolveCurrentUserId = async (req) => {
  const id =
    req.body?.created_by ||
    req.body?.updated_by ||
    req.body?.user_id ||
    req.user?.id ||
    null;
  if (!id) return null;
  if (isUuid(id)) return id;

  const member = await getTeamMember(id);
  return member?.id || null;
};

const createStatusHistory = async ({
  client,
  ticketId,
  previousStatus,
  nextStatus,
  createdBy,
  activityType = "STATUS_CHANGED",
  worknotes = null,
}) => {
  await client.query(
    `INSERT INTO ticket_history
     (ticket_id, activity_type, title, "Worknotes", created_by, status_snapshot, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [
      ticketId,
      activityType,
      "Ticket Status Updated",
      worknotes ? String(worknotes).trim() : null,
      createdBy || null,
      nextStatus,
      {
        previous_status: previousStatus || null,
        new_status: nextStatus,
      },
    ]
  );
};

const resolveAssignee = async (assignedTo) => {
  if (!assignedTo) return null;
  return getTeamMember(assignedTo);
};

const validateDepartment = (member, department) => {
  if (!department || !member?.department) return true;
  return member.department.toLowerCase() === department.toLowerCase();
};

const normalizeTicket = (body = {}) => ({
  caller: body.caller || null,
  opened_by: body.opened_by || null,
  location: body.location || null,
  contact_type: body.contact_type || null,
  category: body.category || null,
  company_name: body.company_name || body.company || null,
  ticket_type: normalizeTicketType(body.ticket_type || body.type),
  urgency: body.urgency || "Medium",
  state: body.state || body.status || "Open",
  department: body.department || null,
  assigned_to: body.assigned_to || null,
  short_description: body.short_description || body.description || null,
  notes: body.notes || null,
  due_date: body.due_date || null,
  email: body.email || null,
  thread_id: body.thread_id || null,
  message_id: body.message_id || null,
});

const createTicketRecord = async (body) => {
  const ticket = normalizeTicket(body);

  if (!ticket.caller || !ticket.short_description) {
    const error = new Error("Caller and description are required.");
    error.status = 400;
    throw error;
  }
  if (!ticket.ticket_type) {
    const error = new Error("Ticket type must be either Incident or Request.");
    error.status = 400;
    throw error;
  }

  const assignee = await resolveAssignee(ticket.assigned_to);
  if (ticket.assigned_to && !assignee) {
    const error = new Error("Assigned team member not found.");
    error.status = 404;
    throw error;
  }
  if (assignee && !validateDepartment(assignee, ticket.department)) {
    const error = new Error(`Team member does not belong to ${ticket.department} department.`);
    error.status = 400;
    throw error;
  }

  const openedBy = await resolveAssignee(ticket.opened_by);
  const client = await pool.connect();
  let data;
  try {
    await client.query("BEGIN");
    const ticket_number = await generateTicketNumber(client, ticket.ticket_type);
    const result = await client.query(
      `INSERT INTO tickets
       (ticket_number, ticket_type, caller, opened_by, assigned_to, location, contact_type,
        category, company_name, urgency, state, short_description, notes, due_date, department, email, thread_id, message_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [
        ticket_number,
        ticket.ticket_type,
        ticket.caller,
        openedBy?.id || null,
        assignee?.id || null,
        ticket.location,
        ticket.contact_type,
        ticket.category,
        ticket.company_name,
        ticket.urgency,
        ticket.state,
        ticket.short_description,
        ticket.notes,
        ticket.due_date,
        ticket.department,
        ticket.email,
        ticket.thread_id,
        ticket.message_id,
      ]
    );

    data = await getTicketRow(result.rows[0].id, client);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  if (assignee) {
    await createNotification({
      teamMemberId: assignee.id,
      title: "Ticket assigned",
      message: `${data.ticket_number} has been assigned to you.`,
      type: "ticket_assignment",
      relatedType: "ticket",
      relatedId: data.id,
      link: `/ticket?ticket=${data.id}`,
    });
  }

  return data;
};

const createTicket = async (req, res) => {
  try {
    const data = await createTicketRecord(req.body);
    res.status(201).json({ success: true, message: "Ticket created successfully.", data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

const getAllTickets = async (req, res) => {
  try {
    const { department, state, type, urgency, assigned_to } = req.query;
    const params = [];
    const where = [];

    if (assigned_to) {
      const member = await resolveAssignee(assigned_to);
      if (!member) return res.json({ success: true, data: [] });
      params.push(member.id);
      where.push(`t.assigned_to = $${params.length}`);
    }
    if (department) {
      params.push(department);
      where.push(`LOWER(COALESCE(tm.department, t.department)) = LOWER($${params.length})`);
    }
    if (state) {
      params.push(state);
      where.push(`LOWER(t.state) = LOWER($${params.length})`);
    }
    if (urgency) {
      params.push(urgency);
      where.push(`LOWER(t.urgency) = LOWER($${params.length})`);
    }
    if (type) {
      const ticketType = normalizeTicketType(type);
      if (!ticketType) return res.json({ success: true, data: [] });
      params.push(ticketType);
      where.push(`LOWER(COALESCE(t.ticket_type, 'request')) = LOWER($${params.length})`);
    }

    const result = await pool.query(
      `SELECT ${ticketSelect}
       FROM tickets t
       LEFT JOIN team_members tm ON tm.id = t.assigned_to
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY t.created_at DESC NULLS LAST, t.ticket_number DESC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getTicketById = async (req, res) => {
  try {
    const data = await getTicketRow(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: "Ticket not found." });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getTicketsByDepartment = async (req, res) => {
  req.query.department = req.params.department;
  return getAllTickets(req, res);
};

const updateTicket = async (req, res) => {
  try {
    const existing = await getTicketRow(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "Ticket not found." });

    const ticket = normalizeTicket({ ...existing, ...req.body });
    const assignee = await resolveAssignee(ticket.assigned_to);
    if (ticket.assigned_to && !assignee) {
      return res.status(404).json({ success: false, error: "Assigned team member not found." });
    }
    if (assignee && !validateDepartment(assignee, ticket.department)) {
      return res.status(400).json({
        success: false,
        error: `Team member does not belong to ${ticket.department} department.`,
      });
    }

    const client = await pool.connect();
    let data;
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE tickets
         SET caller=$1, assigned_to=$2, location=$3, contact_type=$4,
             category=$5, company_name=$6, urgency=$7, state=$8, short_description=$9,
             notes=$10, due_date=$11, department=$12, updated_at=NOW()
         WHERE id=$13`,
        [
          ticket.caller,
          assignee?.id || null,
          ticket.location,
          ticket.contact_type,
          ticket.category,
          ticket.company_name,
          ticket.urgency,
          ticket.state,
          ticket.short_description,
          ticket.notes,
          ticket.due_date,
          ticket.department,
          req.params.id,
        ]
      );

      if (existing.state !== ticket.state) {
        await createStatusHistory({
          client,
          ticketId: req.params.id,
          previousStatus: existing.state,
          nextStatus: ticket.state,
          createdBy: await resolveCurrentUserId(req),
        });
      }

      data = await getTicketRow(req.params.id, client);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    if (assignee && String(existing.assigned_to) !== String(assignee.id)) {
      await createNotification({
        teamMemberId: assignee.id,
        title: "Ticket assigned",
        message: `${data.ticket_number} has been assigned to you.`,
        type: "ticket_assignment",
        relatedType: "ticket",
        relatedId: data.id,
        link: `/ticket?ticket=${data.id}`,
      });
    }

    res.json({ success: true, message: "Ticket updated successfully.", data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateTicketStatus = async (req, res) => {
  try {
    const { state, status, Worknotes, worknotes } = req.body;
    const nextState = state || status;
    const historyActivityType = req.body?.history_activity_type || "STATUS_CHANGED";
    const shouldCreateHistory = beforeState =>
      beforeState !== nextState || historyActivityType === "STATUS_UPDATED";
    if (!nextState) return res.status(400).json({ success: false, error: "Status is required." });

    const before = await getTicketRow(req.params.id);
    if (!before) return res.status(404).json({ success: false, error: "Ticket not found." });

    const client = await pool.connect();
    let data;
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE tickets
         SET state = $1::varchar,
             resolved_at = CASE WHEN $1::text = 'Resolved' THEN COALESCE(resolved_at, NOW()) ELSE resolved_at END,
             updated_at = NOW()
         WHERE id = $2`,
        [nextState, req.params.id]
      );

      if (shouldCreateHistory(before.state)) {
        await createStatusHistory({
          client,
          ticketId: req.params.id,
          previousStatus: before.state,
          nextStatus: nextState,
          createdBy: await resolveCurrentUserId(req),
          activityType: historyActivityType,
          worknotes: Worknotes ?? worknotes,
        });
      }

      data = await getTicketRow(req.params.id, client);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    if (data.assigned_to && before.state !== nextState) {
      await createNotification({
        teamMemberId: data.assigned_to,
        title: "Ticket status changed",
        message: `${data.ticket_number} is now ${nextState}.`,
        type: "ticket_status",
        relatedType: "ticket",
        relatedId: data.id,
        link: `/ticket?ticket=${data.id}`,
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const resolveTicket = async (req, res) => {
  req.body.state = "Resolved";
  return updateTicketStatus(req, res);
};

const assignTicket = async (req, res) => {
  try {
    const { department, assigned_to } = req.body;
    if (!assigned_to) return res.status(400).json({ success: false, error: "assigned_to is required." });

    const assignee = await resolveAssignee(assigned_to);
    if (!assignee) return res.status(404).json({ success: false, error: "Team member not found." });
    if (!validateDepartment(assignee, department)) {
      return res.status(400).json({
        success: false,
        error: `Team member does not belong to ${department} department.`,
      });
    }

    await pool.query(
      `UPDATE tickets
       SET assigned_to=$1, state='In Progress', updated_at=NOW()
       WHERE id=$2`,
      [assignee.id, req.params.id]
    );

    const data = await getTicketRow(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: "Ticket not found." });

    await createNotification({
      teamMemberId: assignee.id,
      title: "Ticket assigned",
      message: `${data.ticket_number} has been assigned to you.`,
      type: "ticket_assignment",
      relatedType: "ticket",
      relatedId: data.id,
      link: `/ticket?ticket=${data.id}`,
    });

    res.json({ success: true, message: "Ticket assigned successfully.", data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteTicket = async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM tickets WHERE id = $1 RETURNING id", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: "Ticket not found." });
    res.json({ success: true, message: "Ticket deleted successfully." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getTicketHistory = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         h.*,
         tm.name AS created_by_name,
         tm.employee_id AS created_by_employee_id
       FROM ticket_history h
       LEFT JOIN team_members tm ON tm.id = h.created_by
       WHERE h.ticket_id = $1
       ORDER BY h.created_at ASC`,
      [req.params.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const createTicketHistory = async (req, res) => {
  try {
    const {
      activity_type,
      title,
      Worknotes,
      worknotes,
      created_by,
      sender,
      receiver,
      follow_up_date,
      follow_up_time,
      reminder = true,
      attachment_url,
      status_snapshot,
      metadata = {},
    } = req.body || {};

    const notes = Worknotes ?? worknotes;
    if (!activity_type) {
      return res.status(400).json({ success: false, error: "activity_type is required." });
    }
    if (!notes || !String(notes).trim()) {
      return res.status(400).json({ success: false, error: "Worknotes is required." });
    }

    const result = await pool.query(
      `INSERT INTO ticket_history
       (ticket_id, activity_type, title, "Worknotes", created_by, sender, receiver,
        follow_up_date, follow_up_time, reminder, attachment_url, status_snapshot, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        req.params.id,
        activity_type,
        title || null,
        String(notes).trim(),
        created_by || null,
        sender || null,
        receiver || null,
        follow_up_date || null,
        follow_up_time || null,
        reminder !== false,
        attachment_url || null,
        status_snapshot || null,
        metadata && typeof metadata === "object" ? metadata : {},
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getTicketStats = async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE state = 'Open')::int AS open,
        COUNT(*) FILTER (WHERE state = 'In Progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE state = 'Resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE state = 'Closed')::int AS closed
      FROM tickets
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  assignTicket,
  createTicket,
  createTicketRecord,
  deleteTicket,
  getAllTickets,
  getTicketById,
  getTicketHistory,
  getTicketStats,
  getTicketsByDepartment,
  createTicketHistory,
  resolveTicket,
  updateTicket,
  updateTicketStatus,
};
