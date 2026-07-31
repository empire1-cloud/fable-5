import type { ResourceType } from "./enums";

export interface AllocationScore {
  expectedReturn: number; // 0-100, evidence-weighted
  confidence: number; // 0-1, calibrated
  strategicValue: number; // 0-100
  learningValue: number; // 0-100, information per dollar
  cost: number; // demo currency units, full cost incl. attention
  reversibility: number; // 0-100, higher = cheaper to undo
  timeToProofDays: number;
  risk: "low" | "medium" | "high";
}

export interface AllocationTarget {
  id: string;
  targetType: "opportunity" | "market-node";
  targetRefId: string;
  label: string;
  score: AllocationScore;
  allocated: Partial<Record<ResourceType, number>>;
}

export interface ResourceAllocation {
  resourceType: ResourceType;
  total: number;
  committed: number;
  reserve: number;
}
