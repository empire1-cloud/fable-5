import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_REGISTRY, getEngine } from "./engine-registry.js";
import { requireAuth, login, sessionExpiry } from "./auth.js";
import { healthcheck } from "./db.js";
import {
  createOpportunity,
  authorizeOpportunity,
  transitionEvidence,
  dashboard,
  listEvidence,
  getEvidence,
  createEvidence,
  addReceipt,
  addVerification,
  addMeasurement,
  listOpportunities,
  listMissions,
  getMission,
  createMission,
  updateMission,
  archiveMission,
  listIntentTokens,
  createIntentToken,
  revokeIntentToken,
  loadIntentTokenForSpend,
  addToWaitlist,
  listWaitlist,
  listDecisions,
  listEscalations,
  resolveEscalation
} from "./repository.js";
import { evaluateIntentToken } from "./domain/spend.js";
import { EvidenceTransitionError } from "./domain/evidence.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const appOrigin = process.env.APP_ORIGIN
  ? process.env.APP_ORIGIN.split(",").map((s) => s.trim())
  : true;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");

app.disable("x-powered-by");
app.use(cors({ origin: appOrigin, credentials: false }));
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  req.correlationId = req.headers["x-correlation-id"] || crypto.randomUUID();
  res.setHeader("x-correlation-id", req.correlationId);
  next();
});
app.use(express.static(publicDir, { extensions: ["html"] }));

app.get("/api/health", async (_req, res, next) => {
  try {
    const db = await healthcheck();
    res.json({
      status: "ok",
      service: "fable5-control-plane",
      architecture: "rev-2.0",
      databaseTime: db.database_time,
      moneyExecutionDefault: false
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? "").trim();
    const password = String(req.body?.password ?? "").trim();
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    const result = await login(email, password);
    if (!result) return res.status(401).json({ error: "REFUSED", reason: "Invalid credentials" });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth(), async (req, res, next) => {
  try {
    const session = await sessionExpiry(req.token);
    if (!session) return res.status(401).json({ error: "REFUSED", reason: "Authentication required" });
    res.json({
      actor: req.actor,
      expiresAt: session.expiresAt,
      issuedAt: session.issuedAt
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/system/blueprint", requireAuth(), (req, res) => {
  res.json({
    title: "SHEET 01 · SYSTEM BLUEPRINT · REV 2.0",
    serverAuthoritative: true,
    tenant: { id: req.actor.tenantId, name: req.actor.tenantName },
    engines: ENGINE_REGISTRY
  });
});

app.get("/api/engines/:engineId", requireAuth(), (req, res) => {
  const engine = getEngine(req.params.engineId);
  if (!engine) return res.status(404).json({ error: "Engine not found" });
  res.json(engine);
});

app.get("/api/dashboard", requireAuth(), async (req, res, next) => {
  try {
    res.json(await dashboard(req.actor));
  } catch (error) {
    next(error);
  }
});

app.post("/api/opportunities", requireAuth(), async (req, res, next) => {
  try {
    if (!req.body?.title) return res.status(400).json({ error: "title is required" });
    res.status(201).json(await createOpportunity(req.actor, req.body));
  } catch (error) {
    next(error);
  }
});

app.get("/api/opportunities", requireAuth(), async (req, res, next) => {
  try {
    res.json(await listOpportunities(req.actor));
  } catch (error) {
    next(error);
  }
});

app.post("/api/opportunities/:id/authorize", requireAuth(), async (req, res, next) => {
  try {
    res.json(await authorizeOpportunity(req.actor, req.params.id, req.body?.reason ?? "Authorized through Engine 00"));
  } catch (error) {
    next(error);
  }
});

app.get("/api/decisions", requireAuth(), async (req, res, next) => {
  try {
    res.json(await listDecisions(req.actor));
  } catch (error) {
    next(error);
  }
});

app.get("/api/escalations", requireAuth(), async (req, res, next) => {
  try {
    res.json(await listEscalations(req.actor));
  } catch (error) {
    next(error);
  }
});

app.post("/api/escalations/:id/resolve", requireAuth(), async (req, res, next) => {
  try {
    const resolution = String(req.body?.resolution ?? "").trim();
    if (!resolution) return res.status(400).json({ error: "resolution is required" });
    res.json(await resolveEscalation(req.actor, req.params.id, resolution));
  } catch (error) {
    next(error);
  }
});

app.get("/api/evidence", requireAuth(), async (req, res, next) => {
  try {
    res.json(await listEvidence(req.actor));
  } catch (error) {
    next(error);
  }
});

app.get("/api/evidence/:id", requireAuth(), async (req, res, next) => {
  try {
    res.json(await getEvidence(req.actor, req.params.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/evidence", requireAuth(), async (req, res, next) => {
  try {
    res.status(201).json(await createEvidence(req.actor, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/evidence/:id/receipts", requireAuth(), async (req, res, next) => {
  try {
    res.status(201).json(await addReceipt(req.actor, req.params.id, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/evidence/:id/verifications", requireAuth(), async (req, res, next) => {
  try {
    res.status(201).json(await addVerification(req.actor, req.params.id, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/evidence/:id/measurements", requireAuth(), async (req, res, next) => {
  try {
    res.status(201).json(await addMeasurement(req.actor, req.params.id, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/evidence/:id/transition", requireAuth(), async (req, res, next) => {
  try {
    const { to, context, reason } = req.body ?? {};
    if (!to) return res.status(400).json({ error: "to state is required" });
    res.json(await transitionEvidence(req.actor, req.params.id, to, context, reason ?? "State gate satisfied"));
  } catch (error) {
    next(error);
  }
});

app.get("/api/missions", requireAuth(), async (req, res, next) => {
  try {
    res.json(await listMissions(req.actor));
  } catch (error) {
    next(error);
  }
});

app.get("/api/missions/:id", requireAuth(), async (req, res, next) => {
  try {
    res.json(await getMission(req.actor, req.params.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/missions", requireAuth(), async (req, res, next) => {
  try {
    res.status(201).json(await createMission(req.actor, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.put("/api/missions/:id", requireAuth(), async (req, res, next) => {
  try {
    res.json(await updateMission(req.actor, req.params.id, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/missions/:id/archive", requireAuth(), async (req, res, next) => {
  try {
    res.json(await archiveMission(req.actor, req.params.id));
  } catch (error) {
    next(error);
  }
});

app.get("/api/intent-tokens", requireAuth(), async (req, res, next) => {
  try {
    res.json(await listIntentTokens(req.actor));
  } catch (error) {
    next(error);
  }
});

app.post("/api/intent-tokens", requireAuth(), async (req, res, next) => {
  try {
    res.status(201).json(await createIntentToken(req.actor, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/intent-tokens/:id/revoke", requireAuth(), async (req, res, next) => {
  try {
    res.json(await revokeIntentToken(req.actor, req.params.id));
  } catch (error) {
    next(error);
  }
});

async function spendVerdict(req, res, next) {
  try {
    const { tokenId, request } = req.body ?? {};
    const token = tokenId ? await loadIntentTokenForSpend(req.actor, tokenId) : null;
    const verdict = evaluateIntentToken(token, { ...request, tenantId: req.actor.tenantId });
    res.status(verdict.allowed ? 200 : 403).json(verdict);
  } catch (error) {
    next(error);
  }
}

app.post("/api/intent-tokens/check", requireAuth(), spendVerdict);
app.post("/api/spend/verdict", requireAuth(), spendVerdict);

/* ── founding-access waitlist (public submit, founder-only read) ────── */
app.post("/api/founding-access/waitlist", async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "REFUSED", reason: "A valid email is required" });
    }
    const entry = await addToWaitlist({
      email,
      name: String(req.body?.name ?? "").trim(),
      company: String(req.body?.company ?? "").trim(),
      claim: String(req.body?.claim ?? "").trim(),
    });
    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

app.get("/api/founding-access/waitlist", requireAuth(), async (req, res, next) => {
  try {
    res.json(await listWaitlist(req.actor));
  } catch (error) {
    next(error);
  }
});

app.get("*splat", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((error, req, res, _next) => {
  const status = Number(
    error.status ?? (error instanceof EvidenceTransitionError ? 409 : 500)
  );
  console.error(JSON.stringify({
    level: "error",
    correlationId: req.correlationId,
    path: req.path,
    message: error.message,
    code: error.code
  }));
  res.status(status).json({
    error: status >= 500 ? "INTERNAL_ERROR" : "REFUSED",
    reason: error.message,
    correlationId: req.correlationId
  });
});

async function start() {
  await healthcheck();
  app.listen(port, () => {
    console.log(JSON.stringify({
      level: "info",
      event: "fable5_started",
      port,
      architecture: "rev-2.0",
      engines: ENGINE_REGISTRY.length,
      outboundMoneyDefault: false
    }));
  });
}

start().catch(async (error) => {
  console.error(JSON.stringify({ level: "fatal", event: "startup_refused", message: error.message }));
  await pool.end().catch(() => {});
  process.exit(1);
});
