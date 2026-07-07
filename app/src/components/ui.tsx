import React from 'react';

export function Eyebrow({ children, accent = true }: { children: React.ReactNode; accent?: boolean }) {
  return <div className={accent ? 'eyebrow eyebrow--accent' : 'eyebrow'}>{children}</div>;
}

export function Panel({
  label,
  accent,
  children,
  className = '',
}: {
  label?: React.ReactNode;
  accent?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`panel ${accent ? 'panel--accent' : ''} ${className}`}>
      {label && <div className={`panel-label ${accent ? 'panel-label--accent' : ''}`}>{label}</div>}
      {children}
    </div>
  );
}

export function Chip({
  children,
  accent,
  className = '',
}: {
  children: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return <span className={`chip ${accent ? 'chip--accent' : ''} ${className}`}>{children}</span>;
}

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'neutral'; children: React.ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Meter({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="meter" role="img" aria-label={label ?? `${pct}%`}>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="meter-val">{pct}%</span>
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <div className="empty-note">{children}</div>;
}

export function SectionRule({ children }: { children: React.ReactNode }) {
  return (
    <div className="section-rule">
      <span className="section-rule-label">{children}</span>
      <span className="section-rule-line" />
    </div>
  );
}
