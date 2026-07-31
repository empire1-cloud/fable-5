// DEMO DATA — Capital & Resource Allocation (Engine 08). Adjustable in the
// UI as local demo state; a reserve is always held unallocated.
import type { AllocationTarget, ResourceDef, ResourceType } from "../types";
import { RESOURCE_TYPES } from "../types";

export const resourcePools: ResourceDef[] = RESOURCE_TYPES.map((resourceType) => {
  const seed: Record<ResourceType, { capacity: number; unit: string; step: number; financial: boolean }> = {
    "founder time": { capacity: 40, unit: "hours/week", step: 1, financial: false },
    "agent time": { capacity: 2000, unit: "hours/week", step: 10, financial: false },
    cash: { capacity: 500000, unit: "$", step: 1000, financial: true },
    compute: { capacity: 10000, unit: "compute units", step: 50, financial: false },
    "engineering capacity": { capacity: 320, unit: "engineers", step: 1, financial: false },
    "distribution capacity": { capacity: 100, unit: "channels", step: 1, financial: false },
    "partnership bandwidth": { capacity: 20, unit: "partners", step: 1, financial: false },
    "legal effort": { capacity: 60, unit: "hours/week", step: 1, financial: false },
    "operational attention": { capacity: 100, unit: "hours/week", step: 1, financial: false },
  };
  const { capacity, unit, step, financial } = seed[resourceType];
  return { type: resourceType, capacity, unit, step, financial };
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
    allocated: { "agent time": 60, "engineering capacity": 40, "operational attention": 8 },
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
