import React, { useState } from 'react';
import { href } from '../lib/router';
import { MARKET_NODES } from '../data/genomes';
import { useSelectedNode } from '../state/selection';
import { useAuth } from '../auth/AuthProvider';
import { useDashboard } from '../state/DashboardData';
import { summarize } from '../lib/dashboard';
import DraftingRoomPanel from './DraftingRoomPanel';

const NAV: { to: string; num: string; label: string }[] = [
  { to: '/control', num: '00', label: 'OVERVIEW' },
  { to: '/blueprint', num: '01', label: 'BLUEPRINT' },
  { to: '/control-plane', num: '02', label: 'CONTROL PLANE' },
  { to: '/control/evidence', num: '03', label: 'EVIDENCE' },
  { to: '/control/decisions', num: '04', label: 'DECISIONS' },
  { to: '/control/escalations', num: '05', label: 'ESCALATIONS' },
  { to: '/genomes', num: '06', label: 'GENOMES' },
  { to: '/allocation', num: '07', label: 'ALLOCATION' },
  { to: '/governance', num: '08', label: 'GOVERNANCE' },
  { to: '/billing', num: '09', label: 'BILLING' },
  { to: '/control/settings', num: '10', label: 'SETTINGS' },
];

/** Status-strip cell. Renders the server's number, or an explicit placeholder
 *  while the server has not answered — never a stale or invented value. */
function Stat({ value, children, warn = false }: { value: number | string | null; children: React.ReactNode; warn?: boolean }) {
  return (
    <span className={warn ? 'pressure pressure--high' : undefined}>
      <strong>{value ?? '—'}</strong> {children}
    </span>
  );
}

export default function Shell({ route, children }: { route: string; children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { state: dash } = useDashboard();
  const { nodeId, setNodeId } = useSelectedNode();
  const [navOpen, setNavOpen] = useState(false);

  const data = dash.status === 'ok' ? dash.data : null;
  const summary = data ? summarize(data) : null;
  const pressure = data?.resourcePressure ?? null;

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
          <span className="status-dot" aria-hidden="true" />{' '}
          {dash.status === 'ok' ? 'SERVER STATE' : dash.status === 'error' ? 'SERVER UNREACHABLE' : 'READING…'}
        </div>
        <div className="topbar-account">
          <span className="topbar-user">{user?.email ?? '—'}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={logout}>
            SIGN OUT
          </button>
        </div>
      </header>

      <div className="status-strip" role="status">
        {dash.status === 'error' ? (
          <span className="pressure pressure--high">
            status unavailable — {dash.error}. No number is shown rather than a number we cannot back.
          </span>
        ) : (
          <>
            <Stat value={summary?.rankedOpportunities ?? null}>ranked opportunities</Stat>
            <Stat value={summary?.totalEvidence ?? null}>evidence records</Stat>
            <Stat value={summary?.pipeline.find((p) => p.state === 'RECEIPTED')?.count ?? null}>
              pending verification
            </Stat>
            <Stat value={data?.genomeCount ?? null}>company genomes</Stat>
            <span>
              <strong>{data ? data.nodes.activeOrScaling : '—'}</strong>
              {data ? `/${data.nodes.total}` : ''} nodes active/scaling
            </span>
            {pressure ? (
              <span className={pressure.ratio > 0.85 ? 'pressure pressure--high' : 'pressure'}>
                resource pressure <strong>{Math.round(pressure.ratio * 100)}%</strong> ({pressure.resourceType})
              </span>
            ) : (
              <span className="pressure">
                resource pressure <strong>—</strong> (no pool with capacity)
              </span>
            )}
          </>
        )}
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
