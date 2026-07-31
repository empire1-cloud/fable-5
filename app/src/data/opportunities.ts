// DEMO DATA — the Opportunity Graph, ranked candidates. Not live scoring.
import type { Opportunity } from "../types";

export const opportunities: Opportunity[] = [
  {
    id: "opp-001",
    title: "SMB invoice-chasing copilot (SaaS wedge)",
    score: 82,
    evidence: ["14-interview batch shows 60% manual chase time", "SEO organic signal confidence 0.78"],
    assumptions: ["willingness to pay ≥ $39/mo not yet RECEIPTED"],
    epistemicType: "HYPOTHESIS",
    expectedValue: 240000,
    confidence: 0.64,
    risk: "medium",
    dependencies: ["Product & Offer spec", "payments module"],
    nextExperiment: "Landing-page pre-sell test, n=200 visits, target 3% conversion",
  },
  {
    id: "opp-002",
    title: "LATAM fintech node — scale verdict",
    score: 91,
    evidence: ["Node KPI feed: NRR 108%, payback 9mo — VERIFIED"],
    assumptions: [],
    epistemicType: "FACT",
    expectedValue: 610000,
    confidence: 0.91,
    risk: "low",
    dependencies: ["Engine 08 budget reallocation"],
    nextExperiment: "None — gate passed; proceed to Global Scaling replication",
  },
  {
    id: "opp-003",
    title: "AI outcome-verification product (new vertical)",
    score: 38,
    evidence: ["Services-to-software market forecast, confidence 0.47"],
    assumptions: ["Distribution channel unproven", "Prior similar product was KILLED — negative intelligence"],
    epistemicType: "FORECAST",
    expectedValue: 90000,
    confidence: 0.47,
    risk: "high",
    dependencies: ["Legal review of outcome claims"],
    nextExperiment: "Re-test prior kill hypothesis with narrower ICP before committing budget",
  },
];
