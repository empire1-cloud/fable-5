import { useCallback, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { ApiIntentToken, SpendVerdict } from "../lib/api";
import { useApiList } from "./useApiList";
import type { WriteResult } from "./useEvidenceRecords";

function failure(err: unknown): WriteResult {
  return { ok: false, detail: err instanceof ApiError ? err.detail : "could not reach the control plane API" };
}

export function useIntentTokens(enabled = true) {
  const list = useApiList<ApiIntentToken>(useCallback(() => api.intentTokens.list(), []), enabled);
  const { replace, add, reload } = list;
  const [lastVerdict, setLastVerdict] = useState<SpendVerdict | null>(null);

  const issue = useCallback(async (body: Record<string, unknown>): Promise<WriteResult> => {
    try { add(await api.intentTokens.issue(body)); return { ok: true }; }
    catch (err) { return failure(err); }
  }, [add]);

  const revoke = useCallback(async (tokenId: string): Promise<WriteResult> => {
    try { replace(await api.intentTokens.revoke(tokenId)); return { ok: true }; }
    catch (err) { return failure(err); }
  }, [replace]);

  const check = useCallback(async (body: Record<string, unknown>): Promise<SpendVerdict> => {
    const requestId = String(body.request_id ?? crypto.randomUUID());
    let verdict: SpendVerdict;
    try {
      verdict = await api.intentTokens.check({ ...body, request_id: requestId });
    } catch (err) {
      verdict = {
        allowed: false,
        executed: false,
        code: "SERVER_UNREACHABLE",
        reason: `${err instanceof ApiError ? err.detail : "could not reach the control plane API"}. No server verdict was persisted — treat the action as refused.`,
      };
    }
    setLastVerdict(verdict);
    await reload();
    return verdict;
  }, [reload]);

  return {
    tokens: list.data,
    loading: list.loading,
    error: list.error,
    reload,
    issue,
    revoke,
    check,
    lastVerdict,
  };
}
