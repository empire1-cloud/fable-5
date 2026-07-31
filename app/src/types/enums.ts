// Shared enums — the single source of truth for the ontology's controlled
// vocabularies. Guards in src/lib and every workspace UI read from these so
// state chips and gates never drift from what the machine actually enforces.

/** The Evidence State Machine — eight states, strictly ordered, none skippable. */
export const EVIDENCE_STATES = [
  "PROPOSED",
  "AUTHORIZED",
  "EXECUTED",
  "RECEIPTED",
  "VERIFIED",
  "MEASURED",
  "LEARNED",
  "CANONIZED",
] as const;
export type EvidenceState = (typeof EVIDENCE_STATES)[number];

/** A record can also be pulled out of the happy path. */
export const TERMINAL_FAILURE_STATES = ["BLOCKED", "KILLED"] as const;
export type FailureState = (typeof TERMINAL_FAILURE_STATES)[number];

export type RecordStatus = EvidenceState | FailureState;

/** The Autonomy Ladder. L4→L5 is the Founder Approval Boundary. */
export const AUTONOMY_LEVELS = ["L0", "L1", "L2", "L3", "L4", "L5"] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  L0: "Observe",
  L1: "Recommend",
  L2: "Draft",
  L3: "Execute Reversible",
  L4: "Execute In Bounds",
  L5: "Founder Escalation",
};

/** Epistemic types — never collapsed into one another. */
export const EPISTEMIC_TYPES = [
  "FACT",
  "INFERENCE",
  "FORECAST",
  "HYPOTHESIS",
  "ASSUMPTION",
] as const;
export type EpistemicType = (typeof EPISTEMIC_TYPES)[number];

/** Receipt types accepted anywhere in the Control Plane. */
export const RECEIPT_TYPES = [
  "test output",
  "diff",
  "commit",
  "API response",
  "deploy log",
  "metric",
  "screenshot",
  "reproducible check",
  "verified artifact",
  "payment confirmation",
] as const;
export type ReceiptType = (typeof RECEIPT_TYPES)[number];

/** Mission lifecycle status inside the Mission Queue. */
export const MISSION_STATUSES = [
  "queued",
  "in-progress",
  "blocked",
  "done",
  "killed",
] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

/** Company Genome maturity. */
export const GENOME_MATURITIES = [
  "Draft",
  "Tested",
  "Verified",
  "Replication-Ready",
] as const;
export type GenomeMaturity = (typeof GENOME_MATURITIES)[number];

/** Market Node status. */
export const NODE_STATUSES = [
  "Exploring",
  "Validating",
  "Active",
  "Scaling",
  "Paused",
  "Killed",
  "Archived",
] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

/** Typed economic gate business models — one universal gate is retired. */
export const GATE_TYPES = [
  "SaaS",
  "Marketplace",
  "Consumer",
  "Txn Infrastructure",
  "AI Product",
  "Services → Software",
] as const;
export type GateType = (typeof GATE_TYPES)[number];

export const GATE_VERDICTS = ["CLONE", "ITERATE", "PAUSE", "KILL"] as const;
export type GateVerdict = (typeof GATE_VERDICTS)[number];

/** Scarce resources tracked by Capital & Resource Allocation (Engine 08). */
export const RESOURCE_TYPES = [
  "founder time",
  "agent time",
  "cash",
  "compute",
  "engineering",
  "distribution",
  "partnerships",
  "legal effort",
  "operational attention",
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** Drafting Room theme controls. */
export const PALETTES = ["cyan", "mint", "amber", "violet"] as const;
export type Palette = (typeof PALETTES)[number];

export const TEXTURES = ["graph", "dots", "plain"] as const;
export type Texture = (typeof TEXTURES)[number];

export const CANON_KINDS = [
  "pattern",
  "anti-pattern",
  "primitive",
  "negative intelligence",
] as const;
export type CanonKind = (typeof CANON_KINDS)[number];

export const TOKEN_ENVIRONMENTS = ["prod", "sandbox"] as const;
export type TokenEnvironment = (typeof TOKEN_ENVIRONMENTS)[number];

export const TOKEN_RECURRENCE = ["one-shot", "bounded"] as const;
export type TokenRecurrence = (typeof TOKEN_RECURRENCE)[number];
