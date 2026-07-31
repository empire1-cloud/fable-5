// DEMO DATA — Canon entries and operating primitives written back from
// LEARNED/CANONIZED evidence records.
import type { CanonEntry, OperatingPrimitive } from "../types";

export const canonEntries: CanonEntry[] = [
  {
    id: "canon-001",
    kind: "pattern",
    body: "SaaS wedge with usage-based expansion clears the NRR gate by month 4 when reminder-sequence timing is localized to WhatsApp-first behavior.",
    sourceOutcomeRef: "ev-001",
    createdAt: "2026-07-11T09:15:00Z",
  },
  {
    id: "canon-002",
    kind: "negative intelligence",
    body: "AI outcome-verification products in this ICP failed prior kill-cycle due to unverifiable self-reported baselines — retest requires independently sourced ground truth before re-authorizing spend.",
    sourceOutcomeRef: "opp-003",
    createdAt: "2026-05-20T00:00:00Z",
  },
];

export const operatingPrimitives: OperatingPrimitive[] = [
  {
    id: "prim-001",
    name: "WhatsApp-first reminder sequencer",
    provenBy: ["ev-001"],
    reusableAcross: ["genome-latam-fintech"],
  },
];
