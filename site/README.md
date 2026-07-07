# FABLE-5 · System Blueprint · REV 2.0 — Static Site

> **Note:** this static poster has been evolved into a functional product —
> see [`../app`](../app) for the interactive React/TypeScript Autonomous
> Company Control Plane (clickable engines, a real mission queue, a working
> evidence state machine, etc). This directory is kept as-is per
> **WE EVOLVE, NEVER DELETE**; it remains a valid, dependency-free static
> rendering of the same design source for anyone who just wants the poster.

Standalone static implementation of `project/FABLE-5 System Blueprint v2.dc.html`
(the Claude Design export). Real HTML + CSS + minimal vanilla JavaScript —
no framework, no build step, no backend, and **no dependency on the Claude
Design runtime** (`support.js`, `DCLogic`, `sc-for`/`sc-if`, `{{ }}` templates).

The original `.dc.html` design files in `project/` are preserved untouched.

## How to open it

**Option A — double-click.** Open `site/index.html` directly in any modern
browser (Chrome, Edge, Firefox, Safari). Everything, including the Drafting
Room controls and `localStorage` persistence, works over `file://`.

**Option B — local server** (identical result, nicer URL):

```sh
cd site
python3 -m http.server 8000
# then visit http://localhost:8000/
```

The only network request is Google Fonts (IBM Plex Mono + Space Grotesk).
Offline, the page falls back to system monospace/sans-serif and remains fully
usable.

## Files

| File | Purpose |
|---|---|
| `index.html` | The full blueprint — master title block, Sheets 1–5, closing strip, and the Drafting Room panel markup. All content is static HTML. |
| `css/blueprint.css` | All styling. Palette, texture, and grid scale are driven by CSS custom properties (`--bg`, `--accent`, `--grid-image`, `--grid-size`) plus `data-palette` / `data-texture` attributes on `<html>`. |
| `js/drafting-room.js` | ~120 lines of vanilla JS powering the Drafting Room panel and persisting selections to `localStorage` (key `fable5.draftingRoom`). |

## Drafting Room controls

A compact floating panel (bottom-right, collapsed to a chip by default —
click **◧ DRAFTING ROOM** to expand):

- **Palette** — cyan `#0d1b2e/#7fd4ff` (default) · mint `#101c14/#8affc1` ·
  amber `#1c1410/#ffc46b` · violet `#170f1e/#c9a6ff`
- **Texture** — graph (default) · dots · plain
- **Grid scale** — 20–64 px in 4 px steps (default 36 px)
- **Reset to spec default** — restores cyan/graph/36px and clears storage

Selections persist across reloads via `localStorage`. With JavaScript
disabled the panel stays hidden and the page renders in the default state.

## Fidelity notes

- The default state (cyan · graph · 36px) reproduces the exported v2 design's
  values exactly — typography, spacing, borders, and colors are transcribed
  from the prototype's inline styles.
- The prototype hard-coded its accent-tinted backgrounds as
  `rgba(127,212,255, α)` (cyan at alpha α). The production CSS expresses them
  as `color-mix(in srgb, var(--accent) N%, transparent)` — identical output in
  the default palette, and correctly tinted (rather than stuck on cyan) in the
  mint/amber/violet palettes, matching the design intent of the whole-palette
  swap.
- The prototype was a fixed 1440 px canvas. The production page is 1440 px at
  desktop widths (pixel-matching the export) and adds responsive breakpoints
  at 1180 px and 720 px so the long-scroll blueprint stays usable on tablets
  and phones; the Evidence State Machine table scrolls horizontally inside its
  own container on small screens.
