import { useState } from "react";
import { Sheet, PanelCard } from "../components";
import { useAuth } from "../auth/AuthProvider";
import { ApiError } from "../lib/api";
import { afterSignInTarget } from "../lib/routes";
import { href, navigate, parseRoute, useHashRoute } from "../lib/router";

const FIELD_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12.5,
  background: "var(--panel-raised)",
  color: "var(--ink)",
  border: "1px solid var(--border)",
  padding: "10px 12px",
  width: "100%",
};

export function Login() {
  const { login } = useAuth();
  const raw = useHashRoute();
  const { query } = parseRoute(raw);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      const next = query.get("next");
      navigate(afterSignInTarget(next ?? "/control"));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.detail
          : "could not reach the control plane API — check that it is running, then try again",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell app-shell--bare">
      <div className="texture-layer" aria-hidden="true" />
      <main className="auth-main" id="main-content">
        <Sheet
          eyebrow="FABLE-5 · CONTROL PLANE"
          title="Sign in"
          note="server-authoritative · every record below belongs to your org and no one else's"
        >
          <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 440 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="card-label">EMAIL</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={FIELD_STYLE}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="card-label">PASSWORD</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={FIELD_STYLE}
              />
            </label>

            {error && (
              <p className="card-footnote" style={{ color: "var(--warn)", borderTop: "none" }} role="alert">
                REFUSED — {error}
              </p>
            )}

            <div className="btn-row">
              <button type="submit" className="btn btn--accent" disabled={busy}>
                {busy ? "…" : "SIGN IN"}
              </button>
              <a className="btn" href={href("/founding-access")}>
                REQUEST FOUNDING ACCESS
              </a>
            </div>
          </form>
        </Sheet>

        <Sheet eyebrow="WHAT YOU ARE SIGNING INTO" title="The boundaries, stated up front" note="read this before you trust anything the app shows you">
          <div className="two-col">
            <PanelCard label="THE SERVER DECIDES">
              Evidence states, opportunity rank, and spend verdicts are computed on the server and
              re-checked on every write. A client that skips the UI still gets refused. The browser
              copy of the rules only greys out buttons.
            </PanelCard>
            <PanelCard label="NO OUTBOUND MONEY" accent>
              This service has no payment rail. An Intent Token check returns a verdict, never a
              payment — <code className="mono">executed</code> is hard-coded false. Nothing here can
              move your money.
            </PanelCard>
          </div>
        </Sheet>
      </main>
    </div>
  );
}
