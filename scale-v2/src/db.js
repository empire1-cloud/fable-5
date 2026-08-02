import pg from "pg";
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

export const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX ?? 20),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on("error", (error) => {
  console.error(JSON.stringify({ level: "error", event: "postgres_pool_error", message: error.message }));
});

export async function withTenant(tenantId, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function healthcheck() {
  const result = await pool.query("SELECT now() AS database_time");
  return result.rows[0];
}
