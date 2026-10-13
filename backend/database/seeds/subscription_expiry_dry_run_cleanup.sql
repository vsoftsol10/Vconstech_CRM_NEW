-- TEST DATABASE ONLY. This file is never run automatically.
-- Deletes only customers created by subscription_expiry_dry_run_test.sql and
-- their dependent subscription history/status-event records.
BEGIN;

WITH seeded_customers AS (
  SELECT id
  FROM customers
  WHERE email LIKE 'subscription-dryrun-%@example.test'
)
DELETE FROM crm_erp_status_events
WHERE crm_customer_id IN (SELECT id FROM seeded_customers);

WITH seeded_customers AS (
  SELECT id
  FROM customers
  WHERE email LIKE 'subscription-dryrun-%@example.test'
)
DELETE FROM subscription_history
WHERE customer_id IN (SELECT id FROM seeded_customers);

DELETE FROM customers
WHERE email LIKE 'subscription-dryrun-%@example.test';

COMMIT;
