# FABLE-5

An evidence-governed company control plane. Work does not count because an agent says it is done, and money does not move because an agent decided to spend it. Both require a receipt.

Two rules run through everything here:

- **Evidence before progress.** A claim advances through the evidence state machine only when the required proof exists. Skipped states are refused.
- **Permission before spend.** No valid Intent Token means no spend. A token authorizes an action; it never claims the action happened.

## Repository layout

| Path | What it is |
|---|---|
| `scale-v2/` | REV 2.0 control plane — server-authoritative API and UI, PostgreSQL with transaction-local RLS, all nine engines. The active line of work. |
| `app/` | React + Vite control plane front end |
| `backend/` | Cofounder execution API surface |
| `site/` | Static blueprint site |

`scale-v2/` evolves FABLE-5 without deleting or replacing the existing implementation. See [`scale-v2/README.md`](scale-v2/README.md) for the engine list and [`scale-v2/PRODUCTION_GATE.md`](scale-v2/PRODUCTION_GATE.md) for what production status would require.

## Intent Tokens

An Intent Token is a scoped permission for spend or high-impact actions.

No valid token → no spend.

A token states exactly:

- who it belongs to
- what action is allowed
- maximum amount and currency
- which vendor or system
- which environment (paper / live)
- when it expires

Every request is checked against these fields. If anything does not match, or the token is missing, revoked, or expired, the action is refused.

Even when a token is valid, execution stays off until an approved connector is deliberately enabled. **Authorised is not the same as executed.**

This is the Anti-Silent-Spend rule, enforced in code — see [`scale-v2/src/domain/spend.js`](scale-v2/src/domain/spend.js).

### Usage

```js
import { evaluateIntentToken } from "./domain/spend.js";

const token = {
  tenantId: "org_123",
  action: "pay_vendor",
  vendorOrSystem: "stripe",
  currency: "USD",
  maxAmount: 10000,
  environment: "live",
  expiresAt: "2026-12-31T23:59:59Z",
  revoked: false
};

const request = {
  tenantId: "org_123",
  action: "pay_vendor",
  vendorOrSystem: "stripe",
  currency: "USD",
  amount: 2500,
  environment: "live"
};

const verdict = evaluateIntentToken(token, request);

// verdict.allowed  → true/false
// verdict.executed → always false until a connector is enabled
// verdict.code     → e.g. "AUTHORIZED_VERDICT_ONLY" | "TOKEN_MISSING" | "TOKEN_EXPIRED"
// verdict.reason   → human-readable explanation

if (!verdict.allowed) {
  switch (verdict.code) {
    case "TOKEN_MISSING":
      throw new Error("No Intent Token presented — NO VALID TOKEN → NO SPEND.");

    case "TOKEN_EXPIRED":
      throw new Error(
        `Intent Token expired at ${token.expiresAt}. Request a new token before retrying.`
      );

    case "TOKEN_REVOKED":
      throw new Error("Intent Token has been revoked. Permission is no longer valid.");

    case "AMOUNT_EXCEEDED":
      throw new Error(
        `Requested amount exceeds token ceiling of ${token.maxAmount} ${token.currency}.`
      );

    case "TENANT_MISMATCH":
    case "ACTION_MISMATCH":
    case "VENDOR_MISMATCH":
    case "CURRENCY_MISMATCH":
    case "ENVIRONMENT_MISMATCH":
      throw new Error(`Intent Token scope mismatch: ${verdict.reason}`);

    default:
      throw new Error(verdict.reason || "Intent Token check failed.");
  }
}

// Token is valid — still do not move money until an approved connector exists.
// verdict.executed remains false by design.
```

### Refusal codes

Checked in this order, first failure wins:

| Code | Meaning |
|---|---|
| `TOKEN_MISSING` | No token presented |
| `TOKEN_REVOKED` | Token was revoked |
| `TOKEN_EXPIRED` | `expiresAt` is in the past |
| `TENANT_MISMATCH` | Token belongs to another organization |
| `ACTION_MISMATCH` | Requested action is outside token scope |
| `VENDOR_MISMATCH` | Vendor or system is outside token scope |
| `CURRENCY_MISMATCH` | Currency is outside token scope |
| `AMOUNT_EXCEEDED` | Amount is above the token ceiling |
| `ENVIRONMENT_MISMATCH` | Environment is outside token scope |
| `AUTHORIZED_VERDICT_ONLY` | Allowed — and still not executed |

## Run

```bash
cd scale-v2
cp .env.example .env
npm install
npm run migrate
npm run bootstrap
npm test
npm start
```

Opens on `http://localhost:3001`. The test suite starts a real server and needs PostgreSQL reachable at `DATABASE_URL`, plus `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` set — `.env.example` covers both.

The front end in `app/` runs separately:

```bash
cd app
npm install
npm run build
npm test
```

## Honest boundary

`scale-v2` is a production candidate, not production. The full list of receipts still required is in [`PRODUCTION_GATE.md`](scale-v2/PRODUCTION_GATE.md); the short version is clean migration and rerun, RLS cross-tenant denial, backup and restore, restart recovery, session revocation, Stripe replay when enabled, load testing, TLS, secrets, retention, and alerting.

Intent Token **refresh and rotation are not implemented.** `evaluateIntentToken` is the whole of the spend-authority surface today. Any design for refreshing or rotating a token needs its persistence boundary to be a single transaction — verify the old token is still refreshable, create the replacement, revoke the old one, commit — so that one grant can never fan out into two live spend permissions.
