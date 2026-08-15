import test from "node:test";
import assert from "node:assert/strict";
import {
  accessVerdict, hasFeature, seatVerdict, nodeVerdict, trialEndsAt, priceFor,
  publicCatalog, PLANS, TRIAL_DAYS, EXTRA_NODE_MONTHLY, ANNUAL_MONTHS_CHARGED
} from "../src/domain/plans.js";

const day = 86_400_000;

test("a live trial can write and reports days remaining", () => {
  const sub = { status: "trialing", plan_key: "trial", seats: 1, trial_ends_at: new Date(Date.now() + 5 * day) };
  const v = accessVerdict(sub);
  assert.equal(v.canWrite, true);
  assert.equal(v.canRead, true);
  assert.equal(v.trialDaysRemaining, 5);
});

test("an expired trial goes read-only — it is never deleted or hidden", () => {
  const sub = { status: "trialing", plan_key: "trial", seats: 1, trial_ends_at: new Date(Date.now() - day) };
  const v = accessVerdict(sub);
  assert.equal(v.canWrite, false, "writes stop");
  assert.equal(v.canRead, true, "everything recorded stays readable — WE EVOLVE, NEVER DELETE");
  assert.equal(v.status, "expired");
  assert.match(v.reason, /remain readable/);
});

test("expiry is a fact about time, not about the stored status", () => {
  // The row still says 'trialing'; the date says otherwise. Time wins.
  const sub = { status: "trialing", plan_key: "trial", trial_ends_at: new Date(Date.now() - 1) };
  assert.equal(accessVerdict(sub).canWrite, false);
});

test("a trial with no end date is treated as expired, not as unlimited", () => {
  const sub = { status: "trialing", plan_key: "trial", trial_ends_at: null };
  assert.equal(accessVerdict(sub).canWrite, false, "missing data must fail closed");
});

test("past_due still writes — a failed card does not instantly freeze a company", () => {
  const sub = { status: "past_due", plan_key: "operator", seats: 5 };
  assert.equal(accessVerdict(sub).canWrite, true);
});

test("canceled and expired are read-only with a reason", () => {
  for (const status of ["canceled", "expired"]) {
    const v = accessVerdict({ status, plan_key: "operator", seats: 5 });
    assert.equal(v.canWrite, false);
    assert.equal(v.canRead, true);
    assert.match(v.reason, /active plan/);
  }
});

test("no subscription at all is refused both ways", () => {
  const v = accessVerdict(null);
  assert.equal(v.canWrite, false);
  assert.equal(v.canRead, false);
});

test("features are gated by the plan actually held", () => {
  const growth = { status: "active", plan_key: "operator", seats: 10 };
  assert.equal(hasFeature(growth, "market_nodes"), true);
  assert.equal(hasFeature(growth, "replication"), false, "replication is an Empire feature");

  const scale = { status: "active", plan_key: "empire", seats: 10 };
  assert.equal(hasFeature(scale, "replication"), true);
});

test("an expired subscription has no features regardless of plan", () => {
  const sub = { status: "expired", plan_key: "empire", seats: 10 };
  assert.equal(hasFeature(sub, "replication"), false);
});

test("seat limits are enforced, and the reason names the numbers", () => {
  const sub = { status: "active", plan_key: "founding" };
  assert.equal(seatVerdict(sub, 2).allowed, true);
  const full = seatVerdict(sub, PLANS.founding.includedSeats);
  assert.equal(full.allowed, false);
  assert.match(full.reason, new RegExp(`${PLANS.founding.includedSeats}/${PLANS.founding.includedSeats}`));
});

test("a stale seats column cannot raise the plan ceiling", () => {
  // Seats are a limit defined by the plan, not a number stored on the row.
  const sub = { status: "active", plan_key: "founding", seats: 999 };
  assert.equal(seatVerdict(sub, PLANS.founding.includedSeats).allowed, false);
});

test("the trial is the advertised length", () => {
  const ends = trialEndsAt(new Date("2026-01-01T00:00:00Z"));
  assert.equal(ends.toISOString().slice(0, 10), "2026-01-15");
  assert.equal(TRIAL_DAYS, 14);
});

test("every plan carries a platform fee, allowances, and features", () => {
  for (const plan of Object.values(PLANS)) {
    // Enterprise is priced on conversation — null, never 0, so it can never
    // render as free.
    assert.ok(plan.platformMonthly === null || typeof plan.platformMonthly === "number");
    assert.ok(plan.includedSeats > 0);
    assert.ok(plan.includedNodes > 0);
    assert.ok(Array.isArray(plan.features) && plan.features.length > 0);
  }
});

/* ── platform-fee pricing metered on active market nodes ───────────────── */

test("nodes are the meter: the included allowance is enforced and priced", () => {
  const sub = { status: "active", plan_key: "founding", extra_nodes: 0 };
  assert.equal(nodeVerdict(sub, 0).allowed, true, "the first node is included");

  const full = nodeVerdict(sub, PLANS.founding.includedNodes);
  assert.equal(full.allowed, false);
  // A refusal must name the price rather than silently accruing a charge.
  assert.match(full.reason, new RegExp(String(EXTRA_NODE_MONTHLY)));
  assert.match(full.reason, /per node|capacity/i);
});

test("purchased capacity raises the node ceiling", () => {
  const sub = { status: "active", plan_key: "founding", extra_nodes: 2 };
  const limit = PLANS.founding.includedNodes + 2;
  assert.equal(nodeVerdict(sub, limit - 1).allowed, true);
  assert.equal(nodeVerdict(sub, limit).allowed, false);
});

test("negative extra_nodes cannot shrink the included allowance", () => {
  const sub = { status: "active", plan_key: "founding", extra_nodes: -5 };
  assert.equal(nodeVerdict(sub, 0).allowed, true, "a bad value must not remove what the plan includes");
});

test("price is the platform fee plus extra nodes", () => {
  const p = priceFor("operator", { extraNodes: 2 });
  assert.equal(p.monthly, PLANS.operator.platformMonthly + 2 * EXTRA_NODE_MONTHLY);
  assert.equal(p.custom, false);
});

test("annual bills ten months for twelve", () => {
  const monthly = priceFor("empire", { interval: "monthly" });
  const annual = priceFor("empire", { interval: "annual" });
  assert.equal(annual.billed, monthly.monthly * ANNUAL_MONTHS_CHARGED);
  assert.equal(ANNUAL_MONTHS_CHARGED, 10, "two months free");
});

test("Enterprise is priced on conversation, never rendered as free", () => {
  const p = priceFor("enterprise");
  assert.equal(p.custom, true);
  assert.equal(p.monthly, null, "null, not 0 — 0 would display as free");
  assert.equal(p.billed, null);
});

test("an unknown plan key yields no price rather than a default one", () => {
  assert.equal(priceFor("does-not-exist"), null);
});

test("the public catalog hides the trial and advertises what is buyable", () => {
  const catalog = publicCatalog();
  assert.ok(!catalog.some((p) => p.key === "trial"), "a trial is not a plan you buy");
  assert.ok(catalog.length >= 4);
  for (const entry of catalog) {
    assert.ok(entry.includedNodes > 0);
    assert.equal(entry.extraNodeMonthly, EXTRA_NODE_MONTHLY);
    if (entry.custom) assert.equal(entry.monthly, null);
    else assert.equal(entry.annualBilled, entry.monthly * ANNUAL_MONTHS_CHARGED);
  }
});

test("plans get strictly more generous as they get more expensive", () => {
  const ladder = ["founding", "operator", "empire"];
  for (let i = 1; i < ladder.length; i++) {
    const lower = PLANS[ladder[i - 1]];
    const upper = PLANS[ladder[i]];
    assert.ok(upper.platformMonthly > lower.platformMonthly, `${upper.key} costs more`);
    assert.ok(upper.includedSeats >= lower.includedSeats, `${upper.key} includes at least as many seats`);
    assert.ok(upper.includedNodes >= lower.includedNodes, `${upper.key} includes at least as many nodes`);
    for (const f of lower.features) {
      assert.ok(upper.features.includes(f), `${upper.key} must not drop ${f} that ${lower.key} had`);
    }
  }
});
