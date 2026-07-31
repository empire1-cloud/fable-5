import { describe, expect, it } from "vitest";
import { allowedNextStates, applyTransition, canTransition, nextStateBlockers } from "./evidence";
import type { EvidenceRecord } from "../types/evidenceRecord";

function baseRecord(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: "ev-test-1",
    subject: "test subject",
    state: "PROPOSED",
    evidence: [],
    confidence: 0.6,
    verifications: [],
    contradictions: [],
    auditHistory: [{ state: "PROPOSED", timestamp: "2026-01-01T00:00:00Z", actor: "engine-00", reason: "filed" }],
    ...overrides,
  };
}

describe("evidence state machine — ordering", () => {
  it("allows PROPOSED -> AUTHORIZED when an authorization record exists and the action is non-financial", () => {
    const record = baseRecord({
      authorization: { authorizedBy: "founder", authorityLevel: "L2" },
    });
    const result = canTransition(record, "AUTHORIZED");
    expect(result.allowed).toBe(true);
  });

  it("VALID: allows RECEIPTED -> VERIFIED when a verification record exists, is reproduced, and there are no unresolved contradictions", () => {
    const record = baseRecord({
      state: "RECEIPTED",
      evidence: [
        {
          id: "rc-1",
          type: "test output",
          payloadRef: "ci://run/123",
          quality: "strong",
          createdAt: "2026-01-02T00:00:00Z",
        },
      ],
      verifications: [
        {
          id: "vr-1",
          verifiedReceiptId: "rc-1",
          verifiedBy: "engine-07",
          reproduced: true,
          method: "independent re-run",
          createdAt: "2026-01-03T00:00:00Z",
        },
      ],
      contradictions: [],
    });

    const result = canTransition(record, "VERIFIED");
    expect(result.allowed).toBe(true);

    const applied = applyTransition(record, "VERIFIED", "independent check reproduced the result", {
      actor: "engine-07",
      now: new Date("2026-01-03T01:00:00Z"),
    });
    expect(applied.state).toBe("VERIFIED");
    expect(applied.auditHistory.at(-1)).toMatchObject({ state: "VERIFIED", actor: "engine-07" });
  });

  it("a record never renders Verified without a verification record (allowedNextStates omits VERIFIED)", () => {
    const record = baseRecord({
      state: "RECEIPTED",
      evidence: [
        { id: "rc-2", type: "commit", payloadRef: "abc123", quality: "adequate", createdAt: "2026-01-02T00:00:00Z" },
      ],
      verifications: [], // no verification record on file
    });
    expect(allowedNextStates(record)).toEqual([]);
    expect(nextStateBlockers(record)).toMatch(/no independent verification record/i);
  });

  it("INVALID: blocks EXECUTED -> VERIFIED, skipping RECEIPTED, with a reason naming the skipped state", () => {
    const record = baseRecord({
      state: "EXECUTED",
      executionLog: "engine-03 ran deploy script at 2026-01-02T00:00:00Z",
    });
    const result = canTransition(record, "VERIFIED");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toMatch(/cannot skip/i);
      expect(result.reason).toMatch(/RECEIPTED/);
    }
  });

  it("INVALID: blocks RECEIPTED -> VERIFIED when contradictions are unresolved, even with a reproduced verification on file", () => {
    const record = baseRecord({
      state: "RECEIPTED",
      evidence: [
        { id: "rc-3", type: "metric", payloadRef: "dash://kpi/7", quality: "strong", createdAt: "2026-01-02T00:00:00Z" },
      ],
      verifications: [
        {
          id: "vr-2",
          verifiedReceiptId: "rc-3",
          verifiedBy: "engine-07",
          reproduced: true,
          method: "independent re-run",
          createdAt: "2026-01-03T00:00:00Z",
        },
      ],
      contradictions: [
        { id: "ct-1", description: "peer measurement disagrees", raisedAt: "2026-01-03T00:30:00Z", resolved: false },
      ],
    });

    const result = canTransition(record, "VERIFIED");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toMatch(/unresolved contradiction/i);
    }
  });

  it("blocks backward transitions", () => {
    const record = baseRecord({ state: "MEASURED", measurement: { kpi: "NRR", value: 105, threshold: 100, passed: true } });
    const result = canTransition(record, "RECEIPTED");
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toMatch(/backward/i);
  });

  it("always allows sideways transition to BLOCKED from a live state", () => {
    const record = baseRecord({ state: "AUTHORIZED", authorization: { authorizedBy: "founder", authorityLevel: "L3" } });
    const result = canTransition(record, "BLOCKED");
    expect(result.allowed).toBe(true);
  });

  it("refuses any transition once a record is BLOCKED or KILLED (negative intelligence is retained, not resumed)", () => {
    const record = baseRecord({ state: "BLOCKED", failureReason: "gate breach" });
    const result = canTransition(record, "AUTHORIZED");
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toMatch(/BLOCKED/);
  });

  it("applyTransition throws rather than mutate on an illegal transition", () => {
    const record = baseRecord({ state: "EXECUTED", executionLog: "ran" });
    expect(() => applyTransition(record, "VERIFIED", "trying to skip")).toThrow(/illegal transition/i);
  });
});

describe("evidence state machine — financial AUTHORIZED requires a valid Intent Token", () => {
  const financialRecord = baseRecord({
    state: "PROPOSED",
    subject: "activate ad spend",
    isFinancial: true,
    authorization: { authorizedBy: "founder", authorityLevel: "L4" },
    intentTokenId: "FIT-2026-0412",
    financialVendorOrSystem: "meta-ads",
    financialAmount: 100,
    financialCurrency: "USD",
    financialEnvironment: "sandbox",
  });

  it("blocks AUTHORIZED when no token is provided in context", () => {
    const result = canTransition(financialRecord, "AUTHORIZED");
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toMatch(/Intent Token/i);
  });

  it("allows AUTHORIZED when a valid, in-scope token is provided", () => {
    const result = canTransition(financialRecord, "AUTHORIZED", {
      token: {
        tokenId: "FIT-2026-0412",
        approvedBy: "founder",
        action: "activate ad spend",
        vendorOrSystem: "meta-ads",
        maxAmount: 5000,
        currency: "USD",
        expiresAt: "2027-01-01T00:00:00Z",
        recurrence: "one-shot",
        environment: "sandbox",
        revoked: false,
        auditLog: [],
      },
    });
    expect(result.allowed).toBe(true);
  });
});
