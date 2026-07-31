import type { ReactNode } from "react";

interface PanelCardProps {
  label: string;
  accent?: boolean;
  footnote?: ReactNode;
  footnoteAccent?: boolean;
  children: ReactNode;
  className?: string;
}

export function PanelCard({ label, accent, footnote, footnoteAccent, children, className }: PanelCardProps) {
  return (
    <div className={`panel-card${className ? ` ${className}` : ""}`}>
      <div className={`card-label${accent ? " card-label--accent" : ""}`}>{label}</div>
      {children}
      {footnote && <div className={`card-footnote${footnoteAccent ? " card-footnote--accent" : ""}`}>{footnote}</div>}
    </div>
  );
}
