const axios = require("axios");

// Meta does not guarantee that every sender ID delivered to a webhook can be
// read through the profile endpoint. For example, an Instagram-scoped ID can
// be unavailable to the current token or disappear after the user revokes
// access. That must not prevent us from recording or replying to the message.
const isUnavailableProfileError = (error) => {
  const apiError = error.response?.data?.error;
  return apiError?.code === 100 && [33, 803].includes(apiError.error_subcode);
};

const getMetaUserProfile = async ({ channel, channelUserId }) => {
  if ((channel !== "Facebook" && channel !== "Instagram") || !channelUserId) return null;

  const fields = channel === "Instagram" ? "name,username" : "first_name,last_name";
  const accessToken = channel === "Instagram"
    ? process.env.INSTAGRAM_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN
    : process.env.PAGE_ACCESS_TOKEN;
  if (!accessToken) return null;

  let response;
  try {
    response = await axios.get(`https://graph.facebook.com/v20.0/${channelUserId}`, {
      params: { fields, access_token: accessToken },
    });
  } catch (error) {
    if (isUnavailableProfileError(error)) return null;
    throw error;
  }
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
