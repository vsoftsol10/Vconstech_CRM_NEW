require("dotenv").config();

const { runSubscriptionExpiryJob } = require("../services/subscriptionExpiryService");

const dryRun = String(process.env.DRY_RUN).toLowerCase() === "true";

runSubscriptionExpiryJob({ dryRun })
  .then((result) => {
    console.log(`[SubscriptionExpiry] One-time run completed (DRY_RUN=${dryRun}).`);
    console.dir(result, { depth: null });
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error("[SubscriptionExpiry] One-time run failed:", error);
    process.exitCode = 1;
  });
