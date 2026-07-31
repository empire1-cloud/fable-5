/** The only door between the browser and the server-authoritative control plane. */

const BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");
const TOKEN_KEY = "fable5:auth:token";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export const tokenStore = {
  get(): string | null {
    try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token: string) {
    try { window.localStorage.setItem(TOKEN_KEY, token); } catch { /* tab-only session */ }
  },
  clear() {
    try { window.localStorage.removeItem(TOKEN_KEY); } catch { /* nothing */ }
  },
};

export const AUTH_EXPIRED_EVENT = "fable5:auth-expired";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && token) {
    tokenStore.clear();
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!res.ok) throw new ApiError(res.status, detailOf(payload) ?? `${method} ${path} failed (${res.status})`);
  return payload as T;
}

function detailOf(payload: unknown): string | null {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return null;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => {
      const loc = Array.isArray(d?.loc) ? d.loc.filter((p: unknown) => p !== "body").join(".") : "";
      return loc ? `${loc}: ${d?.msg}` : String(d?.msg ?? d);
    }).join("; ");
  }
  return null;
}

export interface AuthToken { access_token: string; token_type: string; expires_at: string; }
export interface Me { id: string; org_id: string; email: string; display_name: string; is_founder: boolean; }
export interface Leverage { score: number; factors: Record<string, number>; weights: Record<string, number>; seeded_score: number | null; divergence: number | null; }
export interface ApiOpportunity {
  id: string; title: string; evidence: string[]; assumptions: string[]; dependencies: string[];
  epistemic_type: string; expected_value: number; confidence: number; risk: string; reversibility: string;
  time_to_proof_days: number; next_experiment: string; created_at: string; leverage: Leverage;
}

export interface ApiReceipt {
  id: string; state_attested: string; kind: string; content: string; uri: string | null;
  sha256: string; created_by: string; created_by_user_id: string; created_at: string;
}
export interface ApiVerification {
  id: string; receipt_id: string; verifier: string; verifier_user_id: string; reproduced: boolean;
  method: string; notes: string; created_at: string;
}
export interface ApiContradiction {
  id: string; detail: string; resolved: boolean; resolution: string | null; resolved_at: string | null; created_at: string;
}
export interface ApiAuditEntry { state: string; actor: string; actor_user_id: string; reason: string; created_at: string; }
export interface ApiEvidenceRecord {
  id: string; subject: string; state: string; version: number; epistemic_type: string; confidence: number;
  is_financial: boolean; intent_token_id: string | null; spend_verdict_id: string | null;
  vendor_or_system: string | null; financial_amount: string | null; financial_currency: string | null;
  financial_environment: string | null; authorization: string | null; authorized_by: string | null;
  authorized_by_user_id: string | null; execution_log: string | null; measurement: string | null;
  learning: string | null; canonization: string | null; created_at: string; receipts: ApiReceipt[];
  verifications: ApiVerification[]; contradictions: ApiContradiction[]; audit_entries: ApiAuditEntry[];
  allowed_next_states: string[]; next_state_blocker: string | null;
}

export interface ApiMission {
  id: string; engine_id: string; owner: string; objective: string; autonomy_level: string; status: string;
  success_criteria: string; evidence_requirement: string; blocker: string | null; escalation_condition: string;
  record_id: string | null; created_at: string;
}
export interface ApiIntentTokenAudit { actor: string; action: string; detail: string; created_at: string; }
export interface ApiIntentToken {
  id: string; token_id: string; action: string; vendor_or_system: string; max_amount: string; total_budget: string;
  max_uses: number; currency: string; environment: string; expires_at: string; revoked: boolean;
  revoked_at: string | null; issued_by: string; created_at: string; audit: ApiIntentTokenAudit[];
}
export interface SpendVerdict {
  verdict_id: string; request_id: string; approved: boolean; reason: string | null; executed: boolean;
  execution_available: boolean; expires_at: string; note: string;
}
export interface FinancePolicyAudit {
  actor: string; execution_enabled: boolean; execution_mode: string; webhook_url: string | null;
  webhook_secret_key_id: string | null; require_founder_execution: boolean; reason: string; created_at: string;
}
export interface FinancePolicy {
  execution_enabled: boolean; execution_mode: "verdict_only" | "manual" | "sandbox" | "external_webhook";
  webhook_url: string | null; webhook_secret_key_id: string | null; require_founder_execution: boolean;
  updated_by: string; updated_at: string;
}
export interface PaymentExecution {
  execution_id: string; evidence_record_id: string; receipt_id: string; provider: string; status: string; amount: string; currency: string;
  provider_reference: string | null; response_sha256: string | null; detail: string; executed_by: string; created_at: string;
}
export interface StatesMeta { evidence_states: string[]; failure_states: string[]; all_states: string[]; }

export const api = {
  health: () => request<{ status: string; environment: string }>("GET", "/api/health"),
  states: () => request<StatesMeta>("GET", "/api/meta/states"),
  auth: {
    register: (body: { email: string; password: string; org_name: string; display_name?: string }) => request<AuthToken>("POST", "/api/auth/register", body),
    login: (body: { email: string; password: string }) => request<AuthToken>("POST", "/api/auth/login", body),
    me: () => request<Me>("GET", "/api/auth/me"),
    team: () => request<Me[]>("GET", "/api/auth/team"),
    invite: (body: { email: string; password: string; display_name?: string }) => request<Me>("POST", "/api/auth/invite", body),
  },
  opportunities: {
    list: () => request<ApiOpportunity[]>("GET", "/api/opportunities"),
    create: (body: Record<string, unknown>) => request<ApiOpportunity>("POST", "/api/opportunities", body),
  },
  evidence: {
    list: () => request<ApiEvidenceRecord[]>("GET", "/api/evidence"),
    get: (id: string) => request<ApiEvidenceRecord>("GET", `/api/evidence/${id}`),
    create: (body: Record<string, unknown>) => request<ApiEvidenceRecord>("POST", "/api/evidence", body),
    setFields: (id: string, body: Record<string, string | null>) => request<ApiEvidenceRecord>("PATCH", `/api/evidence/${id}/fields`, body),
    addReceipt: (id: string, body: { kind: string; content: string; uri?: string | null }) => request<ApiEvidenceRecord>("POST", `/api/evidence/${id}/receipts`, body),
    addVerification: (id: string, body: { receipt_id: string; reproduced: boolean; method: string; notes?: string }) => request<ApiEvidenceRecord>("POST", `/api/evidence/${id}/verifications`, body),
    addContradiction: (id: string, body: { detail: string }) => request<ApiEvidenceRecord>("POST", `/api/evidence/${id}/contradictions`, body),
    resolveContradiction: (id: string, contradictionId: string, body: { detail: string }) => request<ApiEvidenceRecord>("POST", `/api/evidence/${id}/contradictions/${contradictionId}/resolve`, body),
    transition: (id: string, body: { to: string; reason: string; expected_version?: number }) => request<ApiEvidenceRecord>("POST", `/api/evidence/${id}/transition`, body),
  },
  missions: {
    list: () => request<ApiMission[]>("GET", "/api/missions"),
    create: (body: Record<string, unknown>) => request<ApiMission>("POST", "/api/missions", body),
    update: (id: string, body: Record<string, unknown>) => request<ApiMission>("PUT", `/api/missions/${id}`, body),
    archive: (id: string) => request<ApiMission>("POST", `/api/missions/${id}/archive`),
  },
  intentTokens: {
    list: () => request<ApiIntentToken[]>("GET", "/api/intent-tokens"),
    issue: (body: Record<string, unknown>) => request<ApiIntentToken>("POST", "/api/intent-tokens", body),
    revoke: (tokenId: string) => request<ApiIntentToken>("POST", `/api/intent-tokens/${tokenId}/revoke`),
    check: (body: Record<string, unknown>) => request<SpendVerdict>("POST", "/api/intent-tokens/check", body),
  },
  compliance: {
    controlEvidence: () => request<Record<string, unknown>>("GET", "/api/compliance/control-evidence"),
  },
  payments: {
    policy: () => request<FinancePolicy>("GET", "/api/payments/policy"),
    setPolicy: (body: Record<string, unknown>) => request<FinancePolicy>("PUT", "/api/payments/policy", body),
    policyAudit: () => request<FinancePolicyAudit[]>("GET", "/api/payments/policy-audit"),
    execute: (verdictId: string, body: { external_reference?: string; note?: string }) => request<PaymentExecution>("POST", `/api/payments/verdicts/${verdictId}/execute`, body),
    executions: () => request<PaymentExecution[]>("GET", "/api/payments/executions"),
    createCheckoutSession: (planType: string) => request<{ url: string }>("POST", "/api/payments/checkout-session", { planType }),
  },
};
