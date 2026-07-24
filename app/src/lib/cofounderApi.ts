export type ExecutionJobStatus =
  | 'awaiting_approval'
  | 'ready'
  | 'leased'
  | 'retry_wait'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export interface ExecutionJob {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  status: ExecutionJobStatus;
  attempt: number;
  max_attempts: number;
  idempotency_key: string;
  trace_id: string;
  approval_required: boolean;
  approval_id: string | null;
  available_at: string;
  lease_owner: string | null;
  lease_expires_at: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExecutionHealth {
  status: 'ok';
  jobs: Partial<Record<ExecutionJobStatus, number>>;
  receipt_count: number;
  receipt_chain_valid: boolean;
}

export interface EnqueueExecutionInput {
  kind: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  approval_required?: boolean;
  max_attempts?: number;
  trace_id?: string;
}

export interface ApproveExecutionInput {
  approval_id: string;
  approved_by: string;
}

const REQUEST_TIMEOUT_MS = 8_000;

export function normalizeCofounderBaseUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  return value.replace(/\/+$/, '');
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  externalSignal?: AbortSignal,
): Promise<T> {
  const timeoutController = new AbortController();
  const timeout = window.setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
  const signal = externalSignal
    ? AbortSignal.any([externalSignal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Cofounder ${response.status}: ${detail || response.statusText}`);
    }
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function getExecutionHealth(baseUrl: string, signal?: AbortSignal): Promise<ExecutionHealth> {
  return requestJson<ExecutionHealth>(baseUrl, '/execution/health', {}, signal);
}

export function listExecutionJobs(baseUrl: string, signal?: AbortSignal): Promise<ExecutionJob[]> {
  return requestJson<ExecutionJob[]>(baseUrl, '/execution/jobs', {}, signal);
}

export function enqueueExecution(
  baseUrl: string,
  input: EnqueueExecutionInput,
  signal?: AbortSignal,
): Promise<ExecutionJob> {
  return requestJson<ExecutionJob>(
    baseUrl,
    '/execution/jobs',
    { method: 'POST', body: JSON.stringify(input) },
    signal,
  );
}

export function approveExecution(
  baseUrl: string,
  jobId: string,
  input: ApproveExecutionInput,
  signal?: AbortSignal,
): Promise<ExecutionJob> {
  return requestJson<ExecutionJob>(
    baseUrl,
    `/execution/jobs/${encodeURIComponent(jobId)}/approve`,
    { method: 'POST', body: JSON.stringify(input) },
    signal,
  );
}
