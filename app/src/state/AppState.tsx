import React, { createContext, useContext, useMemo, useReducer } from 'react';
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

const STORAGE_KEY = 'fable5.appState.v1';

export interface AppState {
  missions: Mission[];
  evidence: Record<string, EvidenceRecord>;
  allocations: Allocations;
  tokens: IntentToken[];
  canon: CanonEntry[];
  /** the autonomy boundary the founder has currently granted to autonomous execution */
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

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.missions || !parsed.evidence) {
      return seedState();
    }
    return parsed as AppState;
  } catch {
    return seedState();
  }
}

function persistState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / storage disabled — demo state stays in-memory for this session */
  }
}

type Action =
  | { type: 'ADVANCE_EVIDENCE'; recordId: string; now: string }
  | { type: 'SET_ALLOCATION'; resource: ResourceType; targetId: string; amount: number }
  | { type: 'REVOKE_TOKEN'; tokenId: string; now: string }
  | { type: 'SET_BOUNDARY'; level: AutonomyLevel }
  | { type: 'RESET_DEMO_STATE' };

function nextMeasurement(record: EvidenceRecord, now: string): EvidenceRecord['measurement'] {
  return {
    gate: 'typed economic gate',
    reading: 'KPI reading recorded against threshold (demo simulation)',
    verdict: record.confidence >= 0.6 ? 'ITERATE' : 'PAUSE',
    at: now,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADVANCE_EVIDENCE': {
      const rec = state.evidence[action.recordId];
      if (!rec) return state;
      const mission = state.missions.find((m) => m.evidenceRecordId === rec.id);
      const check = canAdvance(rec, { mission, tokens: state.tokens, boundary: state.boundary });
      if (!check.ok || !check.to) return state;
      const to = check.to as EvidenceState;

      const updated: EvidenceRecord = {
        ...rec,
        state: to,
        confidence: Math.min(0.97, rec.confidence + (to === 'VERIFIED' || to === 'LEARNED' ? 0.08 : 0.03)),
        audit: [
          ...rec.audit,
          {
            at: action.now,
            actor: 'FOUNDER · demo action',
            action: `advanced ${rec.state} → ${to}`,
          },
        ],
      };
      if (to === 'VERIFIED' && !updated.verification) {
        updated.verification = {
          method: 'independent check (demo simulation)',
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
          title: `${rec.title} — canonized from ${mission?.objective ?? rec.missionId}`,
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
      return { ...state, allocations: { ...state.allocations, [resource]: forResource } };
    }
    case 'REVOKE_TOKEN': {
      return {
        ...state,
        tokens: state.tokens.map((t) =>
          t.id === action.tokenId
            ? {
                ...t,
                revoked: true,
                audit: [...t.audit, { at: action.now, actor: 'Founder · demo action', action: 'revoked' }],
              }
            : t,
        ),
      };
    }
    case 'SET_BOUNDARY':
      return { ...state, boundary: action.level };
    case 'RESET_DEMO_STATE':
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* noop */
      }
      return seedState();
    default:
      return state;
  }
}

interface Ctx {
  state: AppState;
  advanceEvidence: (recordId: string) => void;
  setAllocation: (resource: ResourceType, targetId: string, amount: number) => void;
  revokeToken: (tokenId: string) => void;
  setBoundary: (level: AutonomyLevel) => void;
  resetDemoState: () => void;
}

const AppStateContext = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  React.useEffect(() => {
    persistState(state);
  }, [state]);

  const value = useMemo<Ctx>(
    () => ({
      state,
      advanceEvidence: (recordId) => dispatch({ type: 'ADVANCE_EVIDENCE', recordId, now: new Date().toISOString() }),
      setAllocation: (resource, targetId, amount) => dispatch({ type: 'SET_ALLOCATION', resource, targetId, amount }),
      revokeToken: (tokenId) => dispatch({ type: 'REVOKE_TOKEN', tokenId, now: new Date().toISOString() }),
      setBoundary: (level) => dispatch({ type: 'SET_BOUNDARY', level }),
      resetDemoState: () => dispatch({ type: 'RESET_DEMO_STATE' }),
    }),
    [state],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): Ctx {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

export { nextEvidenceState };
