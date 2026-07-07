import { useEffect, useState } from 'react';

export type Palette = 'cyan' | 'mint' | 'amber' | 'violet';
export type Texture = 'graph' | 'dots' | 'plain';

export interface DraftingRoomState {
  palette: Palette;
  texture: Texture;
  grid: number;
}

export const DEFAULT_DRAFTING_ROOM: DraftingRoomState = {
  palette: 'cyan',
  texture: 'graph',
  grid: 36,
};

const STORAGE_KEY = 'fable5.draftingRoom';
const PALETTES: Palette[] = ['cyan', 'mint', 'amber', 'violet'];
const TEXTURES: Texture[] = ['graph', 'dots', 'plain'];

function clampGrid(n: number): number {
  if (Number.isNaN(n)) return DEFAULT_DRAFTING_ROOM.grid;
  return Math.min(64, Math.max(20, Math.round(n / 4) * 4));
}

function load(): DraftingRoomState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DRAFTING_ROOM };
    const saved = JSON.parse(raw);
    return {
      palette: PALETTES.includes(saved.palette) ? saved.palette : DEFAULT_DRAFTING_ROOM.palette,
      texture: TEXTURES.includes(saved.texture) ? saved.texture : DEFAULT_DRAFTING_ROOM.texture,
      grid: clampGrid(saved.grid),
    };
  } catch {
    return { ...DEFAULT_DRAFTING_ROOM };
  }
}

function persist(state: DraftingRoomState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / storage disabled — controls still work in-memory */
  }
}

function apply(state: DraftingRoomState): void {
  const root = document.documentElement;
  root.setAttribute('data-palette', state.palette);
  root.setAttribute('data-texture', state.texture);
  root.style.setProperty('--grid-size', `${state.grid}px ${state.grid}px`);
}

export function useDraftingRoom() {
  const [state, setState] = useState<DraftingRoomState>(() => {
    const s = load();
    apply(s);
    return s;
  });

  useEffect(() => {
    apply(state);
    persist(state);
  }, [state]);

  function setPalette(palette: Palette) {
    setState((s) => ({ ...s, palette }));
  }
  function setTexture(texture: Texture) {
    setState((s) => ({ ...s, texture }));
  }
  function setGrid(grid: number) {
    setState((s) => ({ ...s, grid: clampGrid(grid) }));
  }
  function reset() {
    setState({ ...DEFAULT_DRAFTING_ROOM });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }

  return { state, setPalette, setTexture, setGrid, reset, palettes: PALETTES, textures: TEXTURES };
}
