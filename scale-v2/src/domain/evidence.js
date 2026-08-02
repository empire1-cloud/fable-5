export const EVIDENCE_STATES = Object.freeze([
  "PROPOSED",
  "AUTHORIZED",
  "EXECUTED",
  "RECEIPTED",
  "VERIFIED",
  "MEASURED",
  "LEARNED",
  "CANONIZED"
]);

const NEXT = Object.freeze({
  PROPOSED: "AUTHORIZED",
  AUTHORIZED: "EXECUTED",
  EXECUTED: "RECEIPTED",
  RECEIPTED: "VERIFIED",
  VERIFIED: "MEASURED",
  MEASURED: "LEARNED",
  LEARNED: "CANONIZED"
});

export class EvidenceTransitionError extends Error {
  constructor(message, code = "EVIDENCE_GATE_REFUSED") {
    super(message);
    this.name = "EvidenceTransitionError";
    this.code = code;
  }
}

export function assertTransition(currentState, nextState, context = {}) {
  if (!EVIDENCE_STATES.includes(currentState) || !EVIDENCE_STATES.includes(nextState)) {
    throw new EvidenceTransitionError("Unknown evidence state", "UNKNOWN_STATE");
  }
  if (currentState === nextState) return true;
  if (NEXT[currentState] !== nextState) {
    throw new EvidenceTransitionError(
      `State transition refused: ${currentState} → ${nextState}. FABLE-5 does not permit skipped gates.`,
      "STATE_SKIP_REFUSED"
    );
  }

  const receipts = Number(context.receiptCount ?? 0);
  const independentVerifications = Number(context.independentVerificationCount ?? 0);
  const measurements = Number(context.measurementCount ?? 0);

  if (nextState === "RECEIPTED" && receipts < 1) {
    throw new EvidenceTransitionError("RECEIPTED requires at least one attached receipt.");
  }
  if (nextState === "VERIFIED" && independentVerifications < 1) {
    throw new EvidenceTransitionError("VERIFIED requires an independent verification record.");
  }
  if (nextState === "MEASURED" && measurements < 1) {
    throw new EvidenceTransitionError("MEASURED requires a typed gate measurement.");
  }
  if (nextState === "LEARNED") {
    const learning = context.learning;
    if (!learning || typeof learning.statement !== "string" || learning.statement.trim().length < 12) {
      throw new EvidenceTransitionError("LEARNED requires a specific supported learning statement.");
    }
    if (!Array.isArray(learning.supportingEvidenceIds) || learning.supportingEvidenceIds.length < 1) {
      throw new EvidenceTransitionError("LEARNED requires supporting evidence IDs.");
    }
  }
  if (nextState === "CANONIZED") {
    const approval = context.canonApproval;
    if (!approval || approval.approved !== true) {
      throw new EvidenceTransitionError("CANONIZED requires an explicit canon promotion approval.");
    }
    if (!approval.policyVersion || !approval.approvedBy) {
      throw new EvidenceTransitionError("CANONIZED requires policy version and approving actor.");
    }
  }
  return true;
}
