import React, { useMemo, useState } from 'react';
import { useAppState } from '../state/AppState';
import { EVIDENCE_STATES } from '../types';
import type { EvidenceRecord, EvidenceState } from '../types';
import { canAdvance, STATE_CLAIMS, stateIndex } from '../lib/evidence';
import { Eyebrow, SectionRule, EmptyNote } from '../components/ui';
import { useHashRoute, parseRoute } from '../lib/router';

function formatAt(value: string) {
  return new Date(value).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StateStrip({ current }: { current: EvidenceState }) {
  return (
    <div className="state-strip">
      {EVIDENCE_STATES.map((s, i) => (
        <React.Fragment key={s}>
          <div className={`state-chip ${i === stateIndex(current) ? 'state-chip--current' : ''} ${i < stateIndex(current) ? 'state-chip--past' : ''}`}>
            {s}
          </div>
          {i < EVIDENCE_STATES.length - 1 && <span className="strip-arrow">→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function RecordCard({ rec, missionObjective }: { rec: EvidenceRecord; missionObjective: string }) {
  const { state, advanceEvidence, apiStatus, proofVerified } = useAppState();
  const mission = state.missions.find((m) => m.evidenceRecordId === rec.id);
  const check = canAdvance(rec, { mission, tokens: state.tokens, boundary: state.boundary });
  const unresolvedContradictions = rec.contradictions.filter((c) => !c.resolved);
  const demoReceipts = rec.receipts.filter((r) => r.demo);
  const liveReceipts = rec.receipts.filter((r) => !r.demo);
  const provenanceSummary =
    liveReceipts.length > 0 && demoReceipts.length > 0
      ? 'hybrid provenance'
      : liveReceipts.length > 0
        ? 'receipt-backed provenance'
        : demoReceipts.length > 0
          ? 'seed/demo provenance'
          : 'no receipts attached';
  const runtimeSummary =
    apiStatus === 'online'
      ? proofVerified
        ? 'connected runtime · canonical proof confirmed'
        : 'connected runtime · canonical proof pending'
      : apiStatus === 'error'
        ? 'live refresh degraded · inspect receipt timestamps'
        : apiStatus === 'offline'
          ? 'offline fallback · verify against receipts before claiming live truth'
          : 'runtime handshake in progress';

  return (
    <div className="panel evidence-card" id={`rec-${rec.id}`}>
      <div className="evidence-card-head">
        <div>
          <div className="panel-label">EVIDENCE {rec.id} · {missionObjective}</div>
          <h3 className="evidence-title">{rec.title}</h3>
        </div>
        <div className="evidence-state-badge">{rec.state}</div>
      </div>

      <StateStrip current={rec.state} />

      <div className="evidence-claim">
        <span className="detail-label">MAY CLAIM</span> {STATE_CLAIMS[rec.state]}
      </div>

      {unresolvedContradictions.length > 0 && (
        <div className="callout callout--bad">
          Contradiction: {unresolvedContradictions[0].description}
        </div>
      )}

      <div className="callout callout--accent evidence-provenance-callout">
        <div><span className="detail-label">PROVENANCE</span> {provenanceSummary}</div>
        <div><span className="detail-label">RUNTIME</span> {runtimeSummary}</div>
      </div>

      <div className="evidence-grid">
        <div>
          <div className="detail-label">RECEIPTS ({rec.receipts.length})</div>
          {rec.receipts.length === 0 ? (
            <div className="muted">none attached</div>
          ) : (
            <ul className="detail-list">
              {rec.receipts.map((r) => (
                <li key={r.id}>
                  <span className={`grade grade--${r.grade}`}>{r.grade}</span> {r.type} — {r.description}
                  <div className="evidence-receipt-meta">
                    {r.demo ? 'seed/demo receipt' : 'runtime-derived receipt'} · attached {formatAt(r.attachedAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="detail-label">VERIFICATION</div>
          {rec.verification ? (
            <div>
              <div>{rec.verification.method} · by {rec.verification.by}</div>
              <div className="evidence-meta-line">
                recorded {formatAt(rec.verification.at)} · reproducible: {rec.verification.reproducible ? 'yes' : 'no'}
              </div>
            </div>
          ) : (
            <div className="muted">not yet independently verified</div>
          )}
        </div>
        <div>
          <div className="detail-label">MEASUREMENT</div>
          {rec.measurement ? (
            <div>
              <div>{rec.measurement.gate} gate · {rec.measurement.reading} → <strong>{rec.measurement.verdict}</strong></div>
              <div className="evidence-meta-line">recorded {formatAt(rec.measurement.at)}</div>
            </div>
          ) : (
            <div className="muted">not yet measured against a gate</div>
          )}
        </div>
        <div>
          <div className="detail-label">CONFIDENCE</div>
          <div>{Math.round(rec.confidence * 100)}%</div>
        </div>
      </div>

      <details className="audit-details">
        <summary>Audit history ({rec.audit.length})</summary>
        <ul className="detail-list">
          {rec.audit.map((a, i) => (
            <li key={i}><span className="mono">{a.at.slice(0, 16).replace('T', ' ')}</span> — {a.actor}: {a.action}{a.detail ? ` (${a.detail})` : ''}</li>
          ))}
        </ul>
      </details>

      <div className="evidence-actions">
        {check.to ? (
          <>
            <button type="button" className="btn btn--primary" disabled={!check.ok} onClick={() => advanceEvidence(rec.id)}>
              Advance → {check.to}
            </button>
            {!check.ok && (
              <ul className="requirement-list">
                {check.requirements.filter((r) => !r.met).map((r, i) => (
                  <li key={i} className="requirement--unmet">✕ {r.label}{r.detail ? ` — ${r.detail}` : ''}</li>
                ))}
              </ul>
            )}
            {check.ok && check.requirements.length > 0 && (
              <ul className="requirement-list">
                {check.requirements.map((r, i) => (
                  <li key={i} className="requirement--met">✓ {r.label}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <span className="muted">terminal state — canonized into reusable intelligence</span>
        )}
      </div>
    </div>
  );
}

export default function Evidence() {
  const { state, apiStatus, lastFetchedAt, proofVerified } = useAppState();
  const raw = useHashRoute();
  const { query } = parseRoute(raw);
  const focusRec = query.get('rec');
  const [stateFilter, setStateFilter] = useState<EvidenceState | 'ALL'>('ALL');

  const records = useMemo(() => Object.values(state.evidence), [state.evidence]);
  const filtered = useMemo(
    () => records.filter((r) => stateFilter === 'ALL' || r.state === stateFilter).sort((a, b) => stateIndex(b.state) - stateIndex(a.state)),
    [records, stateFilter],
  );

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <Eyebrow>SHEET 03 · EVIDENCE STATE MACHINE</Eyebrow>
          <h2 className="page-title">Evidence &amp; Verification</h2>
        </div>
        <div className="page-note">
          anti-fake-progress made structural · no state may be skipped
          {' · '}
          runtime {apiStatus}
          {lastFetchedAt ? ` · last sync ${formatAt(lastFetchedAt)}` : ''}
          {apiStatus === 'online' ? ` · proof ${proofVerified ? 'verified' : 'pending'}` : ''}
        </div>
      </header>

      <SectionRule>ALL EVIDENCE STATES</SectionRule>
      <StateStrip current="PROPOSED" />
      <div className="filter-bar">
        <label>
          FILTER BY STATE
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value as EvidenceState | 'ALL')}>
            <option value="ALL">All</option>
            {EVIDENCE_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <span className="filter-count">{filtered.length} of {records.length} records</span>
      </div>

      <SectionRule>RECORDS</SectionRule>
      {filtered.length === 0 && <EmptyNote>No evidence records in this state.</EmptyNote>}
      <div className="evidence-list">
        {filtered.map((rec) => {
          const mission = state.missions.find((m) => m.evidenceRecordId === rec.id);
          return (
            <div key={rec.id} className={focusRec === rec.id ? 'evidence-focus' : ''}>
              <RecordCard rec={rec} missionObjective={mission?.objective ?? rec.missionId} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
