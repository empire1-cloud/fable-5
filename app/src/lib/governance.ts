import type { AutonomyLevel, IntentToken } from '../types';

export const AUTONOMY_LEVELS: { level: AutonomyLevel; name: string; desc: string }[] = [
  { level: 'L0', name: 'Observe', desc: 'Read, scan, monitor, summarize. May not act.' },
  { level: 'L1', name: 'Recommend', desc: 'Rank, analyze, propose. May not execute.' },
  { level: 'L2', name: 'Draft', desc: 'Prepare assets and workflows. May not publish or deploy.' },
  { level: 'L3', name: 'Execute Reversible', desc: 'Low-risk, bounded, reversible, non-financial actions.' },
  { level: 'L4', name: 'Execute In Bounds', desc: 'Acts inside approved budgets, workflows, environments, policies.' },
  { level: 'L5', name: 'Founder Escalation', desc: 'Irreversible changes, financial actions, legal commitments, deletion, public claims, equity, domains, ownership, high-risk compliance.' },
];

export function levelIndex(l: AutonomyLevel): number {
  return Number(l.slice(1));
}

/** Whether a mission at `required` may be authorized under the granted `boundary`.
    L5 always requires explicit founder escalation regardless of boundary. */
export function withinAuthority(required: AutonomyLevel, boundary: AutonomyLevel): boolean {
  if (required === 'L5') return false;
  return levelIndex(required) <= levelIndex(boundary);
}

export function tokenIsValid(t: IntentToken, now = Date.now()): boolean {
  return !t.revoked && Date.parse(t.expiresAt) > now;
}

export function validTokens(tokens: IntentToken[], now = Date.now()): IntentToken[] {
  return tokens.filter((t) => tokenIsValid(t, now));
}

export function tokenStatus(t: IntentToken, now = Date.now()): 'VALID' | 'REVOKED' | 'EXPIRED' {
  if (t.revoked) return 'REVOKED';
  if (Date.parse(t.expiresAt) <= now) return 'EXPIRED';
  return 'VALID';
}
