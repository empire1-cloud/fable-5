import { useCallback } from "react";
import { api, ApiError } from "../lib/api";
import type { ApiEvidenceRecord } from "../lib/api";
import { useApiList } from "./useApiList";

export interface WriteResult { ok: boolean; detail?: string; }

function failure(err: unknown): WriteResult {
  return { ok: false, detail: err instanceof ApiError ? err.detail : "could not reach the control plane API" };
}

export interface FinancialScope {
  vendor_or_system: string;
  financial_amount: string;
  financial_currency: string;
  financial_environment: "sandbox" | "production";
}

export function useEvidenceRecords(enabled = true) {
  const list = useApiList<ApiEvidenceRecord>(useCallback(() => api.evidence.list(), []), enabled);
  const { replace, add } = list;

  const wrap = useCallback(async (fn: () => Promise<ApiEvidenceRecord>): Promise<WriteResult> => {
    try { replace(await fn()); return { ok: true }; }
    catch (err) { return failure(err); }
  }, [replace]);

  const create = useCallback(async (
    subject: string,
    isFinancial = false,
    scope?: FinancialScope,
  ): Promise<WriteResult> => {
    try {
      add(await api.evidence.create({
        subject,
        is_financial: isFinancial,
        ...(isFinancial ? scope : {}),
      }));
      return { ok: true };
    } catch (err) { return failure(err); }
  }, [add]);

  const advance = useCallback(
    (id: string, to: string, reason: string, expectedVersion?: number) =>
      wrap(() => api.evidence.transition(id, { to, reason, expected_version: expectedVersion })),
    [wrap],
  );

  const setFields = useCallback(
    (id: string, fields: Record<string, string | null>) => wrap(() => api.evidence.setFields(id, fields)),
    [wrap],
  );

  const addReceipt = useCallback(
    (id: string, kind: string, content: string) => wrap(() => api.evidence.addReceipt(id, { kind, content })),
    [wrap],
  );

  const addVerification = useCallback(
    (id: string, receiptId: string, reproduced: boolean, method: string) =>
      wrap(() => api.evidence.addVerification(id, { receipt_id: receiptId, reproduced, method })),
    [wrap],
  );

  const addContradiction = useCallback(
    (id: string, detail: string) => wrap(() => api.evidence.addContradiction(id, { detail })),
    [wrap],
  );

  const resolveContradiction = useCallback(
    (id: string, contradictionId: string, detail: string) =>
      wrap(() => api.evidence.resolveContradiction(id, contradictionId, { detail })),
    [wrap],
  );

  return {
    records: list.data,
    loading: list.loading,
    error: list.error,
    reload: list.reload,
    create,
    advance,
    setFields,
    addReceipt,
    addVerification,
    addContradiction,
    resolveContradiction,
  };
}
