require("dotenv").config();
const express = require("express");

const cors = require("cors");
const { startEmailListener } = require("./services/emailService");
const ensureMergeSchema = require("./database/ensureSchema");
// Load the follow‑up reminder scheduler (runs daily)
require('./scripts/followUpReminder');
require('./scripts/subscriptionExpiry');

// ── Middleware ──────────────────────────────────────────────────────────────
const errorHandler = require("./middleware/errorHandler");

// ── Routes ──────────────────────────────────────────────────────────────────
const authRoutes = require("./routes/authRoutes");
const teamRoutes = require("./routes/teamRoutes");
const leadRoutes = require("./routes/leadRoutes");
const customerRoutes = require("./routes/customerRoutes");
const taskRoutes = require("./routes/taskRoutes");
const planRoutes = require("./routes/planRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const metaRoutes = require("./routes/metaRoutes");
const { integrationRoutes } = require("./integration");


const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ── Routes ──────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("Backend running 🚀"));

app.use("/api/auth", authRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/integration", integrationRoutes);
app.use(metaRoutes);
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ── Error Handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;
ensureMergeSchema()
  .then(() => {
    app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  await startEmailListener();
});
  })
  .catch((err) => {
    console.error("Schema check failed:", err.message);
    process.exit(1);
  });
