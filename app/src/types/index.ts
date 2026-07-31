/* FABLE-5 · domain types
   Source of truth for the product's data model. Demo data lives in src/data;
   mutable demo state lives in src/state. */

export type AutonomyLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export type EngineId = '00' | '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08';

export type EngineLayer = 'strategic' | 'pipeline' | 'substrate' | 'governing';

export interface Engine {
  id: EngineId;
  name: string;
  layer: EngineLayer;
  role: string;
  inputs: string[];
  outputs: string[];
  kpis: string[];
  receipts: string[];
  escalation: string[];
  /** What must be true before the next engine may proceed. */
  gate: string;
  connects: EngineId[];
}

export type SignalCategory = 'market' | 'customer' | 'channel' | 'node-kpi' | 'memory';

export type EvidenceGrade = 'A' | 'B' | 'C';

export interface Signal {
  id: string;
  source: string;
  category: SignalCategory;
  summary: string;
  /** 0–1 */
  confidence: number;
  reliability: EvidenceGrade;
  timestamp: string; // ISO date
  opportunityId?: string;
  nodeId?: string;
}

export type EpistemicType = 'fact' | 'inference' | 'forecast' | 'hypothesis' | 'assumption';

export interface EvidenceItem {
  text: string;
  type: EpistemicType;
}

/** Scoring fields shared by allocation targets (opportunities + nodes). */
export interface AllocationScores {
  expectedReturn: string;
  confidence: number; // 0–1
  strategicValue: 'high' | 'medium' | 'low';
  learningValue: 'high' | 'medium' | 'low';
  cost: string;
  reversibility: 'high' | 'medium' | 'low';
  timeToProof: string;
  risk: string;
}

export interface Opportunity {
  id: string;
  title: string;
  /** 0–100 composite rank score */
  score: number;
  evidence: EvidenceItem[];
  assumptions: string[];
  expectedValue: string;
  confidence: number; // 0–1
  risk: string;
  dependencies: string[];
  nextExperiment: string;
  alloc: AllocationScores;
}

export interface Decision {
  id: string;
  question: string;
  evidence: EvidenceItem[];
  assumptions: string[];
  confidence: number;
  upside: string;
  downside: string;
  reversibility: 'high' | 'medium' | 'low';
  cost: string;
  dependencies: string[];
  recommendedAction: string;
  requiredAuthority: AutonomyLevel;
  nextVerificationEvent: string;
}

export type MissionStatus = 'QUEUED' | 'ACTIVE' | 'BLOCKED';

export interface Mission {
  id: string;
  objective: string;
  opportunityId?: string;
  nodeId?: string;
  engineId: EngineId;
  owner: string;
  autonomy: AutonomyLevel;
  status: MissionStatus;
  budget: string;
  successCriteria: string;
  evidenceRequirement: string;
  blocker?: string;
  escalationCondition: string;
  /** Every mission's claims live in exactly one evidence record. */
  evidenceRecordId: string;
  /** True when executing the mission moves money — requires an Intent Token. */
  financial: boolean;
}

export const EVIDENCE_STATES = [
  'PROPOSED',
  'AUTHORIZED',
  'EXECUTED',
  'RECEIPTED',
  'VERIFIED',
  'MEASURED',
  'LEARNED',
  'CANONIZED',
] as const;

export type EvidenceState = (typeof EVIDENCE_STATES)[number];

export type ReceiptType =
  | 'test output'
  | 'diff'
  | 'commit'
  | 'API response'
  | 'deployment log'
  | 'metric'
  | 'screenshot'
  | 'reproducible check'
  | 'verified artifact';

export interface Receipt {
  id: string;
  type: ReceiptType;
  description: string;
  grade: EvidenceGrade;
  attachedAt: string; // ISO datetime
  demo: boolean;
}

export interface Contradiction {
  id: string;
  description: string;
  resolved: boolean;
  resolution?: string;
}

export interface VerificationRecord {
  method: string;
  by: string;
  reproducible: boolean;
  at: string;
}

export interface MeasurementRecord {
  gate: string;
  reading: string;
  verdict: 'CLONE' | 'ITERATE' | 'PAUSE' | 'KILL';
  at: string;
}

export interface AuditEvent {
  at: string;
  actor: string;
  action: string;
  detail?: string;
}

export interface EvidenceRecord {
  id: string;
  missionId: string;
  title: string;
  state: EvidenceState;
  financial: boolean;
  confidence: number; // 0–1, moves with outcomes
  receipts: Receipt[];
  contradictions: Contradiction[];
  verification?: VerificationRecord;
  measurement?: MeasurementRecord;
  audit: AuditEvent[];
}

export type GenomeMaturity = 'Draft' | 'Tested' | 'Verified' | 'Replication-Ready';

export interface GenomeSection {
  key: string;
  group: string;
  label: string;
  value: string;
  proven: boolean;
}

export interface CompanyGenome {
  id: string;
  name: string;
  thesis: string;
  maturity: GenomeMaturity;
  sections: GenomeSection[];
  verifiedPlaybooks: string[];
  /** What is still missing to reach the next maturity stage. */
  missingForNextStage: string[];
  economicGateType: string;
}

export type NodeStatus =
  | 'Exploring'
  | 'Validating'
  | 'Active'
  | 'Scaling'
  | 'Paused'
  | 'Killed'
  | 'Archived';

export interface MarketNode {
  id: string;
  genomeId: string;
  geography: string;
  vertical: string;
  segment: string;
  offer: string;
  localModules: string[];
  gateType: string;
  evidenceState: EvidenceState;
  autonomy: AutonomyLevel;
  status: NodeStatus;
  statusNote?: string;
  alloc: AllocationScores;
}

export const RESOURCE_TYPES = [
  'founder time',
  'agent time',
  'cash',
  'compute',
  'engineering capacity',
  'distribution capacity',
  'partnership bandwidth',
  'legal effort',
  'operational attention',
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export interface ResourceDef {
  type: ResourceType;
  capacity: number;
  unit: string;
  step: number;
  /** True when allocating this resource moves money. */
  financial: boolean;
}

/** amount allocated per target id, per resource */
export type Allocations = Record<ResourceType, Record<string, number>>;

export interface ResourceAllocation {
  resource: ResourceType;
  targetId: string;
  targetType: 'opportunity' | 'node';
  amount: number;
}

export interface IntentToken {
  id: string;
  approvedBy: string;
  action: string;
  vendorOrSystem: string;
  maxAmount: number;
  currency: string;
  expiresAt: string; // ISO datetime
  recurrence: 'one-shot' | 'bounded';
  environment: 'prod' | 'sandbox';
  revoked: boolean;
  audit: AuditEvent[];
}

export type CanonKind =
  | 'pattern'
  | 'anti-pattern'
  | 'market rule'
  | 'economic rule'
  | 'primitive'
  | 'negative intelligence';

export interface CanonEntry {
  id: string;
  kind: CanonKind;
  title: string;
  origin: string;
  confidence: number;
}

export interface OperatingPrimitive {
  id: string;
  name: string;
  origin: string;
  evidence: string;
  successConditions: string[];
  failureConditions: string[];
  reusableIn: string[];
  confidence: number;
}

// Re-export allocation types
export type { AllocationScore, AllocationTarget } from "./allocation";

// Re-export intent token types
export type { IntentToken, IntentTokenAuditEntry, IntentTokenRequest } from "./intentToken";

// Re-export enums
export type { TokenEnvironment, TokenRecurrence } from "./enums";
