import React from 'react';
import { useAppState } from '../state/AppState';
import { AUTONOMY_LEVELS, levelIndex, tokenStatus } from '../lib/governance';
import type { AutonomyLevel } from '../types';
import { Eyebrow, Chip, SectionRule, Badge } from '../components/ui';

const TOKEN_TONE: Record<string, 'ok' | 'warn' | 'bad'> = { VALID: 'ok', EXPIRED: 'warn', REVOKED: 'bad' };

export default function Governance() {
  const { state, revokeToken, setBoundary } = useAppState();

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <Eyebrow>SHEET 06 · GOVERNANCE</Eyebrow>
          <h2 className="page-title">Governance</h2>
        </div>
        <div className="page-note">authority is granted, expiring, revocable, audited</div>
      </header>

      <SectionRule>AUTONOMY LADDER</SectionRule>
      <div className="panel">
        <div className="detail-label" style={{ marginBottom: 12 }}>
          CURRENT GRANTED BOUNDARY — missions above this level cannot be authorized without raising it here
        </div>
        <div className="boundary-selector">
          {AUTONOMY_LEVELS.filter((l) => l.level !== 'L5').map((l) => (
            <button
              key={l.level}
              type="button"
              className={`boundary-btn ${state.boundary === l.level ? 'boundary-btn--active' : ''}`}
              onClick={() => setBoundary(l.level as AutonomyLevel)}
            >
              {l.level}
            </button>
          ))}
        </div>
        {AUTONOMY_LEVELS.map((l) => (
          <div key={l.level} className="ladder-row">
            {l.level === 'L5' && (
              <div className="boundary">
                <span className="boundary-line" />
                <span className="boundary-label">FOUNDER APPROVAL BOUNDARY — always requires explicit escalation</span>
                <span className="boundary-line" />
              </div>
            )}
            <div className="ladder-row-inner">
              <span className={`ladder-lvl ${levelIndex(l.level as AutonomyLevel) <= levelIndex(state.boundary) ? 'ladder-lvl--granted' : ''}`}>
                {l.level}
              </span>
              <div>
                <div className="ladder-name">{l.name}</div>
                <div className="ladder-desc">{l.desc}</div>
              </div>
              {levelIndex(l.level as AutonomyLevel) <= levelIndex(state.boundary) && l.level !== 'L5' && (
                <Badge tone="ok">granted</Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      <SectionRule>FOUNDER-APPROVED INTENT TOKENS · NO VALID TOKEN → NO SPEND</SectionRule>
      <div className="token-grid">
        {state.tokens.map((t) => {
          const status = tokenStatus(t);
          return (
            <div className="panel token-card" key={t.id}>
              <div className="token-card-head">
                <div className="mono">{t.id}</div>
                <Badge tone={TOKEN_TONE[status]}>{status}</Badge>
              </div>
              <div className="token-rows">
                <div className="token-row"><span className="token-k">approved_by</span><span>{t.approvedBy}</span></div>
                <div className="token-row"><span className="token-k">action</span><span>{t.action}</span></div>
                <div className="token-row"><span className="token-k">vendor / system</span><span>{t.vendorOrSystem}</span></div>
                <div className="token-row"><span className="token-k">max_amount</span><span>{t.currency} {t.maxAmount.toLocaleString()}</span></div>
                <div className="token-row"><span className="token-k">expires</span><span>{t.expiresAt.slice(0, 10)}</span></div>
                <div className="token-row"><span className="token-k">recurrence</span><span>{t.recurrence}</span></div>
                <div className="token-row"><span className="token-k">environment</span><span>{t.environment}</span></div>
              </div>
              <details className="audit-details">
                <summary>Audit record ({t.audit.length})</summary>
                <ul className="detail-list">
                  {t.audit.map((a, i) => <li key={i}><span className="mono">{a.at.slice(0, 10)}</span> — {a.actor}: {a.action}{a.detail ? ` (${a.detail})` : ''}</li>)}
                </ul>
              </details>
              {status === 'VALID' && (
                <button type="button" className="btn btn--danger" onClick={() => revokeToken(t.id)}>
                  Revoke instantly
                </button>
              )}
              {status !== 'VALID' && <div className="muted">no reactivation without a new token</div>}
            </div>
          );
        })}
      </div>

      <SectionRule>CANON &amp; MEMORY</SectionRule>
      <div className="panel canon-list">
        {state.canon.map((c) => (
          <div className="canon-row" key={c.id}>
            <Chip accent={c.kind === 'negative intelligence'}>{c.kind}</Chip>
            <div className="canon-body">
              <div className="canon-title">{c.title}</div>
              <div className="canon-origin">{c.origin} · confidence {Math.round(c.confidence * 100)}%</div>
            </div>
          </div>
        ))}
      </div>

      <SectionRule>DRAFTING ROOM</SectionRule>
      <div className="panel">
        <p className="muted" style={{ marginTop: 0 }}>
          Palette, texture, and grid-scale controls are always available via the floating
          <strong> ◧ DRAFTING ROOM</strong> panel in the bottom-right corner of every workspace.
          Selections persist in this browser via <code>localStorage</code>.
        </p>
      </div>
    </div>
  );
}
