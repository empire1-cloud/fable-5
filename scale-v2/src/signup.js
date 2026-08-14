/*
 * Self-serve organisation creation.
 *
 * Before this, a tenant could only be created by scripts/bootstrap-admin.js —
 * a CLI the founder ran by hand for every customer. That made the founder's
 * calendar the growth ceiling.
 *
 * The whole thing is one transaction. A half-created organisation — a user with
 * no tenant, a tenant with no owner, an owner with no subscription — is worse
 * than no organisation, because the person believes they have an account.
 */
import { randomUUID } from "node:crypto";
import { pool } from "./db.js";
import { hashPassword } from "./auth.js";
import { TRIAL_DAYS, trialEndsAt } from "./domain/plans.js";

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const conflict = (message) => Object.assign(new Error(message), { status: 409 });

/** Capacity defaults every organisation needs to allocate against. Mirrors
 *  scripts/bootstrap-admin.js — genomes and market nodes are deliberately NOT
 *  seeded, because a new company has not validated one and inventing it would
 *  be the fake progress this system exists to refuse. */
const DEFAULT_POOLS = [
  ["founder time", 40, "h/wk", false],
  ["agent time", 640, "agent-h/wk", false],
  ["cash", 25000, "€/mo", true],
  ["compute", 1200, "GPU-h/mo", false],
  ["engineering capacity", 6, "build slots", false],
  ["distribution capacity", 5, "channel slots", false],
  ["partnership bandwidth", 4, "active tracks", false],
  ["legal effort", 12, "h/mo", false],
  ["operational attention", 100, "pts", false],
];

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export function validateSignup({ organisationName, email, password }) {
  const org = String(organisationName ?? "").trim();
  const mail = String(email ?? "").trim().toLowerCase();
  const pass = String(password ?? "");

  if (org.length < 2) throw badRequest("Organisation name is required.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw badRequest("A valid email address is required.");
  // Length over composition rules: a long passphrase beats a short one with a
  // symbol bolted on, and this is the credential guarding the whole company.
  if (pass.length < 12) throw badRequest("Password must be at least 12 characters.");
  if (!slugify(org)) throw badRequest("Organisation name must contain letters or numbers.");

  return { organisationName: org, email: mail, password: pass };
}

/**
 * Creates tenant + owner + membership + resource pools + a trial subscription,
 * atomically. Returns the actor shape the session layer expects.
 */
export async function createOrganisation(input) {
  const { organisationName, email, password } = validateSignup(input);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // An existing address is refused rather than silently attached to a new
    // organisation — that would let a stranger's signup collide with a real
    // account and change what that person can see.
    const existing = await client.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing.rows[0]) {
      throw conflict("An account already exists for that email address. Sign in instead.");
    }

    // tenants, memberships, resource_pools and subscriptions are all under
    // FORCE ROW LEVEL SECURITY, whose policies compare tenant_id against
    // app.tenant_id. So the id has to exist before the first insert: generate
    // it, set the context, then write. Creating the tenant first and setting
    // the context afterwards cannot work — the tenants policy checks the row
    // being inserted against a context that is not set yet.
    const tenantId = randomUUID();
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);

    // Slug uniqueness is global, but RLS now hides other tenants' rows from
    // this lookup — so a collision surfaces as a unique-violation on insert
    // rather than here. Suffix pre-emptively and let the constraint be the
    // final authority.
    const slug = `${slugify(organisationName)}-${tenantId.slice(0, 6)}`;

    const tenant = await client.query(
      `INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3) RETURNING id, name`,
      [tenantId, organisationName, slug],
    );

    const passwordHash = await hashPassword(password);
    const user = await client.query(
      `INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id, email`,
      [email, passwordHash],
    );
    const userId = user.rows[0].id;

    await client.query(
      `INSERT INTO memberships (tenant_id, user_id, role, is_active) VALUES ($1,$2,'OWNER',true)`,
      [tenantId, userId],
    );

    for (const [type, capacity, unit, financial] of DEFAULT_POOLS) {
      await client.query(
        `INSERT INTO resource_pools (tenant_id, resource_type, capacity, unit, financial)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (tenant_id, resource_type) DO NOTHING`,
        [tenantId, type, capacity, unit, financial],
      );
    }

    // The trial is a real subscription row with no Stripe record yet, so every
    // downstream check asks one question regardless of how the tenant is paying.
    const endsAt = trialEndsAt();
    await client.query(
      `INSERT INTO subscriptions (tenant_id, status, plan_key, seats, trial_ends_at)
       VALUES ($1,'trialing','trial',1,$2)`,
      [tenantId, endsAt],
    );

    await client.query("COMMIT");

    return {
      actor: {
        userId,
        email,
        tenantId,
        tenantName: tenant.rows[0].name,
        role: "OWNER",
      },
      trial: { endsAt: endsAt.toISOString(), days: TRIAL_DAYS },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
