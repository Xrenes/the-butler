-- The Butler: initial schema.
--
-- The app connects as the schema owner for system work (sign-in, the reminder worker,
-- Telegram webhooks) and switches to the `butler_app` role (SET LOCAL ROLE) for every
-- request made on behalf of a signed-in user. Row-level security on user tables then
-- guarantees one account can never read or change another account's rows, even if a
-- query forgets its WHERE clause.
--
-- User content (tasks, categories, settings, money) is never stored in plaintext: the
-- `records` table only holds AES-256-GCM ciphertext produced on the user's device.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'butler_app') THEN
    CREATE ROLE butler_app NOLOGIN;
  END IF;
END
$$;

-- Lets the connecting role SET ROLE butler_app. Superusers (local PGlite) can already do
-- that, and some managed hosts reject self-grants, so a failure here is not fatal.
DO $$
BEGIN
  EXECUTE format('GRANT butler_app TO %I', current_user);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'GRANT butler_app skipped: %', SQLERRM;
END
$$;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email) AND length(email) <= 254),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  auth_hash text NOT NULL,
  recovery_auth_hash text NOT NULL,
  kdf_salt text NOT NULL,
  kdf_params jsonb NOT NULL,
  wrapped_master_key jsonb NOT NULL,
  recovery_salt text NOT NULL,
  wrapped_master_key_recovery jsonb NOT NULL,
  wrapped_finance_key_password jsonb NOT NULL,
  wrapped_finance_key_recovery jsonb NOT NULL,
  finance_pin jsonb,
  finance_pin_failures integer NOT NULL DEFAULT 0,
  timezone text NOT NULL DEFAULT 'Asia/Dhaka',
  failed_logins integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE SEQUENCE record_seq;

CREATE TABLE records (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('main', 'finance')),
  iv text NOT NULL,
  ct text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  immutable boolean NOT NULL DEFAULT false,
  deleted boolean NOT NULL DEFAULT false,
  seq bigint NOT NULL DEFAULT nextval('record_seq'),
  size_bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX records_sync_idx ON records (user_id, seq);

CREATE TABLE reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  task_id uuid NOT NULL,
  due_at timestamptz NOT NULL,
  fire_at timestamptz NOT NULL,
  -- Only set when the user opted in to showing the task title in Telegram.
  title text CHECK (title IS NULL OR length(title) <= 120),
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'sending', 'sent', 'failed', 'cancelled', 'actioned')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  action_token_hash text,
  telegram_chat_id bigint,
  telegram_message_id bigint,
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_id)
);
CREATE INDEX reminders_due_idx ON reminders (fire_at) WHERE status = 'scheduled';
CREATE UNIQUE INDEX reminders_action_token_idx ON reminders (action_token_hash)
  WHERE action_token_hash IS NOT NULL;

CREATE TABLE telegram_links (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  chat_id bigint NOT NULL UNIQUE,
  linked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE telegram_link_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE TABLE telegram_updates (
  update_id bigint PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  task_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('complete', 'hold')),
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz
);
CREATE INDEX pending_actions_open_idx ON pending_actions (user_id) WHERE applied_at IS NULL;

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users (id) ON DELETE CASCADE,
  event text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_user_idx ON audit_log (user_id, created_at DESC);

CREATE TABLE rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count integer NOT NULL
);

-- Row-level security: a user-scoped transaction can only see rows whose user_id matches
-- the `app.user_id` setting the server puts on that transaction.
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY records_owner ON records
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
CREATE POLICY reminders_owner ON reminders
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
CREATE POLICY telegram_links_owner ON telegram_links
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
CREATE POLICY telegram_link_tokens_owner ON telegram_link_tokens
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
CREATE POLICY pending_actions_owner ON pending_actions
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON records, reminders, telegram_links, telegram_link_tokens, pending_actions
  TO butler_app;
GRANT USAGE, SELECT ON SEQUENCE record_seq TO butler_app;
