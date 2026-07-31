// DEMO DATA — Capital & Resource Allocation (Engine 08). Adjustable in the
// UI as local demo state; a reserve is always held unallocated.
import type { AllocationTarget, ResourceAllocation, ResourceType } from "../types";
import { RESOURCE_TYPES } from "../types";

export const resourcePools: ResourceAllocation[] = RESOURCE_TYPES.map((resourceType) => {
  const seed: Record<ResourceType, { total: number; committed: number }> = {
    "founder time": { total: 40, committed: 22 },
    "agent time": { total: 2000, committed: 1380 },
    cash: { total: 500000, committed: 310000 },
    compute: { total: 10000, committed: 6200 },
    engineering: { total: 320, committed: 210 },
    distribution: { total: 100, committed: 55 },
    partnerships: { total: 20, committed: 6 },
    "legal effort": { total: 60, committed: 18 },
    "operational attention": { total: 100, committed: 68 },
  };
  const { total, committed } = seed[resourceType];
  return { resourceType, total, committed, reserve: total - committed };
});

export const allocationTargets: AllocationTarget[] = [
  {
    id: "alloc-opp-001",
    targetType: "opportunity",
    targetRefId: "opp-001",
    label: "SMB invoice-chasing copilot (SaaS wedge)",
    score: {
      expectedReturn: 62,
      confidence: 0.64,
      strategicValue: 58,
      learningValue: 74,
      cost: 1200,
      reversibility: 88,
      timeToProofDays: 10,
      risk: "medium",
    },
    allocated: { "agent time": 60, engineering: 40, "operational attention": 8 },
  },
  {
    id: "alloc-node-mx",
    targetType: "market-node",
    targetRefId: "node-latam-fintech-mx",
    label: "LATAM fintech node — Mexico (Scaling)",
    score: {
      expectedReturn: 91,
      confidence: 0.91,
      strategicValue: 88,
      learningValue: 40,
      cost: 85000,
      reversibility: 32,
      timeToProofDays: 0,
      risk: "low",
    },
    allocated: { cash: 85000, "agent time": 400, engineering: 90, distribution: 30 },
  },
  {
    id: "alloc-node-co",
    targetType: "market-node",
    targetRefId: "node-latam-fintech-co",
    label: "LATAM fintech node — Colombia (Validating)",
    score: {
      expectedReturn: 55,
      confidence: 0.5,
      strategicValue: 70,
      learningValue: 66,
      cost: 12000,
      reversibility: 70,
      timeToProofDays: 35,
      risk: "medium",
    },
    allocated: { cash: 12000, "agent time": 120, "legal effort": 10 },
  },
  {
    id: "alloc-opp-003",
    targetType: "opportunity",
    targetRefId: "opp-003",
    label: "AI outcome-verification product (new vertical)",
    score: {
      expectedReturn: 24,
      confidence: 0.31,
      strategicValue: 45,
      learningValue: 55,
      cost: 4000,
      reversibility: 82,
      timeToProofDays: 21,
      risk: "high",
    },
    allocated: { "agent time": 40, "founder time": 2 },
  },
];
