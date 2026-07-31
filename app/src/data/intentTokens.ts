// DEMO DATA — Founder-Approved Intent Tokens. Product model only, never
// wired to real money movement.
import type { IntentToken } from "../types";

export const intentTokens: IntentToken[] = [
  {
    tokenId: "FIT-2026-0412",
    approvedBy: "founder",
    action: "activate ad spend",
    vendorOrSystem: "founder",
    maxAmount: 500,
    currency: "USD",
    expiresAt: "2026-08-15T00:00:00Z",
    recurrence: "one-shot",
    environment: "sandbox",
    revoked: false,
    auditLog: [
      { timestamp: "2026-07-18T10:00:00Z", actor: "founder", action: "issued", detail: "issued for opp-001 pre-sell ad test, capped at $500 sandbox" },
    ],
  },
  {
    tokenId: "FIT-2026-0298",
    approvedBy: "founder",
    action: "pay vendor invoice",
    vendorOrSystem: "whatsapp-business-api",
    maxAmount: 2000,
    currency: "USD",
    expiresAt: "2026-06-30T00:00:00Z",
    recurrence: "bounded",
    environment: "prod",
    revoked: false,
    auditLog: [
      { timestamp: "2026-05-01T00:00:00Z", actor: "founder", action: "issued", detail: "issued for monthly WhatsApp Business API costs" },
      { timestamp: "2026-05-04T00:00:00Z", actor: "engine-08", action: "used", detail: "pay vendor invoice against whatsapp-business-api for 1840 USD — approved" },
    ],
  },
  {
    tokenId: "FIT-2026-0501",
    approvedBy: "founder",
    action: "activate paid distribution",
    vendorOrSystem: "meta-ads",
    maxAmount: 10000,
    currency: "USD",
    expiresAt: "2026-09-01T00:00:00Z",
    recurrence: "bounded",
    environment: "prod",
    revoked: true,
    auditLog: [
      { timestamp: "2026-06-10T00:00:00Z", actor: "founder", action: "issued", detail: "issued for Colombia node paid distribution test" },
      { timestamp: "2026-07-05T00:00:00Z", actor: "founder", action: "revoked", detail: "revoked pending compliance review of collections practices in Colombia" },
    ],
  },
];
