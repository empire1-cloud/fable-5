import type { ReceiptType } from "./enums";

export interface Receipt {
  id: string;
  type: ReceiptType;
  payloadRef: string; // e.g. a URL, commit sha, file path — demo reference
  quality: "weak" | "adequate" | "strong";
  attachedToMissionId?: string;
  createdAt: string; // ISO
}

/** An independent verification of a receipt — distinct from the receipt itself. */
export interface VerificationRecord {
  id: string;
  verifiedReceiptId: string;
  verifiedBy: string; // agent/engine or founder
  reproduced: boolean;
  method: string;
  createdAt: string; // ISO
}

export interface Contradiction {
  id: string;
  description: string;
  raisedAt: string; // ISO
  resolved: boolean;
  resolvedAt?: string;
}

export interface AuditEntry {
  state: string;
  timestamp: string; // ISO
  actor: string;
  reason: string;
}
