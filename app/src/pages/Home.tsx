import React from 'react';
import { href } from '../lib/router';
import { useAppState } from '../state/AppState';
import { systemSnapshot } from '../lib/selectors';
import { Panel, Eyebrow } from '../components/ui';
import ExecutionRuntimeStatus from '../components/ExecutionRuntimeStatus';

export default function Home() {
  const { state } = useAppState();
  const snap = systemSnapshot(state);

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <Eyebrow>SPEC · REV 2.0 · WE EVOLVE, NEVER DELETE</Eyebrow>
        <h1 className="hero-title">
          FABLE-5 <span className="hero-slash">/</span> Autonomous Company Control Plane
        </h1>
        <p className="hero-sub">
          A governed, evidence-backed system that discovers opportunities, allocates resources,
          manufactures companies, verifies reality, learns from every outcome, and replicates
          validated systems across markets. Every workspace below is a live operating surface,
          seeded with realistic demo data — not a static diagram.
        </p>
        <div className="hero-actions">
          <a className="btn btn--primary" href={href('/control-plane')}>
            Enter Control Plane →
          </a>
          <a className="btn btn--ghost" href={href('/blueprint')}>
            Inspect System Blueprint
          </a>
        </div>
      </section>

      <ExecutionRuntimeStatus />

      <section className="snapshot-grid">
        <Panel label="ACTIVE OPPORTUNITIES" className="snapshot-card">
          <div className="snapshot-num">{snap.activeOpportunities}</div>
          <div className="snapshot-note">score ≥ 50 in the Opportunity Graph</div>
        </Panel>
        <Panel label="ACTIVE MISSIONS" className="snapshot-card">
          <div className="snapshot-num">{snap.activeMissions}</div>
          <div className="snapshot-note">executing inside autonomy bounds right now</div>
        </Panel>
        <Panel label="PENDING VERIFICATION" className="snapshot-card">
          <div className="snapshot-num">{snap.pendingVerification}</div>
          <div className="snapshot-note">RECEIPTED, awaiting independent check</div>
        </Panel>
        <Panel label="COMPANY GENOMES" className="snapshot-card">
          <div className="snapshot-num">{snap.genomeCount}</div>
          <div className="snapshot-note">reusable, structured business blueprints</div>
        </Panel>
        <Panel label="MARKET NODES" className="snapshot-card">
          <div className="snapshot-num">{snap.activeNodeCount}<span className="snapshot-num-of">/{snap.totalNodeCount}</span></div>
          <div className="snapshot-note">active or scaling, out of all tracked nodes</div>
        </Panel>
        <Panel label="RESOURCE PRESSURE" className="snapshot-card">
          <div className="snapshot-num">{Math.round(snap.resourcePressure * 100)}<span className="snapshot-num-of">%</span></div>
          <div className="snapshot-note">tightest constraint: {snap.tightestResource}</div>
        </Panel>
      </section>

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
        <a className="workspace-card" href={href('/genomes')}>
          <div className="workspace-num">04</div>
          <div className="workspace-name">Company Genome</div>
          <div className="workspace-desc">Structured, reusable business blueprints and their replication readiness.</div>
        </a>
        <a className="workspace-card" href={href('/allocation')}>
          <div className="workspace-num">05</div>
          <div className="workspace-name">Capital &amp; Resource Allocation</div>
          <div className="workspace-desc">Where the next unit of scarce resource goes — and why. No real spend without a token.</div>
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
