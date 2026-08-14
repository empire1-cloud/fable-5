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

  // A request that lands on static hosting instead of the API fails in a way
  // that says nothing useful: a bare 405 (static files accept only GET/HEAD),
  // or a 200/404 whose body is the SPA's own index.html. Both mean the same
  // thing — no API is reachable at this origin — so say that instead of
  // surfacing a status code the visitor cannot act on.
  if (!res.ok && isStaticHostResponse(res.status, text)) {
    throw new ApiError(
      res.status,
      BASE
        ? `No API is reachable at ${BASE} — a static host answered instead of the control plane. Check the control plane is running and that VITE_API_BASE points at it.`
        : "No API is configured for this site. The front end was built without VITE_API_BASE, so requests are hitting static hosting instead of a control plane.",
    );
  }

  if (!res.ok) throw new ApiError(res.status, detailOf(payload) ?? `${method} ${path} failed (${res.status})`);
  return payload as T;
}

/** True when the response looks like a static host answering an API call:
 *  405 on a path that only ever accepts POST/PUT, or an HTML body where JSON
 *  was expected (the SPA catch-all rewrite serving index.html). */
function isStaticHostResponse(status: number, body: string): boolean {
  if (status === 405) return true;
  return /^\s*<(!doctype html|html)/i.test(body);
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
export interface SignupResult extends AuthSession {
  trial: { endsAt: string; days: number };
}

export interface ApiPlan {
  key: string;
  name: string;
  currency: string;
  /** null means priced on conversation — never render null as free. */
  monthly: number | null;
  annualBilled: number | null;
  includedSeats: number;
  includedNodes: number;
  extraNodeMonthly: number;
  features: string[];
  custom: boolean;
}

export interface ApiLimit {
  used: number;
  allowed: boolean;
  limit: number;
  reason: string;
}

export interface ApiSubscription {
  status: string;
  planKey: string | null;
  plan: { key: string; name: string; includedSeats: number; includedNodes: number; features: string[] } | null;
  canWrite: boolean;
  canRead: boolean;
  reason: string;
  trialDaysRemaining: number | null;
  trialEndsAt: string | null;
  billingInterval: string | null;
  extraNodes: number;
  currentPeriodEnd: string | null;
  usage: {
    seats: ApiLimit;
    nodes: ApiLimit;
    price: { currency: string; monthly: number | null; billed: number | null; custom: boolean } | null;
  } | null;
  catalog: ApiPlan[];
}

export interface ApiBillingStatus {
  configured: boolean;
  webhookConfigured: boolean;
  currency: string;
  reason: string;
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
/** GOD MODE payload — the whole company in one server-computed read.
 *  Note: ranking_score arrives as a numeric string from this endpoint
 *  (unlike /api/opportunities, which casts it), so it is typed honestly. */
export interface ApiDashboard {
  tenant: { id: string; name: string };
  engineCounts: { engine_id: string; count: number }[];
  evidenceCounts: { state: string; count: number }[];
  openEscalations: number;
  opportunities: {
    id: string;
    title: string;
    ranking_score: string | number;
    ranking_verdict: string;
    status: string;
    created_at: string;
  }[];
  genomeCount: number;
  nodes: { total: number; activeOrScaling: number };
  /** null when no pool has capacity — an absent constraint is reported as
   *  absent, never as 0% (which would read as plenty of headroom). */
  resourcePressure: { resourceType: string; ratio: number } | null;
}

export type GenomeMaturityLevel = 'Draft' | 'Tested' | 'Verified' | 'Replication-Ready';

export interface ApiGenome {
  id: string; code: string; name: string; thesis: string;
  maturity: GenomeMaturityLevel;
  economic_gate_type: string; node_count: number;
  section_count: number;
  /** computed from the evidence machine, never stored */
  proven_count: number;
  created_at: string;
}

export interface ApiGenomeSection {
  id: string; key: string; group: string; label: string; value: string;
  evidenceId: string | null;
  /** null when nothing is attached at all */
  evidenceState: string | null;
  evidenceClaim: string | null;
  /** true only when evidenceState has reached VERIFIED or later */
  proven: boolean;
}

export interface ApiGenomeDetail extends Omit<ApiGenome, 'node_count' | 'section_count' | 'proven_count'> {
  sections: ApiGenomeSection[];
  coverage: { proven: number; total: number };
  playbooks: { id: string; title: string; body: string; policy_version: string; approved_by: string; created_at: string }[];
  nodes: { id: string; code: string; geography: string; status: string; evidence_state: string; autonomy_level: string }[];
  missingForNextStage: { label: string; reason: string }[];
  nextMaturity: GenomeMaturityLevel | null;
  replicationReady: boolean;
  maturityGate: { allowed: boolean; reason: string };
}
export interface ApiMarketNode {
  id: string; code: string; genome_id: string | null; genome_code: string | null;
  geography: string; vertical: string; segment: string; offer: string; gate_type: string;
  evidence_state: string; autonomy_level: string; status: string;
  status_note: string | null; created_at: string;
}
export interface ApiResourcePool {
  id: string; resource_type: string; capacity: number; allocated: number;
  unit: string; financial: boolean; pressure: number; created_at: string;
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
    signup: (body: { organisationName: string; email: string; password: string }) =>
      request<SignupResult>("POST", "/api/auth/signup", body),
    me: () => request<MeResult>("GET", "/api/auth/me"),
  },
  subscription: {
    get: () => request<ApiSubscription>("GET", "/api/subscription"),
  },
  billing: {
    status: () => request<ApiBillingStatus>("GET", "/api/billing/status"),
    checkout: (body: { planKey: string; interval: "monthly" | "annual"; extraNodes?: number; returnUrl?: string }) =>
      request<{ id: string; url: string }>("POST", "/api/billing/checkout", body),
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
  dashboard: () => request<ApiDashboard>("GET", "/api/dashboard"),
  genomes: {
    list: () => request<ApiGenome[]>("GET", "/api/genomes"),
    get: (id: string) => request<ApiGenomeDetail>("GET", `/api/genomes/${id}`),
  },
  marketNodes: {
    list: () => request<ApiMarketNode[]>("GET", "/api/market-nodes"),
  },
  resourcePools: {
    list: () => request<ApiResourcePool[]>("GET", "/api/resource-pools"),
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
