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
          <span className="pub-brand-sub">THE AI COMPANY OPERATING SYSTEM</span>
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
            <p className="pub-foot-strapline">The operating system for AI-native companies. Built by a founder, for founders.</p>
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
            <div className="pub-foot-head">THE ECOSYSTEM</div>
            <a
              className="pub-foot-ext"
              href="https://github.com/empire1-cloud/Fable-5"
              target="_blank"
              rel="noreferrer"
            >
              <svg viewBox="0 0 16 16" className="pub-foot-ico" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
                />
              </svg>
              GitHub
            </a>
            <a className="pub-foot-ext" href="https://empire1.cloud" target="_blank" rel="noreferrer">
              <svg viewBox="0 0 16 16" className="pub-foot-ico" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M8 0 15 3v5c0 4.5-3 7.5-7 8-4-.5-7-3.5-7-8V3L8 0Zm0 2.3L3 4.2v3.8c0 3.3 2.1 5.5 5 6 2.9-.5 5-2.7 5-6V4.2L8 2.3Z"
                />
              </svg>
              Empire-1
            </a>
          </div>
          <div>
            <div className="pub-foot-head">BOUNDARIES</div>
            <p className="pub-foot-line">Nothing is called progress until it is proven.</p>
            <p className="pub-foot-line">No silent spend. Receipts required. Every org isolated.</p>
          </div>
        </div>
        <div className="pub-foot-fine">
          <span>WE EVOLVE, NEVER DELETE.</span>
          <span>No testimonials, certifications, or production metrics are claimed on this site.</span>
          <span>
            An independent product of Empire-1 — not affiliated with or endorsed by any AI vendor.{" "}
            <a className="pub-foot-link" href={href("/trust")}>Attribution</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
