import type { AppState } from '../state/AppState';
import { OPPORTUNITIES } from '../data/controlPlane';
import { GENOMES, MARKET_NODES } from '../data/genomes';
import { RESOURCES } from '../data/resources';

export interface SystemSnapshot {
  activeOpportunities: number;
  activeMissions: number;
  pendingVerification: number;
  genomeCount: number;
  activeNodeCount: number;
  totalNodeCount: number;
  resourcePressure: number; // 0-1, highest allocated/capacity ratio across financial+scarce resources
  tightestResource: string;
}

export function systemSnapshot(state: AppState): SystemSnapshot {
  const activeOpportunities = OPPORTUNITIES.filter((o) => o.score >= 50).length;
  const activeMissions = state.missions.filter((m) => m.status === 'ACTIVE').length;
  const pendingVerification = Object.values(state.evidence).filter(
    (e) => e.state === 'RECEIPTED',
  ).length;
  const activeNodeCount = MARKET_NODES.filter((n) => n.status === 'Active' || n.status === 'Scaling').length;

  let tightest = { name: '', ratio: 0 };
  for (const r of RESOURCES) {
    const allocated = Object.values(state.allocations[r.type] ?? {}).reduce((a, b) => a + b, 0);
    const ratio = r.capacity > 0 ? allocated / r.capacity : 0;
    if (ratio > tightest.ratio) tightest = { name: r.type, ratio };
  }

  return {
    activeOpportunities,
    activeMissions,
    pendingVerification,
    genomeCount: GENOMES.length,
    activeNodeCount,
    totalNodeCount: MARKET_NODES.length,
    resourcePressure: tightest.ratio,
    tightestResource: tightest.name,
  };
}
