/* The Evidence State Machine — FABLE-5's core primitive.
   PROPOSED → AUTHORIZED → EXECUTED → RECEIPTED → VERIFIED → MEASURED → LEARNED → CANONIZED
   No state may be skipped; every transition has explicit requirements.
   Anti-Fake Progress: nothing may be shown as verified unless these rules pass. */

import type {
  AutonomyLevel,
  EvidenceRecord,
  EvidenceState,
  IntentToken,
  Mission,
} from '../types';
import { EVIDENCE_STATES } from '../types';
import { validTokens, withinAuthority } from './governance';
import type { EvidenceRecord as RichEvidenceRecord } from '../types/evidenceRecord';
import type { IntentToken as RichIntentToken } from '../types/intentToken';
import type { RecordStatus } from '../types/enums';

export interface TransitionContext {
  mission?: Mission;
  tokens: IntentToken[];
  boundary: AutonomyLevel;
}

export interface Requirement {
  label: string;
  met: boolean;
  detail?: string;
}

export function nextEvidenceState(s: EvidenceState): EvidenceState | null {
  const i = EVIDENCE_STATES.indexOf(s);
  return i >= 0 && i < EVIDENCE_STATES.length - 1 ? EVIDENCE_STATES[i + 1] : null;
}

export function stateIndex(s: EvidenceState): number {
  return EVIDENCE_STATES.indexOf(s);
}

/** What each state entitles the system to claim — and no more. */
export const STATE_CLAIMS: Record<EvidenceState, string> = {
  PROPOSED: 'a ranked candidate — may not claim "approved" or "planned"',
  AUTHORIZED: 'cleared to act — may not claim "in progress"',
  EXECUTED: 'action performed — may not claim "done", "launched", or "fixed"',
  RECEIPTED: 'proof attached — may not claim "verified" or "working"',
  VERIFIED: 'independently checked — may not claim "successful"',
  MEASURED: 'scored against its gate — may not claim "scalable"',
  LEARNED: 'confidence updated — may not claim "canonical"',
  CANONIZED: 'terminal — written to canon as reusable intelligence',
};

/** Requirements to advance from the record's current state to the next one. */
export function transitionRequirements(
  rec: EvidenceRecord,
  ctx: TransitionContext,
): Requirement[] {
  const to = nextEvidenceState(rec.state);
  if (!to) return [];

  switch (to) {
    case 'AUTHORIZED': {
      const reqs: Requirement[] = [];
      if (ctx.mission) {
        const ok = withinAuthority(ctx.mission.autonomy, ctx.boundary);
        reqs.push({
          label: `authority ${ctx.mission.autonomy} within granted boundary ≤ ${ctx.boundary}`,
          met: ok,
          detail: ok ? undefined :
            ctx.mission.autonomy === 'L5'
              ? 'L5 always requires explicit founder escalation'
              : 'raise the granted boundary in Governance, or escalate to founder',
        });
      } else {
        reqs.push({ label: 'owning mission found', met: false });
      }
      if (rec.financial) {
        const tokens = validTokens(ctx.tokens);
        reqs.push({
          label: 'valid Founder-Approved Intent Token on file',
          met: tokens.length > 0,
          detail:
            tokens.length > 0
              ? `token ${tokens[0].id} · max ${tokens[0].currency} ${tokens[0].maxAmount}`
              : 'no valid token — issue one in Governance. NO VALID TOKEN → NO SPEND',
        });
      }
      return reqs;
    }
    case 'EXECUTED':
      return [
        {
          label: 'owner agent performs the action within bounds (demo simulation)',
          met: true,
          detail: 'no external execution system is connected — this simulates local demo state only',
        },
      ];
    case 'RECEIPTED':
      return [
        {
          label: 'at least one receipt attached to the mission',
          met: rec.receipts.length > 0,
          detail:
            rec.receipts.length > 0
              ? `${rec.receipts.length} receipt(s) attached`
              : 'attach a receipt — an action without a receipt did not happen',
        },
      ];
    case 'VERIFIED': {
      const unresolved = rec.contradictions.filter((c) => !c.resolved);
      return [
        {
          label: 'receipts on file',
          met: rec.receipts.length > 0,
        },
        {
          label: 'independent verification recorded',
          met: !!rec.verification,
          detail: rec.verification
            ? `${rec.verification.method} · by ${rec.verification.by}`
            : 'record an independent check — a receipt alone is not verification',
        },
        {
          label: 'no unresolved contradictions',
          met: unresolved.length === 0,
          detail:
            unresolved.length === 0
              ? undefined
              : `${unresolved.length} unresolved: ${unresolved[0].description}`,
        },
      ];
    }
    case 'MEASURED':
      return [
        {
          label: 'outcome scored against the typed economic gate',
          met: !!rec.measurement,
          detail: rec.measurement
            ? `${rec.measurement.gate} · ${rec.measurement.reading} → ${rec.measurement.verdict}`
            : 'record a gate measurement first',
        },
      ];
    case 'LEARNED':
      return [
        {
          label: 'prediction vs outcome error computed; confidence updated',
          met: true,
          detail: 'advancing updates this record’s confidence',
        },
      ];
    case 'CANONIZED':
      return [
        {
          label: 'learning written to canon as a reusable primitive or rule',
          met: true,
          detail: 'advancing appends a canon entry',
        },
      ];
    default:
      return [];
  }
}

export interface TransitionCheck {
  ok: boolean;
  to: EvidenceState | null;
  requirements: Requirement[];
}

export function canAdvance(rec: EvidenceRecord, ctx: TransitionContext): TransitionCheck {
  const to = nextEvidenceState(rec.state);
  const requirements = transitionRequirements(rec, ctx);
  return { ok: to !== null && requirements.every((r) => r.met), to, requirements };
}

// ---------------------------------------------------------------------------
// Rich-model API — operates on the modular EvidenceRecord / IntentToken shapes
// used by the /evidence + /control workspaces, src/data/evidenceRecords, and
// the guard tests. Shares the same strictly-ordered, non-skippable eight-state
// machine and the same anti-fake-progress rules as canAdvance() above.
// ---------------------------------------------------------------------------

export interface RichTransitionContext {
  token?: RichIntentToken;
}

export interface RichTransitionCheck {
  allowed: boolean;
  reason?: string;
}

/** Refuses any transition once a record is BLOCKED or KILLED — negative intelligence is retained, not resumed. */
export function canTransition(
  record: RichEvidenceRecord,
  target: RecordStatus,
  ctx: RichTransitionContext = {},
): RichTransitionCheck {
  if (record.state === 'CANONIZED') {
    return { allowed: false, reason: `record is CANONIZED — terminal` };
  }
  if (record.state === 'BLOCKED' || record.state === 'KILLED') {
    return {
      allowed: false,
      reason: `record is ${record.state} — negative intelligence is retained, not resumed`,
    };
  }
  // Sideways to a failure state is always allowed from a live state.
  if (target === 'BLOCKED' || target === 'KILLED') {
    return { allowed: true };
  }

  const from = stateIndex(record.state as EvidenceState);
  const to = EVIDENCE_STATES.indexOf(target as EvidenceState);
  if (from < 0) return { allowed: false, reason: `unknown current state "${record.state}"` };
  if (to < 0) return { allowed: false, reason: `unknown target state "${target}"` };
  if (to === from) return { allowed: false, reason: `already in state ${target}` };
  if (to < from) return { allowed: false, reason: `backward transition to ${target} is not allowed` };
  if (to > from + 1) {
    return { allowed: false, reason: `cannot skip ${EVIDENCE_STATES[from + 1]} — transitions are sequential` };
  }

  if (target === 'AUTHORIZED' && record.isFinancial) {
    const token = ctx.token;
    if (!token) {
      return { allowed: false, reason: 'no Founder-Approved Intent Token provided in context — NO VALID TOKEN → NO SPEND' };
    }
    if (token.revoked) return { allowed: false, reason: `token ${token.tokenId} is revoked` };
    if (new Date(token.expiresAt).getTime() <= Date.now()) {
      return { allowed: false, reason: `token ${token.tokenId} expired at ${token.expiresAt}` };
    }
    if (record.financialAmount != null && record.financialAmount > token.maxAmount) {
      return {
        allowed: false,
        reason: `financial amount ${record.financialAmount} exceeds token ceiling ${token.maxAmount}`,
      };
    }
    if (record.financialVendorOrSystem && token.vendorOrSystem && record.financialVendorOrSystem !== token.vendorOrSystem) {
      return { allowed: false, reason: `vendor/system out of scope for token ${token.tokenId}` };
    }
    if (record.financialEnvironment && token.environment && record.financialEnvironment !== token.environment) {
      return { allowed: false, reason: `environment out of scope for token ${token.tokenId}` };
    }
  }

  const blockers = nextStateBlockers(record);
  return blockers ? { allowed: false, reason: blockers } : { allowed: true };
}

/** Next live states the record may move to — VERIFIED is omitted until an independent verification record is on file. */
export function allowedNextStates(record: RichEvidenceRecord): EvidenceState[] {
  const next = nextEvidenceState(record.state as EvidenceState);
  if (!next) return [];
  return canTransition(record, next).allowed ? [next] : [];
}

/** Applies a transition immutably, appending an audit entry. Throws rather than mutate on an illegal transition. */
export function applyTransition(
  record: RichEvidenceRecord,
  target: EvidenceState,
  note: string,
  opts: { actor?: string; now?: Date } = {},
): RichEvidenceRecord {
  const check = canTransition(record, target);
  if (!check.allowed) {
    throw new Error(`illegal transition ${record.state} -> ${target}: ${check.reason ?? 'not allowed'}`);
  }
  return {
    ...record,
    state: target,
    auditHistory: [
      ...record.auditHistory,
      { state: target, timestamp: (opts.now ?? new Date()).toISOString(), actor: opts.actor ?? 'system', reason: note },
    ],
  };
}

/** Human-readable unmet requirements blocking the record's next live state; '' means clear. */
export function nextStateBlockers(record: RichEvidenceRecord): string {
  const next = nextEvidenceState(record.state as EvidenceState);
  if (!next) return '';

  const unmet: string[] = [];
  switch (next) {
    case 'AUTHORIZED':
      if (!record.isFinancial && !record.authorization) {
        unmet.push('an authorization record must be on file before AUTHORIZED');
      }
      break;
    case 'RECEIPTED':
      if (record.evidence.length === 0) {
        unmet.push('at least one receipt must be attached — an action without a receipt did not happen');
      }
      break;
    case 'VERIFIED':
      if (record.verifications.length === 0) {
        unmet.push('no independent verification record on file — a receipt alone is not verification');
      }
      if (record.contradictions.some((c) => !c.resolved)) {
        unmet.push('unresolved contradictions remain');
      }
      break;
    case 'MEASURED':
      if (!record.measurement) {
        unmet.push('an outcome measurement against the typed economic gate must be recorded');
      }
      break;
    default:
      break;
  }
  return unmet.join('; ');
}
