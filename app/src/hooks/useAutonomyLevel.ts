import { useLocalStorage } from "./useLocalStorage";
import type { AutonomyLevel } from "../types";

/** The current founder-set authority boundary, persisted and shown app-wide. */
export function useAutonomyLevel() {
  const [level, setLevel] = useLocalStorage<AutonomyLevel>("governance:autonomy-level", "L3");
  return { level, setLevel };
}
