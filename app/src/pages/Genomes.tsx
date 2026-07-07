import React, { useMemo, useState } from 'react';
import { GENOMES, MARKET_NODES, MATURITY_ORDER } from '../data/genomes';
import type { CompanyGenome, GenomeMaturity } from '../types';
import { Eyebrow, Chip, SectionRule } from '../components/ui';

function MaturityStrip({ current }: { current: GenomeMaturity }) {
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
      {idx < MATURITY_ORDER.length - 1 && (
        <span className="locked-chip">GLOBAL CLONE LOCKED UNTIL REPLICATION-READY</span>
      )}
    </div>
  );
}

function GenomeDetail({ genome }: { genome: CompanyGenome }) {
  const groups = useMemo(() => {
    const map = new Map<string, typeof genome.sections>();
    for (const s of genome.sections) {
      if (!map.has(s.group)) map.set(s.group, []);
      map.get(s.group)!.push(s);
    }
    return Array.from(map.entries());
  }, [genome]);

  const nodes = MARKET_NODES.filter((n) => n.genomeId === genome.id);
  const provenCount = genome.sections.filter((s) => s.proven).length;

  return (
    <div className="panel panel--accent genome-detail">
      <div className="panel-label panel-label--accent">GENOME {genome.id}</div>
      <h3 className="engine-detail-name">{genome.name}</h3>
      <p className="genome-thesis">{genome.thesis}</p>
      <MaturityStrip current={genome.maturity} />

      <div className="genome-proof-bar">
        <div className="detail-label">EVIDENCE COVERAGE</div>
        <div className="meter">
          <div className="meter-track"><div className="meter-fill" style={{ width: `${Math.round((provenCount / genome.sections.length) * 100)}%` }} /></div>
          <span className="meter-val">{provenCount}/{genome.sections.length} sections proven</span>
        </div>
      </div>

      <div className="genome-groups">
        {groups.map(([group, sections]) => (
          <div key={group} className="genome-group-card">
            <div className="genome-group-label">{group}</div>
            {sections.map((s) => (
              <div key={s.key} className={`genome-field-row ${s.proven ? '' : 'genome-field-row--unproven'}`}>
                <span className="genome-field-key">{s.label}</span>
                <span className="genome-field-val">{s.value}</span>
                {!s.proven && <span className="genome-field-flag">unproven</span>}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="opportunity-grid">
        <div>
          <div className="detail-label">VERIFIED PLAYBOOKS</div>
          {genome.verifiedPlaybooks.length === 0 ? (
            <div className="muted">none yet — see missing requirements</div>
          ) : (
            <ul className="detail-list">{genome.verifiedPlaybooks.map((p) => <li key={p}>{p}</li>)}</ul>
          )}
        </div>
        <div>
          <div className="detail-label">MISSING FOR NEXT STAGE</div>
          <ul className="detail-list">
            {genome.missingForNextStage.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      </div>

      <div>
        <div className="detail-label">MARKET NODES RUNNING THIS GENOME</div>
        <div className="chips">
          {nodes.map((n) => (
            <Chip key={n.id} accent>{n.geography} · {n.status}</Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Genomes() {
  const [selectedId, setSelectedId] = useState(GENOMES[0]?.id);
  const selected = GENOMES.find((g) => g.id === selectedId) ?? GENOMES[0];

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <Eyebrow>SHEET 04 · COMPANY GENOME &amp; REPLICATION</Eyebrow>
          <h2 className="page-title">Company Genome</h2>
        </div>
        <div className="page-note">verified genome + local modules = candidate market node</div>
      </header>

      <SectionRule>GENOMES</SectionRule>
      <div className="genome-picker">
        {GENOMES.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`genome-pick-card ${g.id === selectedId ? 'genome-pick-card--selected' : ''}`}
            onClick={() => setSelectedId(g.id)}
          >
            <div className="genome-pick-name">{g.name}</div>
            <div className="genome-pick-maturity">{g.maturity}</div>
            <div className="genome-pick-thesis">{g.thesis}</div>
          </button>
        ))}
      </div>

      {selected && <GenomeDetail genome={selected} />}
    </div>
  );
}
