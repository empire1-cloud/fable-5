import "dotenv/config";
import pg from "pg";
import { hashPassword } from "../src/auth.js";
const { Client } = pg;

const connectionString = process.env.DATABASE_ADMIN_URL;
if (!connectionString) throw new Error("DATABASE_ADMIN_URL is required");

const tenantName = process.env.BOOTSTRAP_TENANT_NAME;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!tenantName || !email || !password) {
  throw new Error("BOOTSTRAP_TENANT_NAME, BOOTSTRAP_ADMIN_EMAIL, and BOOTSTRAP_ADMIN_PASSWORD are required");
}

const client = new Client({ connectionString });
await client.connect();
try {
  await client.query("BEGIN");
  const slug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const tenant = await client.query(
    `INSERT INTO tenants(name, slug) VALUES ($1,$2)
     ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name
     RETURNING id`,
    [tenantName, slug]
  );
  const passwordHash = await hashPassword(password);
  const user = await client.query(
    `INSERT INTO users(email, password_hash) VALUES ($1,$2)
     ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash
     RETURNING id`,
    [email.toLowerCase(), passwordHash]
  );
  await client.query(
    `INSERT INTO memberships(tenant_id,user_id,role,is_active)
     VALUES ($1,$2,'OWNER',true)
     ON CONFLICT(tenant_id,user_id) DO UPDATE SET role='OWNER', is_active=true`,
    [tenant.rows[0].id, user.rows[0].id]
  );

  // Resource pools are capacity *configuration* — an organisation needs
  // defaults to allocate against, so they are seeded with zero committed.
  // Genomes and market nodes are deliberately NOT seeded: a new company has
  // not validated a genome or proven a market yet, and inventing one would be
  // exactly the fake progress this system exists to refuse. Those counts read
  // 0 until real work earns them.
  const pools = [
    ["founder time", 40, "h/wk", false],
    ["agent time", 640, "agent-h/wk", false],
    ["cash", 25000, "€/mo", true],
    ["compute", 1200, "GPU-h/mo", false],
    ["engineering capacity", 6, "build slots", false],
    ["distribution capacity", 5, "channel slots", false],
    ["partnership bandwidth", 4, "active tracks", false],
    ["legal effort", 12, "h/mo", false],
    ["operational attention", 100, "pts", false]
  ];
  for (const [type, capacity, unit, financial] of pools) {
    await client.query(
      `INSERT INTO resource_pools(tenant_id, resource_type, capacity, unit, financial)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT(tenant_id, resource_type) DO UPDATE
         SET capacity=EXCLUDED.capacity, unit=EXCLUDED.unit, financial=EXCLUDED.financial`,
      [tenant.rows[0].id, type, capacity, unit, financial]
    );
  }

  await client.query("COMMIT");
  console.log(`Bootstrapped ${email} as OWNER of ${tenantName} with ${pools.length} resource pools.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
