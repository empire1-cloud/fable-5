CREATE TABLE IF NOT EXISTS economic_truth_outbox (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  action_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','delivered','refused')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  response jsonb,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, event_key)
);
CREATE INDEX IF NOT EXISTS idx_economic_truth_outbox_pending
  ON economic_truth_outbox (next_attempt_at, created_at)
  WHERE state IN ('pending','sending');
ALTER TABLE economic_truth_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS economic_truth_outbox_tenant ON economic_truth_outbox;
CREATE POLICY economic_truth_outbox_tenant ON economic_truth_outbox
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
