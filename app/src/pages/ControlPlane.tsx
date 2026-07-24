import React, { useMemo, useState } from 'react';
import { SIGNALS, OPPORTUNITIES } from '../data/controlPlane';
import { useAppState } from '../state/AppState';
import type { EngineId, Mission, MissionStatus } from '../types';
import { ENGINE_MAP } from '../data/engines';
import { Eyebrow, Chip, Badge, SectionRule, EmptyNote } from '../components/ui';
import { navigate } from '../lib/router';
import ExecutionRuntimeStatus from '../components/ExecutionRuntimeStatus';

const STATUS_TONE: Record<MissionStatus, 'ok' | 'warn' | 'bad'> = {
  ACTIVE: 'ok',
  QUEUED: 'warn',
  BLOCKED: 'bad',
};

function SignalRow({ id, source, category, summary, confidence, reliability, timestamp }: (typeof SIGNALS)[number]) {
  return (
    <div className="signal-row" key={id}>
      <div className="signal-cat">{category}</div>
      <div className="signal-body">
        <div className="signal-summary">{summary}</div>
        <div className="signal-source">{source} · {timestamp}</div>
      </div>
      <div className="signal-conf">
        <span className={`grade grade--${reliability}`}>{reliability}</span>
        {Math.round(confidence * 100)}%
      </div>
    </div>
  );
}

function OpportunityCard({ opp, open, onToggle }: { opp: (typeof OPPORTUNITIES)[number]; open: boolean; onToggle: () => void }) {
  return (
    <div className={`opportunity-card ${open ? 'opportunity-card--open' : ''}`}>
      <button type="button" className="opportunity-head" onClick={onToggle} aria-expanded={open}>
        <div className="opportunity-score">{opp.score}</div>
        <div className="opportunity-titleblock">
          <div className="opportunity-title">{opp.title}</div>
          <div className="opportunity-meta">
            EV {opp.expectedValue} · confidence {Math.round(opp.confidence * 100)}% · {opp.risk}
          </div>
        </div>
        <div className="opportunity-caret">{open ? '▾' : '▸'}</div>
      </button>
      {open && (
        <div className="opportunity-body">
          <div className="detail-label">EVIDENCE</div>
          <ul className="detail-list">
            {opp.evidence.length ? opp.evidence.map((e, i) => (
              <li key={i}><span className={`epi-tag epi-tag--${e.type}`}>{e.type}</span> {e.text}</li>
            )) : <li className="muted">none on file — this rank is provisional</li>}
          </ul>
          <div className="detail-label">ASSUMPTIONS · NEVER RENDERED AS FACTS</div>
          <ul className="detail-list">
            {opp.assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
          <div className="opportunity-grid">
            <div><div className="detail-label">DEPENDENCIES</div><div>{opp.dependencies.join(', ') || '—'}</div></div>
            <div><div className="detail-label">NEXT EXPERIMENT</div><div>{opp.nextExperiment}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ControlPlane() {
  const { state } = useAppState();
  const [openOpp, setOpenOpp] = useState<string | null>(OPPORTUNITIES[0]?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<MissionStatus | 'ALL'>('ALL');
  const [engineFilter, setEngineFilter] = useState<EngineId | 'ALL'>('ALL');
  const [inspecting, setInspecting] = useState<Mission | null>(null);

  const sortedOpps = useMemo(() => [...OPPORTUNITIES].sort((a, b) => b.score - a.score), []);

  const missions = useMemo(
    () =>
      state.missions.filter(
        (m) => (statusFilter === 'ALL' || m.status === statusFilter) && (engineFilter === 'ALL' || m.engineId === engineFilter),
      ),
    [state.missions, statusFilter, engineFilter],
  );

  const engineIds = useMemo(() => Array.from(new Set(state.missions.map((m) => m.engineId))).sort(), [state.missions]);

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <Eyebrow>SHEET 02 · AUTONOMOUS CONTROL PLANE</Eyebrow>
          <h2 className="page-title">Control Plane</h2>
        </div>
        <div className="page-note">
          Signals → Opportunity Graph → Decision Engine → Resource Allocation → Mission Queue → Execution → Receipts → Verification → Outcome → Memory
        </div>
      </header>

      <ExecutionRuntimeStatus showJobs />

      <SectionRule>SIGNALS</SectionRule>
      <div className="panel signal-list">
        {SIGNALS.map((s) => <SignalRow key={s.id} {...s} />)}
      </div>

      <SectionRule>OPPORTUNITY GRAPH · RANKED</SectionRule>
      <div className="opportunity-list">
        {sortedOpps.map((o) => (
          <OpportunityCard key={o.id} opp={o} open={openOpp === o.id} onToggle={() => setOpenOpp(openOpp === o.id ? null : o.id)} />
        ))}
      </div>

      <SectionRule>MISSION QUEUE · RANKED, NOT FIFO</SectionRule>
      <div className="filter-bar">
        <label>
          STATUS
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as MissionStatus | 'ALL')}>
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="QUEUED">Queued</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </label>
        <label>
          ENGINE
          <select value={engineFilter} onChange={(e) => setEngineFilter(e.target.value as EngineId | 'ALL')}>
            <option value="ALL">All</option>
            {engineIds.map((id) => (
              <option key={id} value={id}>{id} · {ENGINE_MAP[id]?.name}</option>
            ))}
          </select>
        </label>
        <span className="filter-count">{missions.length} of {state.missions.length} missions</span>
      </div>

      <div className="mission-table panel">
        <div className="mission-row mission-row--head">
          <div>ID</div><div>OBJECTIVE</div><div>ENGINE</div><div>OWNER</div><div>AUTONOMY</div><div>STATUS</div>
        </div>
        {missions.length === 0 && <EmptyNote>No missions match this filter.</EmptyNote>}
        {missions.map((m) => (
          <button type="button" key={m.id} className="mission-row mission-row--body" onClick={() => setInspecting(m)}>
            <div className="mono">{m.id}</div>
            <div className="mission-objective">{m.objective}</div>
            <div className="mono">{m.engineId}</div>
            <div className="mono">{m.owner}</div>
            <div className="mono">{m.autonomy}</div>
            <div><Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge></div>
          </button>
        ))}
      </div>

      {inspecting && (
        <div className="inspector-overlay" role="dialog" aria-label={`Mission ${inspecting.id}`} onClick={() => setInspecting(null)}>
          <div className="inspector-panel panel panel--accent" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="inspector-close" onClick={() => setInspecting(null)} aria-label="Close">✕</button>
            <div className="panel-label panel-label--accent">MISSION {inspecting.id} · {inspecting.engineId} · {ENGINE_MAP[inspecting.engineId]?.name}</div>
            <h3 className="engine-detail-name">{inspecting.objective}</h3>
            <div className="opportunity-grid">
              <div><div className="detail-label">OWNER</div><div className="mono">{inspecting.owner}</div></div>
              <div><div className="detail-label">AUTONOMY</div><div className="mono">{inspecting.autonomy}</div></div>
              <div><div className="detail-label">STATUS</div><Badge tone={STATUS_TONE[inspecting.status]}>{inspecting.status}</Badge></div>
              <div><div className="detail-label">BUDGET</div><div>{inspecting.budget}</div></div>
              <div><div className="detail-label">SUCCESS CRITERIA</div><div>{inspecting.successCriteria}</div></div>
              <div><div className="detail-label">EVIDENCE REQUIREMENT</div><div>{inspecting.evidenceRequirement}</div></div>
              <div><div className="detail-label">ESCALATION CONDITION</div><div>{inspecting.escalationCondition}</div></div>
              {inspecting.blocker && <div><div className="detail-label">BLOCKER</div><div>{inspecting.blocker}</div></div>}
            </div>
            {inspecting.financial && (
              <div className="callout callout--accent">
                Financial mission — execution beyond AUTHORIZE requires a valid Founder-Approved Intent Token. See Governance.
              </div>
            )}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => navigate(`/evidence?rec=${inspecting.evidenceRecordId}`)}
            >
              Open evidence record {inspecting.evidenceRecordId} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
