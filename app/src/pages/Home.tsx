import React from 'react';
import { href } from '../lib/router';
import { useAppState } from '../state/AppState';
import { systemSnapshot } from '../lib/selectors';
import { Badge, Panel, Eyebrow } from '../components/ui';
import ExecutionRuntimeStatus from '../components/ExecutionRuntimeStatus';

type ExternalStatus = 'connected' | 'hybrid' | 'registered only' | 'unconnected' | 'connecting';

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function statusTone(status: ExternalStatus): 'ok' | 'warn' | 'bad' | 'neutral' {
  switch (status) {
    case 'connected':
      return 'ok';
    case 'hybrid':
    case 'connecting':
    case 'registered only':
      return 'warn';
    case 'unconnected':
      return 'bad';
    default:
      return 'neutral';
  }
}

export default function Home() {
  const {
    state,
    apiStatus,
    lastFetchedAt,
    proofVerified,
    liveBrief,
    loopStatus,
    executionProfile,
    connectedRepos,
  } = useAppState();
  const snap = systemSnapshot(state);
  const repoMap = connectedRepos.map((repo) => ({
    repo,
    haystack: normalize(`${repo.name} ${repo.full_name} ${repo.role} ${repo.category} ${repo.integration_plan}`),
  }));
  const findRepo = (...terms: string[]) =>
    repoMap.find(({ haystack }) => terms.every((term) => haystack.includes(normalize(term))))?.repo;
  const aiqRepo = findRepo('aiq');
  const coachRepo = findRepo('ai engineering coach');
  const hicRepo = findRepo('hic');
  const slaRepo = findRepo('sla113');
  const runtimeSummary =
    apiStatus === 'online'
      ? proofVerified
        ? 'Connected to the live runtime with proof-backed state available.'
        : 'Connected to the live runtime, with proof still pending or partial.'
      : apiStatus === 'loading'
        ? 'Attempting a live runtime handshake; local state remains visible during connect.'
        : apiStatus === 'error'
          ? 'Live refresh failed, so this view may mix the last known runtime state with local fallback data.'
          : 'The live runtime is offline, so this workspace is showing local seed fallback data.';
  const runtimeMeta =
    apiStatus === 'online' && lastFetchedAt
      ? `Last live sync ${new Date(lastFetchedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : apiStatus === 'offline'
        ? 'No live sync currently available'
      : apiStatus === 'error'
        ? 'Refresh status degraded'
        : 'Waiting for runtime status';
  const externalSystems: {
    name: string;
    status: ExternalStatus;
    detail: string;
  }[] = [
    {
      name: 'Cofounder',
      status:
        apiStatus === 'online'
          ? proofVerified ? 'connected' : 'hybrid'
          : apiStatus === 'loading'
            ? 'connecting'
            : apiStatus === 'error'
              ? 'hybrid'
              : 'unconnected',
      detail:
        apiStatus === 'online'
          ? `${liveBrief?.execution_mode ?? 'runtime connected'} · ${liveBrief?.phase_status ?? 'phase unknown'}`
          : 'No live handshake from the Cofounder runtime yet.',
    },
    {
      name: 'HIC',
      status: hicRepo ? 'registered only' : 'unconnected',
      detail: hicRepo
        ? `${hicRepo.status} · ${hicRepo.integration_plan}`
        : 'No HIC-specific adapter is registered in the current FABLE runtime.',
    },
    {
      name: 'SLA113',
      status: slaRepo ? 'registered only' : executionProfile ? 'hybrid' : 'unconnected',
      detail: slaRepo
        ? `${slaRepo.status} · ${slaRepo.integration_plan}`
        : executionProfile
          ? `Hermes execution profile is readable (${executionProfile.active_profile ?? 'base rules'}), but no SLA113-labeled adapter is registered.`
          : 'No SLA113 adapter is exposed to FABLE yet.',
    },
    {
      name: 'AIQ',
      status: aiqRepo ? 'registered only' : 'unconnected',
      detail: aiqRepo
        ? `${aiqRepo.status} · ${aiqRepo.integration_plan}`
        : 'AIQ is not present in the current Cofounder repo registry, so FABLE cannot claim a live connection.',
    },
    {
      name: 'AI Engineering Coach',
      status: coachRepo ? 'registered only' : 'unconnected',
      detail: coachRepo
        ? `${coachRepo.status} · ${coachRepo.integration_plan}`
        : 'ai-engineering-coach is not registered in the current runtime; treat it as an external observational lane for now.',
    },
  ];

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
          validated systems across markets. The surfaces below are runtime-aware working views:
          they can show live connected state, hybrid last-known state, or seed fallback state,
          depending on what the existing backend can currently supply.
        </p>
        <div className="hero-runtime-callout">
          <span className="hero-runtime-badge">{apiStatus === 'online' ? 'CONNECTED' : apiStatus === 'loading' ? 'CONNECTING' : apiStatus === 'error' ? 'HYBRID' : 'SEED FALLBACK'}</span>
          <span>{runtimeSummary}</span>
          <span className="hero-runtime-meta">{runtimeMeta}{apiStatus === 'online' ? ` · proof ${proofVerified ? 'verified' : 'pending'}` : ''}</span>
        </div>
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
          <div className="snapshot-note">seeded mission records; live execution is reported above</div>
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

      <section className="runtime-grid">
        <Panel label="CONNECTED RUNTIME" className="runtime-card">
          <div className="runtime-line">
            <span className="detail-label">MISSION</span>
            <span>{liveBrief?.todays_mission ?? 'No live mission reported'}</span>
          </div>
          <div className="runtime-line">
            <span className="detail-label">QUEUE</span>
            <span>
              {loopStatus
                ? `${loopStatus.mission_queue_depth} queued · ${loopStatus.ready_item_count} ready · ${loopStatus.waiting_approval_count} waiting approval`
                : 'Loop status not connected'}
            </span>
          </div>
          <div className="runtime-line">
            <span className="detail-label">EXECUTION</span>
            <span>
              {executionProfile
                ? executionProfile.effective_rules.execution_enabled
                  ? 'real execution enabled'
                  : executionProfile.effective_rules.dry_run_only
                    ? 'dry-run only'
                    : 'execution disabled'
                : 'Execution profile unavailable'}
            </span>
          </div>
          <div className="runtime-line">
            <span className="detail-label">RECEIPTS</span>
            <span>
              {liveBrief?.receipt_ledger_count ?? 0} ledger entries · {liveBrief?.verified_receipt_count ?? 0} verified
            </span>
          </div>
          <div className="runtime-line">
            <span className="detail-label">WATCH</span>
            <span>
              {liveBrief?.watched_repo_count ?? connectedRepos.length} repos observed · {liveBrief?.watch_findings_count ?? 0} findings
            </span>
          </div>
        </Panel>
        <Panel label="EXTERNAL SYSTEMS" className="runtime-card">
          <div className="system-list">
            {externalSystems.map((system) => (
              <div key={system.name} className="system-row">
                <div className="system-head">
                  <strong>{system.name}</strong>
                  <Badge tone={statusTone(system.status)}>{system.status.toUpperCase()}</Badge>
                </div>
                <div className="system-detail">{system.detail}</div>
              </div>
            ))}
          </div>
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
          <div className="workspace-desc">Signals → Opportunity Graph → Decisions → Allocation → Mission Queue → Execution → Receipts → Verification → Outcome → Memory, using connected runtime data when available and explicit fallback when it is not.</div>
        </a>
        <a className="workspace-card" href={href('/evidence')}>
          <div className="workspace-num">03</div>
          <div className="workspace-name">Evidence &amp; Verification</div>
          <div className="workspace-desc">The formal state machine. Nothing is shown as verified without the evidence to support it, and receipt provenance stays visible instead of being collapsed into “live” claims.</div>
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
