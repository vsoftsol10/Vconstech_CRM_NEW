const pool = require("../config/database");
const {
  sendSubscriptionExpiredEmail,
  sendSubscriptionReminderEmail,
} = require("../utils/emailUtil");
const erpApiClient = require("../integration/services/erpApiClient");
const {
  createFollowUpTask,
} = require("../integration/services/customerStatusSyncService");
const { toDate, getReminderEligibility } = require("./subscriptionReminderRules");

const PRICING_URL = "https://vconstech.in/pricing";
const BUSINESS_TIME_ZONE = "Asia/Kolkata";

const parseReminderDays = () =>
  String(process.env.SUBSCRIPTION_REMINDER_DAYS || "30,15,7,1")
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => b - a);

const dateOnly = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const buildEventId = ({ customerId, type, referenceDate, daysBefore }) =>
  [
    "subscription",
    type,
    customerId,
    daysBefore ? `${daysBefore}d` : null,
    referenceDate,
  ]
    .filter(Boolean)
    .join("-");

const paidSubscriptionWhere = `
  LOWER(COALESCE(subscription_status, payment_status, '')) IN (
    'subscription active',
    'active',
    'paid'
  )
  AND LOWER(COALESCE(subscription_status, payment_status, '')) NOT IN (
    'trial active',
    'trial expired',
    'follow-up required',
    'subscription expired'
  )
`;

let expiredAtColumnExists;
const hasExpiredAtColumn = async () => {
  if (expiredAtColumnExists !== undefined) return expiredAtColumnExists;
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'expired_at'
    ) AS exists`
  );
  expiredAtColumnExists = Boolean(result.rows[0]?.exists);
  if (!expiredAtColumnExists) {
    console.warn("[SubscriptionExpiry] customers.expired_at is unavailable; deploy the subscription migration to record expiry timestamps.");
  }
  return expiredAtColumnExists;
};

const tryReserveEvent = async ({ eventId, customer, status, payload }) => {
  const result = await pool.query(
    `INSERT INTO crm_erp_status_events
     (event_id, crm_customer_id, erp_customer_id, status, payload)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING *`,
    [
      eventId,
      customer.id,
      customer.erp_customer_id || null,
      status,
      { ...payload, processing: true },
    ]
  );

  if (result.rows[0]) return { event: result.rows[0], reserved: true };

  const existing = await pool.query(
    "SELECT * FROM crm_erp_status_events WHERE event_id = $1 LIMIT 1",
    [eventId]
  );
  return { event: existing.rows[0] || null, reserved: false };
};

const updateEventPayload = (eventId, payload) =>
  pool.query(
    `UPDATE crm_erp_status_events
     SET payload = payload || $2::jsonb
     WHERE event_id = $1`,
    [eventId, payload]
  );

const completeEvent = (eventId, payload) =>
  updateEventPayload(eventId, {
    ...payload,
    processing: false,
    completedAt: new Date().toISOString(),
  });

const releaseEvent = (eventId) =>
  pool.query("DELETE FROM crm_erp_status_events WHERE event_id = $1", [eventId]);

const fetchReminderCustomers = async (targetDate) => {
  const today = dateOnly();
  const result = await pool.query(
    `SELECT *
     FROM customers
     WHERE renewal_date = $1::date
       AND email IS NOT NULL
       AND renewal_date >= $2::date
       AND ${paidSubscriptionWhere}`,
    [targetDate, today]
  );

  return result.rows;
};

const fetchExpiryCustomers = async (today) => {
  const result = await pool.query(
    `SELECT *
     FROM customers
     WHERE (
       (
         renewal_date <= $1::date
         AND email IS NOT NULL
         AND ${paidSubscriptionWhere}
       )
       OR EXISTS (
         SELECT 1
         FROM crm_erp_status_events e
         WHERE e.crm_customer_id = customers.id
           AND e.status = 'SUBSCRIPTION_EXPIRED'
           AND e.payload->>'completedAt' IS NULL
       )
     )`
  , [today]);

  return result.rows;
};

const markCrmInactive = async (customer) => {
  if (
    String(customer.subscription_status || customer.payment_status || "").toLowerCase() ===
    "subscription expired"
  ) {
    return customer;
  }

  const expiryDate = toDate(customer.renewal_date) || new Date();

  const setExpiredAt = await hasExpiredAtColumn() ? ", expired_at = NOW()" : "";
  const result = await pool.query(
    `UPDATE customers
     SET payment_status = 'Subscription Expired',
         subscription_status = 'Subscription Expired'
         ${setExpiredAt}
     WHERE id = $1
     RETURNING *`,
    [customer.id]
  );

  await pool.query(
    `INSERT INTO subscription_history
     (customer_id, customer_name, plan_name, amount, action_type, start_date, end_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      customer.id,
      customer.customer_name,
      customer.subscription_plan,
      customer.subscription_amount || 0,
      "EXPIRED",
      customer.subscription_start_date ? dateOnly(toDate(customer.subscription_start_date)) : null,
      dateOnly(expiryDate),
    ]
  );

  return result.rows[0];
};

const deactivateErpAccount = async (customer, eventId) => {
  if (!customer.erp_customer_id) {
    return { skipped: true, reason: "missing_erp_customer_identifier" };
  }

  return erpApiClient.updateCustomerStatus(customer.erp_customer_id, {
    status: "SUBSCRIPTION_EXPIRED",
    accountStatus: "SUBSCRIPTION_EXPIRED",
    isActive: false,
    plan: customer.subscription_plan,
    eventId,
  });
};

const createSalesFollowUp = async (customer, eventId) =>
  createFollowUpTask(pool, {
    customer: {
      ...customer,
      followUpTitle: `Renewal follow up: ${customer.customer_name || customer.company_name || "ERP customer"}`,
      followUpDescription: `Paid subscription expired for customer ${customer.customer_name || customer.id}. ERP event ${eventId}.`,
    },
    eventId,
  });

const processReminderCustomer = async ({ customer, daysBefore, targetDate, dryRun = false }) => {
  const eligibility = getReminderEligibility(customer, daysBefore);
  if (eligibility.reason === "missing_start_date") {
    console.warn("[SubscriptionExpiry] Missing subscription_start_date; sending reminder without legacy-term guard.", {
      customerId: customer.id,
      renewalDate: customer.renewal_date,
      daysBefore,
    });
  }
  if (!eligibility.shouldSend) {
    return { customerId: customer.id, skipped: true, ...eligibility };
  }

  const eventId = buildEventId({
    customerId: customer.id,
    type: "renewal-reminder",
    daysBefore,
    referenceDate: targetDate,
  });

  if (dryRun) {
    console.log("[SubscriptionExpiry][DRY_RUN] Would send renewal reminder", {
      customerId: customer.id, email: customer.email, plan: customer.subscription_plan,
      expiryDate: customer.renewal_date, daysBefore,
    });
    return { customerId: customer.id, wouldSend: "renewal-reminder", eventId };
  }

  const reservation = await tryReserveEvent({
    eventId,
    customer,
    status: `SUBSCRIPTION_REMINDER_${daysBefore}D`,
    payload: { daysBefore, targetDate, renewalLink: PRICING_URL },
  });

  if (!reservation.reserved) return { customerId: customer.id, skipped: true, eventId };

  try {
    const email = await sendSubscriptionReminderEmail({
      name: customer.customer_name,
      email: customer.email,
      companyName: customer.company_name,
      plan: customer.subscription_plan,
      expiryDate: customer.renewal_date,
      amount: customer.custom_price ?? customer.subscription_amount,
      gstRate: customer.gst_rate,
    });

    await pool.query(
      `UPDATE customers
       SET reminder_sent = true,
           reminder_sent_date = $2::date
       WHERE id = $1`,
      [customer.id, dateOnly()]
    );

    await completeEvent(eventId, { email });
    return { customerId: customer.id, sent: true, eventId, email };
  } catch (error) {
    await updateEventPayload(eventId, {
      processing: false,
      failedAt: new Date().toISOString(),
      lastError: error.message,
    });
    console.error("[SubscriptionExpiry] Reminder failed", {
      customerId: customer.id,
      eventId,
      message: error.message,
    });
    return { customerId: customer.id, failed: true, eventId, error: error.message };
  }
};

const processExpiredCustomer = async (customer, { dryRun = false } = {}) => {
  const expiryDate = dateOnly(toDate(customer.renewal_date) || new Date());
  const eventId = buildEventId({
    customerId: customer.id,
    type: "expired",
    referenceDate: expiryDate,
  });

  if (dryRun) {
    console.log("[SubscriptionExpiry][DRY_RUN] Would send expiry email", {
      customerId: customer.id, email: customer.email, plan: customer.subscription_plan, expiryDate: customer.renewal_date,
    });
    return { customerId: customer.id, wouldSend: "subscription-expired", eventId };
  }

  const reservation = await tryReserveEvent({
    eventId,
    customer,
    status: "SUBSCRIPTION_EXPIRED",
    payload: { expiryDate, renewalLink: PRICING_URL },
  });

  if (!reservation.event) return { customerId: customer.id, skipped: true, eventId };

  const eventPayload = reservation.event.payload || {};
  let emailRecorded = Boolean(eventPayload.email);
  if (!reservation.reserved && eventPayload.completedAt) {
    return { customerId: customer.id, skipped: true, eventId };
  }

  try {
    const email =
      eventPayload.email ||
      (await sendSubscriptionExpiredEmail({
        name: customer.customer_name,
        email: customer.email,
        companyName: customer.company_name,
        plan: customer.subscription_plan,
        expiryDate: customer.renewal_date,
        amount: customer.custom_price ?? customer.subscription_amount,
        gstRate: customer.gst_rate,
      }));

    if (!eventPayload.email) {
      await updateEventPayload(eventId, { email });
      emailRecorded = true;
    }

    const crmCustomer = await markCrmInactive(customer);
    const erp = await deactivateErpAccount(customer, eventId);
    const followUpTask = await createSalesFollowUp(crmCustomer, eventId);

    await completeEvent(eventId, { email, erp, followUpTask });
    return { customerId: customer.id, expired: true, eventId, email, erp, crmCustomer, followUpTask };
  } catch (error) {
    if (!emailRecorded) {
      await releaseEvent(eventId);
    } else {
      await updateEventPayload(eventId, {
        processing: true,
        lastError: error.message,
        lastFailedAt: new Date().toISOString(),
      });
    }
    console.error("[SubscriptionExpiry] Expiry processing failed", {
      customerId: customer.id,
      eventId,
      message: error.message,
    });
    return { customerId: customer.id, failed: true, eventId, error: error.message };
  }
};

const processReminderPhase = async ({ daysBefore, today, dryRun }) => {
  const targetDate = dateOnly(addDays(today, daysBefore));
  const customers = await fetchReminderCustomers(targetDate);
  const results = [];

  for (const customer of customers) {
    results.push(await processReminderCustomer({ customer, daysBefore, targetDate, dryRun }));
  }

  return {
    daysBefore,
    targetDate,
    checked: customers.length,
    sent: results.filter((result) => result.sent).length,
    skipped: results.filter((result) => result.skipped).length,
    failed: results.filter((result) => result.failed).length,
    results,
  };
};

const processExpiryPhase = async (today, { dryRun = false } = {}) => {
  const customers = await fetchExpiryCustomers(today);
  const results = [];

  for (const customer of customers) {
    results.push(await processExpiredCustomer(customer, { dryRun }));
  }

  return {
    checked: customers.length,
    expired: results.filter((result) => result.expired).length,
    skipped: results.filter((result) => result.skipped).length,
    failed: results.filter((result) => result.failed).length,
    results,
  };
};

const retryFailedReminders = async ({ dryRun = false } = {}) => {
  const result = await pool.query(
    `SELECT e.event_id, e.payload, c.*
     FROM crm_erp_status_events e
     JOIN customers c ON c.id = e.crm_customer_id
     WHERE e.status LIKE 'SUBSCRIPTION_REMINDER_%'
       AND e.payload->>'completedAt' IS NULL
       AND e.payload->>'failedAt' IS NOT NULL
       AND c.email IS NOT NULL`
  );

  const retries = [];
  for (const row of result.rows) {
    const daysBefore = Number.parseInt(String(row.payload?.daysBefore || ""), 10);
    const eligibility = getReminderEligibility(row, daysBefore);
    if (eligibility.reason === "missing_start_date") {
      console.warn("[SubscriptionExpiry] Missing subscription_start_date; retrying reminder without legacy-term guard.", {
        customerId: row.id,
        renewalDate: row.renewal_date,
        daysBefore,
      });
    }
    if (Number.isInteger(daysBefore) && !eligibility.shouldSend) {
      retries.push({ customerId: row.id, eventId: row.event_id, skipped: true, ...eligibility });
      continue;
    }
    if (dryRun) {
      console.log("[SubscriptionExpiry][DRY_RUN] Would retry renewal reminder", {
        customerId: row.id, email: row.email, plan: row.subscription_plan, expiryDate: row.renewal_date,
      });
      retries.push({ customerId: row.id, eventId: row.event_id, wouldSend: "renewal-reminder-retry" });
      continue;
    }
    try {
      const email = await sendSubscriptionReminderEmail({
        name: row.customer_name,
        email: row.email,
        companyName: row.company_name,
        plan: row.subscription_plan,
        expiryDate: row.renewal_date,
        amount: row.custom_price ?? row.subscription_amount,
        gstRate: row.gst_rate,
      });
      await pool.query(
        `UPDATE customers SET reminder_sent = true, reminder_sent_date = $2::date WHERE id = $1`,
        [row.id, dateOnly()]
      );
      await completeEvent(row.event_id, { email, retriedAt: new Date().toISOString() });
      retries.push({ customerId: row.id, eventId: row.event_id, sent: true });
    } catch (error) {
      await updateEventPayload(row.event_id, { failedAt: new Date().toISOString(), lastError: error.message });
      retries.push({ customerId: row.id, eventId: row.event_id, failed: true, error: error.message });
    }
  }
  return retries;
};

const runSubscriptionExpiryJob = async ({ dryRun = String(process.env.DRY_RUN).toLowerCase() === "true" } = {}) => {
  const today = new Date(`${dateOnly()}T12:00:00+05:30`);
  const reminderDays = parseReminderDays();

  console.log("[SubscriptionExpiry] Checking subscription reminders and expiries.");

  const reminders = [];
  for (const daysBefore of reminderDays) {
    reminders.push(await processReminderPhase({ daysBefore, today, dryRun }));
  }

  const retries = await retryFailedReminders({ dryRun });
  const expiry = await processExpiryPhase(dateOnly(today), { dryRun });

  return {
    reminderDays,
    dryRun,
    reminders,
    retries,
    expiry,
  };
};

module.exports = {
  runSubscriptionExpiryJob,
};
