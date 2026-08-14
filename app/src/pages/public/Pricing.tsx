import { useEffect, useState } from "react";
import { api, ApiError, type ApiPlan } from "../../lib/api";
import { href } from "../../lib/router";

/* The catalog is fetched from the control plane rather than duplicated here.
 * A price typed into a marketing page is a second source of truth, and the one
 * a customer reads would be the one that is wrong. If the API cannot be
 * reached, this page says so instead of showing numbers it cannot stand
 * behind. */

function money(amount: number | null, currency: string): string {
  if (amount === null) return "Custom";
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const FEATURE_LABELS: Record<string, string> = {
  control_plane: "Control plane & GOD MODE",
  evidence: "Evidence state machine",
  genomes: "Company genomes",
  market_nodes: "Market nodes",
  replication: "Genome replication",
  sso: "SSO",
  audit_export: "Audit export",
};

function PlanCard({ plan, annual }: { plan: ApiPlan; annual: boolean }) {
  const headline = annual && !plan.custom ? plan.annualBilled : plan.monthly;
  return (
    <article className={`pub-panel pub-plan${plan.custom ? " pub-plan--custom" : ""}`}>
      <h3 className="pub-plan-name">{plan.name}</h3>
      <div className="pub-plan-price">
        <span className="pub-plan-amount">{money(headline, plan.currency)}</span>
        {!plan.custom && <span className="pub-plan-per">{annual ? "/year" : "/month"}</span>}
      </div>
      {annual && !plan.custom && (
        <div className="pub-plan-note">{money(plan.monthly, plan.currency)}/month billed annually — two months free</div>
      )}
      {plan.custom && <div className="pub-plan-note">Priced on a conversation, not a page.</div>}

      <ul className="pub-plan-list">
        <li>
          <strong>{plan.includedSeats}</strong> seats
        </li>
        <li>
          <strong>{plan.includedNodes}</strong> active market {plan.includedNodes === 1 ? "node" : "nodes"}
        </li>
        {!plan.custom && (
          <li>
            +{money(plan.extraNodeMonthly, plan.currency)}/month per additional node
          </li>
        )}
        {plan.features.map((f) => (
          <li key={f}>{FEATURE_LABELS[f] ?? f}</li>
        ))}
      </ul>

      <a className={`pub-btn ${plan.custom ? "pub-btn--ghost" : "pub-btn--gold"}`} href={href(plan.custom ? "/founding-access" : "/signup")}>
        {plan.custom ? "Talk to the founder" : "Start free trial"}
      </a>
    </article>
  );
}

export default function Pricing() {
  const [plans, setPlans] = useState<ApiPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [annual, setAnnual] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.subscription
      .get()
      .then((s) => {
        if (!cancelled) setPlans(s.catalog);
      })
      .catch(async (e: unknown) => {
        // Pricing is public, but /api/subscription requires a session. An
        // unauthenticated visitor gets 401 — fall back to the health check so
        // we can tell "not signed in" apart from "no API at all".
        if (e instanceof ApiError && e.status === 401) {
          try {
            await api.health();
            if (!cancelled) setError("signed-out");
          } catch {
            if (!cancelled) setError("unreachable");
          }
          return;
        }
        if (!cancelled) setError("unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pub-page pub-page--narrow">
      <section className="pub-head">
        <div className="pub-sectlabel">
          <span className="pub-sectnum">01</span>
          <span className="pub-sectrule" aria-hidden="true" />
          <span className="pub-secttext">PRICING</span>
        </div>
        <h1 className="pub-h1">Priced on what you build, not who you hire.</h1>
        <p className="pub-lead">
          Agents do the work here, so a company running well on FABLE-5 has few people. Charging per seat would
          bill you for the thing this system removes. The meter is the <strong>active market node</strong> — a
          validated genome running in a real market. You pay more when you have expanded, not when you have
          hired.
        </p>
      </section>

      <div className="pub-billing-toggle" role="group" aria-label="Billing period">
        <button type="button" className={`pub-toggle ${!annual ? "pub-toggle--on" : ""}`} onClick={() => setAnnual(false)}>
          Monthly
        </button>
        <button type="button" className={`pub-toggle ${annual ? "pub-toggle--on" : ""}`} onClick={() => setAnnual(true)}>
          Annual · 2 months free
        </button>
      </div>

      {!plans && !error && <p className="pub-note">Loading plans from the control plane…</p>}

      {error === "unreachable" && (
        <section className="pub-rulebox">
          <h2 className="pub-h3">Prices are not available right now</h2>
          <p className="pub-note">
            The control plane is not reachable, and these numbers come from it. Rather than show a price we
            cannot stand behind, this page shows none. Try again shortly, or{" "}
            <a href={href("/founding-access")}>request founding access</a> and we will quote you directly.
          </p>
        </section>
      )}

      {error === "signed-out" && (
        <section className="pub-rulebox">
          <h2 className="pub-h3">Plans start at €299/month</h2>
          <p className="pub-note">
            Full pricing detail loads once you have an organisation.{" "}
            <a href={href("/signup")}>Start a free 14-day trial</a> — no card required — or{" "}
            <a href={href("/founding-access")}>talk to the founder</a>.
          </p>
        </section>
      )}

      {plans && (
        <div className="pub-grid pub-grid--plans">
          {plans.map((p) => (
            <PlanCard key={p.key} plan={p} annual={annual} />
          ))}
        </div>
      )}

      <section className="pub-rulebox" aria-labelledby="pricing-honest">
        <h2 className="pub-h3" id="pricing-honest">
          What happens when you stop paying
        </h2>
        <ul className="pub-list">
          <li className="pub-list-item">
            <span className="pub-list-mark" aria-hidden="true">·</span>
            The control plane goes <strong>read-only</strong>. Every record, receipt and canon entry stays
            readable.
          </li>
          <li className="pub-list-item">
            <span className="pub-list-mark" aria-hidden="true">·</span>
            Nothing is deleted, hidden, or held hostage. WE EVOLVE, NEVER DELETE applies to customers too.
          </li>
          <li className="pub-list-item">
            <span className="pub-list-mark" aria-hidden="true">·</span>
            A failed card does not freeze your company mid-flight — you keep writing while the payment is
            retried.
          </li>
        </ul>
      </section>
    </div>
  );
}
