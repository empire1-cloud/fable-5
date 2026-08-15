/*
 * OPT-IN demo content. Deliberately NOT part of `npm run bootstrap`.
 *
 * bootstrap seeds resource-pool capacity only, because a real organisation
 * starts with no validated genome — inventing one would be exactly the fake
 * progress this system refuses. This script exists so the Company Genome
 * workspace can be seen populated (demos, screenshots, local development)
 * without that pretence leaking into the default path.
 *
 * What it demonstrates is the honest part: some sections are linked to
 * evidence that has reached VERIFIED and therefore READ as proven, while
 * others are linked to evidence still sitting at PROPOSED — attached, but
 * not proven — and some have no evidence at all. The coverage meter and the
 * replication gate are computed from those states, so the page shows a
 * genome that genuinely cannot be promoted yet, and says exactly why.
 *
 *   node scripts/seed-demo-genome.js
 */
import "dotenv/config";
import pg from "pg";
const { Client } = pg;

const connectionString = process.env.DATABASE_ADMIN_URL;
if (!connectionString) throw new Error("DATABASE_ADMIN_URL is required");

const SECTIONS = [
  // [key, group, label, value, proofLevel]
  //   'verified' -> evidence advanced to VERIFIED (reads proven)
  //   'claimed'  -> evidence exists at PROPOSED (attached, NOT proven)
  //   'none'     -> nothing attached
  ["problem", "PROBLEM & WEDGE", "problem", "Monthly VAT close is manual, error-prone, and audit-exposed for SMB accountants.", "verified"],
  ["customer", "PROBLEM & WEDGE", "customer", "SMB accounting firms, 3–25 seats, DACH first.", "verified"],
  ["trigger", "PROBLEM & WEDGE", "trigger", "2027-01 phase-2 e-invoicing enforcement (forced migration).", "verified"],
  ["wedge", "PROBLEM & WEDGE", "wedge", "XRechnung phase-2 validation the incumbents cannot pass.", "verified"],
  ["offer", "OFFER", "offer", "Automated close + validation with an audit-ready reconciliation trail.", "verified"],
  ["pricing", "OFFER", "pricing", "€89/entity/mo, volume-tiered; annual prepay discount.", "claimed"],
  ["positioning", "OFFER", "positioning", "Pass the mandate, keep the client — compliance certainty, not bookkeeping software.", "verified"],
  ["delivery", "OFFER", "delivery system", "Self-serve onboarding + managed first close; API into DATEV exports.", "claimed"],
  ["channels", "ACQUISITION", "acquisition channels", "Chamber-of-commerce webinars, DATEV-adjacent communities, paid search on mandate terms.", "verified"],
  ["conversion", "ACQUISITION", "conversion mechanics", "Free mandate-readiness scan → failed-validation report → pilot close.", "verified"],
  ["retention", "ACQUISITION", "retention mechanism", "Every close deepens the entity graph; switching restarts the audit trail.", "claimed"],
  ["workflow", "OPERATIONS", "product workflow", "Ingest → validate → reconcile → exception queue → filing package.", "verified"],
  ["costs", "OPERATIONS", "cost structure", "Inference + storage ~11% of revenue; support 0.4 FTE per 100 entities.", "claimed"],
  ["gate", "CONTROLS", "economic gate", "SaaS gate — NRR >100%, payback <12mo, margin >70%.", "verified"],
  ["risks", "CONTROLS", "risks", "Mandate slippage; DATEV platform response; per-market compliance drift.", "verified"],
  ["expansion", "REPLICATION", "expansion paths", "DACH → UK → Nordics (retired) → MX candidate.", "none"],
  ["localization", "REPLICATION", "localization rules", "Swap tax schema, filing calendar, payment rails; core close workflow constant.", "none"],
  ["infra", "REPLICATION", "infrastructure requirements", "EU data residency; per-market schema registry mirror.", "claimed"]
];

const client = new Client({ connectionString });
await client.connect();
try {
  await client.query("BEGIN");
  const tenantRes = await client.query(`SELECT id FROM tenants ORDER BY created_at LIMIT 1`);
  const tenantId = tenantRes.rows[0]?.id;
  if (!tenantId) throw new Error("No tenant found — run `npm run bootstrap` first.");

  const userRes = await client.query(
    `SELECT user_id FROM memberships WHERE tenant_id = $1 ORDER BY created_at LIMIT 1`,
    [tenantId]
  );
  const userId = userRes.rows[0]?.user_id;
  if (!userId) throw new Error("No member found — run `npm run bootstrap` first.");

  const genomeRes = await client.query(
    `INSERT INTO company_genomes (tenant_id, code, name, thesis, maturity, economic_gate_type)
     VALUES ($1,'G-01','LEDGERPILOT',
             'Automated VAT close for European SMB accountants — regulatory forcing function as the wedge.',
             'Verified','SaaS')
     ON CONFLICT (tenant_id, code) DO UPDATE SET name=EXCLUDED.name
     RETURNING id`,
    [tenantId]
  );
  const genomeId = genomeRes.rows[0].id;

  let verified = 0;
  let claimed = 0;
  for (const [i, [key, group, label, value, proof]] of SECTIONS.entries()) {
    let evidenceId = null;

    if (proof !== "none") {
      const ev = await client.query(
        `INSERT INTO evidence_records
           (id, tenant_id, subject_type, subject_id, claim, state, grade, confidence, created_by)
         VALUES (gen_random_uuid(), $1, 'genome_section', $2, $3, 'PROPOSED', $4, $5, $6)
         RETURNING id`,
        [tenantId, genomeId, `${label}: ${value}`.slice(0, 300), proof === "verified" ? "A" : "C", proof === "verified" ? 0.85 : 0.4, userId]
      );
      evidenceId = ev.rows[0].id;

      if (proof === "verified") {
        // Walk the real gates rather than writing VERIFIED directly: each
        // state needs its artefact, exactly as the API enforces.
        await client.query(
          `INSERT INTO evidence_receipts (id, tenant_id, evidence_id, receipt_type, description, grade)
           VALUES (gen_random_uuid(),$1,$2,'interview','buyer interviews with confirmed budget line','A')`,
          [tenantId, evidenceId]
        );
        await client.query(
          `INSERT INTO evidence_verifications (id, tenant_id, evidence_id, method, verifier, independent, reproducible, result)
           VALUES (gen_random_uuid(),$1,$2,'independent re-check by a second actor','second-actor',true,true,$3)`,
          [tenantId, evidenceId, JSON.stringify({ reproduced: true })]
        );
        await client.query(`UPDATE evidence_records SET state='VERIFIED' WHERE id=$1`, [evidenceId]);
        verified += 1;
      } else {
        claimed += 1;
      }
    }

    await client.query(
      `INSERT INTO genome_sections (tenant_id, genome_id, section_key, section_group, label, value, evidence_id, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (genome_id, section_key) DO UPDATE
         SET section_group=EXCLUDED.section_group, label=EXCLUDED.label,
             value=EXCLUDED.value, evidence_id=EXCLUDED.evidence_id, sort_order=EXCLUDED.sort_order`,
      [tenantId, genomeId, key, group, label, value, evidenceId, i]
    );
  }

  await client.query("COMMIT");
  const total = SECTIONS.length;
  console.log(
    `Seeded demo genome G-01 with ${total} sections: ${verified} proven (VERIFIED), ` +
      `${claimed} attached-but-unproven (PROPOSED), ${total - verified - claimed} with no evidence.`
  );
  console.log(`Replication gate should read LOCKED — ${total - verified} sections lack verified evidence.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
