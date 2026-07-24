import React from 'react';
import { Badge, EmptyNote, SectionRule } from './ui';
import { useCofounderExecution, type CofounderConnectionStatus } from '../hooks/useCofounderExecution';
import type { ExecutionJobStatus } from '../lib/cofounderApi';

const CONNECTION_TONE: Record<CofounderConnectionStatus, 'ok' | 'warn' | 'bad'> = {
  live: 'ok',
  connecting: 'warn',
  not_configured: 'warn',
  offline: 'bad',
};

const JOB_TONE: Record<ExecutionJobStatus, 'ok' | 'warn' | 'bad'> = {
  awaiting_approval: 'warn',
  ready: 'warn',
  leased: 'ok',
  retry_wait: 'warn',
  succeeded: 'ok',
  failed: 'bad',
  canceled: 'bad',
};

function connectionLabel(status: CofounderConnectionStatus): string {
  if (status === 'not_configured') return 'NOT CONFIGURED';
  return status.toUpperCase();
}

export default function ExecutionRuntimeStatus({ showJobs = false }: { showJobs?: boolean }) {
  const { status, health, jobs, error, checkedAt, baseUrl, refresh } = useCofounderExecution();

  return (
    <section>
      <SectionRule>COFOUNDER EXECUTION · REAL CONNECTION</SectionRule>
      <div className="panel">
        <div className="filter-bar">
          <Badge tone={CONNECTION_TONE[status]}>{connectionLabel(status)}</Badge>
          <span className="filter-count">
            {status === 'live'
              ? `${jobs.length} durable jobs · ${health?.receipt_count ?? 0} receipts`
              : error ?? 'Checking Cofounder'}
          </span>
          <button className="btn btn--ghost" type="button" onClick={() => void refresh()}>
            Check now
          </button>
        </div>
        <div className="page-note">
          {status === 'live'
            ? `Connected to ${baseUrl}. Receipt chain ${health?.receipt_chain_valid ? 'valid' : 'FAILED VALIDATION'}.`
            : 'Seeded FABLE data remains visible, but it is not labeled as live Cofounder execution.'}
          {checkedAt ? ` Last checked ${new Date(checkedAt).toLocaleTimeString()}.` : ''}
        </div>
      </div>

      {showJobs && (
        <div className="mission-table panel">
          <div className="mission-row mission-row--head">
            <div>JOB</div><div>TYPE</div><div>TRACE</div><div>ATTEMPT</div><div>APPROVAL</div><div>STATUS</div>
          </div>
          {status !== 'live' && <EmptyNote>Live execution jobs are unavailable.</EmptyNote>}
          {status === 'live' && jobs.length === 0 && <EmptyNote>No durable execution jobs yet.</EmptyNote>}
          {status === 'live' && jobs.slice(0, 20).map((job) => (
            <div className="mission-row mission-row--body" key={job.id}>
              <div className="mono">{job.id.slice(0, 8)}</div>
              <div className="mission-objective">{job.kind}</div>
              <div className="mono">{job.trace_id.slice(0, 8)}</div>
              <div className="mono">{job.attempt}/{job.max_attempts}</div>
              <div className="mono">{job.approval_id ?? (job.approval_required ? 'REQUIRED' : 'NOT REQUIRED')}</div>
              <div><Badge tone={JOB_TONE[job.status]}>{job.status.toUpperCase()}</Badge></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
