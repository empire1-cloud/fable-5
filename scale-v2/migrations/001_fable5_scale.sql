BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fable5_app') THEN
    CREATE ROLE fable5_app LOGIN PASSWORD 'fable5_app' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$roles$;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OWNER','ADMIN','OPERATOR','REVIEWER','VIEWER')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_records (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  claim text NOT NULL,
  state text NOT NULL CHECK (state IN ('PROPOSED','AUTHORIZED','EXECUTED','RECEIPTED','VERIFIED','MEASURED','LEARNED','CANONIZED')),
  grade text NOT NULL CHECK (grade IN ('A','B','C')),
  confidence numeric(5,4) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_events (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES evidence_records(id) ON DELETE CASCADE,
  state_from text,
  state_to text NOT NULL,
  reason text NOT NULL,
  actor_id uuid REFERENCES users(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES evidence_records(id) ON DELETE CASCADE,
  receipt_type text NOT NULL,
  uri text,
  digest text,
  description text NOT NULL,
  grade text NOT NULL CHECK (grade IN ('A','B','C')),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES evidence_records(id) ON DELETE CASCADE,
  method text NOT NULL,
  verifier text NOT NULL,
  independent boolean NOT NULL DEFAULT false,
  reproducible boolean NOT NULL DEFAULT false,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES evidence_records(id) ON DELETE CASCADE,
  gate_type text NOT NULL,
  reading jsonb NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('PASS','FAIL','CLONE','ITERATE','PAUSE','KILL')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contradictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  left_evidence_id uuid REFERENCES evidence_records(id),
  right_evidence_id uuid REFERENCES evidence_records(id),
  description text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learnings (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES evidence_records(id),
  statement text NOT NULL,
  supporting_evidence_ids uuid[] NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS canon_entries (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  source_evidence_id uuid NOT NULL REFERENCES evidence_records(id),
  policy_version text NOT NULL,
  approved_by text NOT NULL,
  superseded_by uuid REFERENCES canon_entries(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS canon_diffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  canon_entry_id uuid NOT NULL REFERENCES canon_entries(id),
  previous_body text,
  next_body text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  ranking_score numeric(6,2) NOT NULL,
  ranking_verdict text NOT NULL,
  ranking_factors jsonb NOT NULL,
  evidence_id uuid NOT NULL REFERENCES evidence_records(id),
  status text NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decisions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES opportunities(id),
  verdict text NOT NULL,
  reason text NOT NULL,
  decided_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS engine_work_items (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engine_id text NOT NULL CHECK (engine_id ~ '^(0[0-8])$'),
  item_type text NOT NULL,
  title text NOT NULL,
  status text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_id uuid REFERENCES evidence_records(id),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS engine_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_engine_id text NOT NULL,
  target_engine_id text NOT NULL,
  work_item_id uuid NOT NULL REFERENCES engine_work_items(id),
  gate_evidence_id uuid NOT NULL REFERENCES evidence_records(id),
  status text NOT NULL CHECK (status IN ('PROPOSED','AUTHORIZED','REFUSED','CONSUMED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engine_id text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  reason text NOT NULL,
  evidence_id uuid REFERENCES evidence_records(id),
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intent_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  approved_by uuid REFERENCES users(id),
  action text NOT NULL,
  vendor_or_system text NOT NULL,
  max_amount numeric(15,2) NOT NULL CHECK (max_amount >= 0),
  currency text NOT NULL,
  expires_at timestamptz NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox','prod')),
  recurrence text NOT NULL CHECK (recurrence IN ('one-shot','bounded')),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES opportunities(id),
  resource_type text NOT NULL,
  amount numeric(15,2) NOT NULL,
  currency text,
  intent_token_id uuid REFERENCES intent_tokens(id),
  verdict text NOT NULL,
  executed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (executed = false)
);

CREATE TABLE IF NOT EXISTS stripe_events_raw (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  signature_verified boolean NOT NULL,
  resolved_tenant_id uuid REFERENCES tenants(id),
  status text NOT NULL CHECK (status IN ('RECEIVED','QUARANTINED','CLAIMED','PROCESSED','FAILED','DEAD_LETTER')),
  received_at timestamptz NOT NULL DEFAULT now(),
  last_error text
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL,
  stripe_customer_id text NOT NULL,
  status text NOT NULL,
  plan_key text NOT NULL,
  provider_event_created bigint NOT NULL DEFAULT 0,
  provider_event_id text NOT NULL DEFAULT '',
  current_period_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, stripe_subscription_id)
);

CREATE TABLE IF NOT EXISTS entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  is_granted boolean NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id),
  evidence_id uuid REFERENCES evidence_records(id),
  valid_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, feature_key)
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claimed_by text,
  attempts integer NOT NULL DEFAULT 0,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_tenant_state ON evidence_records(tenant_id, state);
CREATE INDEX IF NOT EXISTS idx_work_tenant_engine ON engine_work_items(tenant_id, engine_id, status);
CREATE INDEX IF NOT EXISTS idx_opportunity_rank ON opportunities(tenant_id, ranking_score DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_ready ON outbox_events(available_at) WHERE processed_at IS NULL;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_tenants ON tenants;
CREATE POLICY tenant_isolation_tenants ON tenants
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DO $rls$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'memberships','evidence_records','evidence_events','evidence_receipts',
    'evidence_verifications','evidence_measurements','contradictions','learnings',
    'canon_entries','canon_diffs','opportunities','decisions','engine_work_items',
    'engine_handoffs','escalations','intent_tokens','resource_allocations',
    'subscriptions','entitlements','outbox_events'
  ]
  LOOP
    policy_name := 'tenant_isolation_' || table_name;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      policy_name,
      table_name
    );
  END LOOP;
END
$rls$;

GRANT CONNECT ON DATABASE fable5 TO fable5_app;
GRANT USAGE ON SCHEMA public TO fable5_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fable5_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fable5_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fable5_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO fable5_app;

INSERT INTO schema_migrations(version) VALUES ('001_fable5_scale') ON CONFLICT DO NOTHING;

COMMIT;
