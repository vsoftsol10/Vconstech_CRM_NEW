-- Run this only in the CRM Supabase project's SQL editor, never in ERP Supabase.
-- Re-runnable and additive: it does not alter existing customer data.
ALTER TABLE IF EXISTS public.customers
  ADD COLUMN IF NOT EXISTS custom_users integer NULL,
  ADD COLUMN IF NOT EXISTS custom_projects integer NULL,
  ADD COLUMN IF NOT EXISTS custom_price numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS gst_rate numeric(5,2) NULL,
  ADD COLUMN IF NOT EXISTS custom_features jsonb NULL;

ALTER TABLE IF EXISTS public.subscription_history
  ADD COLUMN IF NOT EXISTS metadata jsonb NULL;
