import type { CanonEntry, IntentToken } from '../types';

/* DEMO DATA — seed intent tokens and canon entries. */

export const SEED_TOKENS: IntentToken[] = [
  {
    id: 'FIT-2026-0398',
    approvedBy: 'Founder · M.Q.',
    action: 'Google Ads spend · DACH-01 mandate keywords',
    vendorOrSystem: 'Google Ads · account 493-221',
    maxAmount: 4000,
    currency: 'EUR',
    expiresAt: '2026-07-31T23:59:00Z',
    recurrence: 'bounded',
    environment: 'prod',
    revoked: true,
    audit: [
      { at: '2026-06-01T09:00:00Z', actor: 'Founder · M.Q.', action: 'issued', detail: 'monthly ceiling €4,000' },
      { at: '2026-06-24T18:20:00Z', actor: 'Founder · M.Q.', action: 'revoked', detail: 'creative refresh pending — spend paused. No reactivation without a new token.' },
    ],
  },
  {
    id: 'FIT-2026-0412',
    approvedBy: 'Founder · M.Q.',
    action: 'activate pilot-incentive spend',
    vendorOrSystem: 'Stripe payouts · pilot program',
    maxAmount: 2500,
    currency: 'EUR',
    expiresAt: '2026-06-30T23:59:00Z',
    recurrence: 'one-shot',
    environment: 'prod',
    revoked: false,
    audit: [
      { at: '2026-06-10T10:00:00Z', actor: 'Founder · M.Q.', action: 'issued' },
      { at: '2026-07-01T00:00:00Z', actor: 'ENGINE 07', action: 'expired', detail: 'time bound reached — token no longer valid' },
    ],
  },
];

export const SEED_CANON: CanonEntry[] = [
  {
    id: 'CAN-01',
    kind: 'pattern',
    title: 'Regulatory forcing functions beat category creation for wedge entry',
    origin: 'OPP-01 · DACH mandate window',
    confidence: 0.8,
  },
  {
    id: 'NEG-02',
    kind: 'negative intelligence',
    title: 'Per-market payment-rail integration cost can destroy SMB SaaS margin (Nordics)',
    origin: 'N-NORD-01 · killed 2026-04, learning retained',
    confidence: 0.85,
  },
  {
    id: 'PRIM-07',
    kind: 'primitive',
    title: 'Onboarding sequence v1 — activation +11%, reusable across SaaS nodes',
    origin: 'ER-08 · canonized 2026-05',
    confidence: 0.75,
  },
  {
    id: 'CAN-04',
    kind: 'economic rule',
    title: 'Do not subsidize liquidity where repeat rate is flat — it does not convert to organic demand',
    origin: 'marketplace gate review · Q1',
    confidence: 0.7,
  },
];
