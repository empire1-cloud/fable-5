import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.resolve(__dirname, "../src/server.js");
const TEST_PORT = Number(process.env.TEST_PORT ?? 3111);
const BASE = `http://127.0.0.1:${TEST_PORT}`;

const EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL;
const PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;

let server;

async function waitForHealth(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("server did not become healthy in time");
}

async function req(method, pathname, { token, body } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { status: res.status, body: payload };
}

test.before(async () => {
  assert.ok(EMAIL && PASSWORD, "BOOTSTRAP_ADMIN_EMAIL/PASSWORD must be set in scale-v2/.env");
  server = spawn(process.execPath, [serverEntry], {
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
    cwd: path.resolve(__dirname, "..")
  });
  server.stdout.on("data", () => {});
  server.stderr.on("data", () => {});
  await waitForHealth();
});

test.after(async () => {
  if (server && server.exitCode === null) server.kill("SIGTERM");
  await once(server, "exit").catch(() => {});
});

test("GET /api/health reports the rev-2.0 control plane", async () => {
  const { status, body } = await req("GET", "/api/health");
  assert.equal(status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.moneyExecutionDefault, false);
});

test("auth: login returns { token, actor } and /me honours it", async () => {
  const login = await req("POST", "/api/auth/login", { body: { email: EMAIL, password: PASSWORD } });
  assert.equal(login.status, 200);
  assert.ok(login.body.token, "token returned");
  assert.ok(login.body.actor.userId, "actor.userId returned");
  assert.ok(login.body.actor.tenantId, "actor.tenantId returned");
  assert.equal(login.body.actor.email, EMAIL);
  assert.equal(login.body.actor.role, "OWNER");

  const me = await req("GET", "/api/auth/me", { token: login.body.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.actor.userId, login.body.actor.userId);
  assert.ok(me.body.expiresAt, "expiresAt returned");
});

test("auth: a forged/expired token is refused on /me", async () => {
  const me = await req("GET", "/api/auth/me", { token: "not-a-real-token" });
  assert.equal(me.status, 401);
});

test("evidence: create → gates → receipts → verify → measure, with skip refused", async () => {
  const token = await loginToken();
  const claim = `Integration evidence ${Date.now()} ${randomUUID().slice(0, 8)}`;

  const created = await req("POST", "/api/evidence", { token, body: { claim } });
  assert.equal(created.status, 201);
  assert.equal(created.body.state, "PROPOSED");
  const recordId = created.body.id;

  const listed = await req("GET", "/api/evidence", { token });
  assert.equal(listed.status, 200);
  assert.ok(listed.body.some((r) => r.id === recordId), "record appears in list");

  const one = await req("GET", `/api/evidence/${recordId}`, { token });
  assert.equal(one.status, 200);
  assert.equal(one.body.id, recordId);

  const skipped = await req("POST", `/api/evidence/${recordId}/transition`, { token, body: { to: "RECEIPTED", reason: "jump" } });
  assert.equal(skipped.status, 409, "skipping to RECEIPTED is refused");

  const authorized = await req("POST", `/api/evidence/${recordId}/transition`, { token, body: { to: "AUTHORIZED", reason: "gated" } });
  assert.equal(authorized.status, 200);
  assert.equal(authorized.body.state, "AUTHORIZED");

  const executed = await req("POST", `/api/evidence/${recordId}/transition`, { token, body: { to: "EXECUTED", reason: "ran it" } });
  assert.equal(executed.status, 200);
  assert.equal(executed.body.state, "EXECUTED");

  const receipt = await req("POST", `/api/evidence/${recordId}/receipts`, {
    token,
    body: { receipt_type: "log", description: "signed execution log" }
  });
  assert.equal(receipt.status, 201);
  assert.equal(receipt.body.receipts.length, 1);
  const receiptId = receipt.body.receipts[0].id;

  const receipted = await req("POST", `/api/evidence/${recordId}/transition`, { token, body: { to: "RECEIPTED", reason: "proof attached" } });
  assert.equal(receipted.status, 200);
  assert.equal(receipted.body.state, "RECEIPTED");

  const unverified = await req("POST", `/api/evidence/${recordId}/transition`, { token, body: { to: "VERIFIED", reason: "claimed" } });
  assert.equal(unverified.status, 409, "VERIFIED without an independent verification is refused");

  const verification = await req("POST", `/api/evidence/${recordId}/verifications`, {
    token,
    body: { receipt_id: receiptId, reproduced: true, method: "independent re-run by a second actor", independent: true }
  });
  assert.equal(verification.status, 201);
  assert.equal(verification.body.verifications.length, 1);

  const verified = await req("POST", `/api/evidence/${recordId}/transition`, { token, body: { to: "VERIFIED", reason: "independently reproduced" } });
  assert.equal(verified.status, 200);
  assert.equal(verified.body.state, "VERIFIED");

  const unmeasured = await req("POST", `/api/evidence/${recordId}/transition`, { token, body: { to: "MEASURED", reason: "claimed" } });
  assert.equal(unmeasured.status, 409, "MEASURED without a gate measurement is refused");

  const measurement = await req("POST", `/api/evidence/${recordId}/measurements`, {
    token,
    body: { gate_type: "conversion", reading: { delta: 0.12 }, verdict: "PASS" }
  });
  assert.equal(measurement.status, 201);
  assert.equal(measurement.body.measurements.length, 1);

  const measured = await req("POST", `/api/evidence/${recordId}/transition`, { token, body: { to: "MEASURED", reason: "gated" } });
  assert.equal(measured.status, 200);
  assert.equal(measured.body.state, "MEASURED");
});

test("evidence: another tenant's record is invisible (404, not leaked)", async () => {
  const token = await loginToken();
  const unknown = await req("GET", `/api/evidence/${randomUUID()}`, { token });
  assert.equal(unknown.status, 404);
});

test("missions: create → update → archive through engine_work_items", async () => {
  const token = await loginToken();
  const created = await req("POST", "/api/missions", {
    token,
    body: {
      objective: `Prove onboarding reduces churn (${randomUUID().slice(0, 8)})`,
      owner: "engineer",
      autonomy_level: "L2",
      success_criteria: "churn -5pp in 30 days",
      evidence_requirement: "receipt + independent verification"
    }
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.status, "PLANNED");
  const missionId = created.body.id;

  const updated = await req("PUT", `/api/missions/${missionId}`, { token, body: { status: "ACTIVE", blocker: "vendor latency" } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.status, "ACTIVE");
  assert.equal(updated.body.blocker, "vendor latency");

  const archived = await req("POST", `/api/missions/${missionId}/archive`, { token });
  assert.equal(archived.status, 200);
  assert.equal(archived.body.status, "ARCHIVED");

  const listed = await req("GET", "/api/missions", { token });
  assert.equal(listed.status, 200);
  assert.ok(listed.body.some((m) => m.id === missionId));
});

test("intent tokens: issue → list → check → revoke → refused", async () => {
  const token = await loginToken();
  const created = await req("POST", "/api/intent-tokens", {
    token,
    body: { action: "deploy", vendor_or_system: "stripe-test", max_amount: 50, currency: "USD", environment: "sandbox" }
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.max_amount, 50);
  const tokenId = created.body.id;

  const listed = await req("GET", "/api/intent-tokens", { token });
  assert.equal(listed.status, 200);
  assert.ok(listed.body.some((t) => t.id === tokenId));

  const verdict = await req("POST", "/api/intent-tokens/check", {
    token,
    body: { tokenId, request: { action: "deploy", vendorOrSystem: "stripe-test", amount: 20, currency: "USD", environment: "sandbox" } }
  });
  assert.equal(verdict.status, 200);
  assert.equal(verdict.body.allowed, true);
  assert.equal(verdict.body.executed, false, "no silent execution");

  const revoked = await req("POST", `/api/intent-tokens/${tokenId}/revoke`, { token });
  assert.equal(revoked.status, 200);
  assert.equal(revoked.body.revoked, true);

  const refused = await req("POST", "/api/intent-tokens/check", {
    token,
    body: { tokenId, request: { action: "deploy", vendorOrSystem: "stripe-test", amount: 20, currency: "USD", environment: "sandbox" } }
  });
  assert.equal(refused.status, 403);
  assert.equal(refused.body.allowed, false);
  assert.equal(refused.body.code, "TOKEN_REVOKED");
});

test("opportunities: list is ranked by the server", async () => {
  const token = await loginToken();
  const listed = await req("GET", "/api/opportunities", { token });
  assert.equal(listed.status, 200);
  assert.ok(Array.isArray(listed.body));
});

async function loginToken() {
  const login = await req("POST", "/api/auth/login", { body: { email: EMAIL, password: PASSWORD } });
  assert.equal(login.status, 200);
  return login.body.token;
}
