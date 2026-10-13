const { getReminderEligibility } = require("../services/subscriptionReminderRules");

const base = new Date("2026-10-12T12:00:00+05:30");
const dateAfter = (days) => new Date(base.getTime() + days * 86400000).toISOString();
const annualStart = (daysUntilExpiry) => dateAfter(daysUntilExpiry - 365);
const customers = [
  ["plus-30", 30, annualStart(30)],
  ["plus-15", 15, annualStart(15)],
  ["plus-7", 7, annualStart(7)],
  ["plus-1", 1, annualStart(1)],
  ["today", 0, annualStart(0)],
  ["legacy-30-day", 30, dateAfter(0)],
  ["null-start-date", 30, null],
].map(([id, daysUntilExpiry, subscription_start_date]) => ({
  id,
  renewal_date: dateAfter(daysUntilExpiry),
  subscription_start_date,
}));

for (const customer of customers) {
  const daysUntilExpiry = Math.round((new Date(customer.renewal_date) - base) / 86400000);
  if (daysUntilExpiry === 0) {
    console.log(`${customer.id}: subscription-expired`);
    continue;
  }
  const result = getReminderEligibility(customer, daysUntilExpiry);
  console.log(`${customer.id}: ${result.shouldSend ? `renewal-reminder-${daysUntilExpiry}d` : `SKIP (${result.reason})`}`);
}
