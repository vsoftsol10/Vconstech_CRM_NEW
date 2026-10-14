const PLAN_ALIASES = {
  trail: "trial",
  trial: "free trial",
  "free trial": "free trial",
};

const normalizePlanKey = (value) => {
  const key = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  return PLAN_ALIASES[key] || key;
};

const parsePositiveNumber = (value) => {
  const match = String(value || "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
};

// Kept under the old export name for compatibility.  Calendar units deliberately
// remain calendar units: one year from 29 Feb 2024 is 28 Feb 2025, not day 365.
const parsePlanDurationInDays = (duration) => {
  const text = String(duration || "").trim().toLowerCase();
  const amount = parsePositiveNumber(text);
  const value = amount && amount > 0 ? amount : 1;

  if (!text) return null;
  if (text === "per year" || text === "per year + gst") return { unit: "years", value: 1 };
  if (text === "customized plan") return null;
  if (/\b(day|days|daily)\b/.test(text)) return { unit: "days", value: Math.round(value) };
  if (/\b(week|weeks|weekly)\b/.test(text)) return { unit: "days", value: Math.round(value * 7) };
  if (/\b(month|months|monthly)\b/.test(text)) return { unit: "months", value: Math.round(value) };
  if (/\b(year|years|annual|annually|yearly)\b/.test(text)) return { unit: "years", value: Math.round(value) };
  if (amount && amount > 0) return { unit: "days", value: Math.round(amount) };

  return null;
};

const addCalendarMonths = (date, months) => {
  const next = new Date(date);
  const originalDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(originalDay, lastDay));
  return next;
};

const addCalendarYears = (date, years) => addCalendarMonths(date, years * 12);

const calculateSubscriptionDates = (planDuration, startDate = new Date()) => {
  const duration = typeof planDuration === "number"
    ? { unit: "days", value: planDuration }
    : planDuration;
  if (!duration || !Number.isFinite(Number(duration.value)) || Number(duration.value) <= 0) {
    throw new Error("Plan duration must be a positive calendar duration");
  }

  const subscription_start_date = new Date(startDate);
  const value = Math.round(Number(duration.value));
  let subscription_end_date;
  if (duration.unit === "years") subscription_end_date = addCalendarYears(subscription_start_date, value);
  else if (duration.unit === "months") subscription_end_date = addCalendarMonths(subscription_start_date, value);
  else {
    subscription_end_date = new Date(subscription_start_date);
    subscription_end_date.setDate(subscription_end_date.getDate() + value);
  }

  return {
    subscription_start_date,
    subscription_end_date,
  };
};

const getPlanForSubscription = async (db, planName) => {
  const planKey = normalizePlanKey(planName);
  const result = await db.query(
    `SELECT p.id, p.name, p.price, p.duration,
            COALESCE((to_jsonb(p)->>'gst_rate')::numeric, 18) AS gst_rate
     FROM plans p
     WHERE LOWER(TRIM(name)) = $1
        OR LOWER(TRIM(name)) = $2
     ORDER BY created_at ASC
     LIMIT 1`,
    [planKey, normalizePlanKey(planKey)]
  );

  const plan = result.rows[0];
  if (!plan) {
    const error = new Error(`Subscription plan "${planName}" was not found`);
    error.status = 400;
    throw error;
  }

  let durationInDays = parsePlanDurationInDays(plan.duration);
  // Advanced pricing is customer-specific, so the plan row may say "Customized Plan"
  // instead of a fixed duration. The CRM's Advanced custom price is annual.
  if (
    !durationInDays &&
    planKey === "advanced" &&
    String(plan.duration || "").trim().toLowerCase() === "customized plan"
  ) {
    durationInDays = { unit: "years", value: 1 };
  }
  if (!durationInDays) {
    const error = new Error(`Subscription plan "${plan.name}" has an invalid duration`);
    error.status = 400;
    throw error;
  }

  return {
    ...plan,
    price: Number(plan.price || 0),
    gst_rate: Number(plan.gst_rate || 18),
    durationInDays,
  };
};

module.exports = {
  calculateSubscriptionDates,
  getPlanForSubscription,
  normalizePlanKey,
  parsePlanDurationInDays,
};
