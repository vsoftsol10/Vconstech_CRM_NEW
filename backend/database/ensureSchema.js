const pool = require("../config/database");

const ensureMergeSchema = async () => {
  await pool.query(`
    ALTER TABLE IF EXISTS tasks
      ADD COLUMN IF NOT EXISTS department text,
      ADD COLUMN IF NOT EXISTS status text DEFAULT 'Open',
      ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT NOW()
  `);

  await pool.query(`
    ALTER TABLE IF EXISTS notifications
      ALTER COLUMN reference_id TYPE text USING reference_id::text
  `);

  await pool.query(`
    ALTER TABLE IF EXISTS leads
      ADD COLUMN IF NOT EXISTS follow_up_date date,
      ADD COLUMN IF NOT EXISTS follow_up_time time without time zone,
      ADD COLUMN IF NOT EXISTS reminder_enabled boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS follow_up_reminder_sent_at timestamp without time zone,
      ADD COLUMN IF NOT EXISTS follow_up_reminder_sent_for_date date,
      ADD COLUMN IF NOT EXISTS facebook_id text,
      ADD COLUMN IF NOT EXISTS instagram_id text,
      ADD COLUMN IF NOT EXISTS instagram_username text
  `);

  await pool.query(`
    UPDATE leads AS lead
    SET instagram_id = conversation.channel_user_id
    FROM meta_conversations AS conversation
    WHERE conversation.lead_id = lead.id
      AND conversation.channel = 'Instagram'
      AND conversation.channel_user_id IS NOT NULL
      AND lead.instagram_id IS DISTINCT FROM conversation.channel_user_id
  `);

  await pool.query(`
    UPDATE leads AS lead
    SET facebook_id = conversation.channel_user_id
    FROM meta_conversations AS conversation
    WHERE conversation.lead_id = lead.id
      AND conversation.channel = 'Facebook'
      AND conversation.channel_user_id IS NOT NULL
      AND lead.facebook_id IS DISTINCT FROM conversation.channel_user_id
  `);

  await pool.query(`
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
      ADD COLUMN IF NOT EXISTS subscription_status text
  `);

  await pool.query(`
    UPDATE customers
    SET subscription_start_date = COALESCE(subscription_start_date, start_date::timestamp AT TIME ZONE 'UTC'),
        subscription_end_date = COALESCE(subscription_end_date, renewal_date::timestamp AT TIME ZONE 'UTC')
    WHERE subscription_start_date IS NULL
       OR subscription_end_date IS NULL
  `);

  await pool.query(`
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
      ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS subscription_history_erp_customer_idx
    ON subscription_history (erp_customer_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS subscription_history_erp_user_idx
    ON subscription_history (erp_user_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_erp_status_events (
      id bigserial PRIMARY KEY,
      event_id text NOT NULL UNIQUE,
      crm_customer_id integer NOT NULL,
      erp_customer_id text NULL,
      status text NOT NULL,
      payload jsonb DEFAULT '{}'::jsonb,
      follow_up_task_id bigint NULL,
      created_at timestamp without time zone DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS crm_erp_status_events_customer_idx
    ON crm_erp_status_events (crm_customer_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS crm_erp_status_events_status_idx
    ON crm_erp_status_events (status)
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS crm_erp_customer_mappings_lead_unique
    ON crm_erp_customer_mappings (lead_id)
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS crm_erp_customer_mappings_customer_unique
    ON crm_erp_customer_mappings (customer_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS crm_erp_customer_mappings_status_idx
    ON crm_erp_customer_mappings (status)
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS notifications_lead_follow_up_unique
    ON notifications (team_member_id, reference_type, reference_id)
    WHERE reference_type = 'lead_follow_up'
  `);

  await pool.query(`
    ALTER TABLE IF EXISTS tickets
      ADD COLUMN IF NOT EXISTS department text,
      ADD COLUMN IF NOT EXISTS ticket_type text DEFAULT 'request',
      ADD COLUMN IF NOT EXISTS company_name text
  `);

  await pool.query(`
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
       OR ticket_number ~* '^TIK-(INC|REQ)-[0-9]+$'
  `);

  await pool.query(`
    ALTER TABLE IF EXISTS tickets
      ALTER COLUMN ticket_type SET DEFAULT 'request',
      ALTER COLUMN ticket_type SET NOT NULL
  `);

  await pool.query(`
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
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_number_counters (
      ticket_type text PRIMARY KEY CHECK (ticket_type IN ('incident', 'request')),
      last_number integer NOT NULL DEFAULT 0 CHECK (last_number >= 0),
      updated_at timestamp without time zone DEFAULT NOW()
    )
  `);

  await pool.query(`
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
        updated_at = NOW()
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS tickets_ticket_number_unique
    ON tickets (ticket_number)
    WHERE ticket_number IS NOT NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_history (
      id bigserial PRIMARY KEY,
      ticket_id uuid NOT NULL,
      activity_type text NOT NULL,
      title text NULL,
      "Worknotes" text NULL,
      created_by uuid NULL,
      sender text NULL,
      receiver text NULL,
      follow_up_date date NULL,
      follow_up_time time without time zone NULL,
      reminder boolean DEFAULT true,
      reminder_sent boolean DEFAULT false,
      attachment_url text NULL,
      status_snapshot text NULL,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS ticket_history_ticket_created_idx
    ON ticket_history (ticket_id, created_at DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_processed_messages (
      id bigserial PRIMARY KEY,
      message_id text NOT NULL UNIQUE,
      classification_type text NOT NULL,
      related_type text NULL,
      related_id text NULL,
      sender_email text NULL,
      subject text NULL,
      created_at timestamp without time zone DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS email_processed_messages_created_idx
    ON email_processed_messages (created_at DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta_conversations (
      id bigserial PRIMARY KEY,
      channel text NOT NULL,
      channel_user_id text NOT NULL,
      full_name text NULL,
      phone_raw text NULL,
      channel_username text NULL,
      lead_id bigint NULL,
      registration_status text NOT NULL DEFAULT 'pending',
      registration_token_hash text NULL,
      registration_expires_at timestamp without time zone NULL,
      registration_completed_at timestamp without time zone NULL,
      initial_message text NULL,
      created_at timestamp without time zone DEFAULT NOW(),
      updated_at timestamp without time zone DEFAULT NOW(),
      UNIQUE (channel, channel_user_id)
    )
  `);

  await pool.query(`
    ALTER TABLE IF EXISTS meta_conversations
      ADD COLUMN IF NOT EXISTS channel_username text
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS meta_conversations_registration_token_unique
    ON meta_conversations (registration_token_hash)
    WHERE registration_token_hash IS NOT NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta_messages (
      id bigserial PRIMARY KEY,
      conversation_id bigint NOT NULL REFERENCES meta_conversations(id) ON DELETE CASCADE,
      direction text NOT NULL CHECK (direction IN ('in', 'out')),
      text text NOT NULL,
      created_at timestamp without time zone DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS meta_messages_conversation_created_idx
    ON meta_messages (conversation_id, created_at ASC, id ASC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_updates (
      id bigserial PRIMARY KEY,
      task_id bigint NULL,
      employee_id text NULL,
      employee_name text NULL,
      note text NOT NULL,
      status text NULL,
      created_at timestamp without time zone DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE IF EXISTS task_updates
      ADD COLUMN IF NOT EXISTS task_id bigint,
      ADD COLUMN IF NOT EXISTS employee_name text,
      ADD COLUMN IF NOT EXISTS note text,
      ADD COLUMN IF NOT EXISTS status text,
      ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT NOW()
  `);

  await pool.query(`
    ALTER TABLE IF EXISTS task_updates
      ALTER COLUMN employee_id TYPE text USING employee_id::text
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS task_updates_task_created_idx
    ON task_updates (task_id, created_at ASC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS task_updates_employee_idx
    ON task_updates (employee_id)
  `);
};

module.exports = ensureMergeSchema;
