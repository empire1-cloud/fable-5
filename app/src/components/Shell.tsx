import React, { useState } from 'react';
import { href } from '../lib/router';
import { useAppState } from '../state/AppState';
import { systemSnapshot } from '../lib/selectors';
import { MARKET_NODES } from '../data/genomes';
import { useSelectedNode } from '../state/selection';
import DraftingRoomPanel from './DraftingRoomPanel';

const NAV: { to: string; num: string; label: string }[] = [
  { to: '/', num: '00', label: 'OVERVIEW' },
  { to: '/blueprint', num: '01', label: 'BLUEPRINT' },
  { to: '/control-plane', num: '02', label: 'CONTROL PLANE' },
  { to: '/evidence', num: '03', label: 'EVIDENCE' },
  { to: '/genomes', num: '04', label: 'GENOMES' },
  { to: '/allocation', num: '05', label: 'ALLOCATION' },
  { to: '/governance', num: '06', label: 'GOVERNANCE' },
  { to: '/memory', num: '07', label: 'MEMORY' },
];

export default function Shell({ route, children }: { route: string; children: React.ReactNode }) {
  const { state, apiStatus, lastFetchedAt, proofVerified } = useAppState();
  const snap = systemSnapshot(state);
  const { nodeId, setNodeId } = useSelectedNode();
  const [navOpen, setNavOpen] = useState(false);
  const runtimeLabel =
    apiStatus === 'online'
      ? proofVerified
        ? 'CONNECTED HYBRID STATE'
        : 'CONNECTED STATE · PROOF PENDING'
      : apiStatus === 'loading'
        ? 'CONNECTING · HOLDING LOCAL STATE'
        : apiStatus === 'error'
          ? 'HYBRID STATE · LAST KNOWN + SEED'
          : 'SEED FALLBACK STATE';
  const runtimeMeta =
    apiStatus === 'online' && lastFetchedAt
      ? `last sync ${new Date(lastFetchedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : apiStatus === 'offline'
        ? 'API unreachable'
        : apiStatus === 'error'
          ? 'live refresh failed'
          : 'awaiting runtime handshake';

  return (
    <div className="shell">
      <header className="topbar">
        <button
          className="nav-burger"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((v) => !v)}
        >
          ☰
        </button>
        <div className="topbar-brand">
          <span className="topbar-mark" aria-hidden="true">◧</span>
          <span className="topbar-name">FABLE-5</span>
          <span className="topbar-sub">Autonomous Company Control Plane</span>
        </div>
        <div className="topbar-context">
          <label className="context-label" htmlFor="node-context">NODE CONTEXT</label>
          <select
            id="node-context"
            className="context-select"
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
          >
            {MARKET_NODES.map((n) => (
              <option key={n.id} value={n.id}>
                {n.geography} · {n.status}
              </option>
            ))}
          </select>
        </div>
        <div className="topbar-status" aria-label="System status">
          <span className={`status-dot ${apiStatus !== 'online' ? 'status-dot--muted' : ''}`} aria-hidden="true" />
          <span>{runtimeLabel}</span>
          <span className="status-meta">{runtimeMeta}</span>
        </div>
      </header>

      <div className="status-strip" role="status">
        <span>
          runtime <strong>{apiStatus}</strong>
        </span>
        <span>
          proof <strong>{proofVerified ? 'verified' : 'not yet verified'}</strong>
        </span>
        <span><strong>{snap.activeOpportunities}</strong> active opportunities</span>
        <span><strong>{snap.activeMissions}</strong> active missions</span>
        <span><strong>{snap.pendingVerification}</strong> pending verification</span>
        <span><strong>{snap.genomeCount}</strong> company genomes</span>
        <span><strong>{snap.activeNodeCount}</strong>/{snap.totalNodeCount} nodes active/scaling</span>
        <span className={snap.resourcePressure > 0.85 ? 'pressure pressure--high' : 'pressure'}>
          resource pressure <strong>{Math.round(snap.resourcePressure * 100)}%</strong> ({snap.tightestResource})
        </span>
      </div>

      <div className="shell-body">
        <nav className={`shell-nav ${navOpen ? 'shell-nav--open' : ''}`} aria-label="Workspaces">
          {NAV.map((n) => (
            <a
              key={n.to}
              href={href(n.to)}
              className={`nav-link ${route === n.to ? 'nav-link--active' : ''}`}
              onClick={() => setNavOpen(false)}
            >
              <span className="nav-num">{n.num}</span>
              <span className="nav-label">{n.label}</span>
            </a>
          ))}
          <div className="nav-foot">
            FOUNDER-OWNED INFRA<br />NO SILENT SPEND<br />RECEIPTS REQUIRED<br />WE EVOLVE, NEVER DELETE
          </div>
        </nav>

        <main className="shell-main">{children}</main>
      </div>

      <DraftingRoomPanel />
    </div>
  );
}
