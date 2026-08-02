import React from "react";
import { href } from "../../lib/router";

const STAGES = [
  { label: "Signal", body: "A change arrives from a market, a customer, a node, or the company's own memory. It is logged with its source and reliability — never silently upgraded." },
  { label: "Decision", body: "A decision is formed with the evidence it leans on, the assumptions it carries, and the authority level required. Assumptions are labelled assumptions, not facts." },
  { label: "Action", body: "An action runs only inside the boundary the founder granted. The boundary is checked on the action itself, not assumed from context." },
  { label: "Receipt", body: "Every action must produce a receipt: what ran, when, and what it claimed. No receipt, no record of work. It is that simple." },
  { label: "Independent verification", body: "The actor does not verify its own work. A separate check must reproduce the result, or the work stays unverified." },
  { label: "Measured outcome", body: "The result is scored against a stated threshold. Pass or fail is a reading, not a narrative — and either answer is recorded." },
  { label: "Approved learning", body: "What was proven updates the company's canon. The founder approves what becomes company memory. Nothing is written back silently." },
];

export default function HowItWorks() {
  return (
    <div className="pub-page pub-page--narrow">
      <section className="pub-head">
        <div className="pub-sectlabel">
          <span className="pub-sectnum">01</span>
          <span className="pub-sectrule" aria-hidden="true" />
          <span className="pub-secttext">HOW IT WORKS</span>
        </div>
        <h1 className="pub-h1">One governed path for every piece of work.</h1>
        <p className="pub-lead">
          FABLE-5 does not replace the AI. It replaces the assumption that AI output can be trusted because it
          was produced. Work moves through seven stages, and each stage has a gate that must actually pass.
        </p>
      </section>

      <ol className="pub-flow">
        {STAGES.map((s, i) => (
          <li className="pub-flow-step" key={s.label}>
            <span className="pub-flow-num">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <div className="pub-flow-label">{s.label}</div>
              <div className="pub-flow-body">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>

      <section className="pub-rulebox">
        <h2 className="pub-h3">Two rules carry the whole system</h2>
        <p className="pub-note">
          <strong>Nothing is called verified until it is independently reproduced.</strong> The actor's own report
          is never sufficient — a self-report is a claim, and claims do not advance gates.
        </p>
        <p className="pub-note">
          <strong>Nothing is spent without a token.</strong> Financial actions require an explicit, in-scope,
          founder-approved authorization. No valid token, no spend — regardless of what the AI suggests.
        </p>
      </section>

      <div className="pub-offer-cta">
        <a className="pub-btn pub-btn--gold" href={href("/proof")}>
          See the proof →
        </a>
        <a className="pub-btn pub-btn--ghost" href={href("/sign-in")}>
          Sign in
        </a>
      </div>
    </div>
  );
}
