// DEMO DATA — Canon entries and operating primitives written back from
// LEARNED/CANONIZED evidence records.
import type { CanonEntry, OperatingPrimitive } from "../types";

export const canonEntries: CanonEntry[] = [
  {
    id: "canon-001",
    kind: "pattern",
    title: "SaaS wedge with usage-based expansion clears the NRR gate by month 4 when reminder-sequence timing is localized to WhatsApp-first behavior.",
    origin: "Outcome ev-001",
    confidence: 0.95,
  },
  {
    id: "canon-002",
    kind: "negative intelligence",
    title: "AI outcome-verification products in this ICP failed prior kill-cycle due to unverifiable self-reported baselines — retest requires independently sourced ground truth before re-authorizing spend.",
    origin: "Outcome opp-003",
    confidence: 0.9,
  },
];

export const operatingPrimitives: OperatingPrimitive[] = [
  {
    id: "prim-001",
    name: "WhatsApp-first reminder sequencer",
    origin: "Outcome ev-001",
    evidence: "ev-001 shows 40% increase in engagement",
    successConditions: ["message delivered", "user opens within 1 hour"],
    failureConditions: ["message blocked", "user marks as spam"],
    reusableIn: ["genome-latam-fintech"],
    confidence: 0.85,
  },
];
