import test from "node:test";
import assert from "node:assert/strict";
import { accessVerdict, hasFeature, seatVerdict, trialEndsAt, PLANS, TRIAL_DAYS } from "../src/domain/plans.js";

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
  const sub = { status: "past_due", plan_key: "growth", seats: 5 };
  assert.equal(accessVerdict(sub).canWrite, true);
});

test("canceled and expired are read-only with a reason", () => {
  for (const status of ["canceled", "expired"]) {
    const v = accessVerdict({ status, plan_key: "growth", seats: 5 });
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
  const growth = { status: "active", plan_key: "growth", seats: 10 };
  assert.equal(hasFeature(growth, "market_nodes"), true);
  assert.equal(hasFeature(growth, "replication"), false, "replication is a Scale feature");

  const scale = { status: "active", plan_key: "scale", seats: 10 };
  assert.equal(hasFeature(scale, "replication"), true);
});

test("an expired subscription has no features regardless of plan", () => {
  const sub = { status: "expired", plan_key: "scale", seats: 10 };
  assert.equal(hasFeature(sub, "replication"), false);
});

test("seat limits are enforced, and the reason names the numbers", () => {
  const sub = { status: "active", plan_key: "starter", seats: 5 };
  assert.equal(seatVerdict(sub, 4).allowed, true);
  const full = seatVerdict(sub, 5);
  assert.equal(full.allowed, false);
  assert.match(full.reason, /5\/5/);
});

test("seats can never exceed the plan ceiling even if the row says otherwise", () => {
  // A stale or tampered row claiming 999 seats on Starter must not grant them.
  const sub = { status: "active", plan_key: "starter", seats: 999 };
  assert.equal(seatVerdict(sub, PLANS.starter.maxSeats).allowed, false);
});

test("the trial is the advertised length", () => {
  const ends = trialEndsAt(new Date("2026-01-01T00:00:00Z"));
  assert.equal(ends.toISOString().slice(0, 10), "2026-01-15");
  assert.equal(TRIAL_DAYS, 14);
});

test("every plan is per-seat priced and lists its features", () => {
  for (const plan of Object.values(PLANS)) {
    assert.equal(typeof plan.pricePerSeatMonthly, "number");
    assert.ok(plan.maxSeats > 0);
    assert.ok(Array.isArray(plan.features) && plan.features.length > 0);
  }
});
