import { Sheet, PanelCard } from "../../components";

export function Billing() {
  return (
    <div className="page-stack">
      <Sheet
        eyebrow="ENGINE 05 · PAYMENTS"
        title="Money is not wired yet — on purpose"
        note="This control plane has no payment rail. Nothing on this page can charge you."
      >
        <PanelCard label="VERDICT ONLY, NEVER PAYMENT" accent>
          Engine 05 is the Stripe adapter slot. It is <strong>not provisioned</strong>. Every spend
          path on this system returns a <code className="mono">verdict</code> — an Intent Token
          check answers "may this action proceed?" and hard-codes{" "}
          <code className="mono">executed: false</code>. There is no checkout session, no plan, and
          no billing record to create.
        </PanelCard>
        <div className="two-col">
          <PanelCard label="WHAT THIS MEANS FOR YOU">
            You are not on a subscription tier. Founding Access is granted directly by the founder
            of FABLE-5, not purchased here. When Engine 05 is wired to a real processor, this page
            becomes the adapter's surface — until then it refuses rather than faking a payment.
          </PanelCard>
          <PanelCard label="IF YOU NEED OUTBOUND SPEND">
            Spend needs a founder-approved Intent Token with a scope, a cap, and an environment.
            The verdict is recorded as evidence. If you believe you should be able to pay, raise
            it as a contradiction against the claim "Engine 05 is not provisioned" — that is the
            mechanism this system uses to track its own gaps.
          </PanelCard>
        </div>
      </Sheet>
    </div>
  );
}

export function BillingSuccess() {
  return (
    <div className="page-stack">
      <Sheet eyebrow="ENGINE 05 · PAYMENTS" title="No payment happened" note="">
        <p className="card-footnote">
          This control plane has no payment rail. A checkout cannot succeed here by design. If a
          real processor has been wired since this page was reached, that is Engine 05 going live —
          verify it against the control plane's own evidence rather than trusting this message.
        </p>
      </Sheet>
    </div>
  );
}

export function BillingCancel() {
  return (
    <div className="page-stack">
      <Sheet eyebrow="ENGINE 05 · PAYMENTS" title="No payment was cancelled" note="">
        <p className="card-footnote">
          There is nothing to cancel: this system does not move money. Spend verdicts are refused
          until a founder-approved Intent Token scopes them, and execution stays false until an
          approved connector exists.
        </p>
      </Sheet>
    </div>
  );
}
