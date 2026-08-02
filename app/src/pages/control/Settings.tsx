import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { api } from "../../lib/api";
import { Eyebrow, Badge } from "../../components/ui";

type HealthState =
  | { status: "checking" }
  | { status: "ok"; health: Awaited<ReturnType<typeof api.health>> }
  | { status: "unreachable" };

export default function Settings() {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthState>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((h) => {
        if (!cancelled) setHealth({ status: "ok", health: h });
      })
      .catch(() => {
        if (!cancelled) setHealth({ status: "unreachable" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <Eyebrow>ORGANISATION SETTINGS</Eyebrow>
        <h1 className="hero-title">Settings</h1>
        <p className="hero-sub">
          Who you are on this control plane, and whether the server is reachable. All other configuration lives
          on the server, per organisation, and is never trusted from the browser.
        </p>
      </section>

      <section className="panel">
        <div className="panel-label panel-label--accent">SESSION</div>
        <div className="opportunity-grid">
          <div>
            <div className="detail-label">EMAIL</div>
            <div>{user?.email ?? "—"}</div>
          </div>
          <div>
            <div className="detail-label">ORGANISATION</div>
            <div>{user?.tenantName ?? "—"}</div>
          </div>
          <div>
            <div className="detail-label">ROLE</div>
            {user?.role && ["owner", "admin"].includes(user.role.toLowerCase()) ? (
              <Badge tone="ok">FOUNDER · {user.role.toUpperCase()}</Badge>
            ) : (
              <Badge tone="neutral">{user?.role ?? "MEMBER"}</Badge>
            )}
          </div>
          <div>
            <div className="detail-label">TENANT ID</div>
            <div className="muted">{user?.tenantId ?? "—"}</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-label panel-label--accent">CONTROL PLANE API</div>
        <div className="opportunity-grid">
          <div>
            <div className="detail-label">CONNECTIVITY</div>
            {health.status === "checking" && <Badge tone="neutral">CHECKING…</Badge>}
            {health.status === "ok" && <Badge tone="ok">REACHABLE</Badge>}
            {health.status === "unreachable" && <Badge tone="bad">UNREACHABLE</Badge>}
          </div>
          {health.status === "ok" && (
            <>
              <div>
                <div className="detail-label">SERVICE</div>
                <div className="muted">{health.health.service} · {health.health.architecture}</div>
              </div>
              <div>
                <div className="detail-label">MONEY EXECUTION</div>
                <div className="muted">
                  {health.health.moneyExecutionDefault ? "defaults ON" : "disabled by default (engine 05) — verdicts only, never payments"}
                </div>
              </div>
              <div>
                <div className="detail-label">DB HEARTBEAT</div>
                <div className="muted">{health.health.databaseTime}</div>
              </div>
            </>
          )}
          {health.status === "unreachable" && (
            <div>
              <div className="detail-label">WHAT THIS MEANS</div>
              <div className="muted">
                The API is not responding from this browser. Nothing here is trusted from the client, so the
                control plane refuses writes rather than pretending to work.
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-label panel-label--accent">BOUNDARIES, RESTATED</div>
        <ul className="detail-list">
          <li>The server is authoritative — every rule is re-checked on every write.</li>
          <li>Each organisation is isolated; this session is scoped to yours.</li>
          <li>No outbound money by default. Spend requires a founder-approved token.</li>
          <li>Self-reports are claims. Progress requires a receipt and independent verification.</li>
        </ul>
      </section>
    </div>
  );
}
