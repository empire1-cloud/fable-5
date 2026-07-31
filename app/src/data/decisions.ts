// DEMO DATA — formal decision objects from the Decision Engine.
import type { Decision } from "../types";

export const decisions: Decision[] = [
  {
    id: "dec-001",
    question: "Authorize landing-page pre-sell test for opp-001?",
    evidence: ["14-interview batch", "SEO organic signal"],
    confidence: 0.64,
    upside: "Validates willingness-to-pay at low cost",
    downside: "Wasted design/eng hours if conversion < 3%",
    reversibility: "reversible",
    cost: 1200,
    requiredAuthority: "L3",
    nextVerificationEvent: "200-visit conversion readout",
  },
  {
    id: "dec-002",
    question: "Reallocate budget to LATAM fintech node scale-up?",
    evidence: ["Node KPI feed — VERIFIED NRR 108%"],
    confidence: 0.91,
    upside: "Compounding NRR above gate threshold",
    downside: "Opportunity cost against opp-003 exploration",
    reversibility: "costly-to-reverse",
    cost: 85000,
    requiredAuthority: "L4",
    nextVerificationEvent: "Next monthly SaaS gate reading",
  },
  {
    id: "dec-003",
    question: "Activate paid ad spend for opp-001 pre-sell test?",
    evidence: ["Landing page live", "Founder-approved Intent Token FIT-2026-0412"],
    confidence: 0.58,
    upside: "Faster signal at bounded spend",
    downside: "Real cash movement — irreversible spend",
    reversibility: "irreversible",
    cost: 500,
    requiredAuthority: "L5",
    nextVerificationEvent: "Intent Token AUTHORIZED check",
  },
];
