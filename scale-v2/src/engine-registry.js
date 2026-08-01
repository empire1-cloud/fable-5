export const ENGINE_REGISTRY = Object.freeze([
  {
    id: "00",
    name: "Strategic Intelligence",
    layer: "strategic-selection",
    description: "Decides what deserves attention, resources, and execution now. Ranks everything FABLE-5 could pursue before anything is pursued.",
    inputs: ["graded signals", "canon + negative intelligence", "portfolio state", "market telemetry"],
    outputs: ["Ranked Opportunity Graph", "formal Decision objects", "recommended next experiments"],
    kpis: ["ranking hit rate vs outcome", "confidence calibration error", "time from signal to decision"],
    receipts: ["scored opportunity entries", "decision records with evidence attached"],
    escalations: ["low-confidence assumption about to drive a decision", "two opportunities tie for the #1 slot"],
    connected: ["01", "08", "07"],
    gate: "An evidence-graded opportunity is authorized before Engine 01 spends attention on it."
  },
  {
    id: "01",
    name: "Market Intelligence",
    layer: "value-pipeline",
    description: "Scans global markets, languages, and sectors for exploitable asymmetries.",
    inputs: ["authorized opportunity", "market telemetry", "competitive signals", "negative intelligence"],
    outputs: ["market evidence packs", "segment maps", "willingness-to-pay hypotheses"],
    kpis: ["signal precision", "evidence freshness", "false-positive rate"],
    receipts: ["source records", "interview evidence", "market comparison reports"],
    escalations: ["source conflict", "stale or single-source demand claim"],
    connected: ["00", "02", "07"],
    gate: "Engine 00 authorizes an evidence-graded opportunity."
  },
  {
    id: "02",
    name: "Product & Offer",
    layer: "value-pipeline",
    description: "Designs solutions, pricing, positioning, and delivery models.",
    inputs: ["authorized market evidence", "customer constraints", "canon", "delivery capacity"],
    outputs: ["offer specification", "pricing model", "positioning", "delivery contract"],
    kpis: ["willingness-to-pay conversion", "gross-margin forecast accuracy", "time to offer proof"],
    receipts: ["paid pilot", "signed LOI", "deposit", "verified buyer interview"],
    escalations: ["offer depends on unverified capability", "price has no buyer evidence"],
    connected: ["01", "03", "05", "07"],
    gate: "Willingness-to-pay evidence is RECEIPTED."
  },
  {
    id: "03",
    name: "Asset Factory",
    layer: "value-pipeline",
    description: "Manufactures funnels, content, automations, interfaces, and delivery artifacts.",
    inputs: ["approved offer specification", "brand canon", "artifact requirements", "verification plan"],
    outputs: ["deployable artifacts", "funnels", "automations", "interfaces", "campaign assets"],
    kpis: ["verified artifact throughput", "defect escape rate", "primitive reuse rate"],
    receipts: ["test output", "diff", "commit", "deployment log", "verified artifact"],
    escalations: ["artifact has no reproducible test", "generated asset violates canon"],
    connected: ["02", "04", "07"],
    gate: "Artifacts pass VERIFICATION checks."
  },
  {
    id: "04",
    name: "Growth & Distribution",
    layer: "value-pipeline",
    description: "Deploys assets across global channels and partners.",
    inputs: ["verified assets", "channel policy", "audience map", "campaign budget verdict"],
    outputs: ["distribution runs", "channel evidence", "partner activations", "measured demand"],
    kpis: ["qualified reach", "conversion by channel", "distribution cost per verified outcome"],
    receipts: ["platform delivery receipt", "campaign response", "partner confirmation", "conversion event"],
    escalations: ["spend requested without token", "channel result cannot be independently measured"],
    connected: ["03", "05", "07", "08"],
    gate: "Distribution evidence is MEASURED against the node’s typed gate."
  },
  {
    id: "05",
    name: "Monetization & Finance",
    layer: "value-pipeline",
    description: "Tracks unit economics, revenue evidence, entitlements, and profit routing.",
    inputs: ["measured distribution", "payment events", "cost evidence", "offer economics"],
    outputs: ["revenue receipts", "unit-economics ledger", "profit-routing recommendations", "entitlements"],
    kpis: ["verified revenue", "gross margin", "recovery rate", "revenue without receipt"],
    receipts: ["processor event", "invoice", "ledger entry", "entitlement change"],
    escalations: ["revenue claim without receipt", "entitlement conflicts with subscription truth"],
    connected: ["02", "04", "06", "07", "08"],
    gate: "Gate verdict is recorded and a supported learning may be proposed."
  },
  {
    id: "06",
    name: "Global Scaling",
    layer: "value-pipeline",
    description: "Replicates validated genomes into new markets and verticals: Genome → Adapt → Validate → Deploy → Measure.",
    inputs: ["validated operating genome", "market adaptation evidence", "capacity", "risk limits"],
    outputs: ["adapted genome", "replication plan", "deployment nodes", "scale evidence"],
    kpis: ["replication success rate", "time to local validation", "genome drift"],
    receipts: ["replication package", "local validation", "deployment receipt", "measured outcome"],
    escalations: ["genome copied before validation", "local adaptation breaks canon"],
    connected: ["05", "07", "08"],
    gate: "Genome reaches REPLICATION-READY maturity."
  },
  {
    id: "07",
    name: "Governance · Memory · Verification",
    layer: "substrate",
    description: "The substrate beneath all engines: canon enforcement, permission boundaries, receipts, artifact validation, evidence grading, contradiction detection, and compounding memory.",
    inputs: ["every receipt", "every decision", "every outcome", "every contradiction"],
    outputs: ["verified evidence", "updated canon", "reusable playbooks", "audit trail"],
    kpis: ["verification coverage", "contradictions caught before canon", "primitive reuse rate"],
    receipts: ["verification records", "canon diffs", "audit log entries"],
    escalations: ["a claim reaches VERIFIED without an independent check", "autonomy or spend boundary breach detected"],
    connected: ["00", "01", "02", "03", "04", "05", "06", "08"],
    gate: "Every loop reads from it; every outcome writes back to it."
  },
  {
    id: "08",
    name: "Capital & Resource Allocation",
    layer: "substrate",
    description: "Compares competing opportunities and live nodes, then assigns budgets, reserves, attention, and kill candidates.",
    inputs: ["ranked opportunity graph", "portfolio state", "cash and capacity", "risk policy"],
    outputs: ["allocation verdicts", "Intent Tokens", "reserve decisions", "kill or pause decisions"],
    kpis: ["return on allocated resource", "capital-at-risk", "allocation reversibility"],
    receipts: ["Intent Token", "allocation decision", "revocation record", "resource ledger entry"],
    escalations: ["cash movement attempted without a valid token", "allocation exceeds policy boundary"],
    connected: ["00", "04", "05", "06", "07"],
    gate: "Cash moves only with a valid Intent Token and an enabled execution connector."
  }
]);

export function getEngine(engineId) {
  return ENGINE_REGISTRY.find((engine) => engine.id === String(engineId).padStart(2, "0")) ?? null;
}
