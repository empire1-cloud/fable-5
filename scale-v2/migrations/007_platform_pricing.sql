-- Platform-fee pricing metered on active market nodes.
--
-- 006 shipped with per-seat tiers. That was wrong for this product: FABLE-5's
-- premise is that agents do the work, so a successful customer runs with few
-- humans — per-seat billing would earn less the better the product works.
-- The meter is now the active market node, this system's own unit of company
-- expansion, and seats become a limit rather than the thing being sold.
--
-- 006 is left exactly as it shipped. This migration moves forward from it.

BEGIN;

-- Capacity a tenant has purchased beyond their plan's included nodes.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS extra_nodes integer NOT NULL DEFAULT 0
  CONSTRAINT subscriptions_extra_nodes_nonneg CHECK (extra_nodes >= 0);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'monthly';
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_billing_interval_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_billing_interval_check
  CHECK (billing_interval IN ('monthly','annual'));

-- Plan keys changed with the model. Old rows are remapped rather than left
-- pointing at plans that no longer exist — an unknown plan_key resolves to no
-- plan, which would read as "no features" and quietly degrade a live tenant.
UPDATE subscriptions SET plan_key = 'founding'   WHERE plan_key = 'starter';
UPDATE subscriptions SET plan_key = 'operator'   WHERE plan_key = 'growth';
UPDATE subscriptions SET plan_key = 'empire'     WHERE plan_key = 'scale';

-- Guard the vocabulary so a typo or a stale webhook cannot park a tenant on a
-- plan the catalog does not define.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_key_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_key_check
  CHECK (plan_key IN ('trial','founding','operator','empire','enterprise'));

INSERT INTO schema_migrations(version) VALUES ('007_platform_pricing') ON CONFLICT DO NOTHING;

COMMIT;
