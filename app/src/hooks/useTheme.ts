import { useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { Palette, Texture } from "../types";

const DEFAULTS = { palette: "cyan" as Palette, texture: "graph" as Texture, grid: 36 };

/**
 * Drafting Room theme controls — palette / texture / grid — driven by CSS
 * custom properties on the document root and persisted to localStorage.
 * Any component can call this; App mounts it once and every workspace that
 * needs to read the current theme (e.g. the status bar) can call it too
 * since the underlying storage is shared and reactive within a render.
 */
export function useTheme() {
  const [palette, setPalette] = useLocalStorage<Palette>("theme:palette", DEFAULTS.palette);
  const [texture, setTexture] = useLocalStorage<Texture>("theme:texture", DEFAULTS.texture);
  const [grid, setGrid] = useLocalStorage<number>("theme:grid", DEFAULTS.grid);

  useEffect(() => {
    document.documentElement.setAttribute("data-palette", palette);
  }, [palette]);

  useEffect(() => {
    document.documentElement.setAttribute("data-texture", texture);
  }, [texture]);

  useEffect(() => {
    document.documentElement.style.setProperty("--grid", `${grid}px`);
  }, [grid]);

  const reset = () => {
    setPalette(DEFAULTS.palette);
    setTexture(DEFAULTS.texture);
    setGrid(DEFAULTS.grid);
  };

  return { palette, setPalette, texture, setTexture, grid, setGrid, reset, defaults: DEFAULTS };
}
