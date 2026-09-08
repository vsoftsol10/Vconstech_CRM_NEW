const axios = require("axios");

const getMetaUserProfile = async ({ channel, channelUserId }) => {
  if ((channel !== "Facebook" && channel !== "Instagram") || !channelUserId) return null;

  const fields = channel === "Instagram" ? "name,username" : "first_name,last_name";
  const response = await axios.get(`https://graph.facebook.com/v20.0/${channelUserId}`, {
    params: { fields, access_token: process.env.PAGE_ACCESS_TOKEN },
  });
  const profile = response.data || {};
  const fullName = channel === "Instagram"
    ? profile.name || profile.username || null
    : [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null;

  return { fullName, username: profile.username || null };
};

const sendMetaMessage = async ({ channel, channelUserId, text }) => {
  if (channel === "WhatsApp") {
    return axios.post(
      `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: channelUserId,
        type: "text",
        text: { body: text },
      },
      { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } }
    );
  }

  if (channel === "Facebook" || channel === "Instagram") {
    return axios.post(
      "https://graph.facebook.com/v20.0/me/messages",
      {
        recipient: { id: channelUserId },
        message: { text },
        ...(channel === "Facebook" ? { messaging_type: "RESPONSE" } : {}),
      },
      { params: { access_token: process.env.PAGE_ACCESS_TOKEN } }
    );
  }

  throw new Error(`Unknown Meta channel: ${channel}`);
};

module.exports = { getMetaUserProfile, sendMetaMessage };
