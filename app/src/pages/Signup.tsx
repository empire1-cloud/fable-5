import { useState } from "react";
import { Sheet } from "../components";
import { useAuth } from "../auth/AuthProvider";
import { ApiError } from "../lib/api";
import { href, navigate } from "../lib/router";

const FIELD_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12.5,
  background: "var(--panel-raised)",
  color: "var(--ink)",
  border: "1px solid var(--border)",
  padding: "10px 12px",
  width: "100%",
};

/** Mirrors the server's rule in src/signup.js. Checked here only to give
 *  immediate feedback — the server is still the authority and re-validates. */
const MIN_PASSWORD = 12;

export function Signup() {
  const { signup } = useAuth();
  const [organisationName, setOrganisationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordShort = password.length > 0 && password.length < MIN_PASSWORD;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signup(organisationName.trim(), email.trim(), password);
      navigate("/control");
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
          title="Start your organisation"
          note="14 days, the whole product · no card required"
        >
          <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 440 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="card-label">ORGANISATION</span>
              <input
                type="text"
                required
                autoComplete="organization"
                value={organisationName}
                onChange={(e) => setOrganisationName(e.target.value)}
                style={FIELD_STYLE}
              />
            </label>

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
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={FIELD_STYLE}
                aria-describedby="pw-hint"
              />
              <span
                id="pw-hint"
                className="card-footnote"
                style={{ borderTop: "none", color: passwordShort ? "var(--warn)" : undefined }}
              >
                {MIN_PASSWORD} characters minimum — this credential guards the whole company.
              </span>
            </label>

            {error && (
              <p className="card-footnote" style={{ color: "var(--warn)", borderTop: "none" }} role="alert">
                REFUSED — {error}
              </p>
            )}

            <div className="btn-row">
              <button type="submit" className="btn btn--accent" disabled={busy}>
                {busy ? "…" : "CREATE ORGANISATION"}
              </button>
              <a className="btn" href={href("/sign-in")}>
                Sign in instead
              </a>
            </div>
          </form>
        </Sheet>

        <Sheet eyebrow="WHAT YOU GET" title="The whole system, for fourteen days" note="then read-only, never deleted">
          <ul className="detail-list">
            <li>Every workspace unlocked — evidence, genomes, decisions, escalations, market nodes.</li>
            <li>No card, no sales call. The trial ends by itself.</li>
            <li>
              When it ends the control plane goes <strong>read-only</strong>. Everything you recorded stays
              readable — nothing is deleted or hidden because you stopped paying.
            </li>
            <li>
              Plans start at <strong>€299/month</strong>. <a href={href("/pricing")}>See pricing</a>.
            </li>
          </ul>
        </Sheet>
      </main>
    </div>
  );
}
