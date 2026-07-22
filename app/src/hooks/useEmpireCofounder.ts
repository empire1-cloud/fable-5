/**
 * useEmpireCofounder.ts
 * Fetches live state from empire_auto_cofounder (:8000) and returns
 * it shaped as FABLE-5 domain types.
 *
 * Usage in AppStateProvider:
 *   const { liveState, apiStatus, refetch } = useEmpireCofounder();
 *   // dispatch LOAD_LIVE_STATE when liveState arrives
 *
 * Behavior:
 *   - On mount: pings /health. If offline → apiStatus = "offline", seed data stays.
 *   - If online: fetches tasks, approvals, manifests, registry, brief in parallel.
 *   - Maps to FABLE-5 types via apiAdapters.ts.
 *   - Refetches every POLL_MS when the tab is visible.
 *   - Never throws — errors set apiStatus = "error" and return null liveState.
 *
 * Anti-fake-progress: liveState.verified is a real field derived from
 * canonical_proof_status, not a constant. If the proof chain is broken,
 * VERIFIED states are not claimed.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState } from '../state/AppState';
import { SEED_MISSIONS, SEED_EVIDENCE } from '../data/missions';
import { SEED_ALLOCATIONS } from '../data/resources';
import { SEED_TOKENS, SEED_CANON } from '../data/governance';
import {
  empireApi,
  type ApiBrief,
} from '../lib/empireApi';
import {
  adaptTask,
  buildEvidenceForTask,
  adaptApprovalToToken,
  adaptRegistryToCanon,
} from '../lib/apiAdapters';

// ── Config ────────────────────────────────────────────────────────────────

const POLL_MS = 30_000;   // re-fetch every 30s when tab is visible
const TIMEOUT_MS = 8_000; // if API doesn't respond in 8s → offline

// ── Types ─────────────────────────────────────────────────────────────────

export type ApiStatus = 'loading' | 'online' | 'offline' | 'error';

export interface EmpireLiveState {
  /** FABLE-5 AppState hydrated from live API data */
  appState: AppState;
  /** Raw brief for the dashboard header */
  brief: ApiBrief | null;
  /** True only if /proof/canonical-flow returned final_status === "success" */
  proofVerified: boolean;
  /** ISO timestamp of last successful fetch */
  fetchedAt: string;
}

export interface UseEmpireCofounterResult {
  liveState: EmpireLiveState | null;
  apiStatus: ApiStatus;
  refetch: () => Promise<void>;
}

// ── Seed fallback (used when API is offline) ──────────────────────────────

function buildSeedAppState(): AppState {
  return {
    missions: SEED_MISSIONS,
    evidence: Object.fromEntries(SEED_EVIDENCE.map((e) => [e.id, e])),
    allocations: JSON.parse(JSON.stringify(SEED_ALLOCATIONS)),
    tokens: SEED_TOKENS,
    canon: SEED_CANON,
    boundary: 'L4',
  };
}

// ── Fetch with timeout ────────────────────────────────────────────────────

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
    ),
  ]);
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useEmpireCofounder(): UseEmpireCofounterResult {
  const [liveState, setLiveState] = useState<EmpireLiveState | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('loading');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    // 1. Health check first
    try {
      await withTimeout(empireApi.health(), TIMEOUT_MS);
    } catch {
      setApiStatus((prev) => (prev === 'loading' ? 'offline' : prev));
      return;
    }

    // 2. Fetch all data sources in parallel
    try {
      const [tasks, approvals, manifests, agents, skills, brief] = await Promise.all([
        empireApi.tasks(),
        empireApi.approvals(),
        empireApi.manifests(),
        empireApi.registryAgents(),
        empireApi.registrySkills(),
        empireApi.brief(),
      ]);

      // 3. Derive canonical proof status (non-blocking if it fails)
      let proofVerified = false;
      try {
        const proof = await empireApi.proofCanonicalFlow();
        proofVerified = proof.final_status === 'success';
      } catch {
        // Proof check is best-effort — don't block hydration
        proofVerified = false;
      }

      // 4. Adapt tasks → missions + evidence records
      const missions = tasks.map(adaptTask);

      const evidence = Object.fromEntries(
        tasks.map((task) => {
          const rec = buildEvidenceForTask(task, approvals, manifests);

          // Only claim VERIFIED if canonical proof actually passed
          // (anti-fake-progress: don't let VERIFIED appear if proof is broken)
          if (rec.state === 'VERIFIED' && !proofVerified) {
            rec.state = 'RECEIPTED';
            rec.audit.push({
              at: new Date().toISOString(),
              actor: 'empire-cofounder',
              action: 'VERIFIED claim downgraded — canonical proof not confirmed',
            });
          }

          return [rec.id, rec];
        }),
      );

      // 5. Intent tokens from financial approvals
      const liveTokens = approvals
        .map(adaptApprovalToToken)
        .filter((t): t is NonNullable<typeof t> => t !== null);

      // 6. Canon entries from registry (agents + skills)
      const registryCanon = adaptRegistryToCanon(agents, skills);

      // 7. Build the AppState
      const appState: AppState = {
        missions: missions.length > 0 ? missions : SEED_MISSIONS,
        evidence:
          Object.keys(evidence).length > 0
            ? evidence
            : Object.fromEntries(SEED_EVIDENCE.map((e) => [e.id, e])),
        // Keep seed allocations — no allocation API endpoint yet
        allocations: JSON.parse(JSON.stringify(SEED_ALLOCATIONS)),
        tokens: liveTokens.length > 0 ? liveTokens : SEED_TOKENS,
        canon: registryCanon.length > 0 ? registryCanon : SEED_CANON,
        boundary: 'L4',
      };

      setLiveState({
        appState,
        brief,
        proofVerified,
        fetchedAt: new Date().toISOString(),
      });
      setApiStatus('online');
    } catch (err) {
      console.error('[useEmpireCofounder] Fetch failed:', err);
      setApiStatus('error');
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Poll while tab is visible
  useEffect(() => {
    const start = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') void fetchAll();
      }, POLL_MS);
    };
    const stop = () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };

    start();
    document.addEventListener('visibilitychange', () => {
      document.visibilityState === 'visible' ? start() : stop();
    });

    return () => {
      stop();
      document.removeEventListener('visibilitychange', stop);
    };
  }, [fetchAll]);

  return { liveState, apiStatus, refetch: fetchAll };
}
