import React from "react";
import { href } from "../../lib/router";

const TIMELINE = [
  { t: "00:00", text: "An agent reports a production-ready release. The claim is filed as a claim — not as progress." },
  { t: "00:05", text: "Independent verification is requested before the claim may advance. It cannot skip the gate." },
  { t: "00:12", text: "A contradicting runtime receipt surfaces: the reported state does not match what actually ran." },
  { t: "00:47", text: "A tenant-isolation check fails the boundary the release assumed. The gap is recorded, not patched over." },
  { t: "01:05", text: "No valid spend authorization exists for the planned next step. The operation is blocked." },
];

const RULES = [
  "Receipts are required — an action with no receipt is not recorded work.",
  "Verification is independent — the actor never verifies its own output.",
  "Contradictions block progress — a dispute is resolved or nothing advances.",
  "Negative intelligence is retained — a blocked result stays on the record as a result.",
  "The server is authoritative — skipping the interface does not bypass the rules.",
];

const NO_CLAIMS = [
  "No uptime, revenue, or engagement metrics.",
  "No customer testimonials or logos.",
  "No certifications or compliance badges.",
  "No third-party endorsements.",
];

export default function Proof() {
  return (
    <div className="pub-page pub-page--narrow">
      <section className="pub-head">
        <div className="pub-sectlabel">
          <span className="pub-sectnum">01</span>
          <span className="pub-sectrule" aria-hidden="true" />
          <span className="pub-secttext">PROOF</span>
        </div>
        <h1 className="pub-h1">Proof is the product.</h1>
        <p className="pub-lead">
          FABLE-5's first job is to make the difference between a claim and a verified result visible. The case
          below is the system doing that job on its own first real run. It is told without invented numbers —
          the timestamps are real, the sequence is real, and the outcome is real.
        </p>
      </section>

      <section aria-labelledby="pub-proof-case">
        <h2 className="pub-h2">A true case: the operation the system shut down</h2>
        <p className="pub-lead">
          Handed a "production-ready" release and a team ready to proceed, the control plane did not object — it
          checked. This is what the checks found, in order.
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
          Within an hour and five minutes, the plan to proceed was blocked by evidence on record. No one had to
          remember to check. The claim was checked because a claim is never granted the status of progress.
        </p>
      </section>

      <section aria-labelledby="pub-proof-rules">
        <h2 className="pub-h2">The rules that make this repeatable</h2>
        <ul className="pub-list">
          {RULES.map((r) => (
            <li key={r} className="pub-list-item">
              <span className="pub-list-mark" aria-hidden="true">▸</span>
              {r}
            </li>
          ))}
        </ul>
      </section>

      <section className="pub-rulebox" aria-labelledby="pub-proof-noclaims">
        <h2 className="pub-h3" id="pub-proof-noclaims">What this page does not claim</h2>
        <p className="pub-note">A system that punishes unsupported claims should not make them:</p>
        <ul className="pub-list">
          {NO_CLAIMS.map((c) => (
            <li key={c} className="pub-list-item pub-list-item--muted">
              <span className="pub-list-mark" aria-hidden="true">·</span>
              {c}
            </li>
          ))}
        </ul>
      </section>

      <div className="pub-offer-cta">
        <a className="pub-btn pub-btn--gold" href={href("/sign-in")}>
          Prove it on your own company →
        </a>
      </div>
    </div>
  );
}
