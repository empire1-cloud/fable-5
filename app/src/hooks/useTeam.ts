import { useCallback } from "react";
import { ApiError, api } from "../lib/api";
import type { Me } from "../lib/api";
import { useApiList } from "./useApiList";

export interface WriteResult {
  ok: boolean;
  detail?: string;
}

export interface TeamState {
  members: Me[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  invite: (body: { email: string; password: string; display_name?: string }) => Promise<WriteResult>;
}

/**
 * The org's roster. Every account here is scoped to one `org_id`; the server
 * never returns a member of another org, and there is no route that could ask
 * it to.
 */
export function useTeam(enabled = true): TeamState {
  const list = useApiList<Me>(api.auth.team, enabled);

  const invite = useCallback(
    async (body: { email: string; password: string; display_name?: string }): Promise<WriteResult> => {
      try {
        const member = await api.auth.invite(body);
        list.add(member);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          detail: err instanceof ApiError ? err.detail : "could not reach the control plane API",
        };
      }
    },
    [list],
  );

  return {
    members: list.data,
    loading: list.loading,
    error: list.error,
    reload: list.reload,
    invite,
  };
}
