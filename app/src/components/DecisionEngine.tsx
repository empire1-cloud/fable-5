import React, { useMemo, useState } from 'react';
import { OPPORTUNITIES } from '../data/controlPlane';
import { rankAll, tradeOffs, DIMENSIONS, type RankingResult, type TradeOff } from '../lib/decisionEngine';
import { SectionRule } from '../components/ui';

function BarContribution({ contribution, max }: { contribution: number; max: number }) {
  const pct = max > 0 ? (contribution / max) * 100 : 0;
  return (
    <div className="de-bar-track">
      <div className="de-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function RankingCard({
  result,
  rank,
  expanded,
  onToggle,
}: {
  result: RankingResult;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const maxContrib = useMemo(
    () => Math.max(...result.contributions.map((c) => c.contribution)),
    [result],
  );

  return (
    <div className={`de-rank-card panel ${expanded ? 'panel--accent' : ''}`}>
      <button type="button" className="de-rank-head" onClick={onToggle} aria-expanded={expanded}>
        <div className="de-rank-num">#{rank}</div>
        <div className="de-rank-score">{result.compositeScore}</div>
        <div className="de-rank-info">
          <div className="de-rank-title">{result.opportunity.title}</div>
          <div className="de-rank-meta">
            weakest: {result.weakestDimension.dimension.label} ({result.weakestDimension.label})
            {' · '}strongest: {result.strongestDimension.dimension.label} ({result.strongestDimension.label})
          </div>
        </div>
        <div className="de-rank-caret">{expanded ? '▾' : '▸'}</div>
      </button>

      {expanded && (
        <div className="de-rank-body">
          <div className="de-contributions">
            {result.contributions.map((c) => (
              <div className="de-contrib-row" key={c.dimension.key}>
                <div className="de-contrib-label">{c.dimension.label}</div>
                <BarContribution contribution={c.contribution} max={maxContrib} />
                <div className="de-contrib-weight">×{c.dimension.weight}</div>
                <div className="de-contrib-raw">{c.label}</div>
                <div className="de-contrib-score">{Math.round(c.contribution * 100)}</div>
              </div>
            ))}
          </div>
          <div className="de-rationale">
            {DIMENSIONS.map((d) => (
              <div key={d.key} className="de-rationale-row">
                <span className="de-rationale-label">{d.label}</span>
                <span className="de-rationale-text">{d.rationale}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TradeOffPanel({ pairs }: { pairs: TradeOff[] }) {
  if (pairs.length === 0) return <div className="muted">These opportunities are not meaningfully different on any dimension.</div>;
  return (
    <div className="de-tradeoff-list">
      {pairs.map((t, i) => (
        <div className="de-tradeoff-row" key={i}>
          <div className="de-tradeoff-dim">{t.dimension}</div>
          <div className="de-tradeoff-winner">
            <span className="de-tradeoff-id">{t.winner.id}</span> {t.winner.value}
          </div>
          <div className="de-tradeoff-vs">vs</div>
          <div className="de-tradeoff-loser">
            <span className="de-tradeoff-id">{t.loser.id}</span> {t.loser.value}
          </div>
          <div className="de-tradeoff-gap">{Math.round(t.gap * 100)}pt</div>
        </div>
      ))}
    </div>
  );
}

export default function DecisionEngine() {
  const ranked = useMemo(() => rankAll(OPPORTUNITIES), []);
  const [expandedId, setExpandedId] = useState<string | null>(ranked[0]?.opportunity.id ?? null);
  const [comparePair, setComparePair] = useState<[string, string] | null>(null);

  const topTwo = ranked.length >= 2 ? [ranked[0], ranked[1]] : null;
  const topTwoTradeOffs = useMemo(() => {
    if (!topTwo) return [];
    return tradeOffs(topTwo[0], topTwo[1]);
  }, [topTwo]);

  const customPairTradeOffs = useMemo(() => {
    if (!comparePair) return [];
    const a = ranked.find((r) => r.opportunity.id === comparePair[0]);
    const b = ranked.find((r) => r.opportunity.id === comparePair[1]);
    if (!a || !b) return [];
    return tradeOffs(a, b);
  }, [comparePair, ranked]);

  return (
    <div className="de-section">
      <SectionRule>DECISION ENGINE · ENGINE 00 · HOW RANKING WORKS</SectionRule>

      <div className="de-intro panel">
        <div className="panel-label">RANKING MECHANICS — WEIGHTED MULTI-CRITERIA ANALYSIS</div>
        <p className="de-intro-text">
          Every opportunity is scored across six dimensions. The composite score is a
          weighted sum — not a gut call. Weights reflect the system's current priorities:
          <strong> confidence</strong> (25%) and <strong>strategic value</strong> (20%) dominate because
          uncertain bets at scale destroy more value than they create.
        </p>
        <div className="de-weight-bar">
          {DIMENSIONS.map((d) => (
            <div
              key={d.key}
              className="de-weight-segment"
              style={{ flex: d.weight }}
              title={`${d.label}: ${Math.round(d.weight * 100)}%`}
            >
              <span className="de-weight-label">{Math.round(d.weight * 100)}%</span>
            </div>
          ))}
        </div>
        <div className="de-weight-legend">
          {DIMENSIONS.map((d) => (
            <span key={d.key} className="de-weight-legend-item">{d.label}</span>
          ))}
        </div>
      </div>

      <div className="de-rank-list">
        {ranked.map((r, i) => (
          <RankingCard
            key={r.opportunity.id}
            result={r}
            rank={i + 1}
            expanded={expandedId === r.opportunity.id}
            onToggle={() => setExpandedId(expandedId === r.opportunity.id ? null : r.opportunity.id)}
          />
        ))}
      </div>

      <SectionRule>TRADE-OFF ANALYSIS · TOP TWO</SectionRule>
      <div className="panel">
        <div className="panel-label">THE DECISION BETWEEN #{1} AND #{2} IS REAL — HERE ARE THE AXES</div>
        <TradeOffPanel pairs={topTwoTradeOffs} />
      </div>

      <SectionRule>COMPARE ANY TWO</SectionRule>
      <div className="panel">
        <div className="de-compare-selectors">
          <label>
            OPPORTUNITY A
            <select
              value={comparePair?.[0] ?? ''}
              onChange={(e) => setComparePair([e.target.value, comparePair?.[1] ?? ranked[1]?.opportunity.id ?? ''])}
            >
              <option value="">select…</option>
              {ranked.map((r) => (
                <option key={r.opportunity.id} value={r.opportunity.id}>{r.opportunity.id} · {r.opportunity.title}</option>
              ))}
            </select>
          </label>
          <label>
            OPPORTUNITY B
            <select
              value={comparePair?.[1] ?? ''}
              onChange={(e) => setComparePair([comparePair?.[0] ?? ranked[0]?.opportunity.id ?? '', e.target.value])}
            >
              <option value="">select…</option>
              {ranked.map((r) => (
                <option key={r.opportunity.id} value={r.opportunity.id}>{r.opportunity.id} · {r.opportunity.title}</option>
              ))}
            </select>
          </label>
        </div>
        {comparePair && customPairTradeOffs.length > 0 && <TradeOffPanel pairs={customPairTradeOffs} />}
        {comparePair && customPairTradeOffs.length === 0 && (
          <div className="muted">These two opportunities score similarly across all dimensions.</div>
        )}
      </div>
    </div>
  );
}
