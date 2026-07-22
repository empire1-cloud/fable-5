/**
 * Decision Engine — makes opportunity ranking mechanics transparent.
 *
 * Core Insight: An opportunity's score is not a black box. It is a
 * weighted composite of six allocation dimensions. Exposing the
 * contribution of each dimension builds trust and reveals which
 * dimension is the binding constraint on any given opportunity.
 *
 * This is Engine 00's hidden logic made visible.
 */

import type { AllocationScores, Opportunity } from '../types';

// ── Weight configuration ─────────────────────────────────────────────────

export interface DimensionWeight {
  key: keyof AllocationScores;
  label: string;
  weight: number;
  /** Human-readable explanation of what this dimension measures. */
  rationale: string;
}

export const DIMENSIONS: DimensionWeight[] = [
  { key: 'confidence', label: 'CONFIDENCE', weight: 0.25, rationale: 'How sure are we this is real? Evidence-graded, not gut-feel.' },
  { key: 'strategicValue', label: 'STRATEGIC VALUE', weight: 0.20, rationale: 'Does this unlock compounding advantage or just revenue?' },
  { key: 'learningValue', label: 'LEARNING VALUE', weight: 0.15, rationale: 'Does this reduce uncertainty about the portfolio even if it fails?' },
  { key: 'reversibility', label: 'REVERSIBILITY', weight: 0.15, rationale: 'Can we undo this cheaply? Reversible bets get extra allocation.' },
  { key: 'cost', label: 'COST', weight: 0.15, rationale: 'What does it take? Lower cost at equal value = higher rank.' },
  { key: 'timeToProof', label: 'TIME TO PROOF', weight: 0.10, rationale: 'Faster feedback loops compound learning. Shorter = better.' },
];

// ── Normalization helpers ────────────────────────────────────────────────

const LABEL_TO_NUM: Record<string, number> = { high: 1, medium: 0.5, low: 0.15 };

function normalizeValue(dim: DimensionWeight, alloc: AllocationScores): number {
  const raw = alloc[dim.key];

  // Direct numeric (confidence is 0–1)
  if (typeof raw === 'number') return Math.max(0, Math.min(1, raw));

  // String labels → numeric
  if (typeof raw === 'string') {
    // Check label map first (high/medium/low)
    const mapped = LABEL_TO_NUM[raw.toLowerCase()];
    if (mapped !== undefined) return mapped;

    // Cost: lower is better — invert. Heuristic: parse € or £ amounts.
    if (dim.key === 'cost') {
      const match = raw.match(/[\d,.]+/);
      if (match) {
        const num = parseFloat(match[0].replace(/,/g, ''));
        // Normalize: €0 = 1.0, €25k = 0.0 (within the app's cost range)
        return Math.max(0, 1 - num / 25000);
      }
      return 0.5; // unknown cost → neutral
    }

    // Time to proof: shorter is better
    if (dim.key === 'timeToProof') {
      const dayMatch = raw.match(/(\d+)d/);
      if (dayMatch) {
        const days = parseInt(dayMatch[1]);
        // Normalize: 0d = 1.0, 60d = 0.0
        return Math.max(0, 1 - days / 60);
      }
      if (raw.toLowerCase() === 'proven') return 1.0;
      if (raw.toLowerCase() === 'closed') return 0;
      return 0.5;
    }
  }

  return 0.5;
}

// ── Public API ──────────────────────────────────────────────────────────

export interface DimensionContribution {
  dimension: DimensionWeight;
  normalized: number;
  contribution: number; // normalized × weight
  label: string;
}

export interface RankingResult {
  opportunity: Opportunity;
  /** Final composite score (0–100 scale to match existing score field). */
  compositeScore: number;
  /** Per-dimension breakdown. */
  contributions: DimensionContribution[];
  /** The single weakest dimension — the binding constraint. */
  weakestDimension: DimensionContribution;
  /** The single strongest dimension. */
  strongestDimension: DimensionContribution;
}

function labelFor(dim: DimensionWeight, raw: unknown): string {
  if (typeof raw === 'number') return `${Math.round(raw * 100)}%`;
  if (typeof raw === 'string') return raw;
  return '—';
}

export function rankOpportunity(opp: Opportunity): RankingResult {
  const alloc = opp.alloc;
  const contributions: DimensionContribution[] = DIMENSIONS.map((dim) => {
    const normalized = normalizeValue(dim, alloc);
    const contribution = normalized * dim.weight;
    return {
      dimension: dim,
      normalized,
      contribution,
      label: labelFor(dim, alloc[dim.key]),
    };
  });

  const compositeScore = Math.round(
    contributions.reduce((sum, c) => sum + c.contribution, 0) * 100,
  );

  const sorted = [...contributions].sort((a, b) => a.contribution - b.contribution);

  return {
    opportunity: opp,
    compositeScore,
    contributions,
    weakestDimension: sorted[0],
    strongestDimension: sorted[sorted.length - 1],
  };
}

export function rankAll(opportunities: Opportunity[]): RankingResult[] {
  return opportunities.map(rankOpportunity).sort((a, b) => b.compositeScore - a.compositeScore);
}

// ── Trade-off analysis ──────────────────────────────────────────────────

export interface TradeOff {
  dimension: string;
  winner: { id: string; label: string; value: string };
  loser: { id: string; label: string; value: string };
  gap: number; // absolute difference in normalized score
}

/**
 * Compare two opportunities along each dimension.
 * Returns the dimensions where they differ most — the real decision axes.
 */
export function tradeOffs(a: RankingResult, b: RankingResult): TradeOff[] {
  const tradeOffs: TradeOff[] = [];
  for (let i = 0; i < a.contributions.length; i++) {
    const ca = a.contributions[i];
    const cb = b.contributions[i];
    const gap = Math.abs(ca.normalized - cb.normalized);
    if (gap > 0.05) {
      const [winner, loser] = ca.normalized >= cb.normalized ? [a, b] : [b, a];
      tradeOffs.push({
        dimension: ca.dimension.label,
        winner: {
          id: winner.opportunity.id,
          label: winner.opportunity.title,
          value: ca.normalized >= cb.normalized ? ca.label : cb.label,
        },
        loser: {
          id: loser.opportunity.id,
          label: loser.opportunity.title,
          value: ca.normalized >= cb.normalized ? cb.label : ca.label,
        },
        gap,
      });
    }
  }
  return tradeOffs.sort((a, b) => b.gap - a.gap);
}
