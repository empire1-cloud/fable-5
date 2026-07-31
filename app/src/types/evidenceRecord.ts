import type { RecordStatus } from "./enums";
import type { AuditEntry, Contradiction, Receipt, VerificationRecord } from "./receipt";

export interface EvidenceRecord {
  id: string;
  subject: string; // what this record is evidence for, e.g. a mission or claim
  state: RecordStatus;
  evidence: Receipt[];
  confidence: number; // 0-1
  verifications: VerificationRecord[];
  contradictions: Contradiction[];
  auditHistory: AuditEntry[];

  /** True if the underlying action moves or commits money — gates AUTHORIZED on a valid Intent Token. */
  isFinancial?: boolean;
  /** Required for a financial AUTHORIZED transition — token id checked against the token registry. */
  intentTokenId?: string;
  /** Exact financial scope mirrored in the browser for rendering only; the server remains authoritative. */
  financialVendorOrSystem?: string;
  financialAmount?: number;
  financialCurrency?: string;
  financialEnvironment?: "prod" | "sandbox";
  /** Authorization record required to enter AUTHORIZED. */
  authorization?: { authorizedBy: string; authorityLevel: string };
  /** Execution log required to enter EXECUTED. */
  executionLog?: string;
  /** KPI reading recorded at MEASURED, vs the typed gate threshold. */
  measurement?: { kpi: string; value: number; threshold: number; passed: boolean };
  /** Confidence delta + pattern captured at LEARNED. */
  learning?: { confidenceDelta: number; pattern: string };
  /** Canon diff / playbook entry captured at CANONIZED. */
  canonization?: { canonEntryId: string; note: string };
  failureReason?: string;
}
