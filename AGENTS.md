# AGENTS.md — FABLE-5 Autonomous Company Control Plane

## Project Layout

Two sibling directories, one repo:

- **`app/`** — The product. React + TypeScript + Vite SPA. All active development lives here.
- **`site/`** — Static HTML poster (earlier implementation of the same design). Kept per **WE EVOLVE, NEVER DELETE**. Do not modify unless explicitly asked.

## Quick Start

```sh
cd app
npm install
npm run dev        # http://localhost:5173
```

## Build & Verify

```sh
cd app
npm run build      # tsc --noEmit && vite build → dist/
```

There is **no test runner, no linter, no formatter** configured. TypeScript strict mode (`tsconfig.json`) is the only verification gate. `npm run build` is the CI-equivalent check — it must pass with zero errors.

## Dev Server Proxy

Vite proxies `/api/*` to `http://127.0.0.1:8000` (the `empire_auto_cofounder` FastAPI backend). The rewrite strips the `/api` prefix:

```
fetch('/api/brief')  →  http://127.0.0.1:8000/brief
```

When the backend is offline, the app falls back to seed data and shows an offline banner. This is by design — the app is local-first and backend-optional.

## Architecture (app/src/)

```
types/index.ts       Domain model — single source of truth for all data types
data/                Seed/demo data (missions, evidence, resources, governance, genomes)
lib/                 Pure logic — evidence state machine, governance rules, selectors, router, decisionEngine
state/               React state — AppState reducer + localStorage persistence, selection, draftingRoom
components/          Shared UI — Shell (app frame + nav), DraftingRoomPanel, DecisionEngine, ui.tsx
pages/               One file per workspace (Home, Blueprint, ControlPlane, Evidence, Genomes, Allocation, Governance, Memory)
hooks/               useEmpireCofounder (live API hydration hook)
styles/app.css       All styling — CSS custom properties for theming
```

## Critical Invariants

1. **Evidence State Machine** (`src/lib/evidence.ts`): States advance strictly PROPOSED → AUTHORIZED → EXECUTED → RECEIPTED → VERIFIED → MEASURED → LEARNED → CANONIZED. No skips. `canAdvance()` is the single gate — never bypass it.

2. **Anti-Silent Spend** (`src/lib/governance.ts`): Financial missions/resources require a valid (unrevoked, unexpired) Intent Token. `validTokens()` and `withinAuthority()` are the enforcement functions. NO VALID TOKEN → NO SPEND.

3. **WE EVOLVE, NEVER DELETE**: `site/` and any `*.dc.html` files are preserved. Never delete old implementations — extend forward.

## Routing

Custom ~20-line hash router at `src/lib/router.tsx`. No router library. Routes are `#/blueprint`, `#/control-plane`, `#/memory`, etc. Works from `file://` or any static host.

## Styling

Plain CSS (`src/styles/app.css`). No CSS framework. Theming via CSS custom properties (`--bg`, `--accent`, `--grid-image`, `--grid-size`) controlled by the Drafting Room panel. Palette/texture/grid stored in `localStorage` under key `fable5.draftingRoom`.

## State Management

`useReducer` in `AppState.tsx`. No external state library. All mutable demo state persists to `localStorage`. The `useEmpireCofounder` hook optionally hydrates state from the live API, falling back to seed data.

## Adding a New Workspace

1. Create `src/pages/YourPage.tsx`
2. Add route case in `src/App.tsx` `routeComponent()`
3. Add nav entry in `src/components/Shell.tsx` `NAV` array

## Key Components

**Decision Engine** (`src/components/DecisionEngine.tsx` + `src/lib/decisionEngine.ts`):
Weighted multi-criteria ranking engine. Scores opportunities across six dimensions (confidence, strategic value, expected return, cost, reversibility, time to proof). Exposes `rankOpportunity()`, `rankAll()`, `tradeOffs()` with per-dimension contribution breakdowns. Rendered inline on the Control Plane page between Opportunity Graph and Mission Queue.

**Memory & Learning** (`src/pages/Memory.tsx`, route `#/memory`):
The system's memory workspace. Surfaces canon entries (patterns, primitives, anti-patterns, economic/market rules, negative intelligence) with full evidence-chain tracing back to the originating evidence record. Shows the 8-step learning feedback loop (PROPOSED→CANONIZED), evidence records awaiting canonization, and kind-filtered canon browsing. Each canon entry displays its reuse conditions.

## Gotchas

- No `node_modules` install scripts or postinstall hooks — safe to `npm install` without auditing.
- `dist/` uses `base: './'` — fully static, deployable anywhere including `file://`.
- The `build` script runs `tsc --noEmit` first — type errors block the build even if Vite would succeed.
- Fonts load from Google Fonts (IBM Plex Mono + Space Grotesk). Falls back to system fonts offline.
- The backend API is optional. The app is fully functional with seed data alone.
