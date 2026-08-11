import React, { useEffect, useState } from 'react';
import { href } from '../lib/router';
import { api, ApiError, type ApiDashboard } from '../lib/api';
import { summarize, toNumber } from '../lib/dashboard';
import { ENGINE_MAP } from '../data/engines';
import { Eyebrow, Badge, EmptyNote } from '../components/ui';
import ExecutionRuntimeStatus from '../components/ExecutionRuntimeStatus';

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; data: ApiDashboard }
  | { status: 'error'; message: string };

const VERDICT_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'neutral'> = {
  AUTHORIZE_EXPERIMENT: 'ok',
  INVESTIGATE: 'warn',
  WATCH: 'warn',
  HOLD_FOR_EVIDENCE: 'bad',
  REFUSE: 'bad',
};

export default function Home() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    api
      .dashboard()
      .then((data) => {
        if (!cancelled) setState({ status: 'ok', data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof ApiError ? error.detail : 'Could not reach the control plane.';
        setState({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const data = state.status === 'ok' ? state.data : null;
  const summary = data ? summarize(data) : null;

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <Eyebrow>GOD MODE · EVERY ENGINE, EVERY RECORD, ONE READ</Eyebrow>
        <h1 className="hero-title">
          GOD MODE <span className="hero-slash">/</span> {data?.tenant.name ?? 'your company'}
        </h1>
        <p className="hero-sub">
          You can see everything. You still can't fake anything. Every number below is computed on the
          server from your organisation's own records — and seeing them grants no power to skip a gate.
          The evidence state machine refuses a skipped transition from this screen exactly as it does
          from anywhere else.
        </p>
        <div className="hero-actions">
          <a className="btn btn--primary" href={href('/control/evidence')}>
            Open the Evidence Ledger →
          </a>
          <a className="btn btn--ghost" href={href('/control/escalations')}>
            {data && data.openEscalations > 0 ? `${data.openEscalations} open escalation${data.openEscalations === 1 ? '' : 's'} →` : 'Escalation queue'}
          </a>
        </div>
      </section>

      {state.status === 'loading' && (
        <section className="panel">
          <EmptyNote>Reading the whole company from the server…</EmptyNote>
        </section>
      )}

      {state.status === 'error' && (
        <section className="panel">
          <EmptyNote>
            Could not load the company view: {state.message} — nothing is shown rather than showing
            numbers we cannot stand behind.
          </EmptyNote>
        </section>
      )}

      {data && summary && (
        <>
          <section className="snapshot-grid">
            <div className="panel snapshot-card">
              <div className="panel-label">EVIDENCE RECORDS</div>
              <div className="snapshot-num">{summary.totalEvidence}</div>
              <div className="snapshot-note">live records across all eight states</div>
            </div>
            <div className="panel snapshot-card">
              <div className="panel-label">RANKED OPPORTUNITIES</div>
              <div className="snapshot-num">{summary.rankedOpportunities}</div>
              <div className="snapshot-note">scored by Engine 00, highest first</div>
            </div>
            <div className="panel snapshot-card">
              <div className="panel-label">OPEN ESCALATIONS</div>
              <div className={`snapshot-num ${summary.openEscalations > 0 ? 'snapshot-num--warn' : ''}`}>
                {summary.openEscalations}
              </div>
              <div className="snapshot-note">
                {summary.openEscalations > 0 ? 'refused gates awaiting a stated reason' : 'no refused gate is unresolved'}
              </div>
            </div>
            <div className="panel snapshot-card">
              <div className="panel-label">CANONIZED</div>
              <div className="snapshot-num">{summary.canonized}</div>
              <div className="snapshot-note">reached the terminal state — proven, not claimed</div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-label panel-label--accent">EVIDENCE PIPELINE · the funnel, not a progress bar</div>
            <div className="godmode-pipeline">
              {summary.pipeline.map(({ state: s, count }) => (
                <div key={s} className={`godmode-stage ${count > 0 ? 'godmode-stage--live' : ''}`}>
                  <div className="godmode-stage-num">{count}</div>
                  <div className="godmode-stage-name">{s}</div>
                </div>
              ))}
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>
              A record only moves right when the gate for the next state is satisfied. Nothing on this
              screen can advance one — GOD MODE is omniscience, not permission.
            </p>
          </section>

          <section className="panel">
            <div className="panel-label panel-label--accent">ENGINE LOAD · work items per engine</div>
            <div className="godmode-engines">
              {summary.engineLoad.map(({ id, count }) => {
                const engine = ENGINE_MAP[id];
                return (
                  <div key={id} className={`godmode-engine ${count > 0 ? 'godmode-engine--live' : ''}`}>
                    <div className="godmode-engine-id">{id}</div>
                    <div className="godmode-engine-body">
                      <div className="godmode-engine-name">{engine?.name ?? `Engine ${id}`}</div>
                      <div className="godmode-engine-count">
                        {count} {count === 1 ? 'work item' : 'work items'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="panel-label panel-label--accent">RANKED OPPORTUNITIES · Engine 00 arithmetic</div>
            {data.opportunities.length === 0 ? (
              <EmptyNote>
                No opportunity has been ranked yet. An honest empty state beats an invented number.
              </EmptyNote>
            ) : (
              data.opportunities.map((o) => (
                <div key={o.id} className="godmode-opp">
                  <div className="godmode-opp-score">{toNumber(o.ranking_score).toFixed(2)}</div>
                  <div className="godmode-opp-body">
                    <div className="opportunity-title">{o.title}</div>
                    <div className="opportunity-meta">
                      status {o.status} · ranked {new Date(o.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge tone={VERDICT_TONE[o.ranking_verdict] ?? 'neutral'}>{o.ranking_verdict}</Badge>
                </div>
              ))
            )}
          </section>
        </>
      )}

      <ExecutionRuntimeStatus />

      <section className="workspace-links">
        <a className="workspace-card" href={href('/blueprint')}>
          <div className="workspace-num">01</div>
          <div className="workspace-name">System Blueprint</div>
          <div className="workspace-desc">Inspect all 9 engines — inputs, outputs, KPIs, receipts, escalation, and how they connect.</div>
        </a>
        <a className="workspace-card" href={href('/control-plane')}>
          <div className="workspace-num">02</div>
          <div className="workspace-name">Control Plane</div>
          <div className="workspace-desc">Signals → Opportunity Graph → Decisions → Allocation → Mission Queue → Execution → Receipts → Verification → Outcome → Memory.</div>
        </a>
        <a className="workspace-card" href={href('/evidence')}>
          <div className="workspace-num">03</div>
          <div className="workspace-name">Evidence &amp; Verification</div>
          <div className="workspace-desc">The formal state machine. Nothing is shown as verified without the evidence to support it.</div>
        </a>
        <a className="workspace-card" href={href('/control/decisions')}>
          <div className="workspace-num">04</div>
          <div className="workspace-name">Decisions</div>
          <div className="workspace-desc">Real decision rows written the moment Engine 00 authorizes an opportunity.</div>
        </a>
        <a className="workspace-card" href={href('/control/escalations')}>
          <div className="workspace-num">05</div>
          <div className="workspace-name">Escalations</div>
          <div className="workspace-desc">Refused gates, retained as negative intelligence until resolved with a stated reason.</div>
        </a>
        <a className="workspace-card" href={href('/governance')}>
          <div className="workspace-num">06</div>
          <div className="workspace-name">Governance / Drafting Room</div>
          <div className="workspace-desc">Autonomy ladder, Founder-Approved Intent Tokens, and the visual controls for this workspace.</div>
        </a>
      </section>
    </div>
  );
}
