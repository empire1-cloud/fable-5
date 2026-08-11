import React from "react";
import { href } from "../../lib/router";

const BOUNDARIES = [
  { title: "The server decides", body: "Evidence states, permission checks, and spend verdicts are computed on the server and re-checked on every write. A client that skips the interface is still refused. The browser's copy of the rules only greys out buttons." },
  { title: "Isolation is structural", body: "Every organisation is a separate tenant. Records are scoped to the organisation on the server, not filtered on the client." },
  { title: "No outbound money by default", body: "The control plane has no payment rail it spends from on its own. Financial actions require an explicit, in-scope, founder-approved authorization." },
  { title: "Self-reports are never sufficient", body: "A delegated agent's report of its own work is a claim. Progress requires a receipt, independent verification, and a measured outcome." },
  { title: "We evolve, never delete", body: "Nothing is silently rewritten or removed. Negative intelligence — blocked results, contradictions — is retained as intelligence." },
];

const LIMITS = [
  "FABLE-5 cannot make bad work good. It can only stop unproven work from being called progress.",
  "FABLE-5 does not decide strategy for you. It records the decisions you make and the evidence behind them.",
  "This site makes no claims we cannot back: no testimonials, no certifications, no production metrics.",
];

const INDEPENDENCE = [
  "FABLE-5 is an independent product of Empire-1. It is not affiliated with, endorsed by, sponsored by, or built in partnership with Anthropic or any other AI vendor.",
  "AI assistants — including Anthropic's Claude models — were used as engineering and design tools while building this system, the same way an IDE or a compiler is a tool. The governance model, evidence state machine, and control-plane architecture are Empire-1's own work.",
  "The product name is our own and is not a claim of association with any vendor, model, or trademark that may share similar wording.",
  "No AI vendor has reviewed, certified, or approved this system.",
];

export default function Trust() {
  return (
    <div className="pub-page pub-page--narrow">
      <section className="pub-head">
        <div className="pub-sectlabel">
          <span className="pub-sectnum">01</span>
          <span className="pub-sectrule" aria-hidden="true" />
          <span className="pub-secttext">TRUST</span>
        </div>
        <h1 className="pub-h1">Trust is a boundary, not a promise.</h1>
        <p className="pub-lead">
          A system whose whole job is stopping unsupported claims owes you the same standard. These are the
          boundaries FABLE-5 operates inside, stated up front and enforced in code.
        </p>
      </section>

      <section aria-labelledby="pub-trust-bound">
        <h2 className="pub-h2" id="pub-trust-bound">Operating boundaries</h2>
        <div className="pub-grid pub-grid--2">
          {BOUNDARIES.map((b) => (
            <article className="pub-card" key={b.title}>
              <h3 className="pub-card-title pub-card-title--gold">{b.title}</h3>
              <p className="pub-card-body">{b.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pub-rulebox" aria-labelledby="pub-trust-limits">
        <h2 className="pub-h3" id="pub-trust-limits">Honest limits</h2>
        <ul className="pub-list">
          {LIMITS.map((l) => (
            <li key={l} className="pub-list-item">
              <span className="pub-list-mark" aria-hidden="true">·</span>
              {l}
            </li>
          ))}
        </ul>
      </section>

      <section className="pub-rulebox" aria-labelledby="pub-trust-independence">
        <h2 className="pub-h3" id="pub-trust-independence">Independence and attribution</h2>
        <ul className="pub-list">
          {INDEPENDENCE.map((l) => (
            <li key={l} className="pub-list-item">
              <span className="pub-list-mark" aria-hidden="true">·</span>
              {l}
            </li>
          ))}
        </ul>
      </section>

      <div className="pub-offer-cta">
        <a className="pub-btn pub-btn--gold" href={href("/founding-access")}>
          Request founding access
        </a>
        <a className="pub-btn pub-btn--ghost" href={href("/proof")}>
          See the proof →
        </a>
      </div>
    </div>
  );
}
