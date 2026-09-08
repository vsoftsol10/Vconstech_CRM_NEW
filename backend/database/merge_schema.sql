-- Merge schema for CRM ticket/workspace/notification flow.
-- Non-destructive only: tickets and notifications already exist in the merged CRM.
-- Do not recreate tickets or introduce legacy staff tables.

ALTER TABLE IF EXISTS tasks
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'Open',
  ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT NOW();

ALTER TABLE IF EXISTS notifications
  ALTER COLUMN reference_id TYPE text USING reference_id::text;

ALTER TABLE IF EXISTS leads
  ADD COLUMN IF NOT EXISTS follow_up_date date,
  ADD COLUMN IF NOT EXISTS follow_up_time time without time zone,
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS follow_up_reminder_sent_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS follow_up_reminder_sent_for_date date,
  ADD COLUMN IF NOT EXISTS facebook_id text,
  ADD COLUMN IF NOT EXISTS instagram_id text;

ALTER TABLE IF EXISTS customers
  ADD COLUMN IF NOT EXISTS erp_customer_id text,
  ADD COLUMN IF NOT EXISTS erp_invitation_id text,
  ADD COLUMN IF NOT EXISTS erp_status text,
  ADD COLUMN IF NOT EXISTS erp_synced_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS erp_last_sync_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS trial_start_date date,
  ADD COLUMN IF NOT EXISTS trial_end_date date,
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS subscription_start_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS subscription_end_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS subscription_status text;

UPDATE customers
SET subscription_start_date = COALESCE(subscription_start_date, start_date::timestamp AT TIME ZONE 'UTC'),
    subscription_end_date = COALESCE(subscription_end_date, renewal_date::timestamp AT TIME ZONE 'UTC')
WHERE subscription_start_date IS NULL
   OR subscription_end_date IS NULL;

ALTER TABLE IF EXISTS subscription_history
  ADD COLUMN IF NOT EXISTS erp_customer_id text,
  ADD COLUMN IF NOT EXISTS erp_user_id text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS previous_plan text,
  ADD COLUMN IF NOT EXISTS new_plan text,
  ADD COLUMN IF NOT EXISTS previous_status text,
  ADD COLUMN IF NOT EXISTS new_status text,
  ADD COLUMN IF NOT EXISTS previous_start_date date,
  ADD COLUMN IF NOT EXISTS new_start_date date,
  ADD COLUMN IF NOT EXISTS previous_end_date date,
  ADD COLUMN IF NOT EXISTS new_end_date date,
  ADD COLUMN IF NOT EXISTS changed_by text,
  ADD COLUMN IF NOT EXISTS erp_subscription_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS subscription_history_erp_customer_idx
ON subscription_history (erp_customer_id);

CREATE INDEX IF NOT EXISTS subscription_history_erp_user_idx
ON subscription_history (erp_user_id);

CREATE TABLE IF NOT EXISTS crm_erp_status_events (
  id bigserial PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  crm_customer_id integer NOT NULL,
  erp_customer_id text NULL,
  status text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  follow_up_task_id bigint NULL,
  created_at timestamp without time zone DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_erp_status_events_customer_idx
ON crm_erp_status_events (crm_customer_id);

CREATE INDEX IF NOT EXISTS crm_erp_status_events_status_idx
ON crm_erp_status_events (status);

CREATE TABLE IF NOT EXISTS crm_erp_customer_mappings (
  id bigserial PRIMARY KEY,
  lead_id bigint NOT NULL,
  customer_id integer NOT NULL,
  invitation_id text NULL,
  erp_customer_id text NULL,
  status text NOT NULL DEFAULT 'PENDING',
  request_payload jsonb DEFAULT '{}'::jsonb,
  response_payload jsonb DEFAULT '{}'::jsonb,
  error_payload jsonb DEFAULT '{}'::jsonb,
  synced_at timestamp without time zone NULL,
  created_at timestamp without time zone DEFAULT NOW(),
  updated_at timestamp without time zone DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_erp_customer_mappings_lead_unique
ON crm_erp_customer_mappings (lead_id);

CREATE UNIQUE INDEX IF NOT EXISTS crm_erp_customer_mappings_customer_unique
ON crm_erp_customer_mappings (customer_id);

CREATE INDEX IF NOT EXISTS crm_erp_customer_mappings_status_idx
ON crm_erp_customer_mappings (status);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_lead_follow_up_unique
ON notifications (team_member_id, reference_type, reference_id)
WHERE reference_type = 'lead_follow_up';

ALTER TABLE IF EXISTS tickets
  ADD COLUMN IF NOT EXISTS ticket_type text DEFAULT 'request',
  ADD COLUMN IF NOT EXISTS company_name text;

UPDATE tickets
SET ticket_type = CASE
  WHEN ticket_number ~* '^TIK-INC-[0-9]+$' THEN 'incident'
  WHEN ticket_number ~* '^TIK-REQ-[0-9]+$' THEN 'request'
  WHEN LOWER(TRIM(ticket_type)) IN ('incident', 'incident ticket') THEN 'incident'
  WHEN LOWER(TRIM(ticket_type)) IN ('request', 'request ticket') THEN 'request'
  ELSE 'request'
END
WHERE ticket_type IS NULL
   OR TRIM(ticket_type) = ''
   OR ticket_type NOT IN ('incident', 'request')
   OR ticket_number ~* '^TIK-(INC|REQ)-[0-9]+$';

ALTER TABLE IF EXISTS tickets
  ALTER COLUMN ticket_type SET DEFAULT 'request',
  ALTER COLUMN ticket_type SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'tickets'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tickets_ticket_type_check'
  ) THEN
    ALTER TABLE tickets
      ADD CONSTRAINT tickets_ticket_type_check
      CHECK (ticket_type IN ('incident', 'request'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ticket_number_counters (
  ticket_type text PRIMARY KEY CHECK (ticket_type IN ('incident', 'request')),
  last_number integer NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at timestamp without time zone DEFAULT NOW()
);

INSERT INTO ticket_number_counters (ticket_type, last_number)
VALUES
  (
    'incident',
    COALESCE((
      SELECT MAX((regexp_replace(ticket_number, '^TIK-INC-', ''))::int)
      FROM tickets
      WHERE ticket_number ~ '^TIK-INC-[0-9]+$'
    ), 0)
  ),
  (
    'request',
    COALESCE((
      SELECT MAX((regexp_replace(ticket_number, '^TIK-REQ-', ''))::int)
      FROM tickets
      WHERE ticket_number ~ '^TIK-REQ-[0-9]+$'
    ), 0)
  )
ON CONFLICT (ticket_type) DO UPDATE
SET last_number = GREATEST(ticket_number_counters.last_number, EXCLUDED.last_number),
    updated_at = NOW();

CREATE UNIQUE INDEX IF NOT EXISTS tickets_ticket_number_unique
ON tickets (ticket_number)
WHERE ticket_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_processed_messages (
  id bigserial PRIMARY KEY,
  message_id text NOT NULL UNIQUE,
  classification_type text NOT NULL,
  related_type text NULL,
  related_id text NULL,
  sender_email text NULL,
  subject text NULL,
  created_at timestamp without time zone DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_processed_messages_created_idx
ON email_processed_messages (created_at DESC);

CREATE TABLE IF NOT EXISTS meta_conversations (
  id bigserial PRIMARY KEY,
  channel text NOT NULL,
  channel_user_id text NOT NULL,
  full_name text NULL,
  phone_raw text NULL,
  lead_id bigint NULL,
  registration_status text NOT NULL DEFAULT 'pending',
  registration_token_hash text NULL,
  registration_expires_at timestamp without time zone NULL,
  registration_completed_at timestamp without time zone NULL,
  initial_message text NULL,
  created_at timestamp without time zone DEFAULT NOW(),
  updated_at timestamp without time zone DEFAULT NOW(),
  UNIQUE (channel, channel_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS meta_conversations_registration_token_unique
ON meta_conversations (registration_token_hash)
WHERE registration_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS meta_messages (
  id bigserial PRIMARY KEY,
  conversation_id bigint NOT NULL REFERENCES meta_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  text text NOT NULL,
  created_at timestamp without time zone DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meta_messages_conversation_created_idx
ON meta_messages (conversation_id, created_at ASC, id ASC);
