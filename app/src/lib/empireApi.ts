/**
 * empireApi.ts
 * Typed HTTP client for the empire_auto_cofounder FastAPI (:8000).
 * All requests go through the /api proxy defined in vite.config.ts.
 *
 * Naming convention: functions mirror the API endpoint exactly.
 * No business logic here — adapters live in apiAdapters.ts.
 */

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

// ── Raw API types (mirror empire_auto_cofounder/models.py) ────────────────

export interface ApiHealth {
  status: string;
  service: string;
}

export interface ApiTask {
  id: number;
  title: string;
  repo: string;
  priority: string;
  status: string;
  description: string;
  requires_approval: boolean;
}

export interface ApiApproval {
  id: number;
  title: string;
  repo: string;
  plan_id: string;
  job: string;
  requested_action: string;
  safety_level: string;
  reason: string;
  status: string;       // "pending" | "approved" | "rejected" | "blocked"
  created_at: string;
  resolved_at: string | null;
  decision: string | null;
  approval_required: boolean;
  blocked: boolean;
  human_note: string | null;
}

export interface ApiManifest {
  id: number;
  manifest_id: string;
  plan_id: string;
  approval_id: number;
  repo: string;
  job: string;
  title: string;
  status: string;       // "pending" | "sealed" | "consumed" | "rejected"
  created_at: string;
  sealed_at: string | null;
  dry_run_only: boolean;
  execution_enabled: boolean;
  consumed_by: string | null;
  consumed_at: string | null;
  result_summary: string | null;
}

export interface ApiAgentEntry {
  id: string;
  name: string;
  path: string;
  status: string;
  scope: string;
}

export interface ApiSkillEntry {
  id: string;
  name: string;
  lane: string;
  purpose: string;
  risk: string;
}

export interface ApiRepo {
  name: string;
  full_name: string;
  url: string;
  role: string;
  category: string;
  status: string;
  integration_plan: string;
}

export interface ApiBrief {
  todays_mission: string;
  phase_status: string;
  highest_priority_task: string;
  pending_approval_count: number;
  sealed_manifest_count: number;
  canonical_proof_status: string;
  canonical_proof_hermes_accepted: boolean;
  registered_agent_count: number;
  registered_skill_count: number;
  available_agents: string[];
  available_skills: string[];
  recommended_next_safe_agent: string;
  recommended_next_safe_skill: string;
  dry_run_only: boolean;
  execution_mode: string;
  execution_capability_enabled?: boolean;
  execution_capability_summary?: string;
  watched_repo_count?: number;
  watch_findings_count?: number;
  open_blocker_count?: number;
  top_blocker?: string;
  latest_receipts?: string[];
  receipt_ledger_count?: number;
  verified_receipt_count?: number;
  unverified_receipt_count?: number;
  anti_polsia_note?: string;
}

export interface ApiReceipt {
  id: string;
  manifest_id: string;
  plan_id: string;
  repo: string;
  action_class: string;
  what_changed: string;
  what_tested: string;
  test_result: string;
  proof_artifact: string;
  reproducible_command: string;
  verified: boolean;
  verification_basis: string;
  delegated_to: string | null;
  self_report_only: boolean;
  previous_receipt_hash: string | null;
  receipt_hash: string | null;
  timestamp: string;
}

export interface ApiWatchFinding {
  kind: string;
  severity: string;
  detail: string;
  evidence: string;
}

export interface ApiWatchReport {
  full_name: string;
  local_path: string | null;
  resolved: boolean;
  is_git_repo: boolean;
  head_commit: string | null;
  branch: string | null;
  dirty: boolean;
  dirty_file_count: number;
  recent_commits: string[];
  has_tests: boolean;
  findings: ApiWatchFinding[];
  inspection_mode: string;
  inspection_error: string | null;
  generated_at: string;
  protected_no_touch: boolean;
}

export interface ApiLoopIteration {
  at: string;
  repo_inspected: string | null;
  action_considered: string | null;
  outcome: string;
  detail: string;
  receipt_id: string | null;
  item_id: string | null;
  plan_id: string | null;
  task_id: number | null;
  stage: string | null;
}

export interface ApiLoopStatus {
  running: boolean;
  pid: number | null;
  started_at: string | null;
  last_iteration_at: string | null;
  last_repo_inspected: string | null;
  last_action_considered: string | null;
  last_execution_or_refusal: string | null;
  next_scheduled_iteration: string | null;
  active_profile: string | null;
  current_item_id: string | null;
  mission_queue_depth: number;
  waiting_approval_count: number;
  ready_item_count: number;
  last_receipt_id: string | null;
  iterations: ApiLoopIteration[];
  note: string;
}

export interface ApiExecutionRules {
  execution_enabled: boolean;
  dry_run_only: boolean;
  allowed_action_classes: string[];
  require_live_approval_classes: string[];
  auto_permitted_classes: string[];
  blocked_action_classes: string[];
  require_cleared_chain: boolean;
  require_independent_verification: boolean;
  delegation_targets: string[];
  test_commands: Record<string, string>;
  default_test_command: string;
  protected_branches: string[];
  infra_ownership_rule: string;
  no_touch_repos: string[];
}

export interface ApiExecutionProfileStatus {
  active_profile: string | null;
  base_rules: ApiExecutionRules;
  effective_rules: ApiExecutionRules;
  override_sources: Record<string, string>;
  note: string;
}

// ── Endpoint functions ────────────────────────────────────────────────────

export const empireApi = {
  health: () => get<ApiHealth>('/health'),

  brief: () => get<ApiBrief>('/brief'),

  tasks: () => get<{ tasks?: ApiTask[] } | ApiTask[]>('/tasks').then((d) =>
    Array.isArray(d) ? d : (d.tasks ?? []),
  ),

  approvals: () =>
    get<{ approvals?: ApiApproval[] } | ApiApproval[]>('/approvals').then((d) =>
      Array.isArray(d) ? d : (d.approvals ?? []),
    ),

  manifestsSealed: () =>
    get<{ manifests?: ApiManifest[] } | ApiManifest[]>('/handoff/manifests/sealed').then(
      (d) => Array.isArray(d) ? d : (d.manifests ?? []),
    ),

  manifests: () =>
    get<{ manifests?: ApiManifest[] } | ApiManifest[]>('/handoff/manifests').then(
      (d) => Array.isArray(d) ? d : (d.manifests ?? []),
    ),

  registryAgents: () =>
    get<{ agents?: ApiAgentEntry[] }>('/registry/agents').then((d) => d.agents ?? []),

  registrySkills: () =>
    get<{ skills?: ApiSkillEntry[] }>('/registry/skills').then((d) => d.skills ?? []),

  repos: () =>
    get<{ repos?: ApiRepo[] }>('/repos').then((d) => d.repos ?? []),

  receipts: () =>
    get<{ receipts?: ApiReceipt[] } | ApiReceipt[]>('/receipts').then((d) =>
      Array.isArray(d) ? d : (d.receipts ?? []),
    ),

  watch: () =>
    get<{ reports?: ApiWatchReport[] } | ApiWatchReport[]>('/watch').then((d) =>
      Array.isArray(d) ? d : (d.reports ?? []),
    ),

  loopStatus: () => get<ApiLoopStatus>('/loop/status'),

  executionProfile: () => get<ApiExecutionProfileStatus>('/hermes/execution/profile'),

  approveApproval: (id: number, humanNote: string) =>
    post(`/approvals/${id}/approve`, { human_note: humanNote }),

  rejectApproval: (id: number, humanNote: string) =>
    post(`/approvals/${id}/reject`, { human_note: humanNote }),
};
