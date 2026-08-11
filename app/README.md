# FABLE-5 · Autonomous Company Control Plane

The first functional FABLE-5 product — a React + TypeScript + Vite application
that turns the six-panel REV 2.0 blueprint (`project/FABLE-5 System Blueprint
v2.dc.html`) from a static diagram into an operating surface: engines you can
inspect, a mission queue you can filter, evidence records you can (attempt to)
advance under real rules, genomes you can drill into, resources you can
allocate, and governance controls that actually gate what the demo state will
let you do.

This evolves `site/` (the earlier static HTML poster) rather than replacing
it — both are kept per **WE EVOLVE, NEVER DELETE**. `app/` is the current
product; `site/` remains as an earlier, valid implementation of the same
design source.

## Run it

```sh
cd app
npm install
npm run dev       # http://localhost:5173
```

For full functionality including billing (SHEET 7), you must also run the
backend server:

```sh
# In a separate terminal, from the fable-5 root:
cd backend
npm install
npm run dev       # http://localhost:3001
```

Then set the frontend API base URL by creating a `.env` file in `app/`:
```
VITE_API_BASE=http://localhost:3001
```

Production build:

```sh
npm run build      # runs `tsc --noEmit` then `vite build` → dist/
npm run preview    # serve the built dist/ locally
```

The `dist/` folder is static except for the billing feature, which requires
the backend to be running and pointed to by `VITE_API_BASE`.

## What's real vs. simulated

This is a **local-first product MVP**, architected to be backend-ready but
not pretending to have a backend today:

- **Real**: all navigation, filtering, inspection, the evidence state-machine
  transition rules, autonomy-boundary checks, Token validity checks,
  resource-allocation math, and `localStorage` persistence of demo state and
  preferences.
- **Simulated demo data**: signals, opportunities, missions, evidence
  records, genomes, market nodes, and Intent Tokens are realistic seed data
  in `src/data/`, not live feeds. Advancing an evidence record in the UI
  updates local demo state only — it never claims an external system
  executed anything. Financial missions and financial resource allocation
  stay blocked without a valid, unexpired, unrevoked Intent Token, exactly
  as the design requires (**NO VALID TOKEN → NO SPEND**).
- **Billing integration**: The billing workspace (SHEET 7) integrates with a
  backend service (see `backend/` directory) to create Stripe Checkout
  Sessions. Without the backend running, the billing buttons will show an
  error.

## Architecture

```
src/
  types/        Domain model (Engine, Signal, Opportunity, Mission,
               EvidenceRecord, CompanyGenome, MarketNode, IntentToken, …)
  data/         Seed/demo data only — no components import raw JSON inline
  lib/          Pure logic: evidence state machine, governance/autonomy
               rules, selectors, hash router
  state/        React state: AppState (mutable demo state + localStorage),
               draftingRoom (palette/texture/grid), selection (node context)
  components/   Shared UI: Shell (app frame + nav), DraftingRoomPanel, ui.tsx
  pages/        One file per workspace (Home, Blueprint, ControlPlane,
               Evidence, Genomes, Allocation, Governance, Billing)
  styles/       app.css — all styling, CSS custom properties for theming
```

Routing is a ~20-line hash router (`src/lib/router.tsx`) — no router
dependency, works from `file://` or any static host without server config.

## Workspaces

| Route | Sheet | What it does |
|---|---|---|
| `/` | — | First-run overview: live system snapshot + entry points |
| `/blueprint` | 1 | All 9 engines as clickable cards; inspect inputs, outputs, KPIs, receipts, escalation, and connections |
| `/control-plane` | 2 | Signals → Opportunity Graph → Mission Queue, with real filtering and a mission inspector |
| `/evidence` | 3 | The evidence state machine — advance/blocked buttons reflect real requirement checks, never fake "verified" |
| `/genomes` | 4 | Company Genome sections, maturity ladder, proven-vs-unproven evidence coverage |
| `/allocation` | 5 | Per-resource allocation sliders, portfolio view, typed economic gates, kill logic |
| `/governance` | 6 | Autonomy ladder with an adjustable granted boundary, Intent Tokens (revocable), canon/memory, and the Drafting Room reference |
| `/billing/*` | 7 | Subscription and billing management (requires backend server) |

## Drafting Room (visual controls)

The floating **◧ DRAFTING ROOM** panel (bottom-right, every workspace) exposes:

- **Palette** — cyan (default) · mint · amber · violet
- **Texture** — graph (default) · dots · plain
- **Grid scale** — 20–64px (default 36px)

Implemented with CSS custom properties (`--bg`, `--accent`, `--grid-image`,
`--grid-size`) and `data-palette` / `data-texture` attributes on `<html>`.
Selections persist via `localStorage` (`fable5.draftingRoom`).

## Integrity rules, enforced in code (not just documented)

- **Anti-Fake Progress** — `src/lib/evidence.ts` computes `canAdvance()` for
  every evidence record; the UI can only show "Advance → X" as enabled when
  every requirement for that transition is genuinely met. Unmet requirements
  are listed, not hidden.
- **Anti-Silent Spend** — financial missions and financial resources
  (`cash`) require a **valid** (`!revoked && !expired`) Intent Token before
  they can be authorized or allocated; `src/lib/governance.ts` is the single
  source of truth for that check.
- **Anti-Hostage Infrastructure** — zero dependency on the Claude Design
  runtime. `support.js`, `DCLogic`, `sc-for`/`sc-if`, and `{{ }}` templating
  do not exist anywhere in `app/`.
- **We Evolve, Never Delete** — `project/*.dc.html` are untouched; `site/`
  (the earlier static implementation) is kept alongside this app.

## Known limitations (by design, for this MVP)

- Demo data is illustrative (not live market/company data).
- The hash router has no nested routes or code-splitting — fine at this scale; revisit if the app grows materially.
- `localStorage` is per-browser; there is no cross-device sync.

## Extending the MVP

- To add new routes, edit `src/lib/router.tsx`.
- To add persistent storage, integrate with the backend API (see `backend/` directory).
---

## Independence and attribution

FABLE-5 is an independent product of Empire-1. It is not affiliated with,
endorsed by, sponsored by, or built in partnership with Anthropic or any other
AI vendor. AI assistants — including Anthropic's Claude models — were used as
engineering and design tools while building this system. The governance model,
evidence state machine, and control-plane architecture are Empire-1's own work.
The product name is our own and is not a claim of association with any vendor,
model, or trademark that may share similar wording.
