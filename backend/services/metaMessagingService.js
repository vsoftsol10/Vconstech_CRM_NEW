const axios = require("axios");

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

module.exports = { sendMetaMessage };
