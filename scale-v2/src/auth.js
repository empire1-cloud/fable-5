import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { pool } from "./db.js";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${Buffer.from(derived).toString("hex")}`;
}

export async function verifyPassword(password, encoded) {
  const [salt, expectedHex] = String(encoded).split(":");
  if (!salt || !expectedHex) return false;
  const derived = Buffer.from(await scrypt(password, salt, 64));
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

const tokenHash = (token) => createHash("sha256").update(token).digest("hex");

export async function login(email, password) {
  const result = await pool.query(
    `SELECT user_id, email, password_hash, tenant_id, role, tenant_name
       FROM public.fable5_authenticate($1)`,
    [email]
  );
  const actor = result.rows[0];
  if (!actor || !(await verifyPassword(password, actor.password_hash))) return null;

  const token = randomBytes(32).toString("base64url");
  const ttlHours = Number(process.env.SESSION_TTL_HOURS ?? 12);
  await pool.query(
    `INSERT INTO auth_sessions (token_hash, user_id, tenant_id, expires_at)
     VALUES ($1, $2, $3, now() + ($4 || ' hours')::interval)`,
    [tokenHash(token), actor.user_id, actor.tenant_id, ttlHours]
  );

  return {
    token,
    actor: {
      userId: actor.user_id,
      email: actor.email,
      tenantId: actor.tenant_id,
      tenantName: actor.tenant_name,
      role: actor.role
    }
  };
}

export async function authenticateToken(token) {
  if (!token) return null;
  const result = await pool.query(
    `SELECT user_id, tenant_id, email, role, tenant_name
       FROM public.fable5_session_actor($1)`,
    [tokenHash(token)]
  );
  const row = result.rows[0];
  return row ? {
    userId: row.user_id,
    tenantId: row.tenant_id,
    email: row.email,
    role: row.role,
    tenantName: row.tenant_name
  } : null;
}

/**
 * Session lifecycle detail for the authenticated actor. auth_sessions is not
 * under row-level security, so the app role may read it directly once the
 * actor has already been validated by fable5_session_actor.
 */
export async function sessionExpiry(token) {
  if (!token) return null;
  const result = await pool.query(
    `SELECT expires_at, revoked_at, created_at FROM auth_sessions WHERE token_hash=$1`,
    [tokenHash(token)]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    expiresAt: row.expires_at,
    revoked: row.revoked_at != null,
    issuedAt: row.created_at
  };
}

export function requireAuth() {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization ?? "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      const actor = await authenticateToken(token);
      if (!actor) return res.status(401).json({ error: "REFUSED", reason: "Authentication required" });
      req.actor = actor;
      req.token = token;
      next();
    } catch (error) {
      next(error);
    }
  };
}
