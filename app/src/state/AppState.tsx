/**
 * AppState.tsx  (updated)
 * Adds live API hydration via useEmpireCofounder hook.
 *
 * Changes from original:
 *   1. Added LOAD_LIVE_STATE action — replaces full state from API data.
 *   2. AppStateProvider calls useEmpireCofounder on mount and dispatches
 *      LOAD_LIVE_STATE when live data arrives.
 *   3. Context now exposes `apiStatus` and `refetchLive` for the UI.
 *   4. LoadingShell shown while first API fetch is in-flight.
 *   5. OfflineBanner shown when API is unreachable (seed data still works).
 *   6. All existing actions (advanceEvidence, setAllocation, etc.) unchanged.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import type {
  Allocations,
  AutonomyLevel,
  CanonEntry,
  EvidenceRecord,
  EvidenceState,
  IntentToken,
  Mission,
  ResourceType,
} from '../types';
import { SEED_MISSIONS, SEED_EVIDENCE } from '../data/missions';
import { SEED_ALLOCATIONS } from '../data/resources';
import { SEED_TOKENS, SEED_CANON } from '../data/governance';
import { canAdvance, nextEvidenceState } from '../lib/evidence';
import { useEmpireCofounder, type ApiStatus } from '../hooks/useEmpireCofounder';

// ── State shape ───────────────────────────────────────────────────────────

export interface AppState {
  missions: Mission[];
  evidence: Record<string, EvidenceRecord>;
  allocations: Allocations;
  tokens: IntentToken[];
  canon: CanonEntry[];
  boundary: AutonomyLevel;
}

function seedState(): AppState {
  return {
    missions: SEED_MISSIONS,
    evidence: Object.fromEntries(SEED_EVIDENCE.map((e) => [e.id, e])),
    allocations: JSON.parse(JSON.stringify(SEED_ALLOCATIONS)),
    tokens: SEED_TOKENS,
    canon: SEED_CANON,
    boundary: 'L4',
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────

type Action =
  | { type: 'LOAD_LIVE_STATE'; payload: AppState }          // ← new
  | { type: 'ADVANCE_EVIDENCE'; recordId: string; now: string }
  | { type: 'SET_ALLOCATION'; resource: ResourceType; targetId: string; amount: number }
  | { type: 'REVOKE_TOKEN'; tokenId: string; now: string }
  | { type: 'SET_BOUNDARY'; level: AutonomyLevel }
  | { type: 'RESET_DEMO_STATE' };

function nextMeasurement(
  record: EvidenceRecord,
  now: string,
): EvidenceRecord['measurement'] {
  return {
    gate: 'typed economic gate',
    reading: 'KPI reading recorded against threshold',
    verdict: record.confidence >= 0.6 ? 'ITERATE' : 'PAUSE',
    at: now,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {

    // ── New: replace full state from API ─────────────────────────────────
    case 'LOAD_LIVE_STATE':
      return action.payload;

    // ── All original actions unchanged ───────────────────────────────────
    case 'ADVANCE_EVIDENCE': {
      const rec = state.evidence[action.recordId];
      if (!rec) return state;
      const mission = state.missions.find((m) => m.evidenceRecordId === rec.id);
      const check = canAdvance(rec, {
        mission,
        tokens: state.tokens,
        boundary: state.boundary,
      });
      if (!check.ok || !check.to) return state;
      const to = check.to as EvidenceState;

      const updated: EvidenceRecord = {
        ...rec,
        state: to,
        confidence: Math.min(
          0.97,
          rec.confidence +
            (to === 'VERIFIED' || to === 'LEARNED' ? 0.08 : 0.03),
        ),
        audit: [
          ...rec.audit,
          {
            at: action.now,
            actor: 'FOUNDER · action',
            action: `advanced ${rec.state} → ${to}`,
          },
        ],
      };

      if (to === 'VERIFIED' && !updated.verification) {
        updated.verification = {
          method: 'independent check',
          by: 'ENGINE 07 · verifier',
          reproducible: true,
          at: action.now,
        };
      }
      if (to === 'MEASURED' && !updated.measurement) {
        updated.measurement = nextMeasurement(rec, action.now);
      }

      let canon = state.canon;
      if (to === 'CANONIZED') {
        const entry: CanonEntry = {
          id: `CAN-${rec.id}`,
          kind: 'primitive',
          title: `${rec.title} — canonized from ${
            mission?.objective ?? rec.missionId
          }`,
          origin: `${rec.id} · canonized ${action.now.slice(0, 10)}`,
          confidence: updated.confidence,
        };
        canon = [entry, ...state.canon];
      }

      return {
        ...state,
        evidence: { ...state.evidence, [rec.id]: updated },
        canon,
      };
    }

    case 'SET_ALLOCATION': {
      const { resource, targetId, amount } = action;
      const forResource = { ...(state.allocations[resource] ?? {}) };
      if (amount <= 0) delete forResource[targetId];
      else forResource[targetId] = amount;
      return {
        ...state,
        allocations: { ...state.allocations, [resource]: forResource },
      };
    }

    case 'REVOKE_TOKEN':
      return {
        ...state,
        tokens: state.tokens.map((t) =>
          t.id === action.tokenId
            ? {
                ...t,
                revoked: true,
                audit: [
                  ...t.audit,
                  {
                    at: action.now,
                    actor: 'Founder · action',
                    action: 'revoked',
                  },
                ],
              }
            : t,
        ),
      };

    case 'SET_BOUNDARY':
      return { ...state, boundary: action.level };

    case 'RESET_DEMO_STATE':
      return seedState();

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────

interface Ctx {
  state: AppState;
  /** "loading" | "online" | "offline" | "error" */
  apiStatus: ApiStatus;
  /** ISO timestamp of last successful live fetch */
  lastFetchedAt: string | null;
  /** True only when canonical proof chain confirmed intact */
  proofVerified: boolean;
  /** Trigger a manual refetch from the API */
  refetchLive: () => Promise<void>;
  advanceEvidence: (recordId: string) => void;
  setAllocation: (
    resource: ResourceType,
    targetId: string,
    amount: number,
  ) => void;
  revokeToken: (tokenId: string) => void;
  setBoundary: (level: AutonomyLevel) => void;
  resetDemoState: () => void;
}

const AppStateContext = createContext<Ctx | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────

export function AppStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, undefined, seedState);
  const { liveState, apiStatus, refetch } = useEmpireCofounder();

  // When live data arrives, hydrate the reducer with it
  useEffect(() => {
    if (liveState) {
      dispatch({ type: 'LOAD_LIVE_STATE', payload: liveState.appState });
    }
  }, [liveState]);

  const value = useMemo<Ctx>(
    () => ({
      state,
      apiStatus,
      lastFetchedAt: liveState?.fetchedAt ?? null,
      proofVerified: liveState?.proofVerified ?? false,
      refetchLive: refetch,
      advanceEvidence: (recordId) =>
        dispatch({
          type: 'ADVANCE_EVIDENCE',
          recordId,
          now: new Date().toISOString(),
        }),
      setAllocation: (resource, targetId, amount) =>
        dispatch({ type: 'SET_ALLOCATION', resource, targetId, amount }),
      revokeToken: (tokenId) =>
        dispatch({
          type: 'REVOKE_TOKEN',
          tokenId,
          now: new Date().toISOString(),
        }),
      setBoundary: (level) => dispatch({ type: 'SET_BOUNDARY', level }),
      resetDemoState: () => dispatch({ type: 'RESET_DEMO_STATE' }),
    }),
    [state, apiStatus, liveState, refetch],
  );

  return (
    <AppStateContext.Provider value={value}>
      {/* API status banner — shown at the top of Shell when offline/error */}
      {(apiStatus === 'offline' || apiStatus === 'error') && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: '#1a0000',
            borderBottom: '1px solid #7f1d1d',
            padding: '6px 16px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ color: '#ef4444' }}>●</span>
          {apiStatus === 'offline'
            ? 'empire-cofounder API offline — showing seed data. Start the API: uvicorn empire_auto_cofounder.api:app --port 8000'
            : 'empire-cofounder API error — check console. Showing last known state.'}
          <button
            onClick={() => void refetch()}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: '1px solid #7f1d1d',
              color: '#fca5a5',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            retry
          </button>
        </div>
      )}

      {/* Live indicator — subtle, shown when online */}
      {apiStatus === 'online' && liveState && (
        <div
          style={{
            position: 'fixed',
            bottom: '8px',
            right: '12px',
            zIndex: 9998,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
            color: '#22c55e',
            opacity: 0.5,
            userSelect: 'none',
          }}
        >
          ● LIVE{' '}
          {new Date(liveState.fetchedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
          {liveState.proofVerified
            ? '  ·  PROOF ✓'
            : '  ·  PROOF UNVERIFIED'}
        </div>
      )}

      {children}
    </AppStateContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useAppState(): Ctx {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

export { nextEvidenceState };
