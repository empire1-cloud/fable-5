import React from "react";
import { href } from "../../lib/router";

const INCLUDES = [
  { title: "Your organisation, isolated", body: "A separate workspace and ledger for your company. Nobody else's records are visible to you, and yours are visible to no one else." },
  { title: "A real evidence ledger", body: "Every claim, receipt, verification, and contradiction your company produces — in one place, ordered, and gated." },
  { title: "Decision memory", body: "Every decision keeps the evidence and assumptions that produced it, so the why is never lost." },
  { title: "Permission boundaries you set", body: "You grant the autonomy level and the spend authorizations. The system checks them on every action." },
];

export default function FoundingAccess() {
  return (
    <div className="pub-page pub-page--narrow">
      <section className="pub-head">
        <div className="pub-sectlabel">
          <span className="pub-sectnum">01</span>
          <span className="pub-sectrule" aria-hidden="true" />
          <span className="pub-secttext">FOUNDING ACCESS</span>
        </div>
        <h1 className="pub-h1">Founding Control Plane.</h1>
        <p className="pub-lead">
          Founding access is a first-class control plane for a founder-run company, granted directly by the
          founder of FABLE-5. There is no pricing page, no sales team, and no pipeline to join — there is a
          conversation about what you want to prove.
        </p>
      </section>

      <section aria-labelledby="pub-inc-title">
        <h2 className="pub-h2" id="pub-inc-title">What founding access includes</h2>
        <div className="pub-grid pub-grid--2">
          {INCLUDES.map((i) => (
            <article className="pub-card" key={i.title}>
              <h3 className="pub-card-title pub-card-title--gold">{i.title}</h3>
              <p className="pub-card-body">{i.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pub-rulebox" aria-labelledby="pub-founding-how">
        <h2 className="pub-h3" id="pub-founding-how">How the ask works</h2>
        <p className="pub-note">
          To request access, be ready to state three things: who you are, what your company is working on, and
          the specific claim you want proven. That claim — not a pitch deck — is where we start.
        </p>
        <p className="pub-note">
          Access is granted by the founder of FABLE-5, not by any form on this site — there is no public
          signup. Once granted, the same step applies to everyone: sign in and let the system start keeping
          receipts. What follows is determined by what your company actually proves.
        </p>
      </section>

      <div className="pub-offer-cta">
        <a className="pub-btn pub-btn--gold" href={href("/sign-in")}>
          Sign in to the control plane →
        </a>
        <a className="pub-btn pub-btn--ghost" href={href("/how-it-works")}>
          How it works
        </a>
      </div>
    </div>
  );
}
