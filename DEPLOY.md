# Deploying FABLE-5

The live site at `fable-5-omega.vercel.app` serves only `app/dist` — a static
bundle with no API behind it. Every `/api/*` call lands on static hosting, and
a POST there returns **405**. That is why founding access fails; sign-in and
the control plane fail the same way.

This guide puts the real `scale-v2` control plane online and points the front
end at it. Nothing here reimplements the server for a serverless runtime — the
deployed process is the same Express app the test suite covers, so what ships
is what is tested.

---

## What you are deploying

| Piece | Where it goes | Why |
|---|---|---|
| `scale-v2` | Render (Docker web service) | Long-lived Express process + a real connection pool. |
| PostgreSQL | Render managed database | Row-level security needs a real Postgres, not an edge KV. |
| `app` | Vercel (already there) | Static bundle; only needs `VITE_API_BASE` set. |

---

## 1 — Provision the API and its database

In Render: **New → Blueprint**, point it at this repository. It reads
[`render.yaml`](render.yaml) and creates a `fable5-control-plane` web service
plus a `fable5-db` PostgreSQL instance.

Render will ask for the values marked `sync: false`. They are not in the
blueprint on purpose — they are secrets or your own address, and a config file
should not decide them:

| Variable | What to put |
|---|---|
| `APP_ORIGIN` | `https://fable-5-omega.vercel.app` (comma-separate more origins if you add a custom domain) |
| `BOOTSTRAP_TENANT_NAME` | Your organisation name, e.g. `Empire-1` |
| `BOOTSTRAP_ADMIN_EMAIL` | The founder account's email |
| `BOOTSTRAP_ADMIN_PASSWORD` | A strong password you choose — this is your sign-in |
| `DATABASE_URL` | See below |

### Building `DATABASE_URL`

Migrations run as the database **owner** (`DATABASE_ADMIN_URL`, wired in
automatically). The app itself connects as `fable5_app`, a role that is
`NOSUPERUSER` and `NOBYPASSRLS` — so tenant isolation cannot be bypassed even
by the application's own credentials. That separation is the point, so the two
URLs are not interchangeable.

Render generates `APP_DB_PASSWORD` for you. Take the `Internal Database URL`
it shows for `fable5-db` and swap the credentials for the app role:

```
postgres://fable5_app:<APP_DB_PASSWORD>@<internal-host>/<database>
```

Copy `APP_DB_PASSWORD` from the service's Environment tab after the first
deploy attempt, paste the assembled URL into `DATABASE_URL`, and redeploy.

> **Why not automatic:** Render cannot interpolate one secret into another
> variable. This is the one manual step, and it is deliberate — it is also the
> moment the app credential stops being the default committed in this repo.

---

## 2 — Create the founder account

Migrations run automatically on every deploy (`start:deploy` runs
`migrate` then `server`, and migrations are idempotent and transactional).
Bootstrapping the founder is a **one-time, explicit** step — the system does
not invent an owner for you.

In Render → your service → **Shell**:

```bash
npm run bootstrap
```

This creates the tenant, the founder user, and the nine resource pools. It is
safe to re-run; it upserts.

Optionally, to see the Company Genome workspace populated:

```bash
npm run seed:demo-genome
```

Deliberately **not** part of `bootstrap`: a real organisation starts with no
validated genome, and inventing one is exactly the fake progress this system
refuses.

---

## 3 — Point the front end at the API

In Vercel → project → **Settings → Environment Variables**:

```
VITE_API_BASE = https://<your-render-service>.onrender.com
```

Then **redeploy** the Vercel project. `VITE_API_BASE` is read at *build* time,
not at runtime — setting it without redeploying changes nothing.

---

## 4 — Verify

```bash
# API is up and its database is reachable (this fails closed if Postgres is down)
curl https://<your-render-service>.onrender.com/api/health

# CORS allows your front end
curl -s -D- -o/dev/null -H "Origin: https://fable-5-omega.vercel.app" \
  https://<your-render-service>.onrender.com/api/health | grep -i access-control-allow-origin
```

Then on the live site: submit founding access (should succeed, not 405), and
sign in with the bootstrap credentials.

---

## Refusals you should expect

These are guards, not bugs. Each one fails closed rather than running in an
unsafe configuration:

| Symptom | Meaning |
|---|---|
| `APP_DB_PASSWORD is required when NODE_ENV=production` | Refusing to leave the `fable5_app` role on the default password committed to this repository. |
| `APP_ORIGIN is required when NODE_ENV=production` | Refusing to accept requests from any origin. Name your front ends. |
| `startup_refused … ECONNREFUSED` | Postgres unreachable. The process exits 1 instead of serving a broken API. |
| Front end says *"No API is configured for this site"* | `VITE_API_BASE` was unset at build time, or the build predates setting it. Redeploy Vercel. |

---

## What was verified, and what was not

Verified in this environment, against a real PostgreSQL:

- Migrations run cleanly on a database **not** named `fable5` — the previous
  `GRANT CONNECT ON DATABASE fable5` was hardcoded and would have failed on
  every managed provider.
- `npm run start:deploy` (the container's exact command) with
  `NODE_ENV=production`: migrations apply, the `fable5_app` password rotates to
  `APP_DB_PASSWORD`, the server boots, `/api/health` returns 200.
- Password rotation survives quotes and special characters in the secret.
- CORS: an allowed origin receives `Access-Control-Allow-Origin`; a foreign
  origin receives none.
- Both production guards refuse to boot, exit code 1.
- Full suites still green: 29/29 `scale-v2`, 52/52 `app`.

**Not verified here:** the Docker image build itself. This environment has the
Docker CLI but no daemon, so `docker build` could not run. The Dockerfile is
straightforward (`node:22-slim`, `npm ci --omit=dev`, copy source, non-root
user) and the command it runs is the one tested above — but the first Render
build is the first time the image is actually assembled. Watch that build log.

---

## Billing (Stripe)

Billing is optional and honestly gated. With no key the product still runs:
trials work, the write gate holds, and checkout refuses with a stated reason
rather than inventing a session.

### The live catalog

These Products and Prices already exist in the Stripe account
`acct_1U4Q28DnczZ1gSae` (livemode). Nothing in the code references these IDs —
prices are resolved by metadata — but they are recorded here so the account is
auditable from the repository.

| Plan | Interval | Price ID | Amount |
|---|---|---|---|
| Founding | monthly | `price_1U4QGmDnczZ1gSaeuY3QdzWE` | €299 |
| Founding | annual | `price_1U4QGvDnczZ1gSae2gdRgTd7` | €2,990 |
| Operator | monthly | `price_1U4QH5DnczZ1gSaejsCsKaMd` | €999 |
| Operator | annual | `price_1U4QHEDnczZ1gSaepM7Ynzov` | €9,990 |
| Empire | monthly | `price_1U4QHNDnczZ1gSaeqM5ynb4b` | €2,999 |
| Empire | annual | `price_1U4QHWDnczZ1gSaeEKkqTyEV` | €29,990 |
| Additional market node | monthly | `price_1U4QHeDnczZ1gSaeDJT0Wiqt` | €199 per node |

Each price carries `metadata.plan_key` and `metadata.billing_interval`. That
metadata is how the server finds them — **do not remove it**, and if you create
a replacement price, archive the old one. Two active prices matching the same
plan and interval is an ambiguous charge, and checkout refuses rather than
guessing which one you meant.

### Turning it on

```bash
fly secrets set \
  STRIPE_SECRET_KEY="sk_live_…" \
  STRIPE_WEBHOOK_SECRET="whsec_…" \
  --app fable5-control-plane
```

Then add the webhook endpoint in Stripe → Developers → Webhooks:

```
https://fable5-control-plane.fly.dev/api/billing/webhook
```

Subscribe it to: `checkout.session.completed`,
`customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`. Copy the signing secret into
`STRIPE_WEBHOOK_SECRET`.

To rehearse locally without touching live money, use test-mode keys and the
Stripe CLI:

```bash
stripe listen --forward-to localhost:3001/api/billing/webhook
```

### Payment methods — configured in Stripe, not in code

`createCheckoutSession` deliberately does **not** set `payment_method_types`.
With it unset, Stripe Checkout uses the automatic payment methods enabled in
your Dashboard (*Settings → Payment methods*). Turning SEPA Direct Debit on
therefore needs no code change and no deploy.

That is a real decision with real consequences, so it is written down rather
than left implicit:

- **What customers can actually pay with is a Dashboard setting.** If card is
  the only method enabled, card is the only method offered — the code will not
  tell you.
- **Subscriptions narrow the set.** These are recurring charges, so one-time
  methods (most BNPL, many wallets) will not appear regardless of the toggle.
  In practice: **card**, plus **SEPA Direct Debit** where enabled and the
  customer is in the SEPA zone.
- **Currency is worth a deliberate decision.** The live Stripe prices are in
  **EUR** (see the catalog table above), which was inherited from euro figures
  in demo fixture data — not from a decision about who is being sold to. If the
  first customers are American, USD prices are the ones to create. A Price's
  currency cannot be edited in Stripe: it requires new Prices and archiving the
  old ones, plus changing `CURRENCY` in `src/domain/plans.js`. Cheap now, and
  it must be settled before the first real charge.
- **SEPA Direct Debit** only matters if selling into the SEPA zone. Skip it for
  a US buyer; card is what they expect.
- **A brand-new Stripe account has a limited set until activation completes.**
  Check the Dashboard before assuming a method is live.

If you would rather pin the list in code — auditable, but a deploy is needed to
add a method — set `payment_method_types: ["card", "sepa_debit"]` on the
session in `src/billing.js`.

### Data residency

Both configs pin the region **explicitly** — Fly `iad` (US East), Render `ohio`
for the service *and* its database — rather than accepting a provider default.
Where customer records live should be a decision, not an accident.

US East because the founder and the first customers are in the United States.

**Revisit the day a European customer is real, not before.** An EU buyer of
governance tooling will ask where their records sit, and the answer matters to
them; but choosing a region for a hypothetical buyer while the actual ones are
elsewhere is the wrong trade. (The DACH/VAT genome in this repository is demo
fixture content. It is not a go-to-market plan and should not be read as one.)

Pin the region **before the first customer** either way. Moving a database with
live tenants is painful; moving an empty one is a redeploy. On Fly the Postgres
volume must be created in the same region as the app:

```bash
fly postgres create --name fable5-db --region iad
```

### Guards you should expect

| Refusal | Meaning |
|---|---|
| `503` on checkout, "billing is not configured" | `STRIPE_SECRET_KEY` unset. Deliberate — no charge can be created. |
| `503`, "Refusing to charge a price the product does not show" | Stripe's amount disagrees with `plans.js`. Fix one of them; do not sell until they match. |
| `503`, "Multiple active Stripe prices match" | Duplicate prices for one plan. Archive the extras. |
| `400`, "Missing stripe-signature header" | Something other than Stripe posted to the webhook. |
| `503`, "refusing to trust an unverified webhook body" | `STRIPE_WEBHOOK_SECRET` unset. Without it, anyone reaching the endpoint could grant themselves a plan. |

A completed payment activates the plan **only** via the signed webhook. The
success page is a redirect, not proof of payment, and is never treated as
evidence.
