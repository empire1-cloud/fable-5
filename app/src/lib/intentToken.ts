// Founder-Approved Intent Token — anti-silent-spend.
//
// NO VALID TOKEN → NO SPEND. Every financial action is checked at AUTHORIZE
// against a token. This is a product model only: it proves the control
// exists in code. Real execution, when deployed, remains founder-enabled per tenant and server-authoritative.

import type { IntentToken, IntentTokenAuditEntry, IntentTokenRequest } from "../types";

export type TokenCheckResult =
  | { valid: true; reason?: never }
  | { valid: false; reason: string };

/**
 * Validate a token against a specific requested action. Rejects and would
 * escalate (see escalation note in the result) when the token is expired,
 * revoked, over max_amount, or out of scope (wrong action / vendor /
 * environment).
 */
export function validateIntentToken(
  token: IntentToken | undefined | null,
  request: IntentTokenRequest,
): TokenCheckResult {
  const now = request.at ? new Date(request.at) : new Date();

  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    return { valid: false, reason: "amount must be finite and greater than zero" };
  }
  if (!Number.isInteger(request.amount * 100)) {
    return { valid: false, reason: "amount has more than two decimal places" };
  }
  if (!token) {
    return { valid: false, reason: "no token presented — NO VALID TOKEN → NO SPEND" };
  }
  if (token.revoked) {
    return { valid: false, reason: `token ${token.tokenId} is revoked` };
  }
  if (new Date(token.expiresAt).getTime() <= now.getTime()) {
    return {
      valid: false,
      reason: `token ${token.tokenId} expired at ${token.expiresAt}`,
    };
  }
  if (request.amount > token.maxAmount) {
    return {
      valid: false,
      reason: `requested amount ${request.amount} ${request.currency} exceeds token ceiling ${token.maxAmount} ${token.currency}`,
    };
  }
  if (request.currency !== token.currency) {
    return {
      valid: false,
      reason: `currency mismatch: token scoped to ${token.currency}, request in ${request.currency}`,
    };
  }
  if (request.action !== token.action) {
    return {
      valid: false,
      reason: `action "${request.action}" out of scope for token scoped to "${token.action}"`,
    };
  }
  if (request.vendorOrSystem !== token.vendorOrSystem) {
    return {
      valid: false,
      reason: `vendor/system "${request.vendorOrSystem}" out of scope for token scoped to "${token.vendorOrSystem}"`,
    };
  }
  if (request.environment !== token.environment) {
    return {
      valid: false,
      reason: `environment "${request.environment}" out of scope for token scoped to "${token.environment}"`,
    };
  }

  return { valid: true };
}

/** Build the audit entry a caller should append after a check (used by lib/UI, not auto-mutating). */
export function tokenAuditEntry(
  actor: string,
  result: TokenCheckResult,
  request: IntentTokenRequest,
): IntentTokenAuditEntry {
  return {
    timestamp: request.at ?? new Date().toISOString(),
    actor,
    action: result.valid ? "used" : "rejected",
    detail: result.valid
      ? `${request.action} against ${request.vendorOrSystem} for ${request.amount} ${request.currency} — approved`
      : `${request.action} against ${request.vendorOrSystem} for ${request.amount} ${request.currency} — ${result.reason}`,
  };
}
