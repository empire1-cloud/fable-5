import { randomUUID } from "node:crypto";
import { pool, withTenant } from "./db.js";
import { loadIntentTokenForSpend } from "./repository.js";
import { evaluateIntentToken } from "./domain/spend.js";

const baseUrl = () => String(process.env.ECONOMIC_TRUTH_API_URL ?? "").replace(/\/$/, "");
const apiKey = () => String(process.env.ECONOMIC_TRUTH_INGEST_KEY ?? "");

export function buildEconomicTruthProposal(actor, token, request, eventKey) {
  return {
    action_type: request.action,
    organization_id: actor.tenantId,
    actor_id: actor.userId,
    charter_id: request.charterId || process.env.FABLE5_CHARTER_ID || "fable5-charter-v1",
    policy_id: request.policyId || process.env.FABLE5_POLICY_ID || "fable5-intent-token-policy-v1",
    intent_token_id: token?.id || null,
    idempotency_key: eventKey,
    target: { vendor_or_system: request.vendorOrSystem, ...(request.target || {}) },
    economic_value: { amount: String(request.amount), currency: request.currency },
    evidence: {
      ...(request.evidence || {}),
      source: "fable-5",
      environment: request.environment,
      token_scope: token ? {
        action: token.action,
        vendor_or_system: token.vendorOrSystem,
        max_amount: token.maxAmount,
        currency: token.currency,
        expires_at: token.expiresAt,
      } : null,
    },
  };
}

async function call(path, body, transport = fetch) {
  if (!baseUrl() || !apiKey()) throw new Error("Economic Truth endpoint or ingest key is not configured");
  const response = await transport(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-economic-truth-key": apiKey() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Number(process.env.ECONOMIC_TRUTH_TIMEOUT_MS ?? 8000)),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.reason || `Economic Truth HTTP ${response.status}`);
  return data;
}

export async function queueIntentVerdict(actor, token, request, verdict, transport = fetch) {
  const eventKey = String(request.idempotencyKey || `intent:${token?.id || "missing"}:${randomUUID()}`);
  const payload = buildEconomicTruthProposal(actor, token, request, eventKey);
  const outboxId = randomUUID();

  const row = await withTenant(actor.tenantId, async (client) => {
    const result = await client.query(
      `INSERT INTO economic_truth_outbox (id, tenant_id, event_key, event_type, payload)
       VALUES ($1,$2,$3,'intent_verdict',$4)
       ON CONFLICT (tenant_id, event_key) DO UPDATE SET updated_at=now()
       RETURNING *`,
      [outboxId, actor.tenantId, eventKey, payload]
    );
    return result.rows[0];
  });
  return deliverOutboxRow(actor, row, { token, verdict }, transport);
}

async function deliverOutboxRow(actor, row, context, transport = fetch) {
  try {
    const coverageSurfaces = [
      "fable.intent.authorization",
      ...((row.payload.evidence && row.payload.evidence.coverage_surfaces) || []),
    ];
    for (const surfaceId of [...new Set(coverageSurfaces)]) {
      await call("/api/economic-truth/coverage/heartbeat", {
        surface_id: surfaceId,
        healthy: true,
        detail: { action_id: actionId, event_key: row.event_key },
      }, transport);
    }

    await withTenant(actor.tenantId, (client) => client.query(
      `UPDATE economic_truth_outbox SET state='sending', attempts=attempts+1, updated_at=now() WHERE id=$1`,
      [row.id]
    ));
    const proposed = await call("/api/economic-truth/actions", row.payload, transport);
    const actionId = proposed.action.action_id;
    const parent = [proposed.receipt.receipt_id];
    const final = context.verdict.allowed
      ? await call(`/api/economic-truth/actions/${actionId}/authorize`, {
          allowed: true,
          charter_verified: true,
          policy_verified: true,
          authorized_by: "fable-5",
          intent_token_id: context.token?.id,
          verdict_code: context.verdict.code,
          parent_receipt_ids: parent,
        }, transport)
      : await call(`/api/economic-truth/actions/${actionId}/outcome`, {
          refused: true,
          source: "fable-5",
          external_id: `intent-refusal:${row.event_key}`,
          reason: context.verdict.reason,
          verdict_code: context.verdict.code,
          parent_receipt_ids: parent,
        }, transport);

    await withTenant(actor.tenantId, (client) => client.query(
      `UPDATE economic_truth_outbox
          SET state=$2, action_id=$3, response=$4, last_error=NULL, updated_at=now()
        WHERE id=$1`,
      [row.id, context.verdict.allowed ? "delivered" : "refused", actionId, final]
    ));
    return { ...context.verdict, economicTruthActionId: actionId, receipt: final.receipt, graphRecorded: true };
  } catch (error) {
    await withTenant(actor.tenantId, (client) => client.query(
      `UPDATE economic_truth_outbox
          SET state='pending', last_error=$2,
              next_attempt_at=now() + make_interval(secs => LEAST(3600, GREATEST(30, attempts * 30))),
              updated_at=now()
        WHERE id=$1`,
      [row.id, String(error.message).slice(0, 500)]
    ));
    return {
      allowed: false,
      executed: false,
      code: "ECONOMIC_TRUTH_PENDING",
      reason: "Authorization is withheld until its durable Economic Truth receipt is recorded.",
      outboxId: row.id,
    };
  }
}

export async function flushEconomicTruthOutbox(actor, transport = fetch) {
  const rows = await withTenant(actor.tenantId, async (client) => (
    await client.query(
      `SELECT * FROM economic_truth_outbox
        WHERE state IN ('pending','sending') AND next_attempt_at <= now()
        ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED`
    )
  ).rows);
  const results = [];
  for (const row of rows) {
    const tokenId = row.payload.intent_token_id;
    const token = tokenId ? await loadIntentTokenForSpend(actor, tokenId) : null;
    const verdict = evaluateIntentToken(token, {
      tenantId: actor.tenantId,
      action: row.payload.action_type,
      vendorOrSystem: row.payload.target?.vendor_or_system,
      amount: row.payload.economic_value?.amount,
      currency: row.payload.economic_value?.currency,
      environment: row.payload.evidence?.environment,
    });
    results.push(await deliverOutboxRow(actor, row, { token, verdict }, transport));
  }
  return { processed: results.length, results };
}
