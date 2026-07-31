import { useCallback } from "react";
import { api, ApiError } from "../lib/api";
import type { ApiOpportunity } from "../lib/api";
import { useApiList } from "./useApiList";
import type { WriteResult } from "./useEvidenceRecords";

/**
 * The Opportunity Graph, ranked by the server.
 *
 * Note what is missing: there is no client-side sort. The list arrives in
 * rank order, and rank comes from computed leverage — confidence, expected
 * value, risk, reversibility, time-to-proof — not from a number somebody
 * typed into a data file. If a hand-entered score exists it rides along as
 * `leverage.seeded_score` with the gap reported as `leverage.divergence`,
 * so a bad guess is visible instead of authoritative.
 */
export function useOpportunities(enabled = true) {
  const list = useApiList<ApiOpportunity>(useCallback(() => api.opportunities.list(), []), enabled);
  const { reload } = list;

  /**
   * Reloads instead of prepending. A new candidate changes the ranking of
   * every other one, and the ranking is the server's answer to give.
   */
  const create = useCallback(
    async (body: Record<string, unknown>): Promise<WriteResult> => {
      try {
        await api.opportunities.create(body);
        await reload();
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          detail: err instanceof ApiError ? err.detail : "could not reach the control plane API",
        };
      }
    },
    [reload],
  );

  return {
    opportunities: list.data,
    loading: list.loading,
    error: list.error,
    reload: list.reload,
    create,
  };
}
