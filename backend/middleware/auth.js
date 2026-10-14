const crypto = require("crypto");

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

const getSecret = () => {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) throw new Error("AUTH_TOKEN_SECRET is required for authenticated routes");
  return secret;
};

const sign = (value) => crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");

const createAuthToken = (employee, expiresAt = Date.now() + TOKEN_TTL_MS) => {
  const payload = Buffer.from(JSON.stringify({
    id: employee.id,
    employee_id: employee.employee_id,
    role: employee.role,
    designation: employee.designation,
    department: employee.department,
    exp: expiresAt,
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
};

const verifyAuthToken = (token) => {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return { valid: false, reason: "missing_token_parts" };
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
      return { valid: false, reason: "invalid_signature" };
    }
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!user?.exp || user.exp <= Date.now()) {
      return { valid: false, reason: "expired" };
    }
    return { valid: true, user };
  } catch (error) {
    return { valid: false, reason: "malformed_token" };
  }
};

const requireAuthenticated = (req, res, next) => {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const verification = verifyAuthToken(token);
  if (!verification.valid) {
    const message = verification.reason === "expired" ? "Your session has expired." : "Authentication is required.";
    return res.status(401).json({ success: false, message });
  }
  req.user = verification.user;
  return next();
};

const isAdminOrSales = (user) => {
  const department = String(user?.department || "").trim().toLowerCase();
  const roleValues = [user?.role, user?.designation]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
  const allowedDepartments = new Set(["admin", "sales"]);
  const allowedRoles = new Set([
    "admin", "administrator", "sales", "sales executive", "sales manager", "sales representative",
  ]);

  return allowedDepartments.has(department) || roleValues.some((value) => allowedRoles.has(value));
};

const requireAdminOrSales = (req, res, next) => {
  if (!isAdminOrSales(req.user)) {
    return res.status(403).json({ success: false, message: "Only Admin or Sales roles can modify customer subscriptions." });
  }
  return next();
};

module.exports = { createAuthToken, verifyAuthToken, requireAuthenticated, requireAdminOrSales };
