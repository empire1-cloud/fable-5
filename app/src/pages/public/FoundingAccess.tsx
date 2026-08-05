import React, { useState } from "react";
import { href } from "../../lib/router";
import { api, ApiError } from "../../lib/api";

const INCLUDES = [
  { title: "Your organisation, isolated", body: "A separate workspace and ledger for your company. Nobody else's records are visible to you, and yours are visible to no one else." },
  { title: "A real evidence ledger", body: "Every claim, receipt, verification, and contradiction your company produces — in one place, ordered, and gated." },
  { title: "Decision memory", body: "Every decision keeps the evidence and assumptions that produced it, so the why is never lost." },
  { title: "Permission boundaries you set", body: "You grant the autonomy level and the spend authorizations. The system checks them on every action." },
];

const NEXT_STEPS = [
  "The founder reviews your request — who you are, what your company is working on, and the specific claim you want proven.",
  "If it fits founding access, you receive an invitation by email and sign in to the control plane.",
  "From day one the system starts keeping receipts. Nothing you claim counts until it is proven.",
];

type FormState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "error"; detail: string }
  | { phase: "done"; email: string };

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [claim, setClaim] = useState("");
  const [state, setState] = useState<FormState>({ phase: "idle" });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.phase === "submitting") return;
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setState({ phase: "error", detail: "Enter a valid email address." });
      return;
    }
    setState({ phase: "submitting" });
    try {
      await api.founding.waitlist.create({
        email: clean,
        name: name.trim() || undefined,
        company: company.trim() || undefined,
        claim: claim.trim() || undefined,
      });
      setState({ phase: "done", email: clean });
    } catch (error) {
      const detail = error instanceof ApiError ? error.detail : "The request could not be submitted. Try again.";
      setState({ phase: "error", detail });
    }
  }

  if (state.phase === "done") {
    return (
      <div className="pub-waitlist-done" role="status">
        <h3 className="pub-h3">Request received — {state.email}</h3>
        <ol className="pub-flow">
          {NEXT_STEPS.map((step, i) => (
            <li className="pub-flow-step" key={step}>
              <span className="pub-flow-num">0{i + 1}</span>
              <p className="pub-note" style={{ margin: 0 }}>
                {step}
              </p>
            </li>
          ))}
        </ol>
        <p className="pub-note">
          Submitting the same email again updates your request. Access is still granted by the founder of FABLE-5 — this
          list is where the conversation starts.
        </p>
      </div>
    );
  }

  return (
    <form className="pub-form" onSubmit={onSubmit} noValidate>
      <label className="pub-field">
        <span className="pub-field-label">EMAIL *</span>
        <input
          className="pub-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourcompany.com"
          autoComplete="email"
          required
        />
      </label>
      <div className="pub-form-row">
        <label className="pub-field">
          <span className="pub-field-label">NAME</span>
          <input
            className="pub-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Who you are"
            autoComplete="name"
          />
        </label>
        <label className="pub-field">
          <span className="pub-field-label">COMPANY</span>
          <input
            className="pub-input"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="What you are building"
            autoComplete="organization"
          />
        </label>
      </div>
      <label className="pub-field">
        <span className="pub-field-label">THE CLAIM YOU WANT PROVEN</span>
        <textarea
          className="pub-input pub-textarea"
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          placeholder="One sentence. That claim — not a pitch deck — is where we start."
          rows={3}
        />
      </label>
      {state.phase === "error" && (
        <p className="pub-waitlist-error" role="alert">
          {state.detail}
        </p>
      )}
      <button className="pub-btn pub-btn--gold" type="submit" disabled={state.phase === "submitting"}>
        {state.phase === "submitting" ? "Submitting…" : "Request founding access →"}
      </button>
      <p className="pub-note pub-waitlist-hint">
        Requests land in a real queue — the founder reads it directly. No newsletters, no pipelines.
      </p>
    </form>
  );
}

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

      <section className="pub-rulebox" aria-labelledby="pub-waitlist-title">
        <h2 className="pub-h3" id="pub-waitlist-title">Request founding access</h2>
        <p className="pub-note">
          Three things matter: who you are, what your company is working on, and the specific claim you want
          proven. That claim — not a pitch deck — is where we start.
        </p>
        <WaitlistForm />
      </section>

      <div className="pub-offer-cta">
        <a className="pub-btn pub-btn--ghost" href={href("/how-it-works")}>
          How it works
        </a>
      </div>
    </div>
  );
}
