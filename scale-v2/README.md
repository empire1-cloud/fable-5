# FABLE-5 Scale Evolution · REV 2.0

This directory evolves FABLE-5 without deleting or replacing the existing implementation.

FABLE-5 remains the complete nine-engine, evidence-governed company control plane:

- 00 Strategic Intelligence
- 01 Market Intelligence
- 02 Product & Offer
- 03 Asset Factory
- 04 Growth & Distribution
- 05 Monetization & Finance
- 06 Global Scaling
- 07 Governance · Memory · Verification
- 08 Capital & Resource Allocation

Engine 07 is the substrate beneath every engine. Billing is one Engine 05 adapter; it is not the product trunk.

## Included

- Same-origin server-authoritative control plane UI and API
- All nine engines in the interactive Sheet 01 system map
- PostgreSQL shared-schema tenancy with transaction-local RLS
- Organization login and hashed server sessions
- Engine 00 deterministic opportunity ranking
- Evidence gates that refuse skipped progress
- Independent verification before VERIFIED
- Supported learning before LEARNED
- Explicit canon promotion before CANONIZED
- Engine 08 Intent Token verdicts with `executed: false` by default
- Unified engine work graph, handoffs, canon, contradictions, escalations, outbox, subscriptions, and entitlements
- Raw Stripe ingress quarantined before tenant resolution
- Node domain tests

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

Open `http://localhost:3001`.

## Honest boundary

This is a production candidate. Public production status requires receipts for clean migration and rerun, RLS cross-tenant denial, backup/restore, restart recovery, session revocation, Stripe replay when enabled, load testing, TLS, secrets, retention, and alerting.
