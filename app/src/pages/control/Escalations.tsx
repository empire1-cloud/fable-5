import { useEffect, useState } from "react";
import { api, ApiError, type ApiEscalation } from "../../lib/api";
import { Eyebrow, Badge, EmptyNote } from "../../components/ui";

type LoadState =
  | { status: "loading" }
  | { status: "ok"; escalations: ApiEscalation[] }
  | { status: "error"; message: string };

const SEVERITY_TONE: Record<ApiEscalation["severity"], "ok" | "warn" | "bad" | "neutral"> = {
  LOW: "neutral",
  MEDIUM: "warn",
  HIGH: "bad",
  CRITICAL: "bad",
};

function ResolveForm({ escalation, onResolved }: { escalation: ApiEscalation; onResolved: (e: ApiEscalation) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!text.trim()) {
      setError("A resolution reason is required — nothing resolves silently.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const resolved = await api.escalations.resolve(escalation.id, text.trim());
      onResolved(resolved);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Could not reach the control plane.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div className="detail-label">RESOLVE — record why, don't just dismiss</div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <input
          className="context-select"
          style={{ flex: 1 }}
          placeholder="e.g. re-graded evidence to A and attached a receipt"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
        <button type="button" className="boundary-btn" onClick={submit} disabled={busy}>
          {busy ? "RESOLVING…" : "RESOLVE"}
        </button>
      </div>
      {error && <div className="muted" style={{ marginTop: 4 }}>{error}</div>}
    </div>
  );
}

export default function Escalations() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  function load() {
    setState({ status: "loading" });
    api.escalations
      .list()
      .then((escalations) => setState({ status: "ok", escalations }))
      .catch((error: unknown) => {
        const message = error instanceof ApiError ? error.detail : "Could not reach the control plane.";
        setState({ status: "error", message });
      });
  }

  useEffect(() => {
    load();
  }, []);

  function onResolved(updated: ApiEscalation) {
    setState((prev) =>
      prev.status === "ok"
        ? { status: "ok", escalations: prev.escalations.map((e) => (e.id === updated.id ? updated : e)) }
        : prev
    );
  }

  const items = state.status === "ok" ? state.escalations : [];
  const open = items.filter((e) => !e.resolved_at);
  const resolved = items.filter((e) => e.resolved_at);

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <Eyebrow>ESCALATION QUEUE · NEGATIVE INTELLIGENCE IS RETAINED</Eyebrow>
        <h1 className="hero-title">Escalations</h1>
        <p className="hero-sub">
          Real <code>escalations</code> rows written the moment Engine 00 refuses a gate — for example, an
          opportunity authorized without a grade-A/B evidence record and at least one receipt. Nothing is
          deleted when it resolves; it moves to the resolved list with the reason on file.
        </p>
      </section>

      {state.status === "loading" && (
        <section className="panel">
          <EmptyNote>Loading escalations from the control plane…</EmptyNote>
        </section>
      )}

      {state.status === "error" && (
        <section className="panel">
          <EmptyNote>Could not load escalations: {state.message}</EmptyNote>
        </section>
      )}

      {state.status === "ok" && items.length === 0 && (
        <section className="panel">
          <EmptyNote>Nothing is currently escalated. The queue is empty — and that, itself, is a claim the ledger supports.</EmptyNote>
        </section>
      )}

      {open.map((it) => (
        <section className="panel" key={it.id}>
          <div className="panel-label">{it.id.slice(0, 8)} · {new Date(it.created_at).toLocaleString()}</div>
          <div className="escalation-head">
            <div className="opportunity-title">Engine {it.engine_id} gate refusal</div>
            <Badge tone={SEVERITY_TONE[it.severity]}>{it.severity}</Badge>
          </div>
          <div className="detail-label">WHY IT IS ESCALATED</div>
          <div className="muted">{it.reason}</div>
          <ResolveForm escalation={it} onResolved={onResolved} />
        </section>
      ))}

      {resolved.length > 0 && (
        <>
          <div className="detail-label" style={{ marginTop: 8 }}>RESOLVED — kept on the record, not deleted</div>
          {resolved.map((it) => (
            <section className="panel" key={it.id}>
              <div className="panel-label">{it.id.slice(0, 8)} · {new Date(it.created_at).toLocaleString()}</div>
              <div className="escalation-head">
                <div className="opportunity-title">Engine {it.engine_id} gate refusal</div>
                <Badge tone="ok">RESOLVED</Badge>
              </div>
              <div className="detail-label">WHY IT WAS ESCALATED</div>
              <div className="muted">{it.reason}</div>
              <div className="detail-label" style={{ marginTop: 6 }}>RESOLUTION</div>
              <div className="muted">{it.resolution}</div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
