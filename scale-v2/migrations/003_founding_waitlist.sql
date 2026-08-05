BEGIN;

-- Public founding-access waitlist (pre-signup queue). Like auth_sessions and
-- stripe_events_raw this table is NOT tenant-scoped and NOT under RLS: anyone
-- may submit, only the founder reads it.
CREATE TABLE IF NOT EXISTS founding_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  company text,
  claim text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','invited','granted','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_founding_waitlist_status ON founding_waitlist(status, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON founding_waitlist TO fable5_app;

INSERT INTO schema_migrations(version) VALUES ('003_founding_waitlist') ON CONFLICT DO NOTHING;

COMMIT;
