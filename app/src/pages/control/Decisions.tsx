import { useEffect, useState } from "react";
import { api, ApiError, type ApiDecision } from "../../lib/api";
import { Eyebrow, Badge, EmptyNote } from "../../components/ui";

type LoadState =
  | { status: "loading" }
  | { status: "ok"; decisions: ApiDecision[] }
  | { status: "error"; message: string };

const VERDICT_TONE: Record<string, "ok" | "warn" | "bad" | "neutral"> = {
  AUTHORIZED: "ok",
  REFUSED: "bad",
};

export default function Decisions() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    api.decisions
      .list()
      .then((decisions) => {
        if (!cancelled) setState({ status: "ok", decisions });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof ApiError ? error.detail : "Could not reach the control plane.";
        setState({ status: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <Eyebrow>DECISION LEDGER · SERVER-AUTHORITATIVE</Eyebrow>
        <h1 className="hero-title">Decisions</h1>
        <p className="hero-sub">
          Every row here is a real <code>decisions</code> row written by Engine 00 the moment an opportunity is
          authorized — not narrated after the fact, not seeded demo content. Nothing renders until the server
          confirms it.
        </p>
      </section>

      {state.status === "loading" && (
        <section className="panel">
          <EmptyNote>Loading decisions from the control plane…</EmptyNote>
        </section>
      )}

      {state.status === "error" && (
        <section className="panel">
          <EmptyNote>Could not load decisions: {state.message}</EmptyNote>
        </section>
      )}

      {state.status === "ok" && state.decisions.length === 0 && (
        <section className="panel">
          <EmptyNote>
            No opportunity has been authorized yet. This is an honest empty state — decisions appear here the
            moment Engine 00 authorizes one, never before.
          </EmptyNote>
        </section>
      )}

      {state.status === "ok" &&
        state.decisions.map((d) => (
          <section className="panel" key={d.id}>
            <div className="panel-label panel-label--accent">{d.id.slice(0, 8)} · {new Date(d.created_at).toLocaleString()}</div>
            <h2 className="detail-label" style={{ fontSize: 15 }}>{d.opportunity_title}</h2>
            <div className="opportunity-grid">
              <div>
                <div className="detail-label">VERDICT</div>
                <Badge tone={VERDICT_TONE[d.verdict] ?? "neutral"}>{d.verdict}</Badge>
              </div>
              <div>
                <div className="detail-label">RANKING SCORE</div>
                <div>{d.ranking_score !== null ? d.ranking_score.toFixed(2) : "—"} {d.ranking_verdict ? `(${d.ranking_verdict})` : ""}</div>
              </div>
              <div>
                <div className="detail-label">DECIDED BY</div>
                <div className="muted">{d.decided_by_email ?? "—"}</div>
              </div>
            </div>
            <div className="detail-label" style={{ marginTop: 10 }}>REASON ON FILE</div>
            <div className="muted">{d.reason}</div>
            {d.ranking_factors && (
              <>
                <div className="detail-label" style={{ marginTop: 10 }}>RANKING FACTORS · Engine 00 arithmetic, not narrated</div>
                <ul className="detail-list">
                  {Object.entries(d.ranking_factors).map(([k, v]) => (
                    <li key={k}>{k}: {typeof v === "number" ? v.toFixed(1) : String(v)}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        ))}
    </div>
  );
}
