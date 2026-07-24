import React, { useMemo, useState } from 'react';
import { RESOURCES } from '../data/resources';
import { OPPORTUNITIES } from '../data/controlPlane';
import { MARKET_NODES } from '../data/genomes';
import { useAppState } from '../state/AppState';
import type { AllocationScores, ResourceType } from '../types';
import { Eyebrow, Chip, SectionRule } from '../components/ui';
import { validTokens } from '../lib/governance';

interface Target { id: string; label: string; type: 'opportunity' | 'node'; alloc: AllocationScores }

const TARGETS: Target[] = [
  ...OPPORTUNITIES.map((o) => ({ id: o.id, label: o.title, type: 'opportunity' as const, alloc: o.alloc })),
  ...MARKET_NODES.filter((n) => n.status !== 'Killed' && n.status !== 'Archived').map((n) => ({
    id: n.id,
    label: `${n.geography} · ${n.offer}`,
    type: 'node' as const,
    alloc: n.alloc,
  })),
];

const GATES = [
  { name: 'SaaS', cadence: 'MONTHLY', metrics: 'activation · retention · NRR · CAC payback · gross margin · expansion', scale: 'NRR > 100% · payback < 12mo · margin > 70%', validate: 'activation + retention cohorts stabilize', kill: 'churn > growth for 3 consecutive cohorts' },
  { name: 'Marketplace', cadence: 'WEEKLY', metrics: 'liquidity · supply/demand density · repeat rate · take rate · contribution margin', scale: 'liquidity in ≥1 segment · repeat rising · positive contribution', validate: 'match rate proves in one dense niche', kill: 'liquidity flat despite subsidy' },
  { name: 'Consumer', cadence: 'WEEKLY', metrics: 'D1/D7/D30 retention · engagement · organic coefficient · ARPU · CAC', scale: 'retention curve flattens · organic > paid', validate: 'D30 cohort retains above category baseline', kill: 'retention decays to zero — no floor' },
  { name: 'Txn Infrastructure', cadence: 'MONTHLY', metrics: 'volume · reliability · cost/txn · gross profit · failure rate', scale: 'reliability ≥ 99.9% · unit gross profit positive', validate: 'first production volume, verified', kill: 'cost/txn cannot beat incumbent path' },
  { name: 'AI Product', cadence: 'WEEKLY', metrics: 'successful outcome rate · cost per outcome · inference cost · retention · error rate', scale: 'outcome rate ≥ human baseline · margin > 40% after inference', validate: 'outcomes verified, not self-reported', kill: 'error rate erodes trust faster than value accrues' },
  { name: 'Services → Software', cadence: 'MONTHLY', metrics: 'delivery margin · repeatability · automation % · implementation time · recurring conversion', scale: 'automation > 60% · recurring > one-off revenue', validate: 'same playbook delivers 3× without rework', kill: 'every delivery remains bespoke' },
];

const KILL_TRIGGERS = [
  'Core assumptions repeatedly fail',
  'Economics cannot reach gate thresholds',
  'Time-to-proof exceeds justified cost',
  'Customer pain is weak',
  'Distribution structurally blocked',
  'Regulatory burden destroys the model',
  'Opportunity cost exceeds carrying value',
];

export default function Allocation() {
  const { state, setAllocation, apiStatus, liveBrief } = useAppState();
  const [resourceType, setResourceType] = useState<ResourceType>('cash');
  const resource = RESOURCES.find((r) => r.type === resourceType)!;
  const hasValidToken = validTokens(state.tokens).length > 0;
  const locked = resource.financial && !hasValidToken;

  const allocMap = state.allocations[resourceType] ?? {};
  const totalAllocated = useMemo(() => Object.values(allocMap).reduce((a, b) => a + b, 0), [allocMap]);
  const reserve = Math.max(0, resource.capacity - totalAllocated);
  const overCapacity = totalAllocated > resource.capacity;

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <Eyebrow>SHEET 05 · CAPITAL &amp; RESOURCE ALLOCATION · ENGINE 08</Eyebrow>
          <h2 className="page-title">Capital &amp; Resource Allocation</h2>
        </div>
        <div className="page-note">hybrid allocation view · live intent tokens, canonical target graph</div>
      </header>

      <div className="callout callout--accent">
        Allocation is a <strong>hybrid workspace</strong>: runtime status is <strong>{apiStatus}</strong>, founder-approved tokens and receipts can hydrate from Cofounder, but opportunity and node targets remain canonical shell data until allocation adapters are connected.
        {liveBrief?.execution_mode ? ` Current execution mode: ${liveBrief.execution_mode}.` : ''}
      </div>

      <SectionRule>ALLOCATE A RESOURCE</SectionRule>
      <div className="filter-bar">
        <label>
          RESOURCE
          <select value={resourceType} onChange={(e) => setResourceType(e.target.value as ResourceType)}>
            {RESOURCES.map((r) => <option key={r.type} value={r.type}>{r.type}{r.financial ? ' (financial)' : ''}</option>)}
          </select>
        </label>
        <span className="filter-count">
          {totalAllocated.toLocaleString()} / {resource.capacity.toLocaleString()} {resource.unit} allocated
          {' · '}reserve {reserve.toLocaleString()} {resource.unit}
        </span>
      </div>

      {locked && (
        <div className="callout callout--bad">
          {resourceType} is a financial resource — no valid Founder-Approved Intent Token is on file, so allocation is locked.
          NO VALID TOKEN → NO SPEND. Issue a token in Governance to unlock planning here.
        </div>
      )}
      {overCapacity && (
        <div className="callout callout--bad">Allocated total exceeds capacity — reduce an allocation below before this can clear.</div>
      )}

      <div className="panel">
        <div className="meter meter--wide">
          <div className="meter-track">
            <div
              className={`meter-fill ${overCapacity ? 'meter-fill--over' : ''}`}
              style={{ width: `${Math.min(100, Math.round((totalAllocated / resource.capacity) * 100))}%` }}
            />
          </div>
          <span className="meter-val">{Math.round((totalAllocated / resource.capacity) * 100)}%</span>
        </div>
        <div className="alloc-sliders">
          {TARGETS.map((t) => {
            const amount = allocMap[t.id] ?? 0;
            return (
              <div className="alloc-slider-row" key={t.id}>
                <div className="alloc-slider-label">
                  <span className="mono">{t.id}</span> {t.label}
                </div>
                <input
                  type="range"
                  min={0}
                  max={resource.capacity}
                  step={resource.step}
                  value={amount}
                  disabled={locked}
                  onChange={(e) => setAllocation(resourceType, t.id, Number(e.target.value))}
                />
                <div className="alloc-slider-val mono">{amount.toLocaleString()} {resource.unit}</div>
              </div>
            );
          })}
        </div>
      </div>

      <SectionRule>PORTFOLIO VIEW</SectionRule>
      <div className="portfolio-table panel">
        <div className="portfolio-row portfolio-row--head">
          <div>TARGET</div><div>EXPECTED RETURN</div><div>CONFIDENCE</div><div>STRATEGIC</div><div>LEARNING</div><div>REVERSIBILITY</div><div>TIME TO PROOF</div>
        </div>
        {TARGETS.map((t) => (
          <div className="portfolio-row" key={t.id}>
            <div><Chip accent={t.type === 'node'}>{t.id}</Chip> {t.label}</div>
            <div>{t.alloc.expectedReturn}</div>
            <div>{Math.round(t.alloc.confidence * 100)}%</div>
            <div>{t.alloc.strategicValue}</div>
            <div>{t.alloc.learningValue}</div>
            <div>{t.alloc.reversibility}</div>
            <div>{t.alloc.timeToProof}</div>
          </div>
        ))}
      </div>

      <SectionRule>TYPED ECONOMIC GATES</SectionRule>
      <div className="gates-grid">
        {GATES.map((g) => (
          <div className="gate-card panel" key={g.name}>
            <div className="gate-head">
              <div className="gate-name">{g.name}</div>
              <div className="gate-cadence">{g.cadence}</div>
            </div>
            <div className="gate-metrics">{g.metrics}</div>
            <div className="gate-rules">
              <div><span className="gr-scale">SCALE →</span> {g.scale}</div>
              <div><span className="gr-validate">VALIDATE →</span> {g.validate}</div>
              <div><span className="gr-kill">KILL →</span> {g.kill}</div>
            </div>
          </div>
        ))}
      </div>

      <SectionRule>KILL LOGIC → NEGATIVE INTELLIGENCE</SectionRule>
      <div className="panel panel--accent">
        <ul className="detail-list">
          {KILL_TRIGGERS.map((k) => <li key={k}>{k}</li>)}
        </ul>
        <div className="card-footnote card-footnote--accent">
          Kill preserves data, decisions, failure reasons, artifacts, reusable modules. WE EVOLVE, NEVER DELETE.
        </div>
      </div>
    </div>
  );
}
