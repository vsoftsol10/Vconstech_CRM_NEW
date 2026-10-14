-- Run this in the CRM database SQL editor before deploying the customer form.
-- Safe to re-run; adds only the fields used by manual ERP customer creation.
ALTER TABLE IF EXISTS public.customers
  ADD COLUMN IF NOT EXISTS address text NULL,
  ADD COLUMN IF NOT EXISTS customer_role text NULL,
  ADD COLUMN IF NOT EXISTS custom_templates integer NULL;
