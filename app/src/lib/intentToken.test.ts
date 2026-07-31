import { describe, expect, it } from "vitest";
import { validateIntentToken } from "./intentToken";
import type { IntentToken } from "../types/intentToken";

function baseToken(overrides: Partial<IntentToken> = {}): IntentToken {
  return {
    tokenId: "FIT-2026-0412",
    approvedBy: "founder",
    action: "activate ad spend",
    vendorOrSystem: "meta-ads",
    maxAmount: 2000,
    currency: "USD",
    expiresAt: "2026-12-31T23:59:59Z",
    recurrence: "bounded",
    environment: "prod",
    revoked: false,
    auditLog: [],
    ...overrides,
  };
}

describe("Intent Token validation — NO VALID TOKEN → NO SPEND", () => {
  it("accepts a valid, in-scope, unexpired token under the ceiling", () => {
    const token = baseToken();
    const result = validateIntentToken(token, {
      action: "activate ad spend",
      vendorOrSystem: "meta-ads",
      amount: 1500,
      currency: "USD",
      environment: "prod",
      at: "2026-06-01T00:00:00Z",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects an expired token", () => {
    const token = baseToken({ expiresAt: "2026-01-01T00:00:00Z" });
    const result = validateIntentToken(token, {
      action: "activate ad spend",
      vendorOrSystem: "meta-ads",
      amount: 500,
      currency: "USD",
      environment: "prod",
      at: "2026-07-22T00:00:00Z",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/expired/i);
  });

  it("rejects a revoked token", () => {
    const token = baseToken({ revoked: true });
    const result = validateIntentToken(token, {
      action: "activate ad spend",
      vendorOrSystem: "meta-ads",
      amount: 500,
      currency: "USD",
      environment: "prod",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/revoked/i);
  });

  it("rejects a request over max_amount", () => {
    const token = baseToken({ maxAmount: 1000 });
    const result = validateIntentToken(token, {
      action: "activate ad spend",
      vendorOrSystem: "meta-ads",
      amount: 1200,
      currency: "USD",
      environment: "prod",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/exceeds token ceiling/i);
  });

  it("rejects an out-of-scope action (wrong action)", () => {
    const token = baseToken();
    const result = validateIntentToken(token, {
      action: "buy a domain",
      vendorOrSystem: "meta-ads",
      amount: 100,
      currency: "USD",
      environment: "prod",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/out of scope/i);
  });

  it("rejects an out-of-scope vendor", () => {
    const token = baseToken();
    const result = validateIntentToken(token, {
      action: "activate ad spend",
      vendorOrSystem: "google-ads",
      amount: 100,
      currency: "USD",
      environment: "prod",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/vendor\/system/i);
  });

  it("rejects an out-of-scope environment (sandbox token used against prod request)", () => {
    const token = baseToken({ environment: "sandbox" });
    const result = validateIntentToken(token, {
      action: "activate ad spend",
      vendorOrSystem: "meta-ads",
      amount: 100,
      currency: "USD",
      environment: "prod",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/environment/i);
  });

  it.each([NaN, Infinity, -Infinity, 0, -1])("rejects non-finite or non-positive amount %s", (amount) => {
    const result = validateIntentToken(baseToken(), {
      action: "activate ad spend",
      vendorOrSystem: "meta-ads",
      amount,
      currency: "USD",
      environment: "prod",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/finite|greater than zero/i);
  });

  it("rejects more than two decimal places", () => {
    const result = validateIntentToken(baseToken(), {
      action: "activate ad spend",
      vendorOrSystem: "meta-ads",
      amount: 1.001,
      currency: "USD",
      environment: "prod",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/two decimal/i);
  });

  it("rejects when no token is presented at all", () => {
    const result = validateIntentToken(undefined, {
      action: "activate ad spend",
      vendorOrSystem: "meta-ads",
      amount: 100,
      currency: "USD",
      environment: "prod",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/no token presented/i);
  });
});
