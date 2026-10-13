const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getTermLengthInDays = (customer) => {
  const start = toDate(customer.subscription_start_date);
  const end = toDate(customer.renewal_date);
  if (!start || !end) return null;
  return Math.floor((Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) -
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) / 86400000);
};

const getReminderEligibility = (customer, daysBefore) => {
  const termLengthInDays = getTermLengthInDays(customer);
  if (termLengthInDays === null) {
    return { shouldSend: true, reason: "missing_start_date", termLengthInDays: null };
  }
  if (termLengthInDays <= daysBefore) {
    return { shouldSend: false, reason: "term_not_longer_than_reminder_interval", termLengthInDays };
  }
  return { shouldSend: true, reason: "eligible", termLengthInDays };
};

module.exports = { toDate, getTermLengthInDays, getReminderEligibility };
