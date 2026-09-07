const crypto = require("crypto");
const pool = require("../config/database");

const REGISTRATION_LINK_TTL_DAYS = 30;
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const getOrCreateConversation = async ({ channel, channelUserId, fullName, phoneRaw }) => {
  const result = await pool.query(
    `INSERT INTO meta_conversations (channel, channel_user_id, full_name, phone_raw)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (channel, channel_user_id) DO UPDATE
       SET full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), meta_conversations.full_name),
           phone_raw = COALESCE(NULLIF(EXCLUDED.phone_raw, ''), meta_conversations.phone_raw),
           updated_at = NOW()
     RETURNING *`,
    [channel, channelUserId, fullName || null, phoneRaw || null]
  );
  return result.rows[0];
};

const saveMessage = async ({ conversationId, direction, text }) => {
  const result = await pool.query(
    `INSERT INTO meta_messages (conversation_id, direction, text) VALUES ($1, $2, $3) RETURNING *`,
    [conversationId, direction, text]
  );
  return result.rows[0];
};

const getMessages = async (conversationId) => {
  const result = await pool.query(
    `SELECT id, direction, text, created_at AS at FROM meta_messages WHERE conversation_id = $1 ORDER BY created_at ASC, id ASC`,
    [conversationId]
  );
  return result.rows;
};

const getConversation = async (id) => {
  const result = await pool.query(`SELECT * FROM meta_conversations WHERE id = $1`, [id]);
  return result.rows[0] || null;
};

const listConversations = async () => {
  const result = await pool.query(
    `SELECT c.id, c.channel, c.channel_user_id AS "channelUserId", c.full_name AS "fullName", c.lead_id AS "leadId", c.registration_status AS "registrationStatus", c.updated_at AS "updatedAt", m.text AS "lastMessage", m.direction AS "lastMessageDirection", m.created_at AS "lastMessageAt"
     FROM meta_conversations c
     LEFT JOIN LATERAL (
       SELECT text, direction, created_at FROM meta_messages WHERE conversation_id = c.id ORDER BY created_at DESC, id DESC LIMIT 1
     ) m ON TRUE
     ORDER BY COALESCE(m.created_at, c.updated_at) DESC, c.id DESC`
  );
  return result.rows;
};

const createRegistration = async (conversation, initialMessage) => {
  const token = crypto.randomBytes(32).toString("base64url");
  const ttlDays = Number(process.env.REGISTRATION_LINK_TTL_DAYS || REGISTRATION_LINK_TTL_DAYS);
  const expiresAt = new Date(Date.now() + (Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : REGISTRATION_LINK_TTL_DAYS) * 86400000);
  const result = await pool.query(
    `UPDATE meta_conversations
     SET registration_status = 'pending', registration_token_hash = $1, registration_expires_at = $2,
         initial_message = $3, updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [hashToken(token), expiresAt, initialMessage || null, conversation.id]
  );
  return { conversation: result.rows[0], token };
};

const getRegistration = async (token) => {
  const result = await pool.query(
    `SELECT * FROM meta_conversations
     WHERE registration_token_hash = $1 AND registration_expires_at > NOW()`,
    [hashToken(token)]
  );
  return result.rows[0] || null;
};

const completeRegistration = async ({ conversationId, leadId }) => {
  await pool.query(
    `UPDATE meta_conversations
     SET lead_id = $1, registration_status = 'completed', registration_token_hash = NULL,
         registration_completed_at = NOW(), updated_at = NOW()
     WHERE id = $2`,
    [leadId || null, conversationId]
  );
};

const linkLead = async ({ conversationId, leadId }) => {
  const result = await pool.query(
    `UPDATE meta_conversations SET lead_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [leadId, conversationId]
  );
  return result.rows[0] || null;
};

module.exports = { completeRegistration, createRegistration, getConversation, getMessages, getOrCreateConversation, getRegistration, linkLead, listConversations, saveMessage };
