import { randomUUID } from "node:crypto";
import { pool, withTenant } from "./db.js";
import { rankOpportunity } from "./domain/ranking.js";
import { assertTransition } from "./domain/evidence.js";

const notFound = (message) => Object.assign(new Error(message), { status: 404 });
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const conflict = (message) => Object.assign(new Error(message), { status: 409 });

function normalizeGrade(value) {
  const grade = String(value ?? "C").toUpperCase();
  return ["A", "B", "C"].includes(grade) ? grade : "C";
}

function normalizeConfidence(value) {
  const confidence = Number(value ?? 0);
  if (!Number.isFinite(confidence)) return 0;
  return Math.min(1, Math.max(0, confidence));
}

function normalizeStatus(value) {
  const status = String(value ?? "PLANNED").toUpperCase();
  return ["PLANNED", "ACTIVE", "BLOCKED", "COMPLETE", "ARCHIVED"].includes(status) ? status : "PLANNED";
}

/** Serialize one evidence record with every attached child collection. */
async function serializeEvidence(client, id) {
  const rec = await client.query(`SELECT * FROM evidence_records WHERE id=$1`, [id]);
  const row = rec.rows[0];
  if (!row) throw notFound("Evidence not found");

  const [receipts, verifications, measurements, contradictions, events] = await Promise.all([
    client.query(`SELECT * FROM evidence_receipts WHERE evidence_id=$1 ORDER BY created_at`, [id]),
    client.query(`SELECT * FROM evidence_verifications WHERE evidence_id=$1 ORDER BY created_at`, [id]),
    client.query(`SELECT * FROM evidence_measurements WHERE evidence_id=$1 ORDER BY created_at`, [id]),
    client.query(`SELECT * FROM contradictions WHERE left_evidence_id=$1 OR right_evidence_id=$1 ORDER BY created_at`, [id]),
    client.query(`SELECT * FROM evidence_events WHERE evidence_id=$1 ORDER BY created_at`, [id]),
  ]);

  return {
    id: row.id,
    subject_type: row.subject_type,
    subject_id: row.subject_id,
    claim: row.claim,
    state: row.state,
    grade: row.grade,
    confidence: Number(row.confidence),
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    receipts: receipts.rows.map((r) => ({
      id: r.id,
      receipt_type: r.receipt_type,
      uri: r.uri,
      digest: r.digest,
      description: r.description,
      grade: r.grade,
      is_demo: r.is_demo,
      created_at: r.created_at
    })),
    verifications: verifications.rows.map((v) => ({
      id: v.id,
      method: v.method,
      verifier: v.verifier,
      independent: v.independent,
      reproducible: v.reproducible,
      result: v.result,
      created_at: v.created_at
    })),
    measurements: measurements.rows.map((m) => ({
      id: m.id,
      gate_type: m.gate_type,
      reading: m.reading,
      verdict: m.verdict,
      created_at: m.created_at
    })),
    contradictions: contradictions.rows.map((c) => ({
      id: c.id,
      description: c.description,
      severity: c.severity,
      resolved: c.resolved_at != null,
      resolution: c.resolution,
      resolved_at: c.resolved_at,
      created_at: c.created_at
    })),
    audit_entries: events.rows.map((e) => ({
      id: e.id,
      state_from: e.state_from,
      state_to: e.state_to,
      reason: e.reason,
      actor_id: e.actor_id,
      metadata: e.metadata,
      created_at: e.created_at
    })),
  };
}

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
  try {
    return await withTenant(actor.tenantId, async (client) => {
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
      if (!row) throw notFound("Opportunity not found");
      if (!["A", "B"].includes(row.grade) || Number(row.receipt_count) < 1) {
        throw Object.assign(
          conflict("Engine 00 gate refused: evidence grade A/B and at least one receipt are required."),
          { evidenceId: row.evidence_id, engineId: "00" }
        );
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
  } catch (error) {
    // A refused gate is real intelligence, not noise — it is persisted as an
    // escalation in its own transaction (the authorize transaction above
    // already rolled back) so the refusal survives on the record instead of
    // vanishing with the thrown error. The authorize action itself still
    // fails — raising an escalation never turns a refusal into a success.
    if (error?.status === 409 && error?.evidenceId) {
      await raiseEscalation(actor, {
        engineId: error.engineId ?? "00",
        severity: "MEDIUM",
        reason: error.message,
        evidenceId: error.evidenceId
      }).catch((writeError) => {
        console.error(JSON.stringify({ level: "error", event: "escalation_write_failed", message: writeError.message }));
      });
    }
    throw error;
  }
}

export async function raiseEscalation(actor, { engineId, severity, reason, evidenceId }) {
  return withTenant(actor.tenantId, async (client) => {
    const id = randomUUID();
    await client.query(
      `INSERT INTO escalations (id, tenant_id, engine_id, severity, reason, evidence_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, actor.tenantId, engineId, severity, reason, evidenceId ?? null]
    );
    return { id };
  });
}

export async function listEscalations(actor) {
  return withTenant(actor.tenantId, async (client) => {
    const result = await client.query(
      `SELECT id, engine_id, severity, reason, evidence_id, resolved_at, resolution, created_at
         FROM escalations
        ORDER BY (resolved_at IS NULL) DESC, created_at DESC`
    );
    return result.rows;
  });
}

export async function resolveEscalation(actor, escalationId, resolution) {
  return withTenant(actor.tenantId, async (client) => {
    const result = await client.query(
      `UPDATE escalations SET resolved_at = now(), resolution = $1
        WHERE id = $2 AND resolved_at IS NULL
      RETURNING id, engine_id, severity, reason, evidence_id, resolved_at, resolution, created_at`,
      [resolution, escalationId]
    );
    const row = result.rows[0];
    if (!row) throw notFound("Escalation not found or already resolved");
    return row;
  });
}

export async function listDecisions(actor) {
  return withTenant(actor.tenantId, async (client) => {
    const result = await client.query(
      `SELECT d.id, d.opportunity_id, d.verdict, d.reason, d.decided_by, d.created_at,
              o.title AS opportunity_title, o.ranking_score, o.ranking_verdict, o.ranking_factors,
              u.email AS decided_by_email
         FROM decisions d
         JOIN opportunities o ON o.id = d.opportunity_id
         LEFT JOIN users u ON u.id = d.decided_by
        ORDER BY d.created_at DESC`
    );
    return result.rows.map((r) => ({
      id: r.id,
      opportunity_id: r.opportunity_id,
      opportunity_title: r.opportunity_title,
      verdict: r.verdict,
      reason: r.reason,
      ranking_score: r.ranking_score === null ? null : Number(r.ranking_score),
      ranking_verdict: r.ranking_verdict,
      ranking_factors: r.ranking_factors,
      decided_by_email: r.decided_by_email,
      created_at: r.created_at
    }));
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
    return serializeEvidence(client, evidenceId);
  });
}

export async function listEvidence(actor) {
  return withTenant(actor.tenantId, async (client) => {
    const result = await client.query(`SELECT id FROM evidence_records ORDER BY created_at DESC`);
    const records = [];
    for (const row of result.rows) records.push(await serializeEvidence(client, row.id));
    return records;
  });
}

export async function getEvidence(actor, evidenceId) {
  return withTenant(actor.tenantId, async (client) => serializeEvidence(client, evidenceId));
}

export async function createEvidence(actor, payload) {
  return withTenant(actor.tenantId, async (client) => {
    const id = randomUUID();
    const claim = String(payload.claim ?? payload.subject ?? payload.title ?? "").trim();
    if (!claim) throw badRequest("claim is required");
    const metadata = { ...(payload.metadata ?? {}) };
    if (payload.is_financial) {
      metadata.financial_scope = {
        vendor_or_system: payload.vendor_or_system ?? null,
        financial_amount: payload.financial_amount ?? null,
        financial_currency: payload.financial_currency ?? null,
        financial_environment: payload.financial_environment ?? null
      };
    }
    await client.query(
      `INSERT INTO evidence_records
        (id, tenant_id, subject_type, subject_id, claim, state, grade, confidence, created_by)
       VALUES ($1,$2,$3,$4,$5,'PROPOSED',$6,$7,$8)`,
      [id, actor.tenantId, payload.subject_type ?? "generic", payload.subject_id ?? id, claim, normalizeGrade(payload.grade), normalizeConfidence(payload.confidence), actor.userId]
    );
    await client.query(
      `INSERT INTO evidence_events (id, tenant_id, evidence_id, state_from, state_to, reason, actor_id, metadata)
       VALUES ($1,$2,$3,NULL,'PROPOSED','Record created',$4,$5)`,
      [randomUUID(), actor.tenantId, id, actor.userId, metadata]
    );
    return serializeEvidence(client, id);
  });
}

async function assertEvidenceOwned(client, evidenceId) {
  const result = await client.query(`SELECT 1 FROM evidence_records WHERE id=$1`, [evidenceId]);
  if (!result.rows[0]) throw notFound("Evidence not found");
}

export async function addReceipt(actor, evidenceId, body) {
  return withTenant(actor.tenantId, async (client) => {
    await assertEvidenceOwned(client, evidenceId);
    const description = String(body.description ?? body.content ?? "").trim();
    if (!description) throw badRequest("receipt description is required");
    await client.query(
      `INSERT INTO evidence_receipts
        (id, tenant_id, evidence_id, receipt_type, uri, digest, description, grade, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [randomUUID(), actor.tenantId, evidenceId,
       body.receipt_type ?? body.kind ?? "artifact",
       body.uri ?? null,
       body.digest ?? null,
       description,
       normalizeGrade(body.grade),
       Boolean(body.is_demo ?? false)]
    );
    return serializeEvidence(client, evidenceId);
  });
}

export async function addVerification(actor, evidenceId, body) {
  return withTenant(actor.tenantId, async (client) => {
    await assertEvidenceOwned(client, evidenceId);
    const receiptId = body.receipt_id ?? null;
    if (receiptId) {
      const owned = await client.query(
        `SELECT 1 FROM evidence_receipts WHERE id=$1 AND evidence_id=$2`,
        [receiptId, evidenceId]
      );
      if (!owned.rows[0]) throw notFound("Receipt not found on this record");
    }
    const method = String(body.method ?? "").trim();
    if (method.length < 8) throw badRequest("verification method must be at least 8 characters");
    await client.query(
      `INSERT INTO evidence_verifications
        (id, tenant_id, evidence_id, method, verifier, independent, reproducible, result)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(), actor.tenantId, evidenceId,
       method,
       body.verifier ?? actor.email,
       Boolean(body.independent ?? false),
       Boolean(body.reproduced ?? false),
       body.result ?? { receipt_id: receiptId }]
    );
    return serializeEvidence(client, evidenceId);
  });
}

export async function addMeasurement(actor, evidenceId, body) {
  return withTenant(actor.tenantId, async (client) => {
    await assertEvidenceOwned(client, evidenceId);
    const verdict = String(body.verdict ?? "PASS").toUpperCase();
    if (!["PASS", "FAIL", "CLONE", "ITERATE", "PAUSE", "KILL"].includes(verdict)) {
      throw badRequest(`Unknown measurement verdict: ${verdict}`);
    }
    await client.query(
      `INSERT INTO evidence_measurements
        (id, tenant_id, evidence_id, gate_type, reading, verdict)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [randomUUID(), actor.tenantId, evidenceId,
       body.gate_type ?? body.gateType ?? "default",
       body.reading ?? {},
       verdict]
    );
    return serializeEvidence(client, evidenceId);
  });
}

export async function listOpportunities(actor) {
  return withTenant(actor.tenantId, async (client) => {
    const result = await client.query(
      `SELECT id, title, summary, ranking_score, ranking_verdict, ranking_factors, evidence_id, status, created_at
         FROM opportunities
        ORDER BY ranking_score DESC`
    );
    return result.rows.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      ranking_score: Number(r.ranking_score),
      ranking_verdict: r.ranking_verdict,
      ranking_factors: r.ranking_factors,
      evidence_id: r.evidence_id,
      status: r.status,
      created_at: r.created_at
    }));
  });
}

function serializeMission(row) {
  const p = row.payload ?? {};
  return {
    id: row.id,
    engine_id: row.engine_id,
    owner: p.owner ?? "",
    objective: row.title,
    autonomy_level: p.autonomy_level ?? "L1",
    status: row.status,
    success_criteria: p.success_criteria ?? null,
    evidence_requirement: p.evidence_requirement ?? null,
    blocker: p.blocker ?? null,
    escalation_condition: p.escalation_condition ?? null,
    record_id: row.evidence_id ?? null,
    created_at: row.created_at
  };
}

async function fetchMission(client, missionId) {
  const result = await client.query(
    `SELECT * FROM engine_work_items WHERE id=$1 AND item_type='mission'`,
    [missionId]
  );
  const row = result.rows[0];
  if (!row) throw notFound("Mission not found");
  return row;
}

export async function listMissions(actor) {
  return withTenant(actor.tenantId, async (client) => {
    const result = await client.query(
      `SELECT * FROM engine_work_items WHERE item_type='mission' ORDER BY created_at DESC`
    );
    return result.rows.map(serializeMission);
  });
}

export async function getMission(actor, missionId) {
  return withTenant(actor.tenantId, async (client) => serializeMission(await fetchMission(client, missionId)));
}

export async function createMission(actor, payload) {
  return withTenant(actor.tenantId, async (client) => {
    const id = randomUUID();
    const objective = String(payload.objective ?? payload.title ?? "").trim();
    if (!objective) throw badRequest("mission objective is required");
    const recordId = payload.record_id ?? null;
    if (recordId) await assertEvidenceOwned(client, recordId);
    const missionPayload = {
      owner: payload.owner ?? actor.email,
      autonomy_level: String(payload.autonomy_level ?? "L1").toUpperCase(),
      success_criteria: payload.success_criteria ?? null,
      evidence_requirement: payload.evidence_requirement ?? null,
      blocker: payload.blocker ?? null,
      escalation_condition: payload.escalation_condition ?? null,
      record_id: recordId
    };
    await client.query(
      `INSERT INTO engine_work_items
        (id, tenant_id, engine_id, item_type, title, status, payload, evidence_id, created_by)
       VALUES ($1,$2,$3,'mission',$4,$5,$6,$7,$8)`,
      [id, actor.tenantId, payload.engine_id ?? "00", objective, normalizeStatus(payload.status), missionPayload, recordId, actor.userId]
    );
    return serializeMission(await fetchMission(client, id));
  });
}

export async function updateMission(actor, missionId, payload) {
  return withTenant(actor.tenantId, async (client) => {
    const existing = await fetchMission(client, missionId);
    const merged = {
      owner: payload.owner ?? existing.payload?.owner ?? "",
      autonomy_level: String(payload.autonomy_level ?? existing.payload?.autonomy_level ?? "L1").toUpperCase(),
      success_criteria: payload.success_criteria ?? existing.payload?.success_criteria ?? null,
      evidence_requirement: payload.evidence_requirement ?? existing.payload?.evidence_requirement ?? null,
      blocker: payload.blocker ?? existing.payload?.blocker ?? null,
      escalation_condition: payload.escalation_condition ?? existing.payload?.escalation_condition ?? null,
      record_id: payload.record_id ?? existing.evidence_id ?? null
    };
    await client.query(
      `UPDATE engine_work_items
          SET title=$1, status=$2, payload=$3, updated_at=now()
        WHERE id=$4`,
      [String(payload.objective ?? existing.title), normalizeStatus(payload.status ?? existing.status), merged, missionId]
    );
    return serializeMission(await fetchMission(client, missionId));
  });
}

export async function archiveMission(actor, missionId) {
  return withTenant(actor.tenantId, async (client) => {
    await fetchMission(client, missionId);
    await client.query(
      `UPDATE engine_work_items SET status='ARCHIVED', updated_at=now() WHERE id=$1`,
      [missionId]
    );
    return serializeMission(await fetchMission(client, missionId));
  });
}

function serializeIntentToken(row) {
  return {
    id: row.id,
    action: row.action,
    vendor_or_system: row.vendor_or_system,
    max_amount: Number(row.max_amount),
    currency: row.currency,
    environment: row.environment,
    recurrence: row.recurrence,
    expires_at: row.expires_at,
    revoked: row.revoked_at != null,
    revoked_at: row.revoked_at,
    approved_by: row.approved_by,
    created_at: row.created_at
  };
}

export async function listIntentTokens(actor) {
  return withTenant(actor.tenantId, async (client) => {
    const result = await client.query(`SELECT * FROM intent_tokens ORDER BY created_at DESC`);
    return result.rows.map(serializeIntentToken);
  });
}

export async function createIntentToken(actor, payload) {
  return withTenant(actor.tenantId, async (client) => {
    const maxAmount = Number(payload.max_amount ?? payload.maxAmount);
    if (!Number.isFinite(maxAmount) || maxAmount < 0) throw badRequest("max_amount is required and must be >= 0");
    const expiresAt = new Date(payload.expires_at ?? Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(expiresAt.getTime())) throw badRequest("expires_at is not a valid date");
    const id = randomUUID();
    await client.query(
      `INSERT INTO intent_tokens
        (id, tenant_id, approved_by, action, vendor_or_system, max_amount, currency, expires_at, environment, recurrence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, actor.tenantId, actor.userId,
       payload.action ?? "pay",
       payload.vendor_or_system ?? payload.vendorOrSystem ?? "",
       maxAmount,
       payload.currency ?? "USD",
       expiresAt,
       payload.environment ?? "sandbox",
       payload.recurrence ?? "one-shot"]
    );
    const result = await client.query(`SELECT * FROM intent_tokens WHERE id=$1`, [id]);
    return serializeIntentToken(result.rows[0]);
  });
}

export async function revokeIntentToken(actor, tokenId) {
  return withTenant(actor.tenantId, async (client) => {
    const result = await client.query(
      `UPDATE intent_tokens SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL RETURNING *`,
      [tokenId]
    );
    if (!result.rows[0]) {
      const exists = await client.query(`SELECT 1 FROM intent_tokens WHERE id=$1`, [tokenId]);
      if (!exists.rows[0]) throw notFound("Intent Token not found");
      const row = (await client.query(`SELECT * FROM intent_tokens WHERE id=$1`, [tokenId])).rows[0];
      return serializeIntentToken(row);
    }
    return serializeIntentToken(result.rows[0]);
  });
}

/** Shape used by the spend verdict engine (camelCase keys the domain expects). */
export async function loadIntentTokenForSpend(actor, tokenId) {
  return withTenant(actor.tenantId, async (client) => {
    const result = await client.query(`SELECT * FROM intent_tokens WHERE id=$1`, [tokenId]);
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenant_id,
      action: row.action,
      vendorOrSystem: row.vendor_or_system,
      maxAmount: Number(row.max_amount),
      currency: row.currency,
      expiresAt: row.expires_at,
      environment: row.environment,
      revoked: row.revoked_at != null,
      approvedBy: row.approved_by
    };
  });
}

/** Public founding-access waitlist (pre-signup queue, no tenant context). */
export async function addToWaitlist({ email, name, company, claim }) {
  const result = await pool.query(
    `INSERT INTO founding_waitlist (email, name, company, claim, status)
     VALUES ($1, $2, $3, $4, 'pending')
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       company = EXCLUDED.company,
       claim = EXCLUDED.claim,
       status = CASE WHEN founding_waitlist.status = 'closed' THEN 'closed' ELSE founding_waitlist.status END,
       refreshed_at = now()
     RETURNING id, email, name, company, claim, status, created_at`,
    [String(email).trim().toLowerCase(), name || null, company || null, claim || null]
  );
  return result.rows[0];
}

/** Founder-only view of the waitlist queue. */
export async function listWaitlist(actor) {
  if (actor.role !== "OWNER") throw Object.assign(new Error("Founder access only"), { status: 403 });
  const result = await pool.query(
    `SELECT id, email, name, company, claim, status, created_at, refreshed_at
       FROM founding_waitlist ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function listGenomes(actor) {
  return withTenant(actor.tenantId, async (client) => {
    const result = await client.query(
      `SELECT g.id, g.code, g.name, g.thesis, g.maturity, g.economic_gate_type, g.created_at,
              (SELECT count(*)::int FROM market_nodes n WHERE n.genome_id = g.id) AS node_count,
              (SELECT count(*)::int FROM genome_sections s WHERE s.genome_id = g.id) AS section_count,
              -- proven is computed from the evidence machine, never stored
              (SELECT count(*)::int
                 FROM genome_sections s
                 JOIN evidence_records e ON e.id = s.evidence_id
                WHERE s.genome_id = g.id
                  AND e.state IN ('VERIFIED','MEASURED','LEARNED','CANONIZED')) AS proven_count
         FROM company_genomes g
        ORDER BY g.code`
    );
    return result.rows;
  });
}

/** The evidence states that count as actually proven. Attaching evidence is a
 *  claim; only these states are proof. Kept here so the definition lives in
 *  one place and matches domain/evidence.js. */
const PROVEN_STATES = ["VERIFIED", "MEASURED", "LEARNED", "CANONIZED"];

const MATURITY_ORDER = ["Draft", "Tested", "Verified", "Replication-Ready"];

export async function createGenome(actor, payload) {
  const code = String(payload?.code ?? "").trim();
  const name = String(payload?.name ?? "").trim();
  if (!code || !name) throw badRequest("code and name are required");
  return withTenant(actor.tenantId, async (client) => {
    const result = await client.query(
      `INSERT INTO company_genomes (tenant_id, code, name, thesis, maturity, economic_gate_type)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (tenant_id, code) DO NOTHING
       RETURNING id, code, name, thesis, maturity, economic_gate_type, created_at`,
      [
        actor.tenantId,
        code,
        name,
        String(payload.thesis ?? ""),
        // A new genome starts at Draft. Maturity is earned through the
        // evidence gate, not chosen at creation time.
        "Draft",
        String(payload.economic_gate_type ?? "")
      ]
    );
    if (!result.rows[0]) throw conflict(`A genome with code ${code} already exists.`);
    return result.rows[0];
  });
}

export async function addGenomeSection(actor, genomeId, payload) {
  const key = String(payload?.section_key ?? "").trim();
  const label = String(payload?.label ?? "").trim();
  if (!key || !label) throw badRequest("section_key and label are required");
  return withTenant(actor.tenantId, async (client) => {
    const genome = await client.query(`SELECT id FROM company_genomes WHERE id=$1`, [genomeId]);
    if (!genome.rows[0]) throw notFound("Genome not found");

    // Evidence must belong to this tenant; RLS already scopes the lookup, so a
    // foreign record simply is not found rather than being silently accepted.
    if (payload.evidence_id) {
      const ev = await client.query(`SELECT id FROM evidence_records WHERE id=$1`, [payload.evidence_id]);
      if (!ev.rows[0]) throw notFound("Evidence record not found");
    }

    const result = await client.query(
      `INSERT INTO genome_sections
         (tenant_id, genome_id, section_key, section_group, label, value, evidence_id, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (genome_id, section_key) DO UPDATE
         SET section_group=EXCLUDED.section_group, label=EXCLUDED.label, value=EXCLUDED.value,
             evidence_id=EXCLUDED.evidence_id, updated_at=now()
       RETURNING id, section_key, section_group, label, value, evidence_id, sort_order`,
      [
        actor.tenantId,
        genomeId,
        key,
        String(payload.section_group ?? ""),
        label,
        String(payload.value ?? ""),
        payload.evidence_id ?? null,
        Number.isFinite(Number(payload.sort_order)) ? Number(payload.sort_order) : 0
      ]
    );
    return result.rows[0];
  });
}

export async function getGenome(actor, genomeId) {
  return withTenant(actor.tenantId, async (client) => {
    const genome = await client.query(
      `SELECT id, code, name, thesis, maturity, economic_gate_type, created_at
         FROM company_genomes WHERE id = $1`,
      [genomeId]
    );
    if (!genome.rows[0]) throw notFound("Genome not found");

    const [sections, playbooks, nodes] = await Promise.all([
      client.query(
        `SELECT s.id, s.section_key, s.section_group, s.label, s.value, s.sort_order,
                s.evidence_id, e.state AS evidence_state, e.claim AS evidence_claim
           FROM genome_sections s
           LEFT JOIN evidence_records e ON e.id = s.evidence_id
          WHERE s.genome_id = $1
          ORDER BY s.sort_order, s.section_key`,
        [genomeId]
      ),
      client.query(
        `SELECT c.id, c.title, c.body, c.policy_version, c.approved_by, c.created_at
           FROM genome_playbooks p
           JOIN canon_entries c ON c.id = p.canon_entry_id
          WHERE p.genome_id = $1
          ORDER BY c.created_at`,
        [genomeId]
      ),
      client.query(
        `SELECT id, code, geography, status, evidence_state, autonomy_level
           FROM market_nodes WHERE genome_id = $1 ORDER BY code`,
        [genomeId]
      )
    ]);

    // Provenness is DERIVED, never stored. A section linked to a PROPOSED
    // record is a claim awaiting the gates — not a proof.
    const mapped = sections.rows.map((s) => ({
      id: s.id,
      key: s.section_key,
      group: s.section_group,
      label: s.label,
      value: s.value,
      evidenceId: s.evidence_id,
      evidenceState: s.evidence_state,
      evidenceClaim: s.evidence_claim,
      proven: Boolean(s.evidence_state && PROVEN_STATES.includes(s.evidence_state))
    }));

    const provenCount = mapped.filter((s) => s.proven).length;
    // What is missing is computed from the ledger, not typed into a list.
    const missingForNextStage = mapped
      .filter((s) => !s.proven)
      .map((s) => ({
        label: s.label,
        reason: s.evidenceState
          ? `evidence is ${s.evidenceState} — not yet VERIFIED`
          : "no evidence attached"
      }));

    const row = genome.rows[0];
    const currentIndex = MATURITY_ORDER.indexOf(row.maturity);
    const nextMaturity = currentIndex >= 0 && currentIndex < MATURITY_ORDER.length - 1
      ? MATURITY_ORDER[currentIndex + 1]
      : null;

    return {
      ...row,
      sections: mapped,
      coverage: { proven: provenCount, total: mapped.length },
      playbooks: playbooks.rows,
      nodes: nodes.rows,
      missingForNextStage,
      nextMaturity,
      // The same shape as every other gate in this system: a verdict with the
      // reason attached, computed server-side.
      replicationReady: mapped.length > 0 && provenCount === mapped.length,
      maturityGate:
        mapped.length === 0
          ? { allowed: false, reason: "Genome has no sections — nothing has been described yet." }
          : provenCount === mapped.length
            ? { allowed: true, reason: `All ${mapped.length} sections are backed by VERIFIED-or-later evidence.` }
            : {
                allowed: false,
                reason: `${mapped.length - provenCount} of ${mapped.length} sections lack verified evidence.`
              }
    };
  });
}

export async function listMarketNodes(actor) {
  return withTenant(actor.tenantId, async (client) => {
    const result = await client.query(
      `SELECT n.id, n.code, n.genome_id, g.code AS genome_code, n.geography, n.vertical, n.segment,
              n.offer, n.gate_type, n.evidence_state, n.autonomy_level, n.status, n.status_note,
              n.created_at
         FROM market_nodes n
         LEFT JOIN company_genomes g ON g.id = n.genome_id
        ORDER BY n.code`
    );
    return result.rows;
  });
}

export async function listResourcePools(actor) {
  return withTenant(actor.tenantId, async (client) => {
    const result = await client.query(
      `SELECT id, resource_type, capacity, allocated, unit, financial, created_at
         FROM resource_pools
        ORDER BY resource_type`
    );
    return result.rows.map((r) => ({
      ...r,
      capacity: Number(r.capacity),
      allocated: Number(r.allocated),
      // Computed here so the client never divides by zero or invents a ratio.
      pressure: Number(r.capacity) > 0 ? Number(r.allocated) / Number(r.capacity) : 0
    }));
  });
}

export async function dashboard(actor) {
  return withTenant(actor.tenantId, async (client) => {
    const [engineCounts, evidenceCounts, escalations, opportunities, genomes, nodes, pressure] = await Promise.all([
      client.query(`SELECT engine_id, count(*)::int AS count FROM engine_work_items GROUP BY engine_id ORDER BY engine_id`),
      client.query(`SELECT state, count(*)::int AS count FROM evidence_records GROUP BY state`),
      client.query(`SELECT count(*)::int AS count FROM escalations WHERE resolved_at IS NULL`),
      client.query(`SELECT id, title, ranking_score, ranking_verdict, status, created_at FROM opportunities ORDER BY ranking_score DESC LIMIT 10`),
      client.query(`SELECT count(*)::int AS count FROM company_genomes`),
      client.query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE status IN ('Active','Scaling'))::int AS active
           FROM market_nodes`
      ),
      // The tightest pool defines the pressure. Ordering by ratio means the
      // reported number is the real constraint, not an average that hides it.
      client.query(
        `SELECT resource_type, capacity, allocated,
                CASE WHEN capacity > 0 THEN allocated / capacity ELSE 0 END AS ratio
           FROM resource_pools
          WHERE capacity > 0
          ORDER BY ratio DESC
          LIMIT 1`
      )
    ]);

    const tightest = pressure.rows[0] ?? null;

    return {
      tenant: { id: actor.tenantId, name: actor.tenantName },
      engineCounts: engineCounts.rows,
      evidenceCounts: evidenceCounts.rows,
      openEscalations: escalations.rows[0]?.count ?? 0,
      opportunities: opportunities.rows,
      genomeCount: genomes.rows[0]?.count ?? 0,
      nodes: {
        total: nodes.rows[0]?.total ?? 0,
        activeOrScaling: nodes.rows[0]?.active ?? 0
      },
      // null when no pool has capacity — an absent constraint is reported as
      // absent rather than as 0%, which would read as "plenty of headroom".
      resourcePressure: tightest
        ? { resourceType: tightest.resource_type, ratio: Number(tightest.ratio) }
        : null
    };
  });
}
