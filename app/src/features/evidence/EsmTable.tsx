import { EVIDENCE_STATES } from "../../types/enums";
import type { RecordStatus } from "../../types/enums";

const ROWS: Record<(typeof EVIDENCE_STATES)[number], { entry: string; required: string; claim: string }> = {
  PROPOSED: {
    entry: "Decision object filed with evidence, assumptions, confidence.",
    required: "ranked entry in Opportunity Graph",
    claim: '"approved" · "planned"',
  },
  AUTHORIZED: {
    entry: "Authority check passed; Intent Token valid if financial.",
    required: "authorization record + token ID",
    claim: '"in progress"',
  },
  EXECUTED: {
    entry: "Owner agent performed the action within bounds.",
    required: "execution log",
    claim: '"done" · "launched" · "fixed"',
  },
  RECEIPTED: {
    entry: "Receipt attached to the mission.",
    required: "test output · diff · commit · API response · deploy log",
    claim: '"verified" · "working"',
  },
  VERIFIED: {
    entry: "Independent check confirms receipt matches claim; reproducible.",
    required: "verification record · reproduced check",
    claim: '"successful"',
  },
  MEASURED: {
    entry: "Outcome scored against the typed economic gate.",
    required: "KPI reading vs threshold",
    claim: '"scalable"',
  },
  LEARNED: {
    entry: "Prediction vs outcome error computed; confidence updated.",
    required: "confidence delta + pattern / anti-pattern",
    claim: '"canonical"',
  },
  CANONIZED: {
    entry: "Learning written to canon as a reusable primitive or rule.",
    required: "canon diff · playbook entry",
    claim: "— terminal state",
  },
};

export function EsmTable({ highlight }: { highlight?: RecordStatus }) {
  return (
    <div className="esm-box">
      <div className="esm-scroll">
        <div className="esm-table">
          <div className="esm-head">
            <div className="esm-hcell">STATE</div>
            <div className="esm-hcell esm-hcell--bl">ENTRY CONDITION</div>
            <div className="esm-hcell esm-hcell--bl">REQUIRED EVIDENCE</div>
            <div className="esm-hcell esm-hcell--bl">MAY NOT YET CLAIM</div>
          </div>
          {EVIDENCE_STATES.map((state) => (
            <div className={`esm-row${highlight === state ? " current-row" : ""}`} key={state}>
              <div className="esm-state">{state}</div>
              <div className="esm-cell">{ROWS[state].entry}</div>
              <div className="esm-cell">{ROWS[state].required}</div>
              <div className="esm-claim">{ROWS[state].claim}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="esm-foot">
        FAILURE AT ANY STATE → BLOCKED OR KILLED · STATE, EVIDENCE + FAILURE REASON RETAINED AS NEGATIVE INTELLIGENCE
      </div>
    </div>
  );
}
