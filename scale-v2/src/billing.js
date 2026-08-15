/*
 * Stripe billing.
 *
 * HONESTLY GATED. Without STRIPE_SECRET_KEY every entry point reports that
 * billing is not configured and refuses. It never pretends a charge happened,
 * and it never silently upgrades a tenant — the same rule the rest of this
 * system applies to agents applies to itself.
 *
 * PRICES ARE NOT HARDCODED HERE. They are resolved from Stripe by metadata
 * (plan_key + billing_interval), so there is no list of price IDs in this
 * repository to drift out of sync with the account. On resolution the amount
 * is reconciled against src/domain/plans.js and a mismatch REFUSES the
 * checkout rather than charging a price the product does not advertise. A
 * customer must never be charged a number the page did not show them.
 */
import Stripe from "stripe";
import { pool, withTenant } from "./db.js";
import { getPlan, priceFor, CURRENCY } from "./domain/plans.js";

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const notConfigured = (message) => Object.assign(new Error(message), { status: 503 });

let client = null;

export function billingConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripeClient() {
  if (!billingConfigured()) return null;
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // Pinned: an account-level API version change must not silently alter
      // the shape of objects this code reads.
      apiVersion: "2025-08-27.basil",
      maxNetworkRetries: 2,
    });
  }
  return client;
}

/** Reported to the client so the UI can say what is true rather than showing
 *  a checkout button that cannot work. */
export function billingStatus() {
  return {
    configured: billingConfigured(),
    webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    currency: CURRENCY,
    reason: billingConfigured()
      ? "Billing is configured."
      : "Billing is not configured on this deployment — STRIPE_SECRET_KEY is not set. Checkout is unavailable; no charge can be created.",
  };
}

const priceCache = new Map();

/**
 * Finds the live Price for a plan and interval by its metadata, and refuses if
 * Stripe's amount disagrees with the catalog the product advertises.
 */
export async function resolvePrice(planKey, interval) {
  const stripe = stripeClient();
  if (!stripe) throw notConfigured(billingStatus().reason);

  const cacheKey = `${planKey}:${interval}`;
  if (priceCache.has(cacheKey)) return priceCache.get(cacheKey);

  const plan = getPlan(planKey);
  if (!plan) throw badRequest(`Unknown plan: ${planKey}`);
  if (plan.platformMonthly === null) {
    throw badRequest(`${plan.name} is priced on a conversation and has no self-serve checkout.`);
  }

  const search = await stripe.prices.search({
    query: `active:'true' AND metadata['plan_key']:'${planKey}' AND metadata['billing_interval']:'${interval}'`,
    limit: 2,
  });

  if (search.data.length === 0) {
    throw notConfigured(
      `No active Stripe price found for ${planKey}/${interval}. The Stripe catalog does not match this deployment.`,
    );
  }
  if (search.data.length > 1) {
    // Two active prices for one plan means an ambiguous charge. Refuse rather
    // than pick one and hope it is the intended amount.
    throw notConfigured(
      `Multiple active Stripe prices match ${planKey}/${interval}. Archive the duplicates before selling this plan.`,
    );
  }

  const price = search.data[0];
  const expected = priceFor(planKey, { interval });
  const expectedMinor = Math.round((interval === "annual" ? expected.billed : expected.monthly) * 100);

  if (price.unit_amount !== expectedMinor) {
    throw notConfigured(
      `Stripe price ${price.id} charges ${price.unit_amount / 100} ${price.currency.toUpperCase()} for ${planKey}/${interval}, but this deployment advertises ${expectedMinor / 100} ${CURRENCY}. Refusing to charge a price the product does not show.`,
    );
  }
  if (price.currency.toUpperCase() !== CURRENCY) {
    throw notConfigured(
      `Stripe price ${price.id} is in ${price.currency.toUpperCase()} but this deployment advertises ${CURRENCY}.`,
    );
  }

  priceCache.set(cacheKey, price);
  return price;
}

/** Reuses the tenant's Stripe customer if one exists, so a returning customer
 *  does not accumulate duplicates with split billing history. */
async function customerFor(actor) {
  const stripe = stripeClient();
  const existing = await withTenant(actor.tenantId, async (c) => {
    const { rows } = await c.query(
      `SELECT stripe_customer_id FROM subscriptions
        WHERE stripe_customer_id IS NOT NULL
        ORDER BY created_at DESC LIMIT 1`,
    );
    return rows[0]?.stripe_customer_id ?? null;
  });
  if (existing) return existing;

  const customer = await stripe.customers.create({
    email: actor.email,
    name: actor.tenantName,
    // tenant_id travels with the customer so a webhook can always find its way
    // home even if a session's metadata is missing.
    metadata: { tenant_id: actor.tenantId, tenant_name: actor.tenantName },
  });
  return customer.id;
}

export async function createCheckoutSession(actor, { planKey, interval = "monthly", extraNodes = 0, returnUrl }) {
  const stripe = stripeClient();
  if (!stripe) throw notConfigured(billingStatus().reason);
  if (!["monthly", "annual"].includes(interval)) throw badRequest("interval must be monthly or annual");

  const price = await resolvePrice(planKey, interval);
  const lineItems = [{ price: price.id, quantity: 1 }];

  if (extraNodes > 0) {
    if (interval !== "monthly") {
      throw badRequest("Additional market nodes are billed monthly; buy them from the billing page after subscribing.");
    }
    const nodePrice = await resolvePrice("extra_node", "monthly");
    lineItems.push({ price: nodePrice.id, quantity: extraNodes });
  }

  const customer = await customerFor(actor);
  const base = (returnUrl || process.env.APP_ORIGIN || "").split(",")[0].replace(/\/+$/, "");

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: lineItems,
    success_url: `${base}/#/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/#/billing/cancel`,
    // Both the session and the subscription carry the tenant, so the webhook
    // never has to guess which organisation paid.
    client_reference_id: actor.tenantId,
    metadata: { tenant_id: actor.tenantId, plan_key: planKey, billing_interval: interval, extra_nodes: String(extraNodes) },
    subscription_data: {
      metadata: { tenant_id: actor.tenantId, plan_key: planKey, billing_interval: interval, extra_nodes: String(extraNodes) },
    },
  });

  return { id: session.id, url: session.url };
}

/** Maps a Stripe subscription status onto the vocabulary migration 006 allows.
 *  An unrecognised status must not be written — the CHECK would reject it, and
 *  guessing could silently grant access. */
function mapStatus(stripeStatus) {
  switch (stripeStatus) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "past_due":
    case "unpaid": return "past_due";
    case "canceled":
    case "incomplete_expired": return "canceled";
    case "incomplete":
    case "paused": return "expired";
    default: return null;
  }
}

/**
 * Applies a subscription object to the tenant's row.
 *
 * Ordering is enforced with provider_event_created: Stripe does not guarantee
 * delivery order, and an older event arriving late must not overwrite a newer
 * state (e.g. a stale 'active' resurrecting a cancelled plan).
 */
export async function applySubscription(subscription, event) {
  const tenantId = subscription.metadata?.tenant_id;
  if (!tenantId) return { applied: false, reason: "subscription carries no tenant_id" };

  const status = mapStatus(subscription.status);
  if (!status) return { applied: false, reason: `unmapped Stripe status: ${subscription.status}` };

  const planKey = subscription.metadata?.plan_key ?? null;
  if (!planKey || !getPlan(planKey)) {
    return { applied: false, reason: `subscription carries no known plan_key (${planKey})` };
  }

  const interval = subscription.metadata?.billing_interval === "annual" ? "annual" : "monthly";
  const extraNodes = Number(subscription.metadata?.extra_nodes ?? 0) || 0;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;

  return withTenant(tenantId, async (client) => {
    // The partial unique index allows only one live subscription per tenant,
    // so the trial must be retired in the same transaction that installs the
    // paid plan.
    await client.query(
      `UPDATE subscriptions
          SET status = 'canceled', updated_at = now()
        WHERE status IN ('trialing','active','past_due')
          AND (stripe_subscription_id IS DISTINCT FROM $1)`,
      [subscription.id],
    );

    const { rows } = await client.query(
      `INSERT INTO subscriptions
         (tenant_id, stripe_subscription_id, stripe_customer_id, status, plan_key,
          seats, extra_nodes, billing_interval, current_period_end,
          provider_event_created, provider_event_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (tenant_id, stripe_subscription_id) DO UPDATE
         SET status = EXCLUDED.status,
             plan_key = EXCLUDED.plan_key,
             extra_nodes = EXCLUDED.extra_nodes,
             billing_interval = EXCLUDED.billing_interval,
             current_period_end = EXCLUDED.current_period_end,
             stripe_customer_id = EXCLUDED.stripe_customer_id,
             provider_event_created = EXCLUDED.provider_event_created,
             provider_event_id = EXCLUDED.provider_event_id,
             updated_at = now()
         WHERE subscriptions.provider_event_created <= EXCLUDED.provider_event_created
       RETURNING id, status, plan_key`,
      [
        tenantId,
        subscription.id,
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
        status,
        planKey,
        getPlan(planKey)?.includedSeats ?? 1,
        extraNodes,
        interval,
        periodEnd,
        event?.created ?? 0,
        event?.id ?? "",
      ],
    );

    // No row returned means the guard rejected an out-of-order event.
    if (!rows[0]) return { applied: false, reason: "a newer event has already been applied" };
    return { applied: true, tenantId, ...rows[0] };
  });
}

/**
 * Verifies the signature and applies the event.
 *
 * The signature check is the whole security boundary here — without it anyone
 * who can reach the endpoint could grant themselves a plan by POSTing JSON.
 * If no webhook secret is configured this refuses rather than trusting the
 * body.
 */
export async function handleWebhook(rawBody, signature) {
  const stripe = stripeClient();
  if (!stripe) throw notConfigured(billingStatus().reason);

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw notConfigured(
      "STRIPE_WEBHOOK_SECRET is not set — refusing to trust an unverified webhook body.",
    );
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    throw Object.assign(new Error(`Webhook signature verification failed: ${error.message}`), { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (!session.subscription) return { received: true, handled: false, reason: "session has no subscription" };
      const subscription = await stripe.subscriptions.retrieve(
        typeof session.subscription === "string" ? session.subscription : session.subscription.id,
      );
      // A session's metadata is the reliable copy at this point; make sure the
      // subscription carries it too for every later event.
      if (!subscription.metadata?.tenant_id && session.metadata?.tenant_id) {
        await stripe.subscriptions.update(subscription.id, { metadata: session.metadata });
        subscription.metadata = session.metadata;
      }
      const result = await applySubscription(subscription, event);
      return { received: true, handled: result.applied, ...result };
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const result = await applySubscription(event.data.object, event);
      return { received: true, handled: result.applied, ...result };
    }

    default:
      // Acknowledged but not acted on — Stripe should not retry an event this
      // deployment has no opinion about.
      return { received: true, handled: false, reason: `unhandled event type: ${event.type}` };
  }
}
