import React, { useState } from 'react';
import { ENGINES, ENGINE_MAP } from '../data/engines';
import type { Engine, EngineLayer } from '../types';
import { Eyebrow, Chip, SectionRule } from '../components/ui';
import { useAppState } from '../state/AppState';

const LAYER_LABEL: Record<EngineLayer, string> = {
  strategic: 'STRATEGIC SELECTION',
  pipeline: 'VALUE PIPELINE',
  substrate: 'SUBSTRATE',
  governing: 'GOVERNING LAYER',
};

function EngineCard({ engine, selected, onSelect }: { engine: Engine; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={`engine-card ${selected ? 'engine-card--selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="engine-card-num">{engine.id}</div>
      <div className="engine-card-name">{engine.name}</div>
      <div className="engine-card-role">{engine.role}</div>
      <div className="engine-card-gate">GATE → {engine.gate}</div>
    </button>
  );
}

export default function Blueprint() {
  const { apiStatus } = useAppState();
  const [selectedId, setSelectedId] = useState<string>('00');
  const selected = ENGINE_MAP[selectedId];

  const byLayer = (layer: EngineLayer) => ENGINES.filter((e) => e.layer === layer);

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <Eyebrow>SHEET 01 · SYSTEM BLUEPRINT · REV 2.0</Eyebrow>
          <h2 className="page-title">Interactive System Map</h2>
        </div>
        <div className="page-note">canonical engine map · click an engine to inspect inputs, outputs, KPIs, receipts, and escalation</div>
      </header>

      <div className="callout callout--accent">
        Blueprint is the canonical operating map. Runtime status is <strong>{apiStatus}</strong>, but the engine definitions shown here are source-controlled system architecture, not live telemetry.
      </div>

      <SectionRule>STRATEGIC SELECTION · ENGINE 00</SectionRule>
      <div className="engine-grid engine-grid--single">
        {byLayer('strategic').map((e) => (
          <EngineCard key={e.id} engine={e} selected={e.id === selectedId} onSelect={() => setSelectedId(e.id)} />
        ))}
      </div>

      <SectionRule>VALUE PIPELINE · ENGINES 01–06</SectionRule>
      <div className="engine-grid engine-grid--pipeline">
        {byLayer('pipeline').map((e) => (
          <EngineCard key={e.id} engine={e} selected={e.id === selectedId} onSelect={() => setSelectedId(e.id)} />
        ))}
      </div>

      <SectionRule>GOVERNING &amp; SUBSTRATE LAYERS · ENGINES 07–08</SectionRule>
      <div className="engine-grid engine-grid--single-2">
        {[...byLayer('substrate'), ...byLayer('governing')].map((e) => (
          <EngineCard key={e.id} engine={e} selected={e.id === selectedId} onSelect={() => setSelectedId(e.id)} />
        ))}
      </div>

      {selected && (
        <div className="engine-detail panel panel--accent">
          <div className="engine-detail-head">
            <div>
              <div className="panel-label panel-label--accent">
                ENGINE {selected.id} · {LAYER_LABEL[selected.layer]}
              </div>
              <h3 className="engine-detail-name">{selected.name}</h3>
            </div>
          </div>
          <p className="engine-detail-role">{selected.role}</p>
          <div className="engine-detail-grid">
            <div>
              <div className="detail-label">INPUTS</div>
              <ul className="detail-list">
                {selected.inputs.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
            <div>
              <div className="detail-label">OUTPUTS</div>
              <ul className="detail-list">
                {selected.outputs.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
            <div>
              <div className="detail-label">KPIs</div>
              <ul className="detail-list">
                {selected.kpis.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
            <div>
              <div className="detail-label">ACCEPTED RECEIPTS</div>
              <ul className="detail-list">
                {selected.receipts.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
            <div>
              <div className="detail-label">ESCALATION CONDITIONS</div>
              <ul className="detail-list">
                {selected.escalation.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
            <div>
              <div className="detail-label">CONNECTED ENGINES</div>
              <div className="chips">
                {selected.connects.map((id) => (
                  <Chip key={id} accent>
                    <button
                      type="button"
                      className="chip-link"
                      onClick={() => setSelectedId(id)}
                    >
                      {id} · {ENGINE_MAP[id]?.name}
                    </button>
                  </Chip>
                ))}
              </div>
            </div>
          </div>
          <div className="engine-detail-gate">NEXT MAY PROCEED WHEN → {selected.gate}</div>
        </div>
      )}
    </div>
  );
}
