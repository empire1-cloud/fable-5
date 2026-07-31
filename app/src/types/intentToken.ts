import type { TokenEnvironment, TokenRecurrence } from "./enums";

export interface IntentTokenAuditEntry {
  timestamp: string; // ISO
  actor: string;
  action: "issued" | "checked" | "used" | "revoked" | "rejected";
  detail: string;
}

export interface IntentToken {
  tokenId: string;
  approvedBy: string; // founder signature / name
  action: string; // scoped action, e.g. "activate ad spend"
  vendorOrSystem: string;
  maxAmount: number;
  currency: string;
  expiresAt: string; // ISO
  recurrence: TokenRecurrence;
  environment: TokenEnvironment;
  revoked: boolean;
  auditLog: IntentTokenAuditEntry[];
}

/** The specific spend/action a caller wants to attempt against a token. */
export interface IntentTokenRequest {
  action: string;
  vendorOrSystem: string;
  amount: number;
  currency: string;
  environment: TokenEnvironment;
  at?: string; // ISO, defaults to now — injectable for tests
}
