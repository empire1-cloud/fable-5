import test from "node:test";
import assert from "node:assert/strict";
import { ENGINE_REGISTRY, getEngine } from "../src/engine-registry.js";
import { assertTransition, EvidenceTransitionError } from "../src/domain/evidence.js";
import { rankOpportunity } from "../src/domain/ranking.js";
import { evaluateIntentToken } from "../src/domain/spend.js";

test("FABLE-5 preserves exactly nine engines", () => {
  assert.equal(ENGINE_REGISTRY.length, 9);
  assert.deepEqual(ENGINE_REGISTRY.map((e) => e.id), ["00","01","02","03","04","05","06","07","08"]);
});

test("Engine 07 connects to every other engine", () => {
  assert.deepEqual(getEngine("07").connected, ["00","01","02","03","04","05","06","08"]);
});

test("evidence state machine refuses skipped gates", () => {
  assert.throws(() => assertTransition("PROPOSED", "RECEIPTED"), EvidenceTransitionError);
});

test("RECEIPTED requires a receipt", () => {
  assert.throws(() => assertTransition("EXECUTED", "RECEIPTED", { receiptCount: 0 }), /requires at least one/);
  assert.equal(assertTransition("EXECUTED", "RECEIPTED", { receiptCount: 1 }), true);
});

test("VERIFIED requires independent verification", () => {
  assert.throws(() => assertTransition("RECEIPTED", "VERIFIED", { independentVerificationCount: 0 }), /independent/);
  assert.equal(assertTransition("RECEIPTED", "VERIFIED", { independentVerificationCount: 1 }), true);
});

test("LEARNED requires a supported learning", () => {
  assert.throws(() => assertTransition("MEASURED", "LEARNED", {}), /supported learning/);
  assert.equal(assertTransition("MEASURED", "LEARNED", {
    learning: { statement: "Paid pilots convert better after verified onboarding.", supportingEvidenceIds: ["e1"] }
  }), true);
});

test("CANONIZED requires explicit promotion approval", () => {
  assert.throws(() => assertTransition("LEARNED", "CANONIZED", {}), /promotion approval/);
  assert.equal(assertTransition("LEARNED", "CANONIZED", {
    canonApproval: { approved: true, policyVersion: "canon-v2", approvedBy: "founder" }
  }), true);
});

test("Engine 00 ranking refuses weak evidence", () => {
  const result = rankOpportunity({
    evidenceStrength: 20, demandSignal: 95, strategicFit: 95, marginPotential: 95,
    reversibility: 80, executionReadiness: 90, risk: 20, resourceCost: 20
  });
  assert.equal(result.verdict, "HOLD_FOR_EVIDENCE");
});

test("Engine 00 ranking can authorize a strong experiment", () => {
  const result = rankOpportunity({
    evidenceStrength: 92, demandSignal: 88, strategicFit: 96, marginPotential: 84,
    reversibility: 80, executionReadiness: 90, risk: 20, resourceCost: 30
  });
  assert.equal(result.verdict, "AUTHORIZE_EXPERIMENT");
  assert.ok(result.score >= 78);
});

test("No Intent Token means no spend", () => {
  const verdict = evaluateIntentToken(null, {
    tenantId: "t1", action: "deploy", vendorOrSystem: "x", amount: 10,
    currency: "USD", environment: "prod"
  });
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.executed, false);
});

test("A valid token authorizes but never silently executes", () => {
  const verdict = evaluateIntentToken({
    tenantId: "t1", action: "deploy", vendorOrSystem: "x", maxAmount: 100,
    currency: "USD", environment: "prod", revoked: false,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  }, {
    tenantId: "t1", action: "deploy", vendorOrSystem: "x", amount: 10,
    currency: "USD", environment: "prod"
  });
  assert.equal(verdict.allowed, true);
  assert.equal(verdict.executed, false);
});
