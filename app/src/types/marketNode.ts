import type { AutonomyLevel, GateType, NodeStatus, RecordStatus } from "./enums";

export interface MarketNode {
  id: string;
  genomeId: string;
  geography: string;
  vertical: string;
  segment: string;
  offer: string;
  localModules: string[];
  typedGate: GateType;
  evidenceState: RecordStatus;
  autonomyLevel: AutonomyLevel;
  resourceAllocation: number; // demo currency units committed
  status: NodeStatus;
}
