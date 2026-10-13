// const bcrypt = require("bcrypt");
const bcrypt = require('bcryptjs');

const crypto = require("crypto");
const pool = require("../config/database");
const { sendPasswordResetEmail } = require("../utils/emailUtil");
const { createAuthToken } = require("../middleware/auth");

// ── Login ───────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password, department } = req.body;

    if (!email || !password || !department) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const result = await pool.query(
      `SELECT * FROM team_members WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const employee = result.rows[0];

    if (employee.department?.toLowerCase() !== department.toLowerCase()) {
      return res.status(401).json({ success: false, message: "Department does not match our records" });
    }

    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const { password: _, reset_token, reset_token_expiry, ...safeEmployee } = employee;

    res.json({
      success: true,
      message: "Login successful",
      employee: safeEmployee,
      token: createAuthToken(safeEmployee),
    });

  } catch (err) {
    console.error("POST /login error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Forgot Password ─────────────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await pool.query(
      "SELECT * FROM team_members WHERE email = $1",
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Email not found",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    await pool.query(
      `UPDATE team_members
       SET reset_token = $1,
           reset_token_expiry = NOW() + INTERVAL '15 minutes'
       WHERE email = $2`,
      [resetToken, email]
    );

    await sendPasswordResetEmail(email, resetToken);

    res.json({
      success: true,
      message: "Reset link sent",
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ── Reset Password ──────────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await pool.query(
      `SELECT *
       FROM team_members
       WHERE reset_token = $1
       AND reset_token_expiry > NOW()`,
      [token]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE team_members
       SET password = $1,
           reset_token = NULL,
           reset_token_expiry = NULL
       WHERE id = $2`,
      [hashedPassword, user.rows[0].id]
    );

    res.json({
      success: true,
      message: "Password reset successful",
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ── Change Password ─────────────────────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { employeeId, oldPassword, newPassword } = req.body;

    if (!employeeId || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    }

    const result = await pool.query(
      "SELECT id, password FROM team_members WHERE id = $1",
      [employeeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const employee = result.rows[0];

    const isMatch = await bcrypt.compare(oldPassword, employee.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    const hashedNew = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE team_members SET password = $1 WHERE id = $2",
      [hashedNew, employeeId]
    );

    res.json({ success: true, message: "Password changed successfully" });

  } catch (err) {
    console.error("POST /change-password error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  login,
  forgotPassword,
  resetPassword,
  changePassword,
};
