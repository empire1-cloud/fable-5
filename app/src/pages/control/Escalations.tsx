import React from "react";
import { evidenceRecords } from "../../data/evidenceRecords";
import { Eyebrow, Badge } from "../../components/ui";

interface Escalation {
  id: string;
  subject: string;
  kind: "blocked" | "contradiction";
  detail: string;
  severity: "bad" | "warn";
}

function escalations(): Escalation[] {
  const out: Escalation[] = [];
  for (const rec of evidenceRecords) {
    for (const c of rec.contradictions) {
      if (!c.resolved) {
        out.push({
          id: `${rec.id}·${c.id}`,
          subject: rec.subject,
          kind: "contradiction",
          detail: c.description,
          severity: "warn",
        });
      }
    }
    if (rec.state === "BLOCKED") {
      out.push({
        id: `${rec.id}·blocked`,
        subject: rec.subject,
        kind: "blocked",
        detail: rec.failureReason ?? "record blocked with no retained reason",
        severity: "bad",
      });
    }
  }
  return out;
}

export default function Escalations() {
  const items = escalations();

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <Eyebrow>ESCALATION QUEUE · NEGATIVE INTELLIGENCE IS RETAINED</Eyebrow>
        <h1 className="hero-title">Escalations</h1>
        <p className="hero-sub">
          Work that is blocked, contradicted, or awaiting a decision. Blocked records are not deleted — they stay
          on the record as intelligence, and progress is withheld until the reason is resolved.
        </p>
      </section>

      {items.length === 0 && (
        <section className="panel">
          <div className="empty-note">Nothing is currently escalated. The queue is empty — and that, itself, is a claim the ledger supports.</div>
        </section>
      )}

      {items.map((it) => (
        <section className="panel" key={it.id}>
          <div className="panel-label">{it.id}</div>
          <div className="opportunity-titleblock">
            <div className="opportunity-title">{it.subject}</div>
            <div className="opportunity-meta">
              <Badge tone={it.severity}>{it.kind.toUpperCase()}</Badge>
            </div>
          </div>
          <div className="detail-label">WHY IT IS ESCALATED</div>
          <div className="muted">{it.detail}</div>
          <div className="detail-label" style={{ marginTop: 10 }}>REQUIRED NEXT STEP</div>
          <div className="muted">
            {it.kind === "contradiction"
              ? "resolve the contradiction or re-verify against it — VERIFIED is withheld until then"
              : "review the retained failure reason and decide: fix, re-verify, or keep blocked"}
          </div>
        </section>
      ))}
    </div>
  );
}
