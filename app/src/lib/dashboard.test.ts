import { describe, it, expect } from 'vitest';
import { summarize, toNumber, ENGINE_IDS } from './dashboard';
import type { ApiDashboard } from './api';
import { EVIDENCE_STATES } from '../types';

const payload: ApiDashboard = {
  tenant: { id: 't1', name: 'Empire-1' },
  engineCounts: [{ engine_id: '00', count: 2 }],
  evidenceCounts: [
    { state: 'AUTHORIZED', count: 1 },
    { state: 'PROPOSED', count: 1 },
  ],
  openEscalations: 1,
  opportunities: [
    {
      id: 'o1',
      title: 'DACH regulatory mandate',
      ranking_score: '81.65',
      ranking_verdict: 'AUTHORIZE_EXPERIMENT',
      status: 'AUTHORIZED',
      created_at: '2026-08-11T04:12:12.011Z',
    },
  ],
  genomeCount: 2,
  nodes: { total: 4, activeOrScaling: 1 },
  resourcePressure: { resourceType: 'agent time', ratio: 0.88 },
};

describe('toNumber', () => {
  it('coerces the numeric strings this endpoint actually returns', () => {
    expect(toNumber('81.65')).toBe(81.65);
    expect(toNumber(35.68)).toBe(35.68);
  });

  it('never yields NaN for missing or malformed values', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber('not-a-number')).toBe(0);
  });
});

describe('summarize', () => {
  it('reports every evidence state in canonical order, including zeroes', () => {
    const s = summarize(payload);
    expect(s.pipeline.map((p) => p.state)).toEqual([...EVIDENCE_STATES]);
    expect(s.pipeline.find((p) => p.state === 'AUTHORIZED')?.count).toBe(1);
    expect(s.pipeline.find((p) => p.state === 'VERIFIED')?.count).toBe(0);
  });

  it('reports all nine engines, including idle ones', () => {
    const s = summarize(payload);
    expect(s.engineLoad).toHaveLength(9);
    expect(s.engineLoad.map((e) => e.id)).toEqual([...ENGINE_IDS]);
    expect(s.engineLoad.find((e) => e.id === '00')?.count).toBe(2);
    expect(s.engineLoad.find((e) => e.id === '07')?.count).toBe(0);
  });

  it('sums evidence from the server counts, not from the rendered pipeline', () => {
    // An unfamiliar state must still be counted rather than silently dropped.
    const withUnknown: ApiDashboard = {
      ...payload,
      evidenceCounts: [...payload.evidenceCounts, { state: 'SOME_FUTURE_STATE', count: 5 }],
    };
    expect(summarize(withUnknown).totalEvidence).toBe(7);
  });

  it('does not invent progress: canonized is 0 when the server reports none', () => {
    expect(summarize(payload).canonized).toBe(0);
  });

  it('passes through escalations and opportunity counts unchanged', () => {
    const s = summarize(payload);
    expect(s.openEscalations).toBe(1);
    expect(s.rankedOpportunities).toBe(1);
  });

  it('handles a completely empty company without throwing', () => {
    const empty: ApiDashboard = {
      tenant: { id: 't1', name: 'New Co' },
      engineCounts: [],
      evidenceCounts: [],
      openEscalations: 0,
      opportunities: [],
      genomeCount: 0,
      nodes: { total: 0, activeOrScaling: 0 },
      resourcePressure: null,
    };
    const s = summarize(empty);
    expect(s.totalEvidence).toBe(0);
    expect(s.pipeline).toHaveLength(EVIDENCE_STATES.length);
    expect(s.engineLoad).toHaveLength(9);
  });
});

describe('genomes, nodes, and resource pressure', () => {
  it('passes the server-computed genome and node counts through untouched', () => {
    const s = summarize(payload);
    expect(s.genomeCount).toBe(2);
    expect(s.nodes).toEqual({ total: 4, activeOrScaling: 1 });
  });

  it('keeps resource pressure null rather than coercing it to 0', () => {
    // 0 would render as "no pressure" — plenty of headroom. Absent is not zero.
    const noPools: ApiDashboard = { ...payload, resourcePressure: null };
    expect(summarize(noPools).resourcePressure).toBeNull();
  });

  it('reports the tightest pool as the constraint, with its ratio', () => {
    const s = summarize(payload);
    expect(s.resourcePressure).toEqual({ resourceType: 'agent time', ratio: 0.88 });
  });

  it('derives pending verification from RECEIPTED, not from a separate count', () => {
    const withReceipted: ApiDashboard = {
      ...payload,
      evidenceCounts: [...payload.evidenceCounts, { state: 'RECEIPTED', count: 3 }],
    };
    expect(summarize(withReceipted).pendingVerification).toBe(3);
    // and 0 when the server reports none, rather than undefined
    expect(summarize(payload).pendingVerification).toBe(0);
  });
});
