export function evaluateIntentToken(token, request, now = new Date()) {
  const refuse = (reason, code) => ({ allowed: false, executed: false, code, reason });

  if (!token) return refuse("No Intent Token presented — NO VALID TOKEN → NO SPEND.", "TOKEN_MISSING");
  if (token.revoked) return refuse("Intent Token is revoked.", "TOKEN_REVOKED");
  if (new Date(token.expiresAt).getTime() <= now.getTime()) return refuse("Intent Token is expired.", "TOKEN_EXPIRED");
  if (token.tenantId !== request.tenantId) return refuse("Intent Token belongs to another organization.", "TENANT_MISMATCH");
  if (token.action !== request.action) return refuse("Requested action is outside the token scope.", "ACTION_MISMATCH");
  if (token.vendorOrSystem !== request.vendorOrSystem) return refuse("Vendor or system is outside the token scope.", "VENDOR_MISMATCH");
  if (token.currency !== request.currency) return refuse("Currency is outside the token scope.", "CURRENCY_MISMATCH");
  if (Number(request.amount) > Number(token.maxAmount)) return refuse("Requested amount exceeds the token ceiling.", "AMOUNT_EXCEEDED");
  if (token.environment !== request.environment) return refuse("Environment is outside the token scope.", "ENVIRONMENT_MISMATCH");

  return {
    allowed: true,
    executed: false,
    code: "AUTHORIZED_VERDICT_ONLY",
    reason: "Intent Token is valid. Execution remains false until the organization enables an approved connector."
  };
}
