// const bcrypt = require("bcrypt");
const bcrypt = require('bcryptjs');

const pool = require("../config/database");
const { generateEmployeeId, generatePassword } = require("../utils/validators");

const ALLOWED_DEPARTMENTS = ["Sales", "Marketing", "Technical", "Support", "Admin"];
const SALES_CHART_COLORS = ["#F5C518", "#2ECC71", "#3B82F6", "#8B5CF6", "#F97316", "#14B8A6"];

const normalizeValue = (value) =>
  typeof value === "string" ? value.trim() : value;

const normalizeOptionalValue = (value) => {
  const normalized = normalizeValue(value);
  return normalized === "" ? null : normalized ?? null;
};

const memberSelect = `
  id,
  name,
  email,
  phone,
  role,
  department,
  'Active'::text AS status,
  profile_image AS avatar_url,
  date_joined AS joined_date,
  created_at
`;

const formatCount = (value) => Number(value || 0).toLocaleString("en-IN");

const getPublicBaseUrl = (req) =>
  (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`)
    .trim()
    .replace(/\/$/, "");

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfWeek = () => {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  date.setHours(0, 0, 0, 0);
  return date;
};

const normalizeSource = (task = {}) => {
  const text = `${task.title || ""} ${task.description || ""}`.toLowerCase();
  if (text.includes("whatsapp")) return "whatsapp";
  if (text.includes("instagram")) return "instagram";
  if (text.includes("call") || text.includes("phone")) return "call";
  return "email";
};

const formatTaskTime = (dueDate) => {
  if (!dueDate) return "Today";
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return "Today";

  const hasTime =
    parsed.getHours() !== 0 ||
    parsed.getMinutes() !== 0 ||
    String(dueDate).includes("T");

  if (!hasTime) return "Today";

  return parsed.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const isPendingTask = (status) =>
  !["completed", "done", "closed"].includes(String(status || "").toLowerCase());

const isDueToday = (dueDate) => {
  if (!dueDate) return false;
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const parsed = new Date(dueDate);
  return !Number.isNaN(parsed.getTime()) && parsed >= today && parsed < tomorrow;
};

const mapSalesTask = (task, memberId = null) => ({
  id: task.id,
  memberId,
  title: task.title || "Sales task",
  person: task.employee_name || "Sales member",
  source: normalizeSource(task),
  priority: task.priority || "Medium",
  time: formatTaskTime(task.due_date),
  done: false,
});

const getDepartmentCounts = async () => {
  const result = await pool.query(
    `SELECT department, COUNT(*)::int AS member_count
     FROM team_members
     WHERE department = ANY($1)
     GROUP BY department`,
    [ALLOWED_DEPARTMENTS]
  );

  return ALLOWED_DEPARTMENTS.map((name) => {
    const row = result.rows.find((item) => item.department === name);
    return {
      name,
      member_count: row?.member_count || 0,
      subtitle: "Total members",
      badge: "0%",
      badge_type: "up",
    };
  });
};

const getDepartmentStats = async (_req, res) => {
  try {
    const data = await getDepartmentCounts();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getDepartmentPerformance = async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month, week } = req.query;
    const params = [Number(year)];
    const filters = ["EXTRACT(YEAR FROM t.created_at)::int = $1"];

    if (month) {
      params.push(Number(month));
      filters.push(`EXTRACT(MONTH FROM t.created_at)::int = $${params.length}`);
    }

    if (week === "true") {
      filters.push("t.created_at >= NOW() - INTERVAL '7 days'");
    }

    const result = await pool.query(
      `SELECT
         EXTRACT(MONTH FROM t.created_at)::int AS month,
         ROUND(
           100.0 * COUNT(*) FILTER (WHERE LOWER(COALESCE(t.state, '')) IN ('resolved', 'closed'))
           / NULLIF(COUNT(*), 0)
         )::int AS value
       FROM tickets t
       LEFT JOIN team_members tm ON tm.id = t.assigned_to
       WHERE ${filters.join(" AND ")}
       GROUP BY EXTRACT(MONTH FROM t.created_at)
       ORDER BY month`,
      params
    );

    res.status(200).json({
      success: true,
      data: result.rows.map((row) => ({
        department_name: "All Departments",
        year: Number(year),
        month: row.month,
        value: row.value || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getDepartmentPerformanceYears = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT EXTRACT(YEAR FROM created_at)::int AS year
       FROM tickets
       WHERE created_at IS NOT NULL
       ORDER BY year DESC`
    );

    const currentYear = new Date().getFullYear();
    const years = result.rows.map((row) => row.year).filter(Boolean);
    if (!years.includes(currentYear)) years.unshift(currentYear);

    res.status(200).json({ success: true, data: years });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getDepartmentHealth = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         d.department_name,
         COUNT(DISTINCT tm.id)::int AS members,
         COUNT(DISTINCT tk.id) FILTER (WHERE LOWER(COALESCE(tk.state, 'open')) NOT IN ('resolved', 'closed'))::int AS open_tickets,
         COUNT(DISTINCT ta.id) FILTER (WHERE LOWER(COALESCE(ta.status, 'open')) NOT IN ('completed', 'done', 'closed'))::int AS open_tasks
       FROM unnest($1::text[]) AS d(department_name)
       LEFT JOIN team_members tm ON tm.department = d.department_name
       LEFT JOIN tickets tk ON tk.assigned_to = tm.id
       LEFT JOIN tasks ta ON ta.assigned_to = tm.employee_id
       GROUP BY d.department_name
       ORDER BY d.department_name`,
      [ALLOWED_DEPARTMENTS]
    );

    const data = result.rows.map((row) => {
      const workload = Number(row.open_tickets || 0) + Number(row.open_tasks || 0);
      const members = Number(row.members || 0);
      const percentage = members === 0 ? 0 : Math.min(100, Math.round(100 - (workload / (members * 8)) * 100));
      const status = percentage >= 70 ? "On Track" : percentage >= 40 ? "Need Attention" : "High Workload";

      return {
        department_name: row.department_name,
        percentage,
        status,
        status_label: `${workload} open work items`,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getAllDepartmentMembers = async (req, res) => {
  try {
    const { department, search } = req.query;
    const params = [];
    const where = [];

    if (department) {
      params.push(department);
      where.push(`department = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR role ILIKE $${params.length})`);
    }

    const result = await pool.query(
      `SELECT ${memberSelect}
       FROM team_members
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY created_at DESC NULLS LAST`,
      params
    );

    res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getDepartmentMemberById = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${memberSelect} FROM team_members WHERE id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: "Department member not found." });
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const createDepartmentMember = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      role,
      department,
      designation,
      joined_date,
    } = req.body;

    if (!normalizeOptionalValue(name) || !normalizeOptionalValue(email) || !normalizeOptionalValue(role)) {
      return res.status(400).json({ success: false, error: "Name, email, and role are required." });
    }

    if (!ALLOWED_DEPARTMENTS.includes(department)) {
      return res.status(400).json({
        success: false,
        error: "Invalid department. Must be Sales, Marketing, Technical, Support, or Admin.",
      });
    }

    const existing = await pool.query("SELECT id FROM team_members WHERE email = $1", [normalizeValue(email)]);
    if (existing.rows.length) {
      return res.status(409).json({ success: false, error: "A member with this email already exists." });
    }

    const employeeId = await generateEmployeeId(pool, department);
    const password = await bcrypt.hash(generatePassword(), 10);

    const result = await pool.query(
      `INSERT INTO team_members
       (name, email, phone, role, department, designation, employee_id, date_joined, password)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING ${memberSelect}`,
      [
        normalizeValue(name),
        normalizeValue(email),
        normalizeOptionalValue(phone),
        normalizeValue(role),
        normalizeValue(department),
        normalizeOptionalValue(designation) || normalizeValue(role),
        normalizeValue(employeeId),
        normalizeOptionalValue(joined_date),
        password,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateDepartmentMember = async (req, res) => {
  try {
    const existing = await pool.query("SELECT id FROM team_members WHERE id = $1", [req.params.id]);
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: "Department member not found." });
    }

    const {
      name,
      email,
      phone,
      role,
      department,
      designation,
      joined_date,
    } = req.body;

    if (department && !ALLOWED_DEPARTMENTS.includes(department)) {
      return res.status(400).json({ success: false, error: "Invalid department." });
    }

    const result = await pool.query(
      `UPDATE team_members
       SET
         name = COALESCE($1, name),
         email = COALESCE($2, email),
         phone = COALESCE($3, phone),
         role = COALESCE($4, role),
         department = COALESCE($5, department),
         designation = COALESCE($6, designation),
         date_joined = COALESCE($7, date_joined)
       WHERE id = $8
       RETURNING ${memberSelect}`,
      [
        normalizeOptionalValue(name),
        normalizeOptionalValue(email),
        normalizeOptionalValue(phone),
        normalizeOptionalValue(role),
        normalizeOptionalValue(department),
        normalizeOptionalValue(designation),
        normalizeOptionalValue(joined_date),
        req.params.id,
      ]
    );

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteDepartmentMember = async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM team_members WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: "Department member not found." });
    }

    res.status(200).json({ success: true, message: "Department member deleted successfully." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getSalesDashboard = async (req, res) => {
  try {
    const [membersResult, leadsResult, tasksResult] = await Promise.all([
      pool.query(
        `SELECT id, employee_id, name, email, department, role, designation, profile_image, created_at
         FROM team_members
         WHERE department = $1
         ORDER BY name ASC`,
        ["Sales"]
      ),
      pool.query(
        `SELECT
           l.id,
           l.full_name,
           l.company,
           l.channel,
           l.status,
           l.assigned_to,
           l.created_at,
           l.is_customer,
           tm.name AS assigned_to_name
         FROM leads l
         LEFT JOIN team_members tm
           ON tm.id::text = l.assigned_to::text
           OR tm.employee_id::text = l.assigned_to::text
         ORDER BY l.created_at DESC`
      ),
      pool.query(
        `SELECT id, title, description, assigned_to, employee_name, department, priority, due_date, status, created_at
         FROM tasks
         WHERE department = $1 OR assigned_to IN (
           SELECT employee_id FROM team_members WHERE department = $1
         )
         ORDER BY due_date ASC NULLS LAST, created_at DESC`,
        ["Sales"]
      ),
    ]);

    const members = membersResult.rows;
    const memberIds = new Set(members.map((member) => String(member.id)));
    const memberAssignmentIds = new Set(
      members.flatMap((member) => [member.id, member.employee_id].filter(Boolean).map(String))
    );
    const employeeIdToMemberId = new Map(
      members.map((member) => [String(member.employee_id), member.id])
    );

    const leads = leadsResult.rows.filter((lead) => memberAssignmentIds.has(String(lead.assigned_to)));
    const allSalesLeads = leadsResult.rows.filter(
      (lead) => !lead.assigned_to || memberAssignmentIds.has(String(lead.assigned_to))
    );
    const wonLeads = leads.filter((lead) => String(lead.status || "").toLowerCase() === "won");
    const lostLeads = leads.filter((lead) => String(lead.status || "").toLowerCase() === "lost");
    const recentLeads = leads.filter((lead) => {
      const createdAt = new Date(lead.created_at);
      return !Number.isNaN(createdAt.getTime()) && createdAt >= startOfWeek();
    });
    const conversionRate = leads.length
      ? Number(((wonLeads.length / leads.length) * 100).toFixed(1))
      : 0;

    const stats = [
      {
        label: "Total Leads",
        value: formatCount(leads.length),
        sub: `${formatCount(recentLeads.length)} this week`,
        subColor: "text-gray-500",
        badge: "+0%",
        badgeColor: "bg-green-100 text-green-600",
      },
      {
        label: "Deals won",
        value: formatCount(wonLeads.length),
        sub: "won leads",
        subColor: "text-gray-500",
        badge: "+0%",
        badgeColor: "bg-green-100 text-green-600",
      },
      {
        label: "Conversion Rate",
        value: `${conversionRate}%`,
        sub: "won / total leads",
        subColor: "text-gray-500",
        badge: conversionRate ? "+0%" : "0%",
        badgeColor: "bg-green-100 text-green-600",
      },
      {
        label: "Lost",
        value: formatCount(lostLeads.length),
        sub: "lost leads",
        subColor: "text-gray-500",
        badge: "-0%",
        badgeColor: "bg-red-100 text-red-500",
      },
    ];

    const publicBaseUrl = getPublicBaseUrl(req);
    const teamMembers = members.map((member, index) => {
      const assignedLeads = leads.filter(
        (lead) =>
          String(lead.assigned_to) === String(member.id) ||
          String(lead.assigned_to) === String(member.employee_id)
      );
      const memberWonLeads = assignedLeads.filter(
        (lead) => String(lead.status || "").toLowerCase() === "won"
      );
      const openTasks = tasksResult.rows.filter(
        (task) =>
          String(task.assigned_to) === String(member.employee_id) &&
          !["completed", "done", "closed"].includes(String(task.status || "").toLowerCase())
      );

      return {
        id: member.id,
        employeeId: member.employee_id,
        name: member.name,
        role: member.designation || member.role || "Sales Executive",
        avatar: member.profile_image
          ? `${publicBaseUrl}/uploads/${member.profile_image}`
          : `https://i.pravatar.cc/100?u=${encodeURIComponent(member.employee_id || member.id)}`,
        leadsAssigned: assignedLeads.length,
        dealsWon: memberWonLeads.length,
        status: openTasks.length >= 4 ? "Busy" : "Active",
        color: SALES_CHART_COLORS[index % SALES_CHART_COLORS.length],
      };
    });

    const salesPerformance = teamMembers.map((member) => ({
      name: member.name,
      value: member.dealsWon,
      color: member.color,
    }));

    const today = startOfToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tasksDueToday = tasksResult.rows
      .filter((task) => {
        const dueDate = new Date(task.due_date);
        const isToday =
          !Number.isNaN(dueDate.getTime()) &&
          dueDate >= today &&
          dueDate < tomorrow;
        return isToday && isPendingTask(task.status);
      })
      .map((task) => mapSalesTask(task, employeeIdToMemberId.get(String(task.assigned_to)) || null));

    res.status(200).json({
      success: true,
      data: {
        stats,
        salesPerformance,
        teamMembers,
        tasksDueToday,
        leads: allSalesLeads,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getSalesMemberTasksDueToday = async (req, res) => {
  try {
    const memberResult = await pool.query(
      `SELECT id, employee_id, name, department
       FROM team_members
       WHERE id = $1 AND department = $2
       LIMIT 1`,
      [req.params.id, "Sales"]
    );

    if (!memberResult.rows.length) {
      return res.status(404).json({ success: false, error: "Sales team member not found." });
    }

    const member = memberResult.rows[0];
    const result = await pool.query(
      `SELECT id, title, description, assigned_to, employee_name, department, priority, due_date, status, created_at
       FROM tasks
       WHERE assigned_to = $1
         AND due_date >= CURRENT_DATE
         AND due_date < CURRENT_DATE + INTERVAL '1 day'
         AND LOWER(COALESCE(status, 'open')) NOT IN ('completed', 'done', 'closed')
       ORDER BY due_date ASC NULLS LAST, created_at DESC`,
      [member.employee_id]
    );

    res.status(200).json({
      success: true,
      data: result.rows
        .filter((task) => isDueToday(task.due_date) && isPendingTask(task.status))
        .map((task) => mapSalesTask(task, member.id)),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getDepartmentSummary = async (req, res) => {
  try {
    const [stats, healthResult] = await Promise.all([
      getDepartmentCounts(),
      pool.query(
        `SELECT
           d.department_name,
           COUNT(DISTINCT tm.id)::int AS members,
           COUNT(DISTINCT tk.id) FILTER (WHERE LOWER(COALESCE(tk.state, 'open')) NOT IN ('resolved', 'closed'))::int AS open_tickets,
           COUNT(DISTINCT ta.id) FILTER (WHERE LOWER(COALESCE(ta.status, 'open')) NOT IN ('completed', 'done', 'closed'))::int AS open_tasks
         FROM unnest($1::text[]) AS d(department_name)
         LEFT JOIN team_members tm ON tm.department = d.department_name
         LEFT JOIN tickets tk ON tk.assigned_to = tm.id
         LEFT JOIN tasks ta ON ta.assigned_to = tm.employee_id
         GROUP BY d.department_name
         ORDER BY d.department_name`,
        [ALLOWED_DEPARTMENTS]
      ),
    ]);

    const health = healthResult.rows.map((row) => {
      const workload = Number(row.open_tickets || 0) + Number(row.open_tasks || 0);
      const members = Number(row.members || 0);
      const percentage = members === 0 ? 0 : Math.min(100, Math.round(100 - (workload / (members * 8)) * 100));
      const status = percentage >= 70 ? "On Track" : percentage >= 40 ? "Need Attention" : "High Workload";
      return {
        department_name: row.department_name,
        percentage,
        status,
        status_label: `${workload} open work items`,
      };
    });

    req.query.year = req.query.year || new Date().getFullYear();
    const performanceResult = await pool.query(
      `SELECT
         EXTRACT(MONTH FROM created_at)::int AS month,
         ROUND(
           100.0 * COUNT(*) FILTER (WHERE LOWER(COALESCE(state, '')) IN ('resolved', 'closed'))
           / NULLIF(COUNT(*), 0)
         )::int AS value
       FROM tickets
       WHERE EXTRACT(YEAR FROM created_at)::int = $1
       GROUP BY EXTRACT(MONTH FROM created_at)
       ORDER BY month`,
      [Number(req.query.year)]
    );

    res.status(200).json({
      success: true,
      data: {
        stats,
        health,
        performance: performanceResult.rows,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getDepartmentStats,
  getDepartmentPerformance,
  getDepartmentPerformanceYears,
  getDepartmentHealth,
  getAllDepartmentMembers,
  getDepartmentMemberById,
  createDepartmentMember,
  updateDepartmentMember,
  deleteDepartmentMember,
  getSalesDashboard,
  getSalesMemberTasksDueToday,
  getDepartmentSummary,
};
