import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_REGISTRY, getEngine } from "./engine-registry.js";
import { requireAuth, login } from "./auth.js";
import { healthcheck, pool, withTenant } from "./db.js";
import { createOpportunity, authorizeOpportunity, transitionEvidence, dashboard } from "./repository.js";
import { evaluateIntentToken } from "./domain/spend.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");

app.disable("x-powered-by");
app.use(cors({ origin: process.env.APP_ORIGIN ?? true, credentials: false }));
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
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    const result = await login(email, password);
    if (!result) return res.status(401).json({ error: "REFUSED", reason: "Invalid credentials" });
    res.json(result);
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

app.post("/api/opportunities/:id/authorize", requireAuth(), async (req, res, next) => {
  try {
    res.json(await authorizeOpportunity(req.actor, req.params.id, req.body?.reason ?? "Authorized through Engine 00"));
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

app.post("/api/spend/verdict", requireAuth(), async (req, res, next) => {
  try {
    const { tokenId, request } = req.body ?? {};
    const token = tokenId
      ? await withTenant(req.actor.tenantId, async (client) => {
          const result = await client.query(`SELECT * FROM intent_tokens WHERE id=$1`, [tokenId]);
          const row = result.rows[0];
          return row ? {
            id: row.id,
            tenantId: row.tenant_id,
            action: row.action,
            vendorOrSystem: row.vendor_or_system,
            maxAmount: Number(row.max_amount),
            currency: row.currency,
            expiresAt: row.expires_at,
            environment: row.environment,
            revoked: row.revoked_at != null
          } : null;
        })
      : null;

    const verdict = evaluateIntentToken(token, { ...request, tenantId: req.actor.tenantId });
    res.status(verdict.allowed ? 200 : 403).json(verdict);
  } catch (error) {
    next(error);
  }
});

app.get("*splat", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((error, req, res, _next) => {
  const status = Number(error.status ?? 500);
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
