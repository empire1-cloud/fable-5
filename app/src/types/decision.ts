import type { AutonomyLevel } from "./enums";

export interface Decision {
  id: string;
  question: string;
  evidence: string[];
  confidence: number; // 0-1
  upside: string;
  downside: string;
  reversibility: "reversible" | "costly-to-reverse" | "irreversible";
  cost: number;
  requiredAuthority: AutonomyLevel;
  nextVerificationEvent: string;
}
