-- RUN THIS FILE ONLY IN THE CRM SUPABASE SQL EDITOR.
-- Safe to re-run. This migration only adds nullable columns or relaxes the
-- existing CRM-to-ERP mapping's lead requirement; it never updates or deletes rows.

ALTER TABLE IF EXISTS public.customers
  ADD COLUMN IF NOT EXISTS custom_users integer NULL,
  ADD COLUMN IF NOT EXISTS custom_projects integer NULL,
  ADD COLUMN IF NOT EXISTS custom_price numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS gst_rate numeric(5,2) NULL,
  ADD COLUMN IF NOT EXISTS custom_features jsonb NULL,
  ADD COLUMN IF NOT EXISTS sync_status text NULL,
  ADD COLUMN IF NOT EXISTS sync_error text NULL,
  ADD COLUMN IF NOT EXISTS sync_updated_at timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS erp_user_id text NULL;

-- Manual customers do not originate from a CRM lead. The existing mapping
-- table otherwise cannot hold their PENDING/SYNCED/FAILED mapping row.
ALTER TABLE IF EXISTS public.crm_erp_customer_mappings
  ALTER COLUMN lead_id DROP NOT NULL;
