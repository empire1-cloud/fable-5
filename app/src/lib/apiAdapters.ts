/**
 * apiAdapters.ts
 * Maps empire_auto_cofounder API types → FABLE-5 domain types.
 *
 * Evidence state derivation from API status:
 *   approval.status = "pending"                        → PROPOSED
 *   approval.status = "approved" + no manifest         → AUTHORIZED
 *   approval.status = "approved" + manifest sealed     → EXECUTED
 *   approval.status = "approved" + manifest consumed   → RECEIPTED
 *   proof.canonical_proof_status = "success"           → VERIFIED (set separately)
 *
 * Receipts, MEASURED, LEARNED, CANONIZED are Phase 13 additions —
 * if the receipts endpoint is live, those states are derived from it.
 * Until then, RECEIPTED is the terminal live state.
 */

import type {
  AutonomyLevel,
  CanonEntry,
  EvidenceRecord,
  EvidenceState,
  IntentToken,
  Mission,
  MissionStatus,
} from '../types';
import type {
  ApiApproval,
  ApiManifest,
  ApiAgentEntry,
  ApiSkillEntry,
  ApiTask,
} from './empireApi';

// ── Helpers ───────────────────────────────────────────────────────────────

function safeDate(s: string | null | undefined): string {
  return s ?? new Date().toISOString();
}

/** Derive EvidenceState from an approval + its manifest (if any). */
function deriveEvidenceState(
  approval: ApiApproval,
  manifest: ApiManifest | undefined,
): EvidenceState {
  if (approval.status === 'blocked' || approval.status === 'rejected') {
    // Terminal negative — keep as PROPOSED so it shows up, not hidden
    return 'PROPOSED';
  }
  if (approval.status === 'pending') return 'PROPOSED';

  // approved from here
  if (!manifest) return 'AUTHORIZED';
  if (manifest.status === 'sealed') return 'EXECUTED';
  if (manifest.status === 'consumed') return 'RECEIPTED';

  return 'AUTHORIZED';
}

/** Map empire_auto_cofounder task priority to FABLE-5 AutonomyLevel */
function priorityToAutonomy(priority: string): AutonomyLevel {
  switch (priority.toLowerCase()) {
    case 'critical': return 'L5';
    case 'high':     return 'L4';
    case 'medium':   return 'L3';
    case 'low':      return 'L2';
    default:         return 'L3';
  }
}

/** Map task status to FABLE-5 MissionStatus */
function taskStatusToMission(status: string): MissionStatus {
  switch (status.toLowerCase()) {
    case 'open':    return 'QUEUED';
    case 'active':  return 'ACTIVE';
    case 'blocked': return 'BLOCKED';
    default:        return 'QUEUED';
  }
}

// ── Adapters ──────────────────────────────────────────────────────────────

/**
 * ApiTask → FABLE-5 Mission
 * Each task gets a synthetic evidenceRecordId keyed to its plan
 * (approval) so the state machine can find its evidence record.
 */
export function adaptTask(task: ApiTask): Mission {
  return {
    id: `M-${task.id}`,
    objective: task.title,
    engineId: '03',                               // default to builder engine
    owner: 'AGENT · empire-cofounder',
    autonomy: priorityToAutonomy(task.priority),
    status: taskStatusToMission(task.status),
    budget: '—',
    successCriteria: task.description || task.title,
    evidenceRequirement: 'test output + reproducible check',
    escalationCondition: 'consecutive verification failures',
    evidenceRecordId: `ER-task-${task.id}`,
    financial: task.requires_approval,
  };
}

/**
 * ApiApproval + matching manifest → FABLE-5 EvidenceRecord
 * The evidence record ID mirrors the mission's evidenceRecordId
 * so AppState can join them correctly.
 */
export function adaptApproval(
  approval: ApiApproval,
  manifest: ApiManifest | undefined,
): EvidenceRecord {
  const state = deriveEvidenceState(approval, manifest);
  const now = safeDate(approval.created_at);

  const auditTrail = [
    {
      at: now,
      actor: 'empire-cofounder',
      action: `approval created — status: ${approval.status}`,
    },
  ];

  if (approval.resolved_at) {
    auditTrail.push({
      at: approval.resolved_at,
      actor: 'FOUNDER · human decision',
      action: `${approval.decision ?? 'resolved'} — ${approval.human_note ?? ''}`,
    });
  }

  if (manifest?.sealed_at) {
    auditTrail.push({
      at: manifest.sealed_at,
      actor: 'empire-cofounder',
      action: 'manifest sealed — advanced to EXECUTED',
    });
  }

  if (manifest?.consumed_at) {
    auditTrail.push({
      at: manifest.consumed_at,
      actor: manifest.consumed_by ?? 'hermes-local-stub',
      action: `manifest consumed — ${manifest.result_summary ?? 'dry-run complete'}`,
    });
  }

  return {
    id: `ER-approval-${approval.id}`,
    missionId: `M-plan-${approval.plan_id}`,
    title: approval.title,
    state,
    financial: approval.approval_required && approval.safety_level === 'financial',
    confidence: state === 'RECEIPTED' ? 0.75
               : state === 'EXECUTED'  ? 0.65
               : state === 'AUTHORIZED'? 0.55
               : 0.45,
    receipts: [],
    contradictions: [],
    audit: auditTrail,
  };
}

/**
 * Build evidence records for tasks that have a corresponding approval.
 * Tasks without approvals get a synthetic PROPOSED record.
 */
export function buildEvidenceForTask(
  task: ApiTask,
  approvals: ApiApproval[],
  manifests: ApiManifest[],
): EvidenceRecord {
  // Find the matching approval by scanning for plan_id prefix match
  const taskApproval = approvals.find(
    (a) => a.title === task.title || a.plan_id.includes(`${task.id}`),
  );

  if (taskApproval) {
    const manifest = manifests.find(
      (m) => m.approval_id === taskApproval.id || m.plan_id === taskApproval.plan_id,
    );
    const rec = adaptApproval(taskApproval, manifest);
    // Override id to match the task's evidenceRecordId
    return { ...rec, id: `ER-task-${task.id}`, missionId: `M-${task.id}` };
  }

  // No approval yet → synthetic PROPOSED record
  return {
    id: `ER-task-${task.id}`,
    missionId: `M-${task.id}`,
    title: task.title,
    state: 'PROPOSED',
    financial: task.requires_approval,
    confidence: 0.4,
    receipts: [],
    contradictions: [],
    audit: [
      {
        at: new Date().toISOString(),
        actor: 'empire-cofounder',
        action: 'task registered — no approval yet',
      },
    ],
  };
}

/**
 * ApiApproval → FABLE-5 IntentToken
 * Only financial approvals with status "approved" are valid tokens.
 */
export function adaptApprovalToToken(approval: ApiApproval): IntentToken | null {
  if (!approval.approval_required || approval.safety_level !== 'financial') return null;
  if (approval.status !== 'approved') return null;

  return {
    id: `FIT-live-${approval.id}`,
    approvedBy: approval.human_note?.slice(0, 60) ?? 'Founder · human approval',
    action: approval.requested_action,
    vendorOrSystem: approval.repo,
    maxAmount: 0,           // not yet in API — Phase 13 adds this
    currency: 'USD',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    recurrence: 'one-shot',
    environment: 'prod',
    revoked: approval.blocked,
    audit: [
      {
        at: approval.created_at,
        actor: 'empire-cofounder',
        action: 'token created from financial approval',
      },
      ...(approval.resolved_at
        ? [{ at: approval.resolved_at, actor: 'FOUNDER', action: approval.decision ?? 'approved' }]
        : []),
    ],
  };
}

/**
 * ApiAgentEntry + ApiSkillEntry → FABLE-5 CanonEntry[]
 * Agents and skills are surfaced as canon primitives in FABLE-5's Canon page.
 */
export function adaptRegistryToCanon(
  agents: ApiAgentEntry[],
  skills: ApiSkillEntry[],
): CanonEntry[] {
  const agentEntries: CanonEntry[] = agents.map((a) => ({
    id: `CANON-agent-${a.id}`,
    kind: 'primitive' as const,
    title: `${a.name} — ${a.scope}`,
    origin: a.path,
    confidence: 0.9,
  }));

  const skillEntries: CanonEntry[] = skills.map((s) => ({
    id: `CANON-skill-${s.id}`,
    kind: (s.risk === 'High' ? 'anti-pattern' : 'pattern') as CanonEntry['kind'],
    title: `${s.name} — ${s.lane}`,
    origin: s.purpose,
    confidence: s.risk === 'Low' ? 0.85 : 0.7,
  }));

  return [...agentEntries, ...skillEntries];
}
