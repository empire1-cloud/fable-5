import type { AutonomyLevel, MissionStatus } from "./enums";

export interface Mission {
  id: string;
  objective: string;
  sourceOpportunityId: string;
  engineId: string;
  owner: string;
  autonomyLevel: AutonomyLevel;
  status: MissionStatus;
  successCriteria: string;
  evidenceRequirement: string;
  blocker?: string;
  escalationCondition: string;
  /** True once the user has made a local demo-state change to this mission. */
  locallyModified?: boolean;
}
