import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../lib/api";

export interface ApiListState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Replace one item in place after a write returns the updated row. */
  replace: (item: T) => void;
  /** Prepend a newly created item without a full refetch. */
  add: (item: T) => void;
}

/**
 * One loader for every server-backed collection. Loading and error are real
 * states with their own rendering — an empty list because the request failed
 * must never look like an empty list because there is nothing there.
 */
export function useApiList<T extends { id: string }>(
  fetcher: () => Promise<T[]>,
  enabled = true,
): ApiListState<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetcher());
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "could not reach the control plane API");
    } finally {
      setLoading(false);
    }
  }, [fetcher, enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const replace = useCallback((item: T) => {
    setData((prev) => prev.map((x) => (x.id === item.id ? item : x)));
  }, []);

  const add = useCallback((item: T) => {
    setData((prev) => [item, ...prev]);
  }, []);

  return { data, loading, error, reload, replace, add };
}
