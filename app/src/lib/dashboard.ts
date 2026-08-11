/* GOD MODE aggregation.
 *
 * Pure functions over the server's /api/dashboard payload, kept out of the
 * component so the arithmetic is unit-testable. The rule this module exists to
 * hold: GOD MODE reads everything and computes nothing the server did not
 * already say. It never infers a state, never fills a gap, and never turns a
 * missing number into an optimistic one.
 */
import type { ApiDashboard } from './api';
import { EVIDENCE_STATES, type EvidenceState } from '../types';

/** The nine canonical engines, always shown — including the idle ones, so the
 *  view is the whole company rather than only the busy parts. */
export const ENGINE_IDS = ['00', '01', '02', '03', '04', '05', '06', '07', '08'] as const;

/** The dashboard endpoint returns ranking_score as a numeric string
 *  (`"81.65"`), unlike /api/opportunities which casts it. Coerce defensively
 *  and never render NaN at a founder. */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export interface DashboardSummary {
  totalEvidence: number;
  canonized: number;
  openEscalations: number;
  rankedOpportunities: number;
  /** every evidence state, in canonical order, including zeroes */
  pipeline: { state: EvidenceState; count: number }[];
  /** every engine, in canonical order, including idle ones */
  engineLoad: { id: string; count: number }[];
}

export function summarize(data: ApiDashboard): DashboardSummary {
  const byState = new Map(data.evidenceCounts.map((e) => [e.state, e.count]));
  const byEngine = new Map(data.engineCounts.map((e) => [e.engine_id, e.count]));

  return {
    // Sum the server's own counts — do not re-derive from the pipeline, so an
    // unknown state coming back from the server is still counted, not dropped.
    totalEvidence: data.evidenceCounts.reduce((sum, e) => sum + e.count, 0),
    canonized: byState.get('CANONIZED') ?? 0,
    openEscalations: data.openEscalations,
    rankedOpportunities: data.opportunities.length,
    pipeline: EVIDENCE_STATES.map((state) => ({ state, count: byState.get(state) ?? 0 })),
    engineLoad: ENGINE_IDS.map((id) => ({ id, count: byEngine.get(id) ?? 0 })),
  };
}
