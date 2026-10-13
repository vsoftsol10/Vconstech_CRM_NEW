const cron = require("node-cron");
const { runSubscriptionExpiryJob } = require("../services/subscriptionExpiryService");

const scheduleSubscriptionExpiryJob = () => {
  const expression = process.env.SUBSCRIPTION_EXPIRY_CRON || "15 0 * * *";

  const task = cron.schedule(expression, async () => {
    try {
      await runSubscriptionExpiryJob();
    } catch (error) {
      console.error("[SubscriptionExpiry] Job failed:", error.message);
    }
  }, { timezone: "Asia/Kolkata" });

  console.log(`[SubscriptionExpiry] Job scheduled with cron "${expression}".`);
  return task;
};

module.exports = scheduleSubscriptionExpiryJob();
