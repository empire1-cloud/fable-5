// DEMO DATA — formal decision objects from the Decision Engine.
import type { Decision, EvidenceItem, EpistemicType } from "../types";

export const decisions: Decision[] = [
  {
    id: "dec-001",
    question: "Authorize landing-page pre-sell test for opp-001?",
    evidence: [
      { text: "14-interview batch", type: "fact" as EpistemicType },
      { text: "SEO organic signal", type: "fact" as EpistemicType }
    ],
    assumptions: ["Interview participants represent target market", "SEO signal correlates with intent"],
    confidence: 0.64,
    upside: "Validates willingness-to-pay at low cost",
    downside: "Wasted design/eng hours if conversion < 3%",
    reversibility: "high",
    cost: "1200",
    dependencies: ["landing-page-design-complete"],
    recommendedAction: "Proceed with pre-sell test",
    requiredAuthority: "L3",
    nextVerificationEvent: "200-visit conversion readout",
  },
  {
    id: "dec-002",
    question: "Reallocate budget to LATAM fintech node scale-up?",
    evidence: [
      { text: "Node KPI feed — VERIFIED NRR 108%", type: "fact" as EpistemicType }
    ],
    assumptions: ["Current growth trajectory is sustainable", "Market conditions remain favorable"],
    confidence: 0.91,
    upside: "Compounding NRR above gate threshold",
    downside: "Opportunity cost against opp-003 exploration",
    reversibility: "medium",
    cost: "85000",
    dependencies: ["current-node-performance-verified"],
    recommendedAction: "Approve budget reallocation",
    requiredAuthority: "L4",
    nextVerificationEvent: "Next monthly SaaS gate reading",
  },
  {
    id: "dec-003",
    question: "Activate paid ad spend for opp-001 pre-sell test?",
    evidence: [
      { text: "Landing page live", type: "fact" as EpistemicType },
      { text: "Founder-approved Intent Token FIT-2026-0412", type: "fact" as EpistemicType }
    ],
    assumptions: ["Paid ads will drive relevant traffic", "Landing page conversion rate > 3%"],
    confidence: 0.58,
    upside: "Faster signal at bounded spend",
    downside: "Real cash movement — irreversible spend",
    reversibility: "low",
    cost: "500",
    dependencies: ["landing-page-live", "intent-token-approved"],
    recommendedAction: "Activate paid ad spend with daily budget cap",
    requiredAuthority: "L5",
    nextVerificationEvent: "Intent Token AUTHORIZED check",
  },
];
