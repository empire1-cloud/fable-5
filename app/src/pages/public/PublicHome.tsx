import React from "react";
import { href } from "../../lib/router";

const PROBLEMS = [
  {
    title: "Fake completion",
    body: "The agent says the job is done. The job is not done. Nothing checks, so nothing stops the claim.",
  },
  {
    title: "Unsupported claims",
    body: "A result is presented as fact with no artifact behind it — no log, no run, no reproducible evidence.",
  },
  {
    title: "Permission drift",
    body: "What the system was allowed to do drifts upward because nobody re-states the boundary on every action.",
  },
  {
    title: "Unauthorized actions",
    body: "An action happens that nobody approved. You find out after the fact — if you ever find out.",
  },
  {
    title: "Forgotten contradictions",
    body: "Two outputs contradict each other. The second one overwrites the first, and the disagreement is lost.",
  },
  {
    title: "No memory",
    body: "Nothing learns. The same mistake, the same duplicated work, gets made again — and again — and again.",
  },
];

const FLOW = [
  { num: "01", label: "Signal", body: "Something changes in the world — a market, a customer, a node, a memory." },
  { num: "02", label: "Decision", body: "A decision is made with its evidence, assumptions, and authority level stated." },
  { num: "03", label: "Action", body: "An action executes — but only inside the boundary the founder set." },
  { num: "04", label: "Receipt", body: "Every action produces a receipt: what ran, when, and what it claimed." },
  { num: "05", label: "Independent verification", body: "Nothing is verified by the actor. It is verified separately, or it stays unverified." },
  { num: "06", label: "Measured outcome", body: "The result is scored against a stated threshold — passed or failed, not narrated." },
  { num: "07", label: "Approved learning", body: "The outcome updates what the company knows, and only the founder approves canon." },
];

const TIMELINE = [
  { t: "00:00", text: "An agent reports a production-ready release. The claim is filed as a claim — not as progress." },
  { t: "00:05", text: "Independent verification is requested before the claim may advance. It cannot skip the gate." },
  { t: "00:12", text: "A contradicting runtime receipt surfaces: the reported state does not match what actually ran." },
  { t: "00:47", text: "A tenant-isolation check fails the boundary the release assumed. The gap is recorded, not patched over." },
  { t: "01:05", text: "No valid spend authorization exists for the planned next step. The operation is blocked." },
];

const CAPABILITIES = [
  {
    title: "Verified Progress",
    body: "Work only counts as done when it has been independently verified. Until then it is labelled exactly what it is: unverified.",
  },
  {
    title: "Decision Memory",
    body: "Every decision records why it was made — the evidence, the assumptions, the authority that allowed it. Nothing is a one-off.",
  },
  {
    title: "Contradiction Detection",
    body: "New claims are checked against what the company already knows. Disagreements block progress until they are resolved.",
  },
  {
    title: "Permission Boundaries",
    body: "Every action is checked against the boundary the founder granted. The boundary is re-asserted on every single action.",
  },
  {
    title: "Spend Authorization",
    body: "No valid token, no spend. Financial actions require an explicit, in-scope authorization — nothing spends by default.",
  },
  {
    title: "Compounding Intelligence",
    body: "Proven outcomes write back to the company's canon. The system gets smarter only in the places where it has actually proven something.",
  },
];

const AUDIENCES = [
  "AI-native startups",
  "Founder-led SaaS teams",
  "AI agencies shipping for clients",
  "Multi-agent studios",
  "Venture studios running experiments",
  "Regulated or enterprise teams",
];

const BOUNDARIES = [
  "The server decides — a client that skips the UI is still refused.",
  "Each organisation is fully isolated. Nobody sees another org's records.",
  "No outbound money by default. Execution is a capability the founder explicitly enables.",
  "Negative intelligence is retained, not deleted. A blocked result is still a result.",
  "The system evolves, never rewrites. Nothing is silently replaced.",
];

function SectionLabel({ num, text }: { num: string; text: string }) {
  return (
    <div className="pub-sectlabel">
      <span className="pub-sectnum">{num}</span>
      <span className="pub-sectrule" aria-hidden="true" />
      <span className="pub-secttext">{text}</span>
    </div>
  );
}

export default function PublicHome() {
  return (
    <div className="pub-page">
      {/* 00 — HERO */}
      <section className="pub-hero" aria-label="Introduction">
        <SectionLabel num="00" text="FABLE-5 — GOVERNANCE FOR AI WORK" />
        <h1 className="pub-hero-title">
          Stop calling AI output <span className="pub-accent">progress</span> until it is{" "}
          <span className="pub-accent">proven</span>.
        </h1>
        <p className="pub-hero-sub">
          FABLE-5 is a control plane for companies that run on AI work. It records what was decided, what was
          executed, and what the receipts actually show — and it will not let a claim count as progress until it
          has been independently verified.
        </p>
        <div className="pub-hero-actions">
          <a className="pub-btn pub-btn--gold" href={href("/founding-access")}>
            Request founding access
          </a>
          <a className="pub-btn pub-btn--ghost" href={href("/sign-in")}>
            Sign in
          </a>
        </div>
        <p className="pub-hero-fine">
          FABLE-5 is a working control plane, not a marketed product. There is no sales pipeline, no invented
          pricing, and no fabricated metrics on this site.
        </p>
      </section>

      {/* 01 — PROBLEM */}
      <section className="pub-section" aria-labelledby="pub-problem-title">
        <SectionLabel num="01" text="THE PROBLEM" />
        <h2 id="pub-problem-title" className="pub-h2">
          The failure is not the AI. The failure is that <em className="pub-em">nothing checks the AI</em>.
        </h2>
        <div className="pub-grid pub-grid--3">
          {PROBLEMS.map((p) => (
            <article className="pub-card" key={p.title}>
              <h3 className="pub-card-title">{p.title}</h3>
              <p className="pub-card-body">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 02 — DIFFERENCE */}
      <section className="pub-section" aria-labelledby="pub-diff-title">
        <SectionLabel num="02" text="THE DIFFERENCE" />
        <h2 id="pub-diff-title" className="pub-h2">
          Every piece of work moves through one governed path.
        </h2>
        <ol className="pub-flow">
          {FLOW.map((s) => (
            <li className="pub-flow-step" key={s.num}>
              <span className="pub-flow-num">{s.num}</span>
              <div>
                <div className="pub-flow-label">{s.label}</div>
                <div className="pub-flow-body">{s.body}</div>
              </div>
            </li>
          ))}
        </ol>
        <p className="pub-note">
          At every step, a gate is checked. A claim that has not been receipted, verified, and measured stays
          exactly that — a claim.
        </p>
      </section>

      {/* 03 — CASE STUDY */}
      <section className="pub-section" aria-labelledby="pub-case-title">
        <SectionLabel num="03" text="A TRUE CASE STUDY" />
        <h2 id="pub-case-title" className="pub-h2">
          FABLE-5 shut the operation down within hours.
        </h2>
        <p className="pub-lead">
          On its first real run, the system was handed a "production-ready" release and a team ready to move on it.
          This is what happened — a sanitized timeline, in order, in real time.
        </p>
        <div className="pub-timeline">
          {TIMELINE.map((row) => (
            <div className="pub-tl-row" key={row.t}>
              <span className="pub-tl-t">{row.t}</span>
              <span className="pub-tl-rule" aria-hidden="true" />
              <span className="pub-tl-text">{row.text}</span>
            </div>
          ))}
        </div>
        <p className="pub-note">
          The system did not produce that shutdown. It made the shutdown <em className="pub-em">visible and
          enforceable</em> — because the claims were checked before anyone acted on them.
        </p>
      </section>

      {/* 04 — CAPABILITIES */}
      <section className="pub-section" aria-labelledby="pub-cap-title">
        <SectionLabel num="04" text="WHAT YOU GET" />
        <h2 id="pub-cap-title" className="pub-h2">
          Six capabilities. One promise: nothing unproven is called progress.
        </h2>
        <div className="pub-grid pub-grid--2">
          {CAPABILITIES.map((c) => (
            <article className="pub-card" key={c.title}>
              <h3 className="pub-card-title pub-card-title--gold">{c.title}</h3>
              <p className="pub-card-body">{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 05 — WHO IT'S FOR */}
      <section className="pub-section" aria-labelledby="pub-who-title">
        <SectionLabel num="05" text="WHO IT'S FOR" />
        <h2 id="pub-who-title" className="pub-h2">
          Built for companies where the work is AI work.
        </h2>
        <div className="pub-grid pub-grid--3">
          {AUDIENCES.map((a) => (
            <div className="pub-who" key={a}>
              <span className="pub-who-mark" aria-hidden="true">→</span> {a}
            </div>
          ))}
        </div>
      </section>

      {/* 06 — TRUST BOUNDARIES */}
      <section className="pub-section" aria-labelledby="pub-trust-title">
        <SectionLabel num="06" text="TRUST BOUNDARIES" />
        <h2 id="pub-trust-title" className="pub-h2">
          What FABLE-5 will and will not do — stated up front.
        </h2>
        <ul className="pub-list">
          {BOUNDARIES.map((b) => (
            <li key={b} className="pub-list-item">
              <span className="pub-list-mark" aria-hidden="true">▸</span>
              {b}
            </li>
          ))}
        </ul>
      </section>

      {/* 07 — OFFER */}
      <section className="pub-section" aria-labelledby="pub-offer-title">
        <SectionLabel num="07" text="THE OFFER" />
        <h2 id="pub-offer-title" className="pub-h2">
          Founding Control Plane.
        </h2>
        <p className="pub-lead">
          A first-class control plane for a founder-run company: your organisation, your evidence ledger, your
          decisions, your boundaries — isolated from everyone else's.
        </p>
        <p className="pub-lead">
          Founding access is granted directly by the founder of FABLE-5. There is no pricing page to hide behind:
          we talk about what you want to prove, and we prove it on your own company first.
        </p>
        <div className="pub-offer-cta">
          <a className="pub-btn pub-btn--gold" href={href("/founding-access")}>
            Request founding access
          </a>
          <a className="pub-btn pub-btn--ghost" href={href("/how-it-works")}>
            How it works →
          </a>
        </div>
      </section>

      {/* 08 — FINAL CTA */}
      <section className="pub-final" aria-label="Closing call to action">
        <h2 className="pub-final-title">
          Stop managing AI output. <span className="pub-accent">Start governing company truth.</span>
        </h2>
        <div className="pub-hero-actions">
          <a className="pub-btn pub-btn--gold" href={href("/founding-access")}>
            Request founding access
          </a>
          <a className="pub-btn pub-btn--ghost" href={href("/sign-in")}>
            Sign in
          </a>
        </div>
      </section>
    </div>
  );
}
