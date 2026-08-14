/*
 * Subscription state and the write gate.
 *
 * One place decides whether a tenant may write, so a new endpoint cannot
 * accidentally be free. The gate is applied by HTTP method rather than by an
 * allow-list of routes: a route added tomorrow is covered by default, and
 * forgetting to opt in fails closed instead of open.
 */
import { withTenant } from "./db.js";
import { accessVerdict, seatVerdict, nodeVerdict, priceFor } from "./domain/plans.js";

/**
 * Must run inside withTenant. `subscriptions` is under FORCE ROW LEVEL
 * SECURITY, so a bare pool.query with no app.tenant_id set returns zero rows —
 * which this gate would read as "no subscription" and refuse every write for
 * every tenant. Filtering by tenant_id in the predicate is not a substitute for
 * the tenant context; RLS is evaluated first.
 */
export async function loadSubscription(tenantId) {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT id, tenant_id, status, plan_key, seats, trial_ends_at,
              stripe_subscription_id, stripe_customer_id, current_period_end
         FROM subscriptions
        ORDER BY (status IN ('trialing','active','past_due')) DESC, created_at DESC
        LIMIT 1`,
    );
    return rows[0] ?? null;
  });
}

export async function subscriptionState(tenantId) {
  const subscription = await loadSubscription(tenantId);
  return { subscription, verdict: accessVerdict(subscription) };
}

/**
 * Current consumption against the plan's limits. Reported rather than only
 * enforced, so a customer can see where they stand before a refusal tells
 * them — a limit that is invisible until it blocks you is a bad limit.
 */
export async function usageFor(tenantId, subscription) {
  const { members, activeNodes } = await withTenant(tenantId, async (client) => {
    const [m, n] = await Promise.all([
      client.query(`SELECT count(*)::int AS c FROM memberships WHERE is_active = true`),
      client.query(`SELECT count(*)::int AS c FROM market_nodes WHERE status IN ('Active','Scaling')`),
    ]);
    return { members: m.rows[0].c, activeNodes: n.rows[0].c };
  });

  return {
    seats: { used: members, ...seatVerdict(subscription, members) },
    nodes: { used: activeNodes, ...nodeVerdict(subscription, activeNodes) },
    price: priceFor(subscription?.plan_key, {
      extraNodes: subscription?.extra_nodes ?? 0,
      interval: subscription?.billing_interval ?? "monthly",
    }),
  };
}

/** Methods that change state. GET/HEAD/OPTIONS stay open for any tenant with a
 *  subscription record, including expired ones — an expired customer keeps
 *  reading everything they recorded. Nothing is deleted or hidden. */
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Applied after requireAuth. Routes that must stay reachable while read-only
 * (billing, so a lapsed customer can pay; logout) are exempt by path prefix.
 */
export function requireWriteAccess(exemptPrefixes = []) {
  return async (req, res, next) => {
    try {
      if (!WRITE_METHODS.has(req.method)) return next();
      if (exemptPrefixes.some((p) => req.path.startsWith(p))) return next();

      const { verdict } = await subscriptionState(req.actor.tenantId);
      if (verdict.canWrite) {
        req.subscriptionVerdict = verdict;
        return next();
      }

      // 402 rather than 403: this is not a permission the user lacks, it is a
      // payment state they can change, and the response says how.
      return res.status(402).json({
        error: "PAYMENT_REQUIRED",
        reason: verdict.reason,
        status: verdict.status,
        planKey: verdict.planKey,
        readOnly: true,
        correlationId: req.correlationId,
      });
    } catch (error) {
      next(error);
    }
  };
}
