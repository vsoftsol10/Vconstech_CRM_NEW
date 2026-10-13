-- Apply through the normal database migration process; this file is not run by the app.
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS gst_rate numeric(5,2) NOT NULL DEFAULT 18;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS expired_at timestamp with time zone;

-- Catalogue changes only. Existing customer subscription dates are intentionally
-- not touched; they retain their current term until an explicit renewal/change.
UPDATE plans
SET price = 0,
    duration = '7 days',
    gst_rate = 18
WHERE LOWER(TRIM(name)) IN ('trial', 'free trial', 'trail');

UPDATE plans
SET price = 3000,
    duration = '1 year',
    gst_rate = 18
WHERE LOWER(TRIM(name)) = 'basic';

UPDATE plans
SET price = 4200,
    duration = '1 year',
    gst_rate = 18
WHERE LOWER(TRIM(name)) = 'premium';
