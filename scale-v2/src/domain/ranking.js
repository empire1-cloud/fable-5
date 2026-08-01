const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));

export function rankOpportunity(input) {
  const evidence = clamp(input.evidenceStrength ?? 0, 0, 100);
  const demand = clamp(input.demandSignal ?? 0, 0, 100);
  const strategicFit = clamp(input.strategicFit ?? 0, 0, 100);
  const margin = clamp(input.marginPotential ?? 0, 0, 100);
  const reversibility = clamp(input.reversibility ?? 0, 0, 100);
  const executionReadiness = clamp(input.executionReadiness ?? 0, 0, 100);
  const risk = clamp(input.risk ?? 100, 0, 100);
  const resourceCost = clamp(input.resourceCost ?? 100, 0, 100);

  const score =
    evidence * 0.22 +
    demand * 0.18 +
    strategicFit * 0.18 +
    margin * 0.14 +
    reversibility * 0.08 +
    executionReadiness * 0.12 +
    (100 - risk) * 0.05 +
    (100 - resourceCost) * 0.03;

  const confidence = Math.round((evidence * 0.65 + demand * 0.2 + executionReadiness * 0.15) * 100) / 100;
  const roundedScore = Math.round(score * 100) / 100;
  const verdict =
    evidence < 45 ? "HOLD_FOR_EVIDENCE" :
    roundedScore >= 78 ? "AUTHORIZE_EXPERIMENT" :
    roundedScore >= 62 ? "INVESTIGATE" :
    roundedScore >= 45 ? "WATCH" :
    "REFUSE";

  return {
    score: roundedScore,
    confidence,
    verdict,
    formulaVersion: "engine00-ranking-v2.0",
    factors: { evidence, demand, strategicFit, margin, reversibility, executionReadiness, risk, resourceCost }
  };
}
