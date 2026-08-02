import React from "react";
import { href } from "../lib/router";
import { useAuth } from "../auth/AuthProvider";
import { SIGN_IN_PATH } from "../lib/routes";

export default function RequireAuth({ path, children }: { path: string; children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="pub" role="status" aria-live="polite">
        <div className="pub-gate">
          <div className="pub-gate-mark" aria-hidden="true">◧</div>
          <p className="pub-gate-line">Checking your session with the control plane…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(path);
    return (
      <div className="pub" role="alert">
        <div className="pub-gate">
          <div className="pub-gate-mark" aria-hidden="true">◧</div>
          <h1 className="pub-gate-title">This workspace is behind your sign-in.</h1>
          <p className="pub-gate-line">
            Evidence, decisions, and boundaries are scoped to your organisation. Sign in to open{" "}
            <code className="mono">{path}</code>.
          </p>
          <div className="pub-hero-actions">
            <a className="pub-btn pub-btn--gold" href={href(`${SIGN_IN_PATH}?next=${next}`)}>
              Sign in
            </a>
            <a className="pub-btn pub-btn--ghost" href={href("/")}>
              Back to the site
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
