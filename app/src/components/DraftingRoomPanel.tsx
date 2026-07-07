import React, { useState } from 'react';
import { useDraftingRoom, DEFAULT_DRAFTING_ROOM, type Palette, type Texture } from '../state/draftingRoom';

const PALETTE_SWATCH: Record<Palette, { bg: string; accent: string; label: string }> = {
  cyan: { bg: '#0d1b2e', accent: '#7fd4ff', label: 'CYAN' },
  mint: { bg: '#101c14', accent: '#8affc1', label: 'MINT' },
  amber: { bg: '#1c1410', accent: '#ffc46b', label: 'AMBER' },
  violet: { bg: '#170f1e', accent: '#c9a6ff', label: 'VIOLET' },
};

export default function DraftingRoomPanel() {
  const { state, setPalette, setTexture, setGrid, reset } = useDraftingRoom();
  const [open, setOpen] = useState(false);

  return (
    <aside className="drafting-room">
      <button
        className="dr-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="dr-body"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dr-toggle-mark" aria-hidden="true">◧</span> DRAFTING ROOM
      </button>
      {open && (
        <div className="dr-body" id="dr-body">
          <div className="dr-group" role="group" aria-label="Palette">
            <div className="dr-label">PALETTE</div>
            <div className="dr-options">
              {(Object.keys(PALETTE_SWATCH) as Palette[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className="dr-swatch"
                  aria-pressed={state.palette === p}
                  title={PALETTE_SWATCH[p].label}
                  onClick={() => setPalette(p)}
                >
                  <span
                    className="dr-swatch-chip"
                    style={
                      {
                        '--sw-bg': PALETTE_SWATCH[p].bg,
                        '--sw-accent': PALETTE_SWATCH[p].accent,
                      } as React.CSSProperties
                    }
                  />
                  {PALETTE_SWATCH[p].label}
                </button>
              ))}
            </div>
          </div>

          <div className="dr-group" role="group" aria-label="Texture">
            <div className="dr-label">TEXTURE</div>
            <div className="dr-options">
              {(['graph', 'dots', 'plain'] as Texture[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="dr-opt"
                  aria-pressed={state.texture === t}
                  onClick={() => setTexture(t)}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="dr-group">
            <label className="dr-label" htmlFor="dr-grid">
              GRID SCALE <span className="dr-grid-val">{state.grid}px</span>
            </label>
            <input
              id="dr-grid"
              type="range"
              min={20}
              max={64}
              step={4}
              value={state.grid}
              onChange={(e) => setGrid(Number(e.target.value))}
            />
          </div>

          <button type="button" className="dr-reset" onClick={reset}>
            RESET TO SPEC DEFAULT
          </button>
          <div className="dr-note">
            default — {PALETTE_SWATCH[DEFAULT_DRAFTING_ROOM.palette].label.toLowerCase()} ·{' '}
            {DEFAULT_DRAFTING_ROOM.texture} · {DEFAULT_DRAFTING_ROOM.grid}px
          </div>
        </div>
      )}
    </aside>
  );
}
