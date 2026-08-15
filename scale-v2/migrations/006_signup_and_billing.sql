-- Self-serve signup and subscription state.
--
-- Two things were impossible before this: a stranger could not create an
-- organisation (only scripts/bootstrap-admin.js could, by hand), and nobody
-- could pay (subscriptions/entitlements existed in 001 and no code touched
-- them). Those are the two ends of the revenue path.
--
-- A trial is a real subscription row with no Stripe record yet, so the rest of
-- the system asks one question — "what is this tenant entitled to?" — and never
-- has to special-case trials against paid plans.

BEGIN;

-- 001 declared these NOT NULL, which assumed every subscription began at
-- Stripe. A trial begins before any payment exists.
ALTER TABLE subscriptions ALTER COLUMN stripe_subscription_id DROP NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN stripe_customer_id DROP NOT NULL;

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS seats integer NOT NULL DEFAULT 1;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Status vocabulary is fixed here rather than trusted from a webhook payload:
-- an unknown status must fail loudly, not silently grant access.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trialing','active','past_due','canceled','expired'));

-- One live subscription per tenant. Without this a replayed webhook or a
-- double checkout could leave a tenant holding two active plans.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_live_per_tenant
  ON subscriptions (tenant_id)
  WHERE status IN ('trialing','active','past_due');

CREATE INDEX IF NOT EXISTS subscriptions_stripe_sub_idx ON subscriptions(stripe_subscription_id);

-- Signup is a public, unauthenticated endpoint, so it is the one surface a
-- stranger can hammer. Attempts are recorded to rate-limit by IP, and login
-- failures by email, in a way that survives a restart — an in-memory counter
-- resets every deploy, which is exactly when an attacker benefits.
CREATE TABLE IF NOT EXISTS auth_attempts (
  id bigserial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('login','signup')),
  -- email for login, client address for signup; never a password or token
  subject text NOT NULL,
  succeeded boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_attempts_lookup_idx
  ON auth_attempts (kind, subject, created_at DESC);

-- auth_attempts is deliberately NOT tenant-scoped and NOT under RLS: it is
-- consulted before a tenant is known (that is the whole point of a pre-auth
-- throttle). It holds no tenant data — a kind, a subject, and an outcome.
GRANT SELECT, INSERT, DELETE ON auth_attempts TO fable5_app;
GRANT USAGE, SELECT ON SEQUENCE auth_attempts_id_seq TO fable5_app;

-- Backfill: every tenant that existed before billing did.
--
-- Without this, introducing the write gate would lock out every organisation
-- created by scripts/bootstrap-admin.js — including the founder's own — because
-- a tenant with no subscription row has no write access. Shipping a change that
-- bricks existing customers is not an acceptable way to add billing.
--
-- CLI-provisioned tenants are owner-operated rather than customers, so they are
-- granted an active plan rather than dropped into a trial that would expire
-- under them. New self-serve organisations start on a trial via src/signup.js.
INSERT INTO subscriptions (tenant_id, status, plan_key, seats)
SELECT t.id, 'active', 'scale', 25
  FROM tenants t
 WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.tenant_id = t.id);

INSERT INTO schema_migrations(version) VALUES ('006_signup_and_billing') ON CONFLICT DO NOTHING;

COMMIT;
