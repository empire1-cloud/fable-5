import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_REGISTRY, getEngine } from "./engine-registry.js";
import { requireAuth, login, sessionExpiry, issueSession } from "./auth.js";
import { healthcheck, pool } from "./db.js";
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
  resolveEscalation,
  listGenomes,
  getGenome,
  createGenome,
  addGenomeSection,
  listMarketNodes,
  listResourcePools
} from "./repository.js";
import { evaluateIntentToken } from "./domain/spend.js";
import { EvidenceTransitionError } from "./domain/evidence.js";
import { createOrganisation } from "./signup.js";
import { subscriptionState, requireWriteAccess } from "./subscription.js";
import { PLANS } from "./domain/plans.js";
import { loginThrottle, signupThrottle, recordAttempt, clientAddress, pruneAttempts } from "./throttle.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
// Unset means "reflect any origin", which is fine on a laptop and wrong for an
// API on the public internet. Production must name its front ends explicitly.
if (!process.env.APP_ORIGIN && process.env.NODE_ENV === "production") {
  console.error(JSON.stringify({
    level: "fatal",
    event: "startup_refused",
    message: "APP_ORIGIN is required when NODE_ENV=production — refusing to accept requests from any origin."
  }));
  process.exit(1);
}
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

    // Throttled before the password is checked, so a locked-out attacker
    // cannot use response timing to learn whether an account exists.
    const throttle = await loginThrottle(email);
    if (!throttle.allowed) {
      return res.status(429).json({ error: "REFUSED", reason: throttle.reason, correlationId: req.correlationId });
    }

    const result = await login(email, password);
    await recordAttempt("login", email, Boolean(result));
    if (!result) return res.status(401).json({ error: "REFUSED", reason: "Invalid credentials" });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/signup", async (req, res, next) => {
  try {
    const address = clientAddress(req);
    const throttle = await signupThrottle(address);
    if (!throttle.allowed) {
      return res.status(429).json({ error: "REFUSED", reason: throttle.reason, correlationId: req.correlationId });
    }

    let created;
    try {
      created = await createOrganisation({
        organisationName: req.body?.organisationName,
        email: req.body?.email,
        password: req.body?.password
      });
    } catch (error) {
      // Record the attempt whether or not it succeeded — the throttle counts
      // creations from an address, and a failed one still consumed the work.
      await recordAttempt("signup", address, false);
      throw error;
    }
    await recordAttempt("signup", address, true);

    // Sign the founder straight in. Making someone re-enter credentials they
    // set four seconds ago is friction with no security benefit.
    const session = await issueSession(created.actor);
    res.status(201).json({ ...session, trial: created.trial });
  } catch (error) {
    next(error);
  }
});

app.get("/api/subscription", requireAuth(), async (req, res, next) => {
  try {
    const { subscription, verdict } = await subscriptionState(req.actor.tenantId);
    res.json({
      status: verdict.status,
      planKey: verdict.planKey,
      plan: verdict.plan ?? null,
      canWrite: verdict.canWrite,
      canRead: verdict.canRead,
      reason: verdict.reason,
      trialDaysRemaining: verdict.trialDaysRemaining ?? null,
      trialEndsAt: subscription?.trial_ends_at ?? null,
      seats: subscription?.seats ?? null,
      currentPeriodEnd: subscription?.current_period_end ?? null,
      plans: Object.values(PLANS)
    });
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

/*
 * `protect` = authenticate, then check the tenant may write.
 *
 * These are composed into one guard and used on every private route, rather
 * than the subscription check being added per endpoint, so a route cannot be
 * left ungated by omission. A global app.use() cannot do this job: req.actor
 * is set by requireAuth, which runs per route, so a gate mounted earlier would
 * always see an anonymous request and pass everything through.
 *
 * Billing is exempt — a read-only tenant must still be able to pay to return.
 */
const protect = [requireAuth(), requireWriteAccess(["/api/billing"])];

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

app.post("/api/opportunities", protect, async (req, res, next) => {
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

app.post("/api/opportunities/:id/authorize", protect, async (req, res, next) => {
  try {
    res.json(await authorizeOpportunity(req.actor, req.params.id, req.body?.reason ?? "Authorized through Engine 00"));
  } catch (error) {
    next(error);
  }
});

app.get("/api/genomes", requireAuth(), async (req, res, next) => {
  try {
    res.json(await listGenomes(req.actor));
  } catch (error) {
    next(error);
  }
});

app.post("/api/genomes", protect, async (req, res, next) => {
  try {
    res.status(201).json(await createGenome(req.actor, req.body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/genomes/:id/sections", protect, async (req, res, next) => {
  try {
    res.status(201).json(await addGenomeSection(req.actor, req.params.id, req.body));
  } catch (error) {
    next(error);
  }
});

app.get("/api/genomes/:id", requireAuth(), async (req, res, next) => {
  try {
    res.json(await getGenome(req.actor, req.params.id));
  } catch (error) {
    next(error);
  }
});

app.get("/api/market-nodes", requireAuth(), async (req, res, next) => {
  try {
    res.json(await listMarketNodes(req.actor));
  } catch (error) {
    next(error);
  }
});

app.get("/api/resource-pools", requireAuth(), async (req, res, next) => {
  try {
    res.json(await listResourcePools(req.actor));
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

app.post("/api/escalations/:id/resolve", protect, async (req, res, next) => {
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

app.post("/api/evidence", protect, async (req, res, next) => {
  try {
    res.status(201).json(await createEvidence(req.actor, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/evidence/:id/receipts", protect, async (req, res, next) => {
  try {
    res.status(201).json(await addReceipt(req.actor, req.params.id, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/evidence/:id/verifications", protect, async (req, res, next) => {
  try {
    res.status(201).json(await addVerification(req.actor, req.params.id, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/evidence/:id/measurements", protect, async (req, res, next) => {
  try {
    res.status(201).json(await addMeasurement(req.actor, req.params.id, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/evidence/:id/transition", protect, async (req, res, next) => {
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

app.post("/api/missions", protect, async (req, res, next) => {
  try {
    res.status(201).json(await createMission(req.actor, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.put("/api/missions/:id", protect, async (req, res, next) => {
  try {
    res.json(await updateMission(req.actor, req.params.id, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/missions/:id/archive", protect, async (req, res, next) => {
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

app.post("/api/intent-tokens", protect, async (req, res, next) => {
  try {
    res.status(201).json(await createIntentToken(req.actor, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/intent-tokens/:id/revoke", protect, async (req, res, next) => {
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

app.post("/api/intent-tokens/check", protect, spendVerdict);
app.post("/api/spend/verdict", protect, spendVerdict);

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
