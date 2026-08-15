import { useEffect, useState } from "react";
import { Sheet, PanelCard } from "../../components";
import { api, ApiError, type ApiBillingStatus, type ApiSubscription } from "../../lib/api";
import { href } from "../../lib/router";

/* This page states the billing state rather than asserting one. It previously
 * said "money is not wired yet — on purpose", which was true then and becomes
 * false the moment a key is configured. A page that hardcodes a claim about
 * the system is a page that will eventually lie about it. */

function money(amount: number | null, currency: string): string {
  if (amount === null) return "Custom";
  return new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function Billing() {
  const [sub, setSub] = useState<ApiSubscription | null>(null);
  const [billing, setBilling] = useState<ApiBillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.subscription.get(), api.billing.status()])
      .then(([s, b]) => {
        if (cancelled) return;
        setSub(s);
        setBilling(b);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.detail : "Could not reach the control plane.");
      });
    return () => { cancelled = true; };
  }, []);

  async function upgrade(planKey: string) {
    setBusy(planKey);
    setError(null);
    try {
      const session = await api.billing.checkout({
        planKey,
        interval,
        returnUrl: window.location.origin,
      });
      // Stripe hosts the card form — no card details ever touch this app.
      window.location.assign(session.url);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Could not start checkout.");
      setBusy(null);
    }
  }

  const trial = sub?.status === "trialing";
  const readOnly = sub ? !sub.canWrite : false;

  return (
    <div className="page-stack">
      <Sheet
        eyebrow="ENGINE 05 · PAYMENTS"
        title="Billing"
        note="Stripe hosts the card form — no card details reach this system"
      >
        {error && (
          <PanelCard label="REFUSED">{error}</PanelCard>
        )}

        {!sub && !error && <PanelCard label="LOADING">Reading your subscription…</PanelCard>}

        {sub && (
          <>
            <PanelCard label="CURRENT PLAN" accent>
              <div style={{ display: "grid", gap: 6 }}>
                <div>
                  <strong>{sub.plan?.name ?? "None"}</strong> · {sub.status}
                  {trial && sub.trialDaysRemaining !== null && (
                    <> · {sub.trialDaysRemaining} {sub.trialDaysRemaining === 1 ? "day" : "days"} left</>
                  )}
                </div>
                <div className="muted">{sub.reason}</div>
                {sub.usage && (
                  <div className="muted">
                    {sub.usage.seats.used}/{sub.usage.seats.limit} seats ·{" "}
                    {sub.usage.nodes.used}/{sub.usage.nodes.limit} active market nodes
                  </div>
                )}
              </div>
            </PanelCard>

            {readOnly && (
              <PanelCard label="READ-ONLY">
                New work is refused until there is an active plan. Nothing you recorded has been
                deleted or hidden — every record, receipt and canon entry is still readable, and
                writing resumes the moment a plan is active.
              </PanelCard>
            )}

            {billing && !billing.configured && (
              <PanelCard label="CHECKOUT UNAVAILABLE">
                {billing.reason} No charge can be created from this deployment, so no upgrade button
                is shown — rather than offering one that cannot work.
              </PanelCard>
            )}

            {billing?.configured && !billing.webhookConfigured && (
              <PanelCard label="WEBHOOK NOT CONFIGURED">
                Checkout will work, but <code className="mono">STRIPE_WEBHOOK_SECRET</code> is not
                set, so a completed payment will not activate the plan automatically. Set it before
                selling.
              </PanelCard>
            )}

            {billing?.configured && (
              <>
                <div className="btn-row" style={{ marginBottom: 12 }}>
                  <button
                    type="button"
                    className={`btn ${interval === "monthly" ? "btn--accent" : ""}`}
                    onClick={() => setInterval("monthly")}
                  >
                    MONTHLY
                  </button>
                  <button
                    type="button"
                    className={`btn ${interval === "annual" ? "btn--accent" : ""}`}
                    onClick={() => setInterval("annual")}
                  >
                    ANNUAL · 2 MONTHS FREE
                  </button>
                </div>

                <div className="two-col">
                  {sub.catalog.map((plan) => (
                    <PanelCard key={plan.key} label={plan.name.toUpperCase()}>
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontSize: 22, fontWeight: 700 }}>
                          {money(interval === "annual" ? plan.annualBilled : plan.monthly, plan.currency)}
                          {!plan.custom && (
                            <span className="muted" style={{ fontSize: 12 }}>
                              {interval === "annual" ? " /year" : " /month"}
                            </span>
                          )}
                        </div>
                        <div className="muted">
                          {plan.includedSeats} seats · {plan.includedNodes} active{" "}
                          {plan.includedNodes === 1 ? "node" : "nodes"}
                        </div>
                        {plan.custom ? (
                          <a className="btn" href={href("/founding-access")}>
                            TALK TO THE FOUNDER
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="btn btn--accent"
                            disabled={busy !== null || plan.key === sub.planKey}
                            onClick={() => upgrade(plan.key)}
                          >
                            {plan.key === sub.planKey
                              ? "CURRENT PLAN"
                              : busy === plan.key
                                ? "OPENING CHECKOUT…"
                                : "CHOOSE PLAN"}
                          </button>
                        )}
                      </div>
                    </PanelCard>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Sheet>
    </div>
  );
}

export function BillingSuccess() {
  return (
    <div className="page-stack">
      <Sheet
        eyebrow="ENGINE 05 · PAYMENTS"
        title="Payment received"
        note="your plan activates when Stripe confirms it — not when this page loads"
      >
        <PanelCard label="WHAT HAPPENS NOW" accent>
          Stripe has taken the payment. Your plan becomes active when the confirming webhook
          arrives, which is usually immediate. This page does not activate anything itself — a
          success page is a redirect, not proof of payment, and this system does not treat one as
          evidence.
        </PanelCard>
        <div className="btn-row">
          <a className="btn btn--accent" href={href("/control")}>
            BACK TO THE CONTROL PLANE
          </a>
          <a className="btn" href={href("/billing")}>
            CHECK PLAN STATUS
          </a>
        </div>
      </Sheet>
    </div>
  );
}

export function BillingCancel() {
  return (
    <div className="page-stack">
      <Sheet eyebrow="ENGINE 05 · PAYMENTS" title="Checkout cancelled" note="nothing was charged">
        <PanelCard label="NO CHARGE WAS MADE">
          You left the checkout before completing it. No payment was taken and your plan is
          unchanged.
        </PanelCard>
        <div className="btn-row">
          <a className="btn btn--accent" href={href("/billing")}>
            BACK TO BILLING
          </a>
          <a className="btn" href={href("/control")}>
            CONTROL PLANE
          </a>
        </div>
      </Sheet>
    </div>
  );
}
