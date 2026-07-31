import type { EpistemicType } from "./enums";

export interface Opportunity {
  id: string;
  title: string;
  score: number; // ranking score, 0-100
  evidence: string[];
  assumptions: string[];
  epistemicType: EpistemicType;
  expectedValue: number; // demo currency units
  confidence: number; // 0-1
  risk: "low" | "medium" | "high";
  dependencies: string[];
  nextExperiment: string;
}
