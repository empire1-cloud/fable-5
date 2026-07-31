import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "fable5:";

function readStorage<T>(key: string, initial: T): T {
  if (typeof window === "undefined") return initial;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return initial;
    return JSON.parse(raw) as T;
  } catch {
    return initial;
  }
}

/**
 * Small localStorage-backed state hook. Every workspace that persists demo
 * state (theme, mission-queue edits, evidence advancement, allocation
 * tweaks) goes through this one hook so persistence stays in one place and
 * a future backend can replace it without touching components.
 */
export function useLocalStorage<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readStorage(key, initial));
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFIX + keyRef.current, JSON.stringify(value));
    } catch {
      // storage unavailable (private mode, quota) — demo state stays in-memory only.
    }
  }, [value]);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue(next);
  }, []);

  return [value, set];
}
