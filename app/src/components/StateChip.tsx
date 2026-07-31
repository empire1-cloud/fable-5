import { EVIDENCE_STATES } from "../types/enums";

/**
 * Renders the record's state strip. The state is whatever the server says it
 * is — this component styles a string, it never infers progress.
 */
export function StateStrip({ current }: { current: string }) {
  const failed = current === "BLOCKED" || current === "KILLED";
  const currentIdx = failed ? -1 : (EVIDENCE_STATES as readonly string[]).indexOf(current);

  return (
    <div className="state-strip" role="list" aria-label="Evidence state progression">
      {EVIDENCE_STATES.map((state, i) => {
        const isCurrent = !failed && state === current;
        const isReached = !failed && i < currentIdx;
        return (
          <span key={state} style={{ display: "contents" }}>
            <span
              role="listitem"
              className={`state-chip${isCurrent ? " current" : ""}${isReached ? " reached" : ""}`}
            >
              {state}
            </span>
            {i < EVIDENCE_STATES.length - 1 && (
              <span className="strip-arrow" aria-hidden="true">
                →
              </span>
            )}
          </span>
        );
      })}
      {failed && <span className="state-chip failed">{current}</span>}
    </div>
  );
}
