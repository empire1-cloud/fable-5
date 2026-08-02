import { randomUUID } from "node:crypto";
import { withTenant } from "./db.js";
import { rankOpportunity } from "./domain/ranking.js";
import { assertTransition } from "./domain/evidence.js";

export async function createOpportunity(actor, payload) {
  const ranking = rankOpportunity(payload);
  return withTenant(actor.tenantId, async (client) => {
    const evidenceId = randomUUID();
    const opportunityId = randomUUID();

    await client.query(
      `INSERT INTO evidence_records
        (id, tenant_id, subject_type, subject_id, claim, state, grade, confidence, created_by)
       VALUES ($1, $2, 'opportunity', $3, $4, 'PROPOSED', $5, $6, $7)`,
      [evidenceId, actor.tenantId, opportunityId, payload.claim ?? payload.title, payload.evidenceGrade ?? "C", ranking.confidence / 100, actor.userId]
    );

    await client.query(
      `INSERT INTO opportunities
        (id, tenant_id, title, summary, ranking_score, ranking_verdict, ranking_factors, evidence_id, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'RANKED', $9)`,
      [opportunityId, actor.tenantId, payload.title, payload.summary ?? "", ranking.score, ranking.verdict, ranking.factors, evidenceId, actor.userId]
    );

    await client.query(
      `INSERT INTO engine_work_items
        (id, tenant_id, engine_id, item_type, title, status, payload, evidence_id, created_by)
       VALUES ($1, $2, '00', 'opportunity', $3, 'RANKED', $4, $5, $6)`,
      [randomUUID(), actor.tenantId, payload.title, { ranking, opportunityId }, evidenceId, actor.userId]
    );

    return { opportunityId, evidenceId, ranking };
  });
}

export async function authorizeOpportunity(actor, opportunityId, reason) {
  return withTenant(actor.tenantId, async (client) => {
    const result = await client.query(
      `SELECT o.*, e.state, e.grade,
              (SELECT count(*)::int FROM evidence_receipts r WHERE r.evidence_id=e.id) AS receipt_count
         FROM opportunities o
         JOIN evidence_records e ON e.id=o.evidence_id
        WHERE o.id=$1
        FOR UPDATE`,
      [opportunityId]
    );
    const row = result.rows[0];
    if (!row) throw Object.assign(new Error("Opportunity not found"), { status: 404 });
    if (!["A", "B"].includes(row.grade) || Number(row.receipt_count) < 1) {
      throw Object.assign(new Error("Engine 00 gate refused: evidence grade A/B and at least one receipt are required."), { status: 409 });
    }

    assertTransition(row.state, "AUTHORIZED");
    const decisionId = randomUUID();
    await client.query(
      `INSERT INTO decisions (id, tenant_id, opportunity_id, verdict, reason, decided_by)
       VALUES ($1,$2,$3,'AUTHORIZED',$4,$5)`,
      [decisionId, actor.tenantId, opportunityId, reason, actor.userId]
    );
    await client.query(`UPDATE opportunities SET status='AUTHORIZED', updated_at=now() WHERE id=$1`, [opportunityId]);
    await client.query(`UPDATE evidence_records SET state='AUTHORIZED', updated_at=now() WHERE id=$1`, [row.evidence_id]);
    await client.query(
      `INSERT INTO evidence_events (id, tenant_id, evidence_id, state_from, state_to, reason, actor_id)
       VALUES ($1,$2,$3,$4,'AUTHORIZED',$5,$6)`,
      [randomUUID(), actor.tenantId, row.evidence_id, row.state, reason, actor.userId]
    );
    return { decisionId, opportunityId, evidenceId: row.evidence_id, state: "AUTHORIZED" };
  });
}

export async function transitionEvidence(actor, evidenceId, nextState, context, reason) {
  return withTenant(actor.tenantId, async (client) => {
    const result = await client.query(
      `SELECT e.*,
              (SELECT count(*)::int FROM evidence_receipts r WHERE r.evidence_id=e.id) AS receipt_count,
              (SELECT count(*)::int FROM evidence_verifications v WHERE v.evidence_id=e.id AND v.independent=true) AS verification_count,
              (SELECT count(*)::int FROM evidence_measurements m WHERE m.evidence_id=e.id) AS measurement_count
         FROM evidence_records e
        WHERE e.id=$1
        FOR UPDATE`,
      [evidenceId]
    );
    const row = result.rows[0];
    if (!row) throw Object.assign(new Error("Evidence not found"), { status: 404 });

    assertTransition(row.state, nextState, {
      receiptCount: row.receipt_count,
      independentVerificationCount: row.verification_count,
      measurementCount: row.measurement_count,
      learning: context?.learning,
      canonApproval: context?.canonApproval
    });

    await client.query(`UPDATE evidence_records SET state=$1, updated_at=now() WHERE id=$2`, [nextState, evidenceId]);
    await client.query(
      `INSERT INTO evidence_events (id, tenant_id, evidence_id, state_from, state_to, reason, actor_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(), actor.tenantId, evidenceId, row.state, nextState, reason, actor.userId, context ?? {}]
    );

    if (nextState === "LEARNED") {
      await client.query(
        `INSERT INTO learnings (id, tenant_id, evidence_id, statement, supporting_evidence_ids, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [randomUUID(), actor.tenantId, evidenceId, context.learning.statement, context.learning.supportingEvidenceIds, actor.userId]
      );
    }

    if (nextState === "CANONIZED") {
      await client.query(
        `INSERT INTO canon_entries (id, tenant_id, title, body, source_evidence_id, policy_version, approved_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [randomUUID(), actor.tenantId, context.canonApproval.title, context.canonApproval.body, evidenceId, context.canonApproval.policyVersion, context.canonApproval.approvedBy]
      );
    }
    return { evidenceId, from: row.state, to: nextState };
  });
}

export async function dashboard(actor) {
  return withTenant(actor.tenantId, async (client) => {
    const [engineCounts, evidenceCounts, escalations, opportunities] = await Promise.all([
      client.query(`SELECT engine_id, count(*)::int AS count FROM engine_work_items GROUP BY engine_id ORDER BY engine_id`),
      client.query(`SELECT state, count(*)::int AS count FROM evidence_records GROUP BY state`),
      client.query(`SELECT count(*)::int AS count FROM escalations WHERE resolved_at IS NULL`),
      client.query(`SELECT id, title, ranking_score, ranking_verdict, status, created_at FROM opportunities ORDER BY ranking_score DESC LIMIT 10`)
    ]);
    return {
      tenant: { id: actor.tenantId, name: actor.tenantName },
      engineCounts: engineCounts.rows,
      evidenceCounts: evidenceCounts.rows,
      openEscalations: escalations.rows[0]?.count ?? 0,
      opportunities: opportunities.rows
    };
  });
}
