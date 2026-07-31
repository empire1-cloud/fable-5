import { useCallback } from "react";
import { api, ApiError } from "../lib/api";
import type { ApiMission } from "../lib/api";
import { useApiList } from "./useApiList";
import type { WriteResult } from "./useEvidenceRecords";

function failure(err: unknown): WriteResult {
  return {
    ok: false,
    detail: err instanceof ApiError ? err.detail : "could not reach the control plane API",
  };
}

/**
 * Server-backed Mission Queue. A status change here is a real write to your
 * org's database — it is still not a claim that any external system executed
 * anything. FABLE-5 records intent and evidence; it does not run your vendors.
 *
 * There is no delete. A mission that turned out to be wrong is archived and
 * kept as negative intelligence.
 */
export function useMissions(enabled = true) {
  const list = useApiList<ApiMission>(useCallback(() => api.missions.list(), []), enabled);
  const { replace, add } = list;

  const setStatus = useCallback(
    async (mission: ApiMission, status: string): Promise<WriteResult> => {
      try {
        replace(
          await api.missions.update(mission.id, {
            engine_id: mission.engine_id,
            owner: mission.owner,
            objective: mission.objective,
            autonomy_level: mission.autonomy_level,
            status,
            success_criteria: mission.success_criteria,
            evidence_requirement: mission.evidence_requirement,
            blocker: mission.blocker,
            escalation_condition: mission.escalation_condition,
            record_id: mission.record_id,
          }),
        );
        return { ok: true };
      } catch (err) {
        return failure(err);
      }
    },
    [replace],
  );

  const create = useCallback(
    async (body: Record<string, unknown>): Promise<WriteResult> => {
      try {
        add(await api.missions.create(body));
        return { ok: true };
      } catch (err) {
        return failure(err);
      }
    },
    [add],
  );

  const archive = useCallback(
    async (id: string): Promise<WriteResult> => {
      try {
        replace(await api.missions.archive(id));
        return { ok: true };
      } catch (err) {
        return failure(err);
      }
    },
    [replace],
  );

  return {
    missions: list.data,
    loading: list.loading,
    error: list.error,
    reload: list.reload,
    setStatus,
    create,
    archive,
  };
}
