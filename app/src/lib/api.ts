/** The only door between the browser and the server-authoritative control plane (rev-2.0, scale-v2). */

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

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
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
  const reason = (payload as { reason?: unknown }).reason;
  if (typeof reason === "string") return reason;
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

/** The authenticated caller, derived server-side from the session. */
export interface Actor {
  userId: string;
  email: string;
  tenantId: string;
  tenantName: string;
  role: string;
}
export interface AuthSession {
  token: string;
  actor: Actor;
}
export interface MeResult {
  actor: Actor;
  expiresAt: string;
  issuedAt: string;
}
export interface HealthState {
  status: string;
  service: string;
  architecture: string;
  databaseTime: string;
  moneyExecutionDefault: boolean;
}

export interface ApiReceipt {
  id: string; receipt_type: string; uri: string | null; digest: string | null;
  description: string; grade: string; is_demo: boolean; created_at: string;
}
export interface ApiVerification {
  id: string; method: string; verifier: string; independent: boolean; reproducible: boolean;
  result: unknown; created_at: string;
}
export interface ApiMeasurement {
  id: string; gate_type: string; reading: unknown; verdict: string; created_at: string;
}
export interface ApiContradiction {
  id: string; description: string; severity: string; resolved: boolean;
  resolution: string | null; resolved_at: string | null; created_at: string;
}
export interface ApiAuditEntry {
  id: string; state_from: string | null; state_to: string; reason: string;
  actor_id: string; metadata: unknown; created_at: string;
}
export interface ApiEvidenceRecord {
  id: string; subject_type: string; subject_id: string; claim: string; state: string;
  grade: string; confidence: number; created_by: string; created_at: string; updated_at: string;
  receipts: ApiReceipt[]; verifications: ApiVerification[]; measurements: ApiMeasurement[];
  contradictions: ApiContradiction[]; audit_entries: ApiAuditEntry[];
}

export interface ApiOpportunity {
  id: string; title: string; summary: string; ranking_score: number; ranking_verdict: string;
  ranking_factors: unknown; evidence_id: string; status: string; created_at: string;
}
export interface ApiMission {
  id: string; engine_id: string; owner: string; objective: string; autonomy_level: string;
  status: string; success_criteria: string | null; evidence_requirement: string | null;
  blocker: string | null; escalation_condition: string | null; record_id: string | null;
  created_at: string;
}
export interface ApiIntentToken {
  id: string; action: string; vendor_or_system: string; max_amount: number; currency: string;
  environment: string; recurrence: string; expires_at: string; revoked: boolean;
  revoked_at: string | null; approved_by: string; created_at: string;
}
export interface SpendVerdict {
  allowed: boolean;
  executed: boolean;
  code: string;
  reason: string;
}
export interface OpportunityRanking {
  score: number;
  verdict: string;
  confidence: number;
  factors: Record<string, number>;
}
export interface ApiDecision {
  id: string;
  opportunity_id: string;
  opportunity_title: string;
  verdict: string;
  reason: string;
  ranking_score: number | null;
  ranking_verdict: string | null;
  ranking_factors: Record<string, number> | null;
  decided_by_email: string | null;
  created_at: string;
}
export interface ApiEscalation {
  id: string;
  engine_id: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
  evidence_id: string | null;
  resolved_at: string | null;
  resolution: string | null;
  created_at: string;
}

export const api = {
  health: () => request<HealthState>("GET", "/api/health"),
  auth: {
    login: (body: { email: string; password: string }) => request<AuthSession>("POST", "/api/auth/login", body),
    me: () => request<MeResult>("GET", "/api/auth/me"),
  },
  opportunities: {
    list: () => request<ApiOpportunity[]>("GET", "/api/opportunities"),
    create: (body: Record<string, unknown>) => request<{ opportunityId: string; evidenceId: string; ranking: OpportunityRanking }>("POST", "/api/opportunities", body),
  },
  evidence: {
    list: () => request<ApiEvidenceRecord[]>("GET", "/api/evidence"),
    get: (id: string) => request<ApiEvidenceRecord>("GET", `/api/evidence/${id}`),
    create: (body: Record<string, unknown>) => request<ApiEvidenceRecord>("POST", "/api/evidence", body),
    addReceipt: (id: string, body: { receipt_type?: string; description: string; uri?: string | null; digest?: string | null; grade?: string }) =>
      request<ApiEvidenceRecord>("POST", `/api/evidence/${id}/receipts`, body),
    addVerification: (id: string, body: { receipt_id?: string | null; method: string; verifier?: string; independent?: boolean; reproduced?: boolean; result?: unknown }) =>
      request<ApiEvidenceRecord>("POST", `/api/evidence/${id}/verifications`, body),
    addMeasurement: (id: string, body: { gate_type?: string; reading?: unknown; verdict?: string }) =>
      request<ApiEvidenceRecord>("POST", `/api/evidence/${id}/measurements`, body),
    transition: (id: string, body: { to: string; context?: unknown; reason?: string }) =>
      request<ApiEvidenceRecord>("POST", `/api/evidence/${id}/transition`, body),
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
  decisions: {
    list: () => request<ApiDecision[]>("GET", "/api/decisions"),
  },
  escalations: {
    list: () => request<ApiEscalation[]>("GET", "/api/escalations"),
    resolve: (id: string, resolution: string) =>
      request<ApiEscalation>("POST", `/api/escalations/${id}/resolve`, { resolution }),
  },
  founding: {
    waitlist: {
      create: (body: { email: string; name?: string; company?: string; claim?: string }) =>
        request<{ id: string; email: string; status: string }>("POST", "/api/founding-access/waitlist", body),
      list: () =>
        request<{ id: string; email: string; name: string | null; company: string | null; claim: string | null; status: string }[]>(
          "GET",
          "/api/founding-access/waitlist"
        ),
    },
  },
};
