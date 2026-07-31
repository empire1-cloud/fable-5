import { useState } from "react";
import { Sheet, PanelCard } from "../components";
import { useAuth } from "../auth/AuthProvider";
import { ApiError } from "../lib/api";

type Mode = "login" | "register";

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
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, orgName);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "could not reach the control plane API");
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
          title={mode === "login" ? "Sign in" : "Create an organisation"}
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

            {mode === "register" && (
              <label style={{ display: "grid", gap: 6 }}>
                <span className="card-label">ORGANISATION NAME</span>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  style={FIELD_STYLE}
                />
              </label>
            )}

            <label style={{ display: "grid", gap: 6 }}>
              <span className="card-label">PASSWORD</span>
              <input
                type="password"
                required
                minLength={mode === "register" ? 12 : undefined}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={FIELD_STYLE}
              />
              {mode === "register" && (
                <span className="card-footnote" style={{ borderTop: "none", paddingTop: 0 }}>
                  Minimum 12 characters. Hashed with Argon2id — the server never stores it.
                </span>
              )}
            </label>

            {error && (
              <p className="card-footnote" style={{ color: "var(--warn)", borderTop: "none" }} role="alert">
                REFUSED — {error}
              </p>
            )}

            <div className="btn-row">
              <button type="submit" className="btn btn--accent" disabled={busy}>
                {busy ? "…" : mode === "login" ? "SIGN IN" : "CREATE ORGANISATION"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError(null);
                }}
              >
                {mode === "login" ? "NEED AN ACCOUNT?" : "ALREADY HAVE ONE?"}
              </button>
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
