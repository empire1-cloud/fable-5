import type { EpistemicType } from "./enums";

export interface Signal {
  id: string;
  source: string;
  category: string;
  confidence: number; // 0-1, calibrated
  epistemicType: EpistemicType;
  timestamp: string; // ISO
  reliability: number; // 0-1, source reliability
  relatedOpportunityId?: string;
}
