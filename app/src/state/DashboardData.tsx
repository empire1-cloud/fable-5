import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError, type ApiDashboard } from '../lib/api';

export type DashboardState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ok'; data: ApiDashboard; error: null }
  | { status: 'error'; data: null; error: string };

interface DashboardContext {
  state: DashboardState;
  reload: () => Promise<void>;
}

const Ctx = createContext<DashboardContext | null>(null);

/**
 * Mounted once inside the authenticated shell. The status strip and the GOD
 * MODE overview both read the same company-wide counts, so they share one
 * request — two fetches could disagree mid-load and show the founder two
 * different companies on one screen, which is the precise failure this
 * provider exists to prevent.
 */
export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DashboardState>({ status: 'loading', data: null, error: null });

  const reload = useCallback(async () => {
    try {
      const data = await api.dashboard();
      setState({ status: 'ok', data, error: null });
    } catch (err) {
      setState({
        status: 'error',
        data: null,
        error: err instanceof ApiError ? err.detail : 'could not reach the control plane API',
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // The reload closure sets state unconditionally; guard it on unmount so a
    // late response cannot write into a torn-down tree.
    void (async () => {
      try {
        const data = await api.dashboard();
        if (!cancelled) setState({ status: 'ok', data, error: null });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            data: null,
            error: err instanceof ApiError ? err.detail : 'could not reach the control plane API',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ state, reload }), [state, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboard(): DashboardContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDashboard must be used inside <DashboardProvider>');
  return ctx;
}
