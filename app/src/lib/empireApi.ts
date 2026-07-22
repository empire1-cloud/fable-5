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
}

export interface ApiProofResult {
  final_status: string;
  plan_id: string;
  approval_id: number | null;
  manifest_id: string;
  hermes_intake_accepted: boolean;
  dry_run_only: boolean;
  consumed_status: string;
  steps: { step: string; status: string; detail?: string }[];
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

  approveApproval: (id: number, humanNote: string) =>
    post(`/approvals/${id}/approve`, { human_note: humanNote }),

  rejectApproval: (id: number, humanNote: string) =>
    post(`/approvals/${id}/reject`, { human_note: humanNote }),

  proofCanonicalFlow: () => post<ApiProofResult>('/proof/canonical-flow'),
};
