import React from "react";
import { decisions } from "../../data/decisions";
import { Eyebrow, Badge } from "../../components/ui";

const REV_TONE: Record<string, "ok" | "warn" | "bad"> = {
  high: "ok",
  medium: "warn",
  low: "bad",
};

export default function Decisions() {
  return (
    <div className="page-stack">
      <section className="hero-panel">
        <Eyebrow>DECISION LEDGER · SERVER-AUTHORITATIVE</Eyebrow>
        <h1 className="hero-title">Decisions</h1>
        <p className="hero-sub">
          Every decision keeps the evidence it leaned on, the assumptions it carried, and the authority level
          that allowed it. Nothing here is narrated after the fact — it is the record itself.
        </p>
      </section>

      {decisions.map((d) => (
        <section className="panel" key={d.id}>
          <div className="panel-label panel-label--accent">{d.id} · {d.requiredAuthority}</div>
          <h2 className="detail-label" style={{ fontSize: 15 }}>{d.question}</h2>
          <div className="opportunity-grid">
            <div>
              <div className="detail-label">EVIDENCE</div>
              <ul className="detail-list">
                {d.evidence.length ? d.evidence.map((e, i) => (
                  <li key={i}>
                    <span className={`epi-tag epi-tag--${e.type}`}>{e.type}</span> {e.text}
                  </li>
                )) : <li className="muted">no evidence on file — this decision is provisional</li>}
              </ul>
            </div>
            <div>
              <div className="detail-label">ASSUMPTIONS · NEVER RENDERED AS FACTS</div>
              <ul className="detail-list">
                {d.assumptions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          </div>
          <div className="opportunity-grid">
            <div>
              <div className="detail-label">CONFIDENCE</div>
              <div>{Math.round(d.confidence * 100)}%</div>
            </div>
            <div>
              <div className="detail-label">REVERSIBILITY</div>
              <Badge tone={REV_TONE[d.reversibility]}>{d.reversibility}</Badge>
            </div>
            <div>
              <div className="detail-label">COST IF WRONG</div>
              <div>${d.cost}</div>
            </div>
            <div>
              <div className="detail-label">DEPENDENCIES</div>
              <div>{d.dependencies.join(', ') || '—'}</div>
            </div>
          </div>
          <div className="opportunity-grid">
            <div>
              <div className="detail-label">UPSIDE</div>
              <div className="muted">{d.upside}</div>
            </div>
            <div>
              <div className="detail-label">DOWNSIDE</div>
              <div className="muted">{d.downside}</div>
            </div>
          </div>
          <div className="opportunity-grid">
            <div>
              <div className="detail-label">RECOMMENDED ACTION</div>
              <div>{d.recommendedAction}</div>
            </div>
            <div>
              <div className="detail-label">NEXT VERIFICATION EVENT</div>
              <div className="muted">{d.nextVerificationEvent}</div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
