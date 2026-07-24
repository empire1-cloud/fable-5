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
  EvidenceChainStep,
  CanonEntry,
  EvidenceProvenance,
  EvidenceRecord,
  EvidenceState,
  IntentToken,
  Mission,
  MissionStatus,
  Receipt,
  ReceiptType,
} from '../types';
import type {
  ApiApproval,
  ApiManifest,
  ApiAgentEntry,
  ApiReceipt,
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
    case 'complete': return 'COMPLETE';
    default:        return 'QUEUED';
  }
}

function liveProvenance(detail: string, observedAt?: string): EvidenceProvenance {
  return {
    mode: 'live',
    source: 'empire_auto_cofounder',
    detail,
    observedAt,
  };
}

function classifyReceiptType(receipt: ApiReceipt): ReceiptType {
  const changed = `${receipt.what_changed} ${receipt.proof_artifact}`.toLowerCase();
  if (receipt.action_class.includes('test') || receipt.what_tested.trim() || receipt.test_result === 'pass' || receipt.test_result === 'fail') {
    return 'test output';
  }
  if (receipt.reproducible_command.trim()) return 'reproducible check';
  if (changed.includes('commit')) return 'commit';
  if (changed.includes('deploy')) return 'deployment log';
  if (changed.includes('api') || changed.includes('response')) return 'API response';
  if (changed.includes('artifact') || receipt.verified) return 'verified artifact';
  return 'diff';
}

function receiptGrade(receipt: ApiReceipt): 'A' | 'B' | 'C' {
  if (receipt.verified) return 'A';
  if (receipt.reproducible_command.trim() || receipt.test_result === 'pass') return 'B';
  return 'C';
}

function adaptReceipt(receipt: ApiReceipt): Receipt {
  const detailBits = [
    receipt.what_changed.trim(),
    receipt.what_tested.trim() ? `tested: ${receipt.what_tested.trim()}` : '',
    receipt.test_result && receipt.test_result !== 'not_run' ? `result: ${receipt.test_result}` : '',
    receipt.verification_basis.trim() ? `basis: ${receipt.verification_basis.trim()}` : '',
  ].filter(Boolean);

  return {
    id: receipt.id,
    type: classifyReceiptType(receipt),
    description: detailBits.join(' · ') || receipt.proof_artifact || receipt.action_class || 'receipt on file',
    grade: receiptGrade(receipt),
    attachedAt: receipt.timestamp,
    demo: false,
    verified: receipt.verified,
    reproducibleCommand: receipt.reproducible_command || undefined,
    provenance: liveProvenance(
      receipt.self_report_only
        ? 'live receipt ledger entry (self-report only)'
        : 'live receipt ledger entry',
      receipt.timestamp,
    ),
  };
}

function taskChainStep(task: ApiTask): EvidenceChainStep {
  return {
    id: 'mission',
    label: 'Mission registered',
    status: 'passed',
    source: 'task queue',
    detail: `${task.status || 'queued'} · ${task.repo || 'repo pending'}`,
  };
}

function buildApprovalChain(
  approval: ApiApproval,
  manifest: ApiManifest | undefined,
  receipts: ApiReceipt[],
): EvidenceChainStep[] {
  const rejected = approval.status === 'rejected' || approval.status === 'blocked';
  const approved = approval.status === 'approved';
  const manifestSealed = manifest?.status === 'sealed' || manifest?.status === 'consumed' || Boolean(manifest?.sealed_at);
  const manifestConsumed = manifest?.status === 'consumed' || Boolean(manifest?.consumed_at);

  return [
    {
      id: 'approval-request',
      label: 'Approval requested',
      status: 'passed',
      source: 'approval ledger',
      detail: `${approval.requested_action || approval.title} · ${approval.repo}`,
      at: approval.created_at,
    },
    {
      id: 'founder-decision',
      label: 'Founder decision',
      status: rejected ? 'blocked' : approved ? 'passed' : 'waiting',
      source: 'approval ledger',
      detail: approval.decision ?? approval.status,
      at: approval.resolved_at ?? undefined,
    },
    {
      id: 'preflight',
      label: 'Preflight cleared',
      status: manifest ? 'passed' : approved ? 'waiting' : 'not_applicable',
      source: 'manifest gate',
      detail: manifest
        ? `manifest ${manifest.manifest_id}`
        : approved
          ? 'approved but no manifest on file yet'
          : 'waiting for approval before preflight',
      at: manifest?.created_at,
    },
    {
      id: 'manifest',
      label: 'Manifest sealed',
      status: manifestSealed ? 'passed' : manifest ? 'waiting' : 'not_applicable',
      source: 'handoff manifest',
      detail: manifest
        ? `${manifest.status} · ${manifest.dry_run_only ? 'dry-run only' : 'execution capable'}`
        : 'no manifest on file',
      at: manifest?.sealed_at ?? manifest?.created_at,
    },
    {
      id: 'execution-mode',
      label: 'Execution mode',
      status: manifest ? 'passed' : 'not_applicable',
      source: 'Hermes execution rules',
      detail: manifest
        ? `${manifest.execution_enabled ? 'execution enabled' : 'execution disabled'} · ${manifest.dry_run_only ? 'dry-run only' : 'live actions allowed by rules'}`
        : 'no execution profile without a manifest',
      at: manifest?.sealed_at ?? manifest?.created_at,
    },
    {
      id: 'hermes-intake',
      label: 'Hermes intake',
      status: manifestConsumed ? 'passed' : manifestSealed ? 'waiting' : 'not_applicable',
      source: manifest?.consumed_by ?? 'hermes-local-stub',
      detail: manifest?.result_summary ?? (manifestSealed ? 'sealed manifest awaiting intake' : 'intake not reached'),
      at: manifest?.consumed_at ?? undefined,
    },
    {
      id: 'receipt-ledger',
      label: 'Receipt ledger',
      status: receipts.length > 0 ? 'passed' : manifestConsumed ? 'waiting' : 'not_applicable',
      source: 'receipts ledger',
      detail: receipts.length > 0
        ? `${receipts.length} receipt${receipts.length === 1 ? '' : 's'} attached`
        : 'no receipt attached to this chain',
      at: receipts[0]?.timestamp,
    },
  ];
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
  receipts: ApiReceipt[] = [],
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

  const receiptRecords = receipts.map(adaptReceipt);
  const chain = buildApprovalChain(approval, manifest, receipts);

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
    receipts: receiptRecords,
    contradictions: [],
    audit: auditTrail,
    chain,
    provenance: liveProvenance(
      manifest
        ? `approval + manifest chain mapped from ${approval.repo}`
        : `approval ledger mapped from ${approval.repo}`,
      manifest?.consumed_at ?? manifest?.sealed_at ?? approval.resolved_at ?? approval.created_at,
    ),
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
  receipts: ApiReceipt[] = [],
): EvidenceRecord {
  // Find the matching approval by scanning for plan_id prefix match
  const taskApproval = approvals.find(
    (a) => a.title === task.title || a.plan_id.includes(`${task.id}`),
  );

  if (taskApproval) {
    const manifest = manifests.find(
      (m) => m.approval_id === taskApproval.id || m.plan_id === taskApproval.plan_id,
    );
    const matchingReceipts = receipts.filter((receipt) =>
      (manifest?.manifest_id && receipt.manifest_id === manifest.manifest_id) ||
      (!!taskApproval.plan_id && receipt.plan_id === taskApproval.plan_id),
    );
    const rec = adaptApproval(taskApproval, manifest, matchingReceipts);
    // Override id to match the task's evidenceRecordId
    return {
      ...rec,
      id: `ER-task-${task.id}`,
      missionId: `M-${task.id}`,
      chain: [taskChainStep(task), ...(rec.chain ?? [])],
    };
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
    chain: [
      taskChainStep(task),
      {
        id: 'approval-request',
        label: 'Approval requested',
        status: task.requires_approval ? 'waiting' : 'not_applicable',
        source: 'approval ledger',
        detail: task.requires_approval ? 'mission requires approval; no approval on file yet' : 'task does not require approval',
      },
    ],
    provenance: liveProvenance('task queue entry without approval yet', new Date().toISOString()),
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
