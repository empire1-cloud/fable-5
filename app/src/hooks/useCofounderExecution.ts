import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getExecutionHealth,
  listExecutionJobs,
  normalizeCofounderBaseUrl,
  type ExecutionHealth,
  type ExecutionJob,
} from '../lib/cofounderApi';

export type CofounderConnectionStatus = 'not_configured' | 'connecting' | 'live' | 'offline';

interface CofounderExecutionState {
  status: CofounderConnectionStatus;
  health: ExecutionHealth | null;
  jobs: ExecutionJob[];
  error: string | null;
  checkedAt: string | null;
}

const POLL_INTERVAL_MS = 15_000;

const INITIAL_STATE: CofounderExecutionState = {
  status: 'connecting',
  health: null,
  jobs: [],
  error: null,
  checkedAt: null,
};

export function useCofounderExecution() {
  const baseUrl = useMemo(
    () => normalizeCofounderBaseUrl(import.meta.env.VITE_COFOUNDER_API_URL),
    [],
  );
  const [state, setState] = useState<CofounderExecutionState>(() =>
    baseUrl
      ? INITIAL_STATE
      : { ...INITIAL_STATE, status: 'not_configured', error: 'VITE_COFOUNDER_API_URL is not set' },
  );
  const activeRequest = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!baseUrl) {
      setState({
        status: 'not_configured',
        health: null,
        jobs: [],
        error: 'VITE_COFOUNDER_API_URL is not set',
        checkedAt: new Date().toISOString(),
      });
      return;
    }

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;

    try {
      const [health, jobs] = await Promise.all([
        getExecutionHealth(baseUrl, controller.signal),
        listExecutionJobs(baseUrl, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setState({
        status: 'live',
        health,
        jobs,
        error: null,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState((current) => ({
        ...current,
        status: 'offline',
        error: error instanceof Error ? error.message : 'Cofounder connection failed',
        checkedAt: new Date().toISOString(),
      }));
    }
  }, [baseUrl]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      activeRequest.current?.abort();
    };
  }, [refresh]);

  return { ...state, baseUrl, refresh };
}
