import React, { useMemo, useState } from 'react';
import { useAppState } from '../state/AppState';
import type { CanonEntry, CanonKind, EvidenceRecord, EvidenceState } from '../types';
import { EVIDENCE_STATES } from '../types';
import { stateIndex, STATE_CLAIMS } from '../lib/evidence';
import { Eyebrow, Badge, SectionRule, EmptyNote } from '../components/ui';

const KIND_TONE: Record<CanonKind, 'ok' | 'warn' | 'bad' | 'neutral'> = {
  pattern: 'ok',
  'negative intelligence': 'bad',
  primitive: 'ok',
  'economic rule': 'warn',
  'market rule': 'warn',
  'anti-pattern': 'bad',
};

const KIND_LABEL: Record<CanonKind, string> = {
  pattern: 'PATTERN',
  'negative intelligence': 'NEG INT',
  primitive: 'PRIMITIVE',
  'economic rule': 'ECON RULE',
  'market rule': 'MARKET RULE',
  'anti-pattern': 'ANTI-PATTERN',
};

function CanonCard({ entry, evidence, expanded, onToggle }: {
  entry: CanonEntry;
  evidence: EvidenceRecord | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`memory-canon-card panel ${expanded ? 'panel--accent' : ''}`}>
      <button type="button" className="memory-canon-head" onClick={onToggle} aria-expanded={expanded}>
        <Badge tone={KIND_TONE[entry.kind]}>{KIND_LABEL[entry.kind]}</Badge>
        <div className="memory-canon-title">{entry.title}</div>
        <div className="memory-canon-score">{Math.round(entry.confidence * 100)}%</div>
        <div className="memory-canon-caret">{expanded ? '▾' : '▸'}</div>
      </button>
      {expanded && (
        <div className="memory-canon-body">
          <div className="memory-canonical-grid">
            <div>
              <div className="detail-label">ORIGIN</div>
              <div className="mono">{entry.origin}</div>
            </div>
            <div>
              <div className="detail-label">CONFIDENCE</div>
              <div className="mono">{Math.round(entry.confidence * 100)}%</div>
            </div>
            <div>
              <div className="detail-label">KIND</div>
              <div className="mono">{entry.kind}</div>
            </div>
          </div>

          {evidence && (
            <div className="memory-origin-trace">
              <div className="detail-label">EVIDENCE CHAIN · {evidence.id}</div>
              <div className="memory-state-strip">
                {EVIDENCE_STATES.map((s, i) => (
                  <React.Fragment key={s}>
                    <span className={`memory-state-chip ${
                      i < stateIndex(evidence.state) ? 'memory-state-chip--past' :
                      i === stateIndex(evidence.state) ? 'memory-state-chip--current' : ''
                    }`}>{s}</span>
                    {i < EVIDENCE_STATES.length - 1 && <span className="memory-strip-arrow">→</span>}
                  </React.Fragment>
                ))}
              </div>
              <div className="memory-origin-claim">
                <span className="detail-label">WHAT THIS STATE MEANS:</span>{' '}
                {STATE_CLAIMS[evidence.state]}
              </div>
              {evidence.verification && (
                <div className="memory-origin-verification">
                  <span className="detail-label">VERIFICATION:</span>{' '}
                  {evidence.verification.method} · by {evidence.verification.by}
                  {evidence.verification.reproducible && ' · reproducible'}
                </div>
              )}
              {evidence.measurement && (
                <div className="memory-origin-measurement">
                  <span className="detail-label">MEASUREMENT:</span>{' '}
                  {evidence.measurement.gate} · {evidence.measurement.reading} → {evidence.measurement.verdict}
                </div>
              )}
              <div className="memory-origin-audit">
                <div className="detail-label">AUDIT TRAIL ({evidence.audit.length} events)</div>
                {evidence.audit.map((ev, i) => (
                  <div className="memory-audit-row" key={i}>
                    <span className="memory-audit-at">{ev.at.slice(0, 10)}</span>
                    <span className="memory-audit-actor">{ev.actor}</span>
                    <span className="memory-audit-action">{ev.action}</span>
                    {ev.detail && <span className="memory-audit-detail">{ev.detail}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="memory-reuse">
            <div className="detail-label">REUSE CONDITIONS</div>
            <div className="memory-reuse-text">
              {entry.kind === 'primitive' && 'This primitive may be cloned into new nodes that share the same activation condition. Apply only where the preconditions listed in its origin hold.'}
              {entry.kind === 'pattern' && 'This pattern may be applied to similar market entries where the same regulatory or demand forcing function exists. Verify local conditions before cloning.'}
              {entry.kind === 'negative intelligence' && 'Do NOT apply this lesson as a positive rule. Use to avoid repeating a known failure mode. Reference when evaluating similar opportunities.'}
              {entry.kind === 'economic rule' && 'This rule applies to economic-gate decisions. Reference when scoring opportunities against SaaS or marketplace gate thresholds.'}
              {entry.kind === 'market rule' && 'This rule applies to market-entry decisions. Reference when evaluating new geographies or segments with similar structural conditions.'}
              {entry.kind === 'anti-pattern' && 'This is a known anti-pattern. Avoid implementing systems or strategies that match this shape. Use as a veto heuristic.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LearningFeedbackLoop() {
  const steps = [
    { state: 'PROPOSED' as EvidenceState, label: 'SIGNAL DETECTED', desc: 'A signal enters the system and is ranked by the Decision Engine.' },
    { state: 'AUTHORIZED' as EvidenceState, label: 'MISSION CREATED', desc: 'Opportunity crosses the confidence threshold — a mission is filed with evidence requirements.' },
    { state: 'EXECUTED' as EvidenceState, label: 'ACTION TAKEN', desc: 'The owning agent performs the work within its autonomy boundary.' },
    { state: 'RECEIPTED' as EvidenceState, label: 'PROOF ATTACHED', desc: 'Receipts (test output, metrics, diffs) are attached. No receipt = it did not happen.' },
    { state: 'VERIFIED' as EvidenceState, label: 'INDEPENDENT CHECK', desc: 'A separate engine independently verifies the receipts. Contradictions are flagged.' },
    { state: 'MEASURED' as EvidenceState, label: 'GATE SCORED', desc: 'Outcome is compared to the typed economic gate. Verdict: CLONE, ITERATE, PAUSE, or KILL.' },
    { state: 'LEARNED' as EvidenceState, label: 'CONFIDENCE UPDATED', desc: 'Prediction vs outcome error is computed. The system updates what it believes.' },
    { state: 'CANONIZED' as EvidenceState, label: 'WRITTEN TO CANON', desc: 'The learning becomes a reusable primitive, pattern, or rule — available to all future missions.' },
  ];

  return (
    <div className="memory-loop">
      {steps.map((step, i) => (
        <div className="memory-loop-step" key={step.state}>
          <div className="memory-loop-num">{i}</div>
          <div className="memory-loop-content">
            <div className="memory-loop-label">{step.label}</div>
            <div className="memory-loop-state">{step.state}</div>
            <div className="memory-loop-desc">{step.desc}</div>
          </div>
          {i < steps.length - 1 && <div className="memory-loop-connector" />}
        </div>
      ))}
    </div>
  );
}

export default function Memory() {
  const { state } = useAppState();
  const [expandedId, setExpandedId] = useState<string | null>(state.canon[0]?.id ?? null);
  const [kindFilter, setKindFilter] = useState<CanonKind | 'ALL'>('ALL');

  const filteredCanon = useMemo(
    () => kindFilter === 'ALL' ? state.canon : state.canon.filter((c) => c.kind === kindFilter),
    [state.canon, kindFilter],
  );

  const canonizedEvidence = useMemo(
    () => Object.values(state.evidence).filter((e) => e.state === 'CANONIZED'),
    [state.evidence],
  );

  const learnedEvidence = useMemo(
    () => Object.values(state.evidence).filter((e) => e.state === 'LEARNED'),
    [state.evidence],
  );

  const evidenceById = useMemo(
    () => Object.fromEntries(Object.values(state.evidence).map((e) => [e.id, e])),
    [state.evidence],
  );

  function findEvidenceForCanon(entry: CanonEntry): EvidenceRecord | undefined {
    const match = entry.origin.match(/^(ER-\d+)/);
    if (match) return evidenceById[match[1]];
    return canonizedEvidence.find((e) => entry.origin.includes(e.id));
  }

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: state.canon.length };
    for (const c of state.canon) {
      counts[c.kind] = (counts[c.kind] || 0) + 1;
    }
    return counts;
  }, [state.canon]);

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <Eyebrow>SHEET 07 · MEMORY & LEARNING</Eyebrow>
          <h2 className="page-title">Memory</h2>
        </div>
        <div className="page-note">
          Signals → Opportunity Graph → Decision Engine → Resource Allocation → Mission Queue → Execution → Receipts → Verification → Outcome → Memory
        </div>
      </header>

      <SectionRule>THE LEARNING FEEDBACK LOOP</SectionRule>
      <div className="panel">
        <div className="panel-label">EVERY CANON ENTRY TRACES BACK THROUGH THIS CHAIN — NO ENTRY EXISTS WITHOUT EVIDENCE</div>
        <LearningFeedbackLoop />
      </div>

      <SectionRule>CANON · REUSABLE INTELLIGENCE ({state.canon.length} entries)</SectionRule>
      <div className="memory-stats">
        <div className="memory-stat">
          <div className="memory-stat-num">{canonizedEvidence.length}</div>
          <div className="memory-stat-label">CANONIZED EVIDENCE RECORDS</div>
        </div>
        <div className="memory-stat">
          <div className="memory-stat-num">{learnedEvidence.length}</div>
          <div className="memory-stat-label">LEARNED · AWAITING CANONIZATION</div>
        </div>
        <div className="memory-stat">
          <div className="memory-stat-num">{Object.values(state.evidence).length}</div>
          <div className="memory-stat-label">TOTAL EVIDENCE RECORDS</div>
        </div>
      </div>

      <div className="filter-bar">
        <label>
          KIND
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as CanonKind | 'ALL')}>
            <option value="ALL">All ({kindCounts.ALL})</option>
            {(Object.keys(KIND_LABEL) as CanonKind[]).map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]} ({kindCounts[k] || 0})</option>
            ))}
          </select>
        </label>
      </div>

      <div className="memory-canon-list">
        {filteredCanon.length === 0 && <EmptyNote>No canon entries match this filter.</EmptyNote>}
        {filteredCanon.map((entry) => (
          <CanonCard
            key={entry.id}
            entry={entry}
            evidence={findEvidenceForCanon(entry)}
            expanded={expandedId === entry.id}
            onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
          />
        ))}
      </div>

      <SectionRule>EVIDENCE RECORDS AWAITING CANONIZATION</SectionRule>
      <div className="panel">
        <div className="panel-label">
          THESE RECORDS HAVE REACHED LEARNED OR CANONIZED — THE SYSTEM'S HIGHEST-CONFIDENCE STATE
        </div>
        {learnedEvidence.length === 0 && canonizedEvidence.length === 0 ? (
          <EmptyNote>No evidence records have reached LEARNED or CANONIZED yet.</EmptyNote>
        ) : (
          <div className="memory-pending-list">
            {[...learnedEvidence, ...canonizedEvidence].map((e) => (
              <div className="memory-pending-row" key={e.id}>
                <div className="memory-pending-id mono">{e.id}</div>
                <div className="memory-pending-title">{e.title}</div>
                <Badge tone={e.state === 'CANONIZED' ? 'ok' : 'warn'}>{e.state}</Badge>
                <div className="memory-pending-conf">{Math.round(e.confidence * 100)}%</div>
                <div className="memory-pending-receipts">{e.receipts.length} receipt(s)</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
