-- RUN THIS FILE ONLY IN THE ERP SUPABASE SQL EDITOR.
-- Safe to re-run. This migration only adds nullable columns and never updates
-- or deletes rows. Table/column casing follows the ERP identifiers referenced
-- by the CRM integration code: public."User" and its quoted camelCase fields.

ALTER TABLE IF EXISTS public."User"
  ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean NULL,
  ADD COLUMN IF NOT EXISTS "passwordExpiresAt" timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS "subscriptionEndDate" timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS "userLimit" integer NULL,
  ADD COLUMN IF NOT EXISTS "projectLimit" integer NULL,
  ADD COLUMN IF NOT EXISTS "customPrice" numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS "gstRate" numeric(5,2) NULL,
  ADD COLUMN IF NOT EXISTS "customFeatures" jsonb NULL;

-- Intentionally no password column is added here. The ERP authentication
-- service and its existing password-hash column/algorithm are not present in
-- this repository and must be confirmed before implementation.
