import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { allocationTargets as demoTargets, resourcePools as demoPools } from "../data/allocation";
import type { AllocationTarget, ResourceAllocation } from "../types/allocation";
import type { ResourceType } from "../types/enums";

/**
 * Local, persisted view over demo Capital & Resource Allocation state. Cash
 * movement is a number on a demo target here — never a real transfer; any
 * financial *action* stays gated behind the Intent Token system (see
 * lib/intentToken.ts and /governance).
 */
export function useAllocation() {
  const [targets, setTargets] = useLocalStorage<AllocationTarget[]>("allocation:targets", demoTargets);
  const [pools, setPools] = useLocalStorage<ResourceAllocation[]>("allocation:pools", demoPools);

  const adjust = useCallback(
    (targetId: string, resourceType: ResourceType, amount: number) => {
      const target = targets.find((t) => t.id === targetId);
      const pool = pools.find((p) => p.resourceType === resourceType);
      if (!target || !pool) return;

      const currentAmount = target.allocated[resourceType] ?? 0;
      const delta = amount - currentAmount;
      if (pool.reserve - delta < 0) {
        // Not enough reserve — refuse the adjustment, keep a reserve held unallocated.
        return;
      }

      setTargets((prev) =>
        prev.map((t) => (t.id === targetId ? { ...t, allocated: { ...t.allocated, [resourceType]: amount } } : t)),
      );
      setPools((prev) =>
        prev.map((p) =>
          p.resourceType === resourceType ? { ...p, committed: p.committed + delta, reserve: p.reserve - delta } : p,
        ),
      );
    },
    [targets, pools, setPools, setTargets],
  );

  const resetDemo = useCallback(() => {
    setTargets(demoTargets);
    setPools(demoPools);
  }, [setTargets, setPools]);

  return { targets, pools, adjust, resetDemo };
}
