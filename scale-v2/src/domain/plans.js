/*
 * Plan catalog and entitlement rules.
 *
 * Pure functions over a subscription row — no database, no Stripe — so the
 * question "what may this tenant do right now?" is decided in one tested place
 * rather than re-derived at each call site.
 *
 * The doctrine that shapes this file: an expired trial goes READ-ONLY, it does
 * not delete. Nothing a tenant recorded is destroyed or hidden because they
 * stopped paying — evidence, canon and receipts stay readable. Only new writes
 * are refused. WE EVOLVE, NEVER DELETE applies to customers too.
 */

export const TRIAL_DAYS = 14;

/** Per-seat tiers. seats is the billable unit; limits gate what a plan opens. */
export const PLANS = Object.freeze({
  trial: {
    key: "trial",
    name: "Trial",
    pricePerSeatMonthly: 0,
    maxSeats: 5,
    features: ["control_plane", "evidence", "genomes", "market_nodes", "replication"],
  },
  starter: {
    key: "starter",
    name: "Starter",
    pricePerSeatMonthly: 49,
    maxSeats: 5,
    features: ["control_plane", "evidence", "genomes"],
  },
  growth: {
    key: "growth",
    name: "Growth",
    pricePerSeatMonthly: 99,
    maxSeats: 25,
    features: ["control_plane", "evidence", "genomes", "market_nodes"],
  },
  scale: {
    key: "scale",
    name: "Scale",
    pricePerSeatMonthly: 199,
    maxSeats: 500,
    features: ["control_plane", "evidence", "genomes", "market_nodes", "replication"],
  },
});

/** Statuses that permit writing. past_due still writes — a failed card should
 *  not instantly freeze a paying customer's company; it becomes read-only only
 *  once the provider gives up and the status moves to canceled/expired. */
const WRITING_STATUSES = new Set(["trialing", "active", "past_due"]);

export function getPlan(planKey) {
  return PLANS[planKey] ?? null;
}

/**
 * The single access verdict. Shaped like every other gate in this system: a
 * boolean plus the reason, so a refusal can always explain itself.
 *
 * @param {object|null} subscription row from `subscriptions`, or null
 * @param {Date} now
 */
export function accessVerdict(subscription, now = new Date()) {
  if (!subscription) {
    return {
      canRead: false,
      canWrite: false,
      status: "none",
      planKey: null,
      reason: "This organisation has no subscription record.",
    };
  }

  const plan = getPlan(subscription.plan_key);
  const base = {
    canRead: true, // a paid-up past is never hidden; see the file header
    planKey: subscription.plan_key,
    status: subscription.status,
    plan,
  };

  if (!WRITING_STATUSES.has(subscription.status)) {
    return {
      ...base,
      canWrite: false,
      reason:
        subscription.status === "canceled"
          ? "Subscription canceled. Your records remain readable; new work requires an active plan."
          : "Subscription expired. Your records remain readable; new work requires an active plan.",
    };
  }

  // A trial that ran out is read-only even though its stored status still says
  // trialing — expiry is a fact about time, not about whether a job got to run.
  if (subscription.status === "trialing") {
    const endsAt = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
    if (!endsAt || endsAt.getTime() <= now.getTime()) {
      return {
        ...base,
        canWrite: false,
        status: "expired",
        reason: "Trial has ended. Your records remain readable; new work requires an active plan.",
      };
    }
    return {
      ...base,
      canWrite: true,
      trialDaysRemaining: Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000),
      reason: "Trial active.",
    };
  }

  return { ...base, canWrite: true, reason: "Subscription active." };
}

/** Feature gate, evaluated against the plan the tenant is actually on. */
export function hasFeature(subscription, featureKey, now = new Date()) {
  const verdict = accessVerdict(subscription, now);
  if (!verdict.canWrite) return false;
  return Boolean(verdict.plan?.features.includes(featureKey));
}

/** Seat limits are enforced on invite, not silently exceeded and billed later. */
export function seatVerdict(subscription, currentMemberCount) {
  const plan = getPlan(subscription?.plan_key);
  if (!plan) return { allowed: false, reason: "No plan on this subscription." };
  const limit = Math.min(subscription.seats ?? plan.maxSeats, plan.maxSeats);
  if (currentMemberCount >= limit) {
    return {
      allowed: false,
      reason: `Seat limit reached (${currentMemberCount}/${limit} on ${plan.name}). Add seats or move to a larger plan.`,
    };
  }
  return { allowed: true, reason: `${currentMemberCount + 1}/${limit} seats used.` };
}

export function trialEndsAt(from = new Date()) {
  return new Date(from.getTime() + TRIAL_DAYS * 86_400_000);
}
