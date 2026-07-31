// DEMO DATA — Evidence Records for the /evidence workspace. Deliberately
// spans multiple states, including a blocked one and one with unresolved
// contradictions, so the guard in src/lib/evidence.ts has real cases to
// enforce against, not just a single happy path.
import type { EvidenceRecord } from "../types";

export const evidenceRecords: EvidenceRecord[] = [
  {
    id: "ev-001",
    subject: "LATAM fintech node — monthly SaaS gate reading",
    state: "CANONIZED",
    evidence: [
      { id: "rc-001", type: "metric", payloadRef: "dash://kpi/latam-fintech-01/nrr", quality: "strong", createdAt: "2026-07-10T08:00:00Z" },
      { id: "rc-002", type: "API response", payloadRef: "billing-api://export/2026-06", quality: "strong", createdAt: "2026-07-10T08:05:00Z" },
    ],
    confidence: 0.94,
    verifications: [
      { id: "vr-001", verifiedReceiptId: "rc-001", verifiedBy: "engine-07", reproduced: true, method: "independent KPI re-pull", createdAt: "2026-07-11T09:00:00Z" },
    ],
    contradictions: [],
    authorization: { authorizedBy: "founder", authorityLevel: "L4" },
    executionLog: "engine-05 pulled June billing export and computed NRR at 2026-07-10T07:55:00Z",
    measurement: { kpi: "NRR", value: 108, threshold: 100, passed: true },
    learning: { confidenceDelta: 0.06, pattern: "SaaS wedge with usage-based expansion clears NRR gate by month 4 in LATAM fintech" },
    canonization: { canonEntryId: "canon-001", note: "Written back as a reusable pattern for fintech SaaS nodes" },
    auditHistory: [
      { state: "PROPOSED", timestamp: "2026-06-01T00:00:00Z", actor: "engine-00", reason: "filed with ranked opportunity graph entry opp-002" },
      { state: "AUTHORIZED", timestamp: "2026-06-02T00:00:00Z", actor: "founder", reason: "authority check passed at L4, non-financial measurement" },
      { state: "EXECUTED", timestamp: "2026-07-10T07:55:00Z", actor: "engine-05", reason: "KPI export computed" },
      { state: "RECEIPTED", timestamp: "2026-07-10T08:05:00Z", actor: "engine-05", reason: "metric + API response receipts attached" },
      { state: "VERIFIED", timestamp: "2026-07-11T09:00:00Z", actor: "engine-07", reason: "independent re-pull reproduced NRR 108%" },
      { state: "MEASURED", timestamp: "2026-07-11T09:05:00Z", actor: "engine-05", reason: "scored against SaaS typed gate — passed" },
      { state: "LEARNED", timestamp: "2026-07-11T09:10:00Z", actor: "engine-07", reason: "prediction-vs-outcome error computed, confidence updated +0.06" },
      { state: "CANONIZED", timestamp: "2026-07-11T09:15:00Z", actor: "engine-07", reason: "written to canon as reusable pattern" },
    ],
  },
  {
    id: "ev-002",
    subject: "Landing-page pre-sell test — 200-visit conversion readout",
    state: "RECEIPTED",
    evidence: [
      { id: "rc-003", type: "deploy log", payloadRef: "vercel://deploy/8f2a", quality: "adequate", createdAt: "2026-07-19T12:00:00Z" },
    ],
    confidence: 0.58,
    verifications: [],
    contradictions: [],
    authorization: { authorizedBy: "engine-00", authorityLevel: "L3" },
    executionLog: "asset-factory-agent-1 deployed landing page at 2026-07-19T11:50:00Z",
    auditHistory: [
      { state: "PROPOSED", timestamp: "2026-07-15T00:00:00Z", actor: "engine-00", reason: "filed against opportunity graph entry opp-001" },
      { state: "AUTHORIZED", timestamp: "2026-07-16T00:00:00Z", actor: "engine-00", reason: "authority check passed at L3, non-financial build" },
      { state: "EXECUTED", timestamp: "2026-07-19T11:50:00Z", actor: "asset-factory-agent-1", reason: "landing page built and deployed within bounds" },
      { state: "RECEIPTED", timestamp: "2026-07-19T12:00:00Z", actor: "asset-factory-agent-1", reason: "deploy log attached" },
    ],
  },
  {
    id: "ev-003",
    subject: "AI outcome-verification vertical — re-tested kill hypothesis",
    state: "RECEIPTED",
    evidence: [
      { id: "rc-004", type: "test output", payloadRef: "ci://run/9931", quality: "adequate", createdAt: "2026-07-21T10:00:00Z" },
    ],
    confidence: 0.31,
    verifications: [
      { id: "vr-002", verifiedReceiptId: "rc-004", verifiedBy: "engine-07", reproduced: true, method: "independent re-run of the same test batch", createdAt: "2026-07-21T14:00:00Z" },
    ],
    contradictions: [
      { id: "ct-001", description: "peer market scan (sig-005) disagrees with test-batch outcome distribution", raisedAt: "2026-07-21T15:00:00Z", resolved: false },
    ],
    authorization: { authorizedBy: "engine-00", authorityLevel: "L1" },
    executionLog: "market-intel-agent-1 ran narrower-ICP test batch at 2026-07-21T09:50:00Z",
    auditHistory: [
      { state: "PROPOSED", timestamp: "2026-07-20T00:00:00Z", actor: "engine-00", reason: "filed against opportunity graph entry opp-003" },
      { state: "AUTHORIZED", timestamp: "2026-07-20T12:00:00Z", actor: "engine-00", reason: "authority check passed at L1, recommend only" },
      { state: "EXECUTED", timestamp: "2026-07-21T09:50:00Z", actor: "market-intel-agent-1", reason: "test batch executed within bounds" },
      { state: "RECEIPTED", timestamp: "2026-07-21T10:00:00Z", actor: "market-intel-agent-1", reason: "test output attached" },
      { state: "BLOCKED", timestamp: "2026-07-21T15:00:00Z", actor: "engine-07", reason: "contradiction detected against sig-005 — VERIFIED withheld pending re-verification" },
    ],
    failureReason: "contradiction with peer market scan unresolved — retained as negative intelligence, re-verification mission auto-filed",
  },
  {
    id: "ev-004",
    subject: "activate ad spend",
    state: "PROPOSED",
    evidence: [
      { id: "rc-005", type: "diff", payloadRef: "decision-object://dec-003", quality: "weak", createdAt: "2026-07-21T18:00:00Z" },
    ],
    confidence: 0.58,
    verifications: [],
    contradictions: [],
    isFinancial: true,
    intentTokenId: "FIT-2026-0412",
    auditHistory: [
      { state: "PROPOSED", timestamp: "2026-07-21T18:00:00Z", actor: "engine-00", reason: "filed against opportunity graph entry opp-001, decision dec-003" },
    ],
  },
];
