process.env.AUTH_TOKEN_SECRET = "fixture-auth-secret";

const { createAuthToken, verifyAuthToken } = require("../middleware/auth");

const employee = { id: 1, employee_id: "EMP-001", role: "Admin", department: "Admin" };
const validToken = createAuthToken(employee);
const tamperedToken = `${validToken.slice(0, -1)}${validToken.endsWith("a") ? "b" : "a"}`;
const expiredToken = createAuthToken(employee, Date.now() - 1);

for (const [label, token] of [["no token", ""], ["abc", "abc"], ["tampered", tamperedToken], ["expired", expiredToken], ["valid", validToken]]) {
  const result = verifyAuthToken(token);
  console.log(`${label}: ${result.valid ? "PASS" : "401"}${result.reason ? ` (${result.reason})` : ""}`);
}
