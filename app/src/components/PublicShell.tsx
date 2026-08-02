import React, { useState } from "react";
import { href } from "../lib/router";
import { useAuth } from "../auth/AuthProvider";

const NAV: { to: string; label: string }[] = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/proof", label: "Proof" },
  { to: "/founding-access", label: "Founding access" },
  { to: "/trust", label: "Trust" },
];

export default function PublicShell({
  route,
  children,
}: {
  route: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="pub">
      <a className="pub-skip" href="#main-content">
        Skip to content
      </a>
      <header className="pub-nav">
        <a className="pub-brand" href={href("/")} aria-label="FABLE-5 home">
          <span className="pub-mark" aria-hidden="true">
            ◧
          </span>
          <span className="pub-brand-name">FABLE-5</span>
          <span className="pub-brand-sub">GOVERNANCE FOR AI WORK</span>
        </a>

        <button
          type="button"
          className="pub-burger"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <nav className={`pub-navlinks ${open ? "pub-navlinks--open" : ""}`} aria-label="Primary">
          {NAV.map((n) => (
            <a
              key={n.to}
              href={href(n.to)}
              className={`pub-navlink ${route === n.to ? "pub-navlink--active" : ""}`}
              onClick={() => setOpen(false)}
            >
              {n.label}
            </a>
          ))}
          <span className="pub-navsep" aria-hidden="true" />
          {user ? (
            <a className="pub-navlink pub-navlink--enter" href={href("/control")} onClick={() => setOpen(false)}>
              Enter control plane →
            </a>
          ) : (
            <a className="pub-navlink pub-navlink--enter" href={href("/sign-in")} onClick={() => setOpen(false)}>
              Sign in →
            </a>
          )}
        </nav>
      </header>

      <main id="main-content">{children}</main>

      <footer className="pub-foot">
        <div className="pub-foot-grid">
          <div>
            <div className="pub-foot-brand">
              <span className="pub-mark" aria-hidden="true">◧</span> FABLE-5
            </div>
            <p className="pub-foot-strapline">Governance for AI work. Built by a founder, for founders.</p>
          </div>
          <nav aria-label="Footer">
            <div className="pub-foot-head">NAVIGATE</div>
            <a href={href("/how-it-works")}>How it works</a>
            <a href={href("/proof")}>Proof</a>
            <a href={href("/founding-access")}>Founding access</a>
            <a href={href("/trust")}>Trust</a>
            <a href={href("/sign-in")}>Sign in</a>
          </nav>
          <div>
            <div className="pub-foot-head">BOUNDARIES</div>
            <p className="pub-foot-line">Nothing is called progress until it is proven.</p>
            <p className="pub-foot-line">No silent spend. Receipts required. Every org isolated.</p>
          </div>
        </div>
        <div className="pub-foot-fine">
          <span>WE EVOLVE, NEVER DELETE.</span>
          <span>No testimonials, certifications, or production metrics are claimed on this site.</span>
        </div>
      </footer>
    </div>
  );
}
