const pool = require("../config/database");
const { createLeadRecord } = require("./leadController");
const { fallbackReply, generateSalesReply } = require("../services/metaAiReplyService");
const { getMetaUserProfile, sendMetaMessage } = require("../services/metaMessagingService");
const conversationService = require("../services/metaConversationService");

const processedMessages = new Map();
const DEDUPLICATION_TTL_MS = 10 * 60 * 1000;
const EXISTING_LEAD_REPLY = "We received your message. Our team will contact you soon.";

const isDuplicateMessage = (messageId) => {
  if (!messageId) return false;
  const now = Date.now();
  for (const [id, receivedAt] of processedMessages) {
    if (now - receivedAt > DEDUPLICATION_TTL_MS) processedMessages.delete(id);
  }
  if (processedMessages.has(messageId)) return true;
  processedMessages.set(messageId, now);
  return false;
};

const publicBaseUrl = (req) => (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
const escapeHtml = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const placeholderPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  const candidate = digits.slice(-10);
  if (/^[6-9]\d{9}$/.test(candidate)) return candidate;

  let hash = 0;
  for (const character of String(value || "meta")) hash = (hash * 31 + character.charCodeAt(0)) % 1000000000;
  return `9${String(hash).padStart(9, "0")}`;
};

const placeholderEmail = (channel, channelUserId) => {
  const localPart = String(channelUserId || "user").replace(/[^a-z0-9]/gi, "").slice(0, 48) || "user";
  return `${channel.toLowerCase()}-${localPart}@meta.lead`;
};

const syncSocialLeadUsername = async ({ channel, leadId, username }) => {
  const usernameColumn = channel === "Facebook" ? "facebook_username" : channel === "Instagram" ? "instagram_username" : null;
  if (!usernameColumn || !leadId || !username) return;

  await pool.query(`UPDATE leads SET ${usernameColumn} = $1 WHERE id = $2`, [username, leadId]);
};

const createInboundCrmLead = async (conversation) => {
  if (conversation.lead_id) return conversation.lead_id;

  const fullName = String(conversation.full_name || "").trim();
  const result = await createLeadRecord({
    fullName: fullName.length >= 3 ? fullName : `${conversation.channel} User`,
    company: "Not Provided",
    phone: placeholderPhone(conversation.phone_raw || conversation.channel_user_id),
    email: placeholderEmail(conversation.channel, conversation.channel_user_id),
    channel: conversation.channel,
    status: "new",
    date: new Date().toISOString().slice(0, 10),
  });
  const leadId = result.body.lead?.id || result.body.leadId;
  if (leadId) {
    await conversationService.linkLead({ conversationId: conversation.id, leadId });
  }
  return leadId || null;
};

const renderRegistrationPage = (conversation, error = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lead Registration</title><style>body{margin:0;font-family:Arial,sans-serif;background:#f6f7f9;color:#17202a}main{max-width:560px;margin:32px auto;padding:24px;background:#fff;border:1px solid #dfe3e8;border-radius:8px}label{display:block;margin-top:14px;font-weight:700}input,textarea{box-sizing:border-box;width:100%;margin-top:6px;padding:11px;border:1px solid #c9d1d9;border-radius:6px;font-size:15px}textarea{min-height:92px}button{margin-top:20px;width:100%;padding:12px;border:0;border-radius:6px;background:#1769aa;color:#fff;font-size:16px;font-weight:700}.error{padding:10px;color:#8a1f11;background:#fff0ed;border:1px solid #ffc9bf;border-radius:6px}</style></head><body><main><h1>Registration Form</h1>${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}<form method="post"><label>Full name<input name="fullName" value="${escapeHtml(conversation.full_name === "Unknown" ? "" : conversation.full_name)}" required></label><label>Company<input name="company" required></label><label>Mobile number<input name="phone" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" required></label><label>Email<input name="email" type="email" required></label><label>Requirements<textarea name="requirements" placeholder="Tell us what you need"></textarea></label><button type="submit">Submit</button></form></main></body></html>`;
const renderCompletePage = (alreadySubmitted = false) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Registration Submitted</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Arial,sans-serif;background:#f6f7f9;color:#17202a}main{width:min(560px,calc(100% - 32px));padding:28px;box-sizing:border-box;background:#fff;border:1px solid #dfe3e8;border-radius:8px;text-align:center}</style></head><body><main><h1>${alreadySubmitted ? "Registration already submitted" : "Registration submitted"}</h1><p>${alreadySubmitted ? "We already have your details. Our team will contact you soon." : "Thank you. We have received your details and our team will contact you soon."}</p></main></body></html>`;

const sendRegistrationLink = async (req, conversation, initialMessage) => {
  const hasActiveRegistrationLink =
    conversation.registration_status === "pending" &&
    conversation.registration_token_hash &&
    new Date(conversation.registration_expires_at).getTime() > Date.now();
  if (hasActiveRegistrationLink) return;

  const registration = await conversationService.createRegistration(conversation, initialMessage);
  const link = `${publicBaseUrl(req)}/register/${registration.token}`;
  const text = `Thanks for messaging us. Please complete this registration form so our team can help you: ${link}`;
  await sendMetaMessage({ channel: conversation.channel, channelUserId: conversation.channel_user_id, text });
  await conversationService.saveMessage({ conversationId: conversation.id, direction: "out", text });
};

const handleInboundMessage = async (req, { channel, channelUserId, fullName, phoneRaw, text, username }) => {
  if (!text.trim()) return;
  const conversation = await conversationService.getOrCreateConversation({ channel, channelUserId, fullName, phoneRaw, username });
  const isExistingLead = Boolean(conversation.lead_id);
  const leadId = await createInboundCrmLead(conversation);
  await syncSocialLeadUsername({ channel, leadId, username: conversation.channel_username });
  await conversationService.saveMessage({ conversationId: conversation.id, direction: "in", text });

  if (isExistingLead) {
    await sendMetaMessage({ channel, channelUserId, text: EXISTING_LEAD_REPLY });
    await conversationService.saveMessage({ conversationId: conversation.id, direction: "out", text: EXISTING_LEAD_REPLY });
    return;
  }

  const messages = await conversationService.getMessages(conversation.id);
  let aiReply;
  try {
    aiReply = await generateSalesReply(messages);
  } catch (error) {
    console.error("Meta auto-reply failed:", error.message);
    aiReply = fallbackReply(messages);
  }
  await sendMetaMessage({ channel, channelUserId, text: aiReply.reply });
  await conversationService.saveMessage({ conversationId: conversation.id, direction: "out", text: aiReply.reply });
  if (aiReply.wantsRegistration) await sendRegistrationLink(req, conversation, text);
};

const verifyWebhook = (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === process.env.META_VERIFY_TOKEN) return res.status(200).send(req.query["hub.challenge"]);
  return res.sendStatus(403);
};

const receiveWebhook = async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body || {};
    if (body.object === "page" || body.object === "instagram") {
      const channel = body.object === "page" ? "Facebook" : "Instagram";
      for (const entry of body.entry || []) for (const event of entry.messaging || []) {
        if (event.message?.is_echo || !event.message || isDuplicateMessage(event.message.mid)) continue;
        const channelUserId = event.sender?.id;
        if (!channelUserId) continue;
        let profile = null;
        try {
          profile = await getMetaUserProfile({ channel, channelUserId });
        } catch (error) {
          console.error("Meta profile lookup failed:", error.response?.data || error.message);
        }
        const fullName = profile?.fullName || (channel === "Facebook" ? "Facebook User" : "Instagram User");
        await handleInboundMessage(req, {
          channel,
          channelUserId,
          fullName,
          text: event.message.text || "",
          username: event.sender?.username || profile?.username || null,
        });
      }
    }
    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry || []) for (const change of entry.changes || []) for (const message of change.value?.messages || []) {
        if (isDuplicateMessage(message.id)) continue;
        const channelUserId = message.from;
        if (!channelUserId) continue;
        const contact = (change.value.contacts || []).find((item) => item.wa_id === channelUserId) || change.value.contacts?.[0];
        await handleInboundMessage(req, { channel: "WhatsApp", channelUserId, fullName: contact?.profile?.name || "Unknown", phoneRaw: channelUserId, text: message.text?.body || "" });
      }
    }
  } catch (error) {
    console.error("Meta webhook processing failed:", error.response?.data || error.message);
  }
};

const getRegistrationForm = async (req, res) => {
  const conversation = await conversationService.getRegistration(req.params.token);
  if (!conversation) return res.status(404).send("Registration link not found or expired.");
  if (conversation.registration_status === "completed") return res.type("html").send(renderCompletePage(true));
  return res.type("html").send(renderRegistrationPage(conversation));
};

const submitRegistrationForm = async (req, res) => {
  const conversation = await conversationService.getRegistration(req.params.token);
  if (!conversation) return res.status(404).send("Registration link not found or expired.");
  if (conversation.registration_status === "completed") return res.type("html").send(renderCompletePage(true));
  const phone = String(req.body.phone || "").replace(/\D/g, "");
  if (phone.length !== 10) return res.status(400).type("html").send(renderRegistrationPage(conversation, "Enter a valid 10-digit mobile number."));
  const fullName = String(req.body.fullName || "").trim();
  const company = String(req.body.company || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  if (fullName.length < 3 || !company || !emailPattern.test(email)) {
    return res.status(400).type("html").send(renderRegistrationPage(conversation, "Enter a valid name, company, and email address."));
  }
  try {
    let leadId = conversation.lead_id;
    if (leadId) {
      const result = await pool.query(
        `UPDATE leads SET full_name = $1, company = $2, phone = $3, email = $4, requirements = $5 WHERE id = $6 RETURNING id`,
        [fullName, company, phone, email, String(req.body.requirements || "").trim() || null, leadId]
      );
      leadId = result.rows[0]?.id || null;
    }
    if (!leadId) {
      const result = await createLeadRecord({ fullName, company, phone, email, requirements: req.body.requirements, channel: conversation.channel, status: "new", date: new Date().toISOString().slice(0, 10) });
      leadId = result.body.lead?.id || result.body.leadId;
    }
    await conversationService.completeRegistration({ conversationId: conversation.id, leadId });
    return res.type("html").send(renderCompletePage());
  } catch (error) {
    const message = error.errors ? Object.values(error.errors)[0] : error.message;
    return res.status(error.status || 400).type("html").send(renderRegistrationPage(conversation, message));
  }
};

const listInbox = async (req, res) => res.json(await conversationService.listConversations());
const getInboxMessages = async (req, res) => {
  const conversation = await conversationService.getConversation(req.params.id);
  if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });
  return res.json(await conversationService.getMessages(conversation.id));
};
const sendInboxReply = async (req, res) => {
  const text = String(req.body.text || "").trim();
  if (!text) return res.status(400).json({ success: false, message: "Reply text is required" });
  const conversation = await conversationService.getConversation(req.params.id);
  if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });
  try {
    await sendMetaMessage({ channel: conversation.channel, channelUserId: conversation.channel_user_id, text });
    const message = await conversationService.saveMessage({ conversationId: conversation.id, direction: "out", text });
    return res.json({ success: true, message });
  } catch (error) {
    return res.status(502).json({ success: false, message: error.response?.data?.error?.message || error.message });
  }
};

module.exports = { getInboxMessages, getRegistrationForm, listInbox, receiveWebhook, sendInboxReply, submitRegistrationForm, verifyWebhook };
