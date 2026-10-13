-- TEST DATABASE ONLY. This file is never run automatically.
-- It intentionally removes only the six disposable example.test seed accounts.
BEGIN;

DELETE FROM customers
WHERE email LIKE 'subscription-dryrun-%@example.test';

INSERT INTO customers (
  customer_name, company_name, phone, email,
  subscription_plan, subscription_amount,
  start_date, renewal_date, subscription_start_date, subscription_end_date,
  payment_status, subscription_status, notes
)
VALUES
  ('Dry Run 30', 'Test Only', '9000000030', 'subscription-dryrun-30@example.test', 'Basic', 3000,
   ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '335 days'), ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '30 days'), ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '335 days'), ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '30 days'),
   'Subscription Active', 'Subscription Active', 'Dry-run seed: 30-day reminder'),
  ('Dry Run 15', 'Test Only', '9000000015', 'subscription-dryrun-15@example.test', 'Basic', 3000,
   ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '350 days'), ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '15 days'), ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '350 days'), ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '15 days'),
   'Subscription Active', 'Subscription Active', 'Dry-run seed: 15-day reminder'),
  ('Dry Run 7', 'Test Only', '9000000007', 'subscription-dryrun-7@example.test', 'Basic', 3000,
   ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '358 days'), ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '7 days'), ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '358 days'), ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '7 days'),
   'Subscription Active', 'Subscription Active', 'Dry-run seed: 7-day reminder'),
  ('Dry Run 1', 'Test Only', '9000000001', 'subscription-dryrun-1@example.test', 'Basic', 3000,
   ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '364 days'), ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '1 day'), ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '364 days'), ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '1 day'),
   'Subscription Active', 'Subscription Active', 'Dry-run seed: 1-day reminder'),
  ('Dry Run Expiry', 'Test Only', '9000000000', 'subscription-dryrun-expiry@example.test', 'Basic', 3000,
   ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '365 days'), (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date, ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '365 days'), (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,
   'Subscription Active', 'Subscription Active', 'Dry-run seed: expiry email'),
  ('Dry Run Legacy Monthly', 'Test Only', '9000000031', 'subscription-dryrun-legacy@example.test', 'Basic', 3000,
   (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date, ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '30 days'), (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date, ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '30 days'),
   'Subscription Active', 'Subscription Active', 'Dry-run seed: must skip 30-day reminder');

COMMIT;
