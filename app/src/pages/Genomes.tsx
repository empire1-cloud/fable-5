import React, { useEffect, useState } from 'react';
import { api, ApiError, type ApiGenome, type ApiGenomeDetail, type ApiGenomeSection, type GenomeMaturityLevel } from '../lib/api';
import { Eyebrow, Chip, SectionRule, Badge, EmptyNote } from '../components/ui';

const MATURITY_ORDER: GenomeMaturityLevel[] = ['Draft', 'Tested', 'Verified', 'Replication-Ready'];

function MaturityStrip({ current, gate }: { current: GenomeMaturityLevel; gate: ApiGenomeDetail['maturityGate'] }) {
  const idx = MATURITY_ORDER.indexOf(current);
  return (
    <div className="maturity-strip">
      {MATURITY_ORDER.map((m, i) => (
        <React.Fragment key={m}>
          <div className={`mat-chip ${i === idx ? 'mat-chip--current' : ''} ${i < idx ? 'mat-chip--past' : ''}`}>
            <span className="mat-name">{m.toUpperCase()}</span>
          </div>
          {i < MATURITY_ORDER.length - 1 && <span className="strip-arrow">→</span>}
        </React.Fragment>
      ))}
      {!gate.allowed && <span className="locked-chip">LOCKED — {gate.reason}</span>}
    </div>
  );
}

/** A section is proven only when its evidence reached VERIFIED or later.
 *  "attached" and "proven" are shown as different things on purpose. */
function SectionRow({ section }: { section: ApiGenomeSection }) {
  const state = section.evidenceState;
  return (
    <div className={`genome-field-row ${section.proven ? '' : 'genome-field-row--unproven'}`}>
      <span className="genome-field-key">{section.label}</span>
      <span className="genome-field-val">{section.value}</span>
      {section.proven ? (
        <span className="genome-field-flag genome-field-flag--proven" title={`evidence ${state}`}>
          {state}
        </span>
      ) : state ? (
        <span className="genome-field-flag genome-field-flag--claimed" title="evidence attached but not yet verified">
          {state} · not proven
        </span>
      ) : (
        <span className="genome-field-flag">no evidence</span>
      )}
    </div>
  );
}

function GenomeDetail({ genome }: { genome: ApiGenomeDetail }) {
  const groups = new Map<string, ApiGenomeSection[]>();
  for (const s of genome.sections) {
    if (!groups.has(s.group)) groups.set(s.group, []);
    groups.get(s.group)!.push(s);
  }
  const pct = genome.coverage.total > 0 ? Math.round((genome.coverage.proven / genome.coverage.total) * 100) : 0;

  return (
    <div className="panel panel--accent genome-detail">
      <div className="panel-label panel-label--accent">GENOME {genome.code}</div>
      <h3 className="engine-detail-name">{genome.name}</h3>
      <p className="genome-thesis">{genome.thesis}</p>
      <MaturityStrip current={genome.maturity} gate={genome.maturityGate} />

      <div className="genome-proof-bar">
        <div className="detail-label">
          EVIDENCE COVERAGE · computed from the state machine, not a stored flag
        </div>
        <div className="meter">
          <div className="meter-track"><div className="meter-fill" style={{ width: `${pct}%` }} /></div>
          <span className="meter-val">
            {genome.coverage.proven}/{genome.coverage.total} sections backed by VERIFIED-or-later evidence
          </span>
        </div>
      </div>

      <div className="genome-groups">
        {Array.from(groups.entries()).map(([group, sections]) => (
          <div key={group} className="genome-group-card">
            <div className="genome-group-label">{group}</div>
            {sections.map((s) => <SectionRow key={s.id} section={s} />)}
          </div>
        ))}
      </div>

      <div className="opportunity-grid">
        <div>
          <div className="detail-label">VERIFIED PLAYBOOKS · canon entries only</div>
          {genome.playbooks.length === 0 ? (
            <div className="muted">
              none yet — a playbook appears here only after its evidence reaches CANONIZED
            </div>
          ) : (
            <ul className="detail-list">
              {genome.playbooks.map((p) => (
                <li key={p.id}>{p.title} <span className="muted">· {p.policy_version}</span></li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="detail-label">
            MISSING FOR {genome.nextMaturity ? genome.nextMaturity.toUpperCase() : 'NEXT STAGE'} · derived, not typed
          </div>
          {genome.missingForNextStage.length === 0 ? (
            <div className="muted">nothing outstanding — every section carries verified evidence</div>
          ) : (
            <ul className="detail-list">
              {genome.missingForNextStage.map((m) => (
                <li key={m.label}>
                  <strong>{m.label}</strong> — <span className="muted">{m.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <div className="detail-label">MARKET NODES RUNNING THIS GENOME</div>
        {genome.nodes.length === 0 ? (
          <div className="muted">no node runs this genome yet</div>
        ) : (
          <div className="chips">
            {genome.nodes.map((n) => (
              <Chip key={n.id} accent>{n.geography} · {n.status} · {n.autonomy_level}</Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Genomes() {
  const [list, setList] = useState<ApiGenome[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApiGenomeDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.genomes
      .list()
      .then((rows) => {
        if (cancelled) return;
        setList(rows);
        setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setListError(e instanceof ApiError ? e.detail : 'Could not reach the control plane.');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setDetail(null);
    setDetailError(null);
    api.genomes
      .get(selectedId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e: unknown) => {
        if (!cancelled) setDetailError(e instanceof ApiError ? e.detail : 'Could not reach the control plane.');
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <Eyebrow>SHEET 04 · COMPANY GENOME &amp; REPLICATION</Eyebrow>
          <h2 className="page-title">Company Genome</h2>
        </div>
        <div className="page-note">a section is proven by evidence, never by assertion</div>
      </header>

      <SectionRule>GENOMES</SectionRule>

      {listError && (
        <div className="panel"><EmptyNote>Could not load genomes: {listError}</EmptyNote></div>
      )}

      {!list && !listError && (
        <div className="panel"><EmptyNote>Loading genomes from the control plane…</EmptyNote></div>
      )}

      {list && list.length === 0 && (
        <div className="panel">
          <EmptyNote>
            No genome has been created yet. This is an honest empty state — a new organisation has not
            validated a business blueprint, and nothing is invented to fill the space.
          </EmptyNote>
        </div>
      )}

      {list && list.length > 0 && (
        <div className="genome-picker">
          {list.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`genome-pick-card ${g.id === selectedId ? 'genome-pick-card--selected' : ''}`}
              onClick={() => setSelectedId(g.id)}
            >
              <div className="genome-pick-name">{g.name}</div>
              <div className="genome-pick-maturity">
                {g.maturity}
                {g.section_count > 0 && (
                  <> · <Badge tone={g.proven_count === g.section_count ? 'ok' : 'warn'}>
                    {g.proven_count}/{g.section_count} proven
                  </Badge></>
                )}
              </div>
              <div className="genome-pick-thesis">{g.thesis}</div>
            </button>
          ))}
        </div>
      )}

      {detailError && (
        <div className="panel"><EmptyNote>Could not load this genome: {detailError}</EmptyNote></div>
      )}
      {selectedId && !detail && !detailError && (
        <div className="panel"><EmptyNote>Reading genome…</EmptyNote></div>
      )}
      {detail && <GenomeDetail genome={detail} />}
    </div>
  );
}
