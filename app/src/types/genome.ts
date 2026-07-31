import type { GenomeMaturity } from "./enums";

export interface CompanyGenome {
  id: string;
  name: string;
  maturity: GenomeMaturity;

  // PROBLEM & WEDGE
  problem: string;
  customer: string;
  trigger: string;
  wedge: string;

  // OFFER
  offer: string;
  pricing: string;
  positioning: string;
  deliveryModel: string;

  // ACQUISITION
  channels: string[];
  conversionMechanics: string;
  retentionMechanism: string;
  organicLoops: string;

  // OPERATIONS
  productWorkflow: string;
  keyAgents: string[];
  keyWorkflows: string[];
  costStructure: string;

  // CONTROLS
  economicGates: string;
  risks: string[];
  failureModes: string[];
  dependencies: string[];

  // REPLICATION
  expansionPaths: string[];
  localizationRules: string[];
  infraRequirements: string[];
  complianceRequirements: string[];

  verifiedPlaybooks: string[];
  missingEvidence: string[];
}
