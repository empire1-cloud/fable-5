/*
 * Plan catalog and entitlement rules.
 *
 * Pure functions over a subscription row — no database, no Stripe — so the
 * question "what may this tenant do right now?" is decided in one tested place
 * rather than re-derived at each call site.
 *
 * WHY A PLATFORM FEE AND NOT PER SEAT
 * FABLE-5's premise is that agents do the work, so a successful customer
 * deliberately runs with few humans. Charging per seat would mean earning less
 * the better the product works — billing for the very thing it removes. The
 * meter is instead the **active market node**: this system's own unit of
 * company expansion. When a customer replicates a validated genome into a new
 * market, they grow and so does the bill. Seats become a limit, not the meter.
 *
 * WHAT AN EXPIRED PLAN DOES
 * It goes READ-ONLY. Nothing a tenant recorded is destroyed or hidden because
 * they stopped paying — evidence, canon and receipts stay readable; only new
 * writes are refused. WE EVOLVE, NEVER DELETE applies to customers too.
 */

export const TRIAL_DAYS = 14;

/** Currency for every published price. Stripe amounts are minor units. */
export const CURRENCY = "EUR";

/** Annual billing bills 10 months for 12 — cash up front, and it materially
 *  reduces churn versus monthly. */
export const ANNUAL_MONTHS_CHARGED = 10;

export const PLANS = Object.freeze({
  trial: {
    key: "trial",
    name: "Trial",
    platformMonthly: 0,
    includedSeats: 3,
    includedNodes: 1,
    // A trial shows the whole product. Discovering a locked feature after
    // committing real work to the system is a worse experience than paying.
    features: ["control_plane", "evidence", "genomes", "market_nodes", "replication"],
  },
  founding: {
    key: "founding",
    name: "Founding",
    platformMonthly: 299,
    includedSeats: 3,
    includedNodes: 1,
    features: ["control_plane", "evidence", "genomes", "market_nodes"],
  },
  operator: {
    key: "operator",
    name: "Operator",
    platformMonthly: 999,
    includedSeats: 10,
    includedNodes: 3,
    features: ["control_plane", "evidence", "genomes", "market_nodes"],
  },
  empire: {
    key: "empire",
    name: "Empire",
    platformMonthly: 2999,
    includedSeats: 25,
    includedNodes: 10,
    features: ["control_plane", "evidence", "genomes", "market_nodes", "replication"],
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    // null, not 0 — "priced on conversation", never rendered as free.
    platformMonthly: null,
    includedSeats: 1000,
    includedNodes: 1000,
    features: ["control_plane", "evidence", "genomes", "market_nodes", "replication", "sso", "audit_export"],
  },
});

/** Each active market node beyond the plan's included allowance. */
export const EXTRA_NODE_MONTHLY = 199;

/** Statuses that permit writing. past_due still writes — a failed card should
 *  not instantly freeze a paying customer's company; it becomes read-only only
 *  once the provider gives up and the status moves to canceled/expired. */
const WRITING_STATUSES = new Set(["trialing", "active", "past_due"]);

export function getPlan(planKey) {
  return PLANS[planKey] ?? null;
}

/** Monthly-equivalent and billed totals, including any extra nodes. Returns
 *  null pricing for Enterprise rather than inventing a number. */
export function priceFor(planKey, { extraNodes = 0, interval = "monthly" } = {}) {
  const plan = getPlan(planKey);
  if (!plan) return null;
  if (plan.platformMonthly === null) {
    return { planKey, interval, currency: CURRENCY, monthly: null, billed: null, custom: true };
  }
  const monthly = plan.platformMonthly + Math.max(0, extraNodes) * EXTRA_NODE_MONTHLY;
  const billed = interval === "annual" ? monthly * ANNUAL_MONTHS_CHARGED : monthly;
  return { planKey, interval, currency: CURRENCY, monthly, billed, custom: false };
}

/**
 * The single access verdict. Shaped like every other gate in this system: a
 * boolean plus the reason, so a refusal can always explain itself.
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

/** Seats are a limit, not the meter — enforced on invite rather than silently
 *  exceeded and billed later. */
export function seatVerdict(subscription, currentMemberCount) {
  const plan = getPlan(subscription?.plan_key);
  if (!plan) return { allowed: false, limit: 0, reason: "No plan on this subscription." };
  const limit = plan.includedSeats;
  if (currentMemberCount >= limit) {
    return {
      allowed: false,
      limit,
      reason: `Seat limit reached (${currentMemberCount}/${limit} on ${plan.name}). Move to a larger plan to add people.`,
    };
  }
  return { allowed: true, limit, reason: `${currentMemberCount + 1}/${limit} seats used.` };
}

/**
 * Market nodes are the billable meter. Beyond the included allowance a tenant
 * must have bought capacity (`extra_nodes`); the refusal names the price rather
 * than silently accruing a charge nobody agreed to.
 */
export function nodeVerdict(subscription, currentActiveNodes) {
  const plan = getPlan(subscription?.plan_key);
  if (!plan) return { allowed: false, limit: 0, reason: "No plan on this subscription." };
  const limit = plan.includedNodes + Math.max(0, subscription.extra_nodes ?? 0);
  if (currentActiveNodes >= limit) {
    return {
      allowed: false,
      limit,
      reason: `Active market node limit reached (${currentActiveNodes}/${limit} on ${plan.name}). Add capacity at ${EXTRA_NODE_MONTHLY} ${CURRENCY}/month per node, or move to a larger plan.`,
    };
  }
  return { allowed: true, limit, reason: `${currentActiveNodes + 1}/${limit} active nodes used.` };
}

export function trialEndsAt(from = new Date()) {
  return new Date(from.getTime() + TRIAL_DAYS * 86_400_000);
}

/** Public catalog shape for the pricing page and the upgrade screen. */
export function publicCatalog() {
  return Object.values(PLANS)
    .filter((p) => p.key !== "trial")
    .map((p) => ({
      key: p.key,
      name: p.name,
      currency: CURRENCY,
      monthly: p.platformMonthly,
      annualBilled: p.platformMonthly === null ? null : p.platformMonthly * ANNUAL_MONTHS_CHARGED,
      includedSeats: p.includedSeats,
      includedNodes: p.includedNodes,
      extraNodeMonthly: EXTRA_NODE_MONTHLY,
      features: p.features,
      custom: p.platformMonthly === null,
    }));
}
