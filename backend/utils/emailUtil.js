const transporter = require("../config/email");

const getSender = () => {
  const email = process.env.SMTP_FROM_EMAIL;
  const name = process.env.SMTP_FROM_NAME || "Vconstech";
  if (!email) {
    throw new Error("[SMTP] SMTP_FROM_EMAIL is required");
  }
  return `"${name}" <${email}>`;
};

const getPublicSmtpConfig = () =>
  typeof transporter.smtpConfig === "function"
    ? transporter.smtpConfig()
    : {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 0),
        secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
        userExists: Boolean(process.env.SMTP_USER),
        passwordExists: Boolean(process.env.SMTP_PASS),
      };

const sendMailWithLogging = async (options) => {
  const smtp = getPublicSmtpConfig();
  console.log("[SMTP] sendMail reached", {
    ...smtp,
    to: options.to,
    subject: options.subject,
  });

  try {
    const result = await transporter.sendMail(options);
    console.log("[SMTP] sendMail ok", {
      ...smtp,
      to: options.to,
      subject: options.subject,
      messageId: result.messageId,
    });
    return result;
  } catch (err) {
    console.error("[SMTP] sendMail failed", {
      ...smtp,
      to: options.to,
      subject: options.subject,
      code: err.code,
      command: err.command,
      message: err.message,
    });
    throw err;
  }
};

// ── Send Welcome Email ──────────────────────────────────────────────────────
const sendWelcomeEmail = async (name, email, employeeId, autoPassword) => {
  try {
    await sendMailWithLogging({
      from: getSender(),
      to: email,
      subject: "CRM Login Credentials",
      html: `
        <div style="
          background:#f4f7fb;
          padding:40px 20px;
          font-family:Arial,sans-serif;
        ">
          <div style="
            max-width:600px;
            margin:auto;
            background:white;
            border-radius:16px;
            overflow:hidden;
            box-shadow:0 4px 15px rgba(0,0,0,0.08);
          ">
            <div style="
              background:linear-gradient(135deg,#2563eb,#1e40af);
              color:white;
              padding:30px;
              text-align:center;
            ">
              <h1 style="margin:0;">Welcome to Vconstech 🚀</h1>
              <p style="margin-top:10px;font-size:15px;">
                Your CRM account has been created successfully
              </p>
            </div>

            <div style="padding:30px;color:#111827;">
              <p>Hi <strong>${name}</strong>,</p>
              <p>
                We are excited to welcome you to the Vconstech team.
                Below are your login credentials for accessing the CRM system.
              </p>

              <div style="
                background:#f9fafb;
                border:1px solid #e5e7eb;
                border-radius:12px;
                padding:20px;
                margin:25px 0;
              ">
                <p><strong>Employee ID:</strong> ${employeeId}</p>
               
<p><strong>Email:</strong> ${email}</p>
<p><strong>Password:</strong> ${autoPassword}</p>

<p>
  <a
    href="https://crm.vconstech.in/"
    style="
      background:#2563eb;
      color:#ffffff;
      padding:10px 18px;
      text-decoration:none;
      border-radius:6px;
      display:inline-block;
      font-weight:bold;
    "
  >
    Login to CRM
  </a>
</p>

<p>
  If the button doesn't work, copy and paste this URL into your browser:<br>
  <strong>https://crm.thevsoft.com</strong>
</p>
              </div>

              <p style="color:#dc2626;">
                Please change your password after your first login.
              </p>

              <p>
                We wish you great success and a wonderful journey with us.
              </p>

              <br/>
              <p>Best Regards,</p>
              <p><strong>Vconstech Team</strong></p>
            </div>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error("Email sending error:", err);
    throw err;
  }
};

// ── Send Password Reset Email ───────────────────────────────────────────────
const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const resetLink = `https://crm.vconstech.in/reset-password/${resetToken}`;

    await sendMailWithLogging({
      from: getSender(),
      to: email,
      subject: "Reset Your Password",
      html: `
        <h2>Password Reset</h2>
        <p>Click below to reset your password:</p>
        <a href="${resetLink}" style="
          display:inline-block;
          background:#2563eb;
          color:white;
          padding:10px 20px;
          text-decoration:none;
          border-radius:5px;
        ">
          Reset Password
        </a>
        <p>Valid for 15 minutes.</p>
      `,
    });
  } catch (err) {
    console.error("Password reset email error:", err);
    throw err;
  }
};

const PRICING_URL = "https://vconstech.in/pricing";

const formatDisplayDate = (date) => {
  if (!date) return "N/A";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const renewalButton = `
  <p style="margin:24px 0">
    <a href="${PRICING_URL}" style="background:#111827;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold">
      Renew Subscription
    </a>
  </p>
`;

const sendSubscriptionReminderEmail = async ({
  name,
  email,
  subject,
  message,
  companyName,
  plan,
  expiryDate,
}) => {
  if (!email) return { sent: false, reason: "missing_email" };

  await sendMailWithLogging({
    from: getSender(),
    to: email,
    subject: subject || "Subscription Renewal Reminder",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:auto">
        <p>Hi <strong>${name || "Customer"}</strong>,</p>
        ${
          message
            ? `<p>${message}</p>`
            : `<p>This is a reminder that your subscription will expire soon.</p>`
        }
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:20px 0">
          <p style="margin:0 0 8px"><strong>Company Name:</strong> ${companyName || "N/A"}</p>
          <p style="margin:0 0 8px"><strong>Current Plan:</strong> ${plan || "N/A"}</p>
          <p style="margin:0"><strong>Expiry Date:</strong> ${formatDisplayDate(expiryDate)}</p>
        </div>
        ${renewalButton}
        <p>Best Regards,<br/><strong>Vconstech Team</strong></p>
      </div>
    `,
  });

  return { sent: true };
};

const sendSubscriptionExpiredEmail = async ({ name, email, companyName }) => {
  if (!email) return { sent: false, reason: "missing_email" };

  await sendMailWithLogging({
    from: getSender(),
    to: email,
    subject: "Your Subscription Has Expired",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:auto">
        <p>Hi <strong>${name || "Customer"}</strong>,</p>
        <p>Your subscription has expired.</p>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin:20px 0">
          <p style="margin:0 0 8px"><strong>Company Name:</strong> ${companyName || "N/A"}</p>
         
          <p style="margin:0">ERP access is now inactive.</p>
        </div>
        <p>Please renew your subscription to reactivate services.</p>
        ${renewalButton}
        <p>Best Regards,<br/><strong>Vconstech Team</strong></p>
      </div>
    `,
  });

  return { sent: true };
};

const sendErpInvitationEmail = async ({ name, email, invitationUrl, invitationId }) => {
  if (!email) return { sent: false, reason: "missing_email" };

  await sendMailWithLogging({
    from: getSender(),
    to: email,
    subject: "Complete your Vconstech ERP registration",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:auto">
        <h2 style="margin-bottom:12px">Welcome to Vconstech ERP</h2>
        <p>Hi <strong>${name || "Customer"}</strong>,</p>
        <p>Your ERP account invitation is ready. Please open the link below and create your password.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:20px 0">
          <p style="margin:0 0 12px"><strong>Invitation ID:</strong> ${invitationId}</p>
          <a href="${invitationUrl}" style="background:#111827;color:#ffffff;padding:10px 14px;border-radius:6px;text-decoration:none;display:inline-block">Complete registration</a>
        </div>
        <p style="font-size:13px;color:#6b7280">If the button does not work, open this link: <a href="${invitationUrl}">${invitationUrl}</a></p>
        <p>Best Regards,<br/><strong>Vconstech Team</strong></p>
      </div>
    `,
  });

  return { sent: true };
};

module.exports = {
  sendErpInvitationEmail,
  sendSubscriptionExpiredEmail,
  sendSubscriptionReminderEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
};
