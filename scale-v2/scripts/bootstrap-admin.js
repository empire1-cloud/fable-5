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
  await client.query("COMMIT");
  console.log(`Bootstrapped ${email} as OWNER of ${tenantName}.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
