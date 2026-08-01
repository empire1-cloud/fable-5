import "dotenv/config";
import fs from "node:fs/promises";
import pg from "pg";
const { Client } = pg;

const connectionString = process.env.DATABASE_ADMIN_URL;
if (!connectionString) throw new Error("DATABASE_ADMIN_URL is required");

const client = new Client({ connectionString });
await client.connect();
try {
  const sql = await fs.readFile(new URL("../migrations/001_fable5_scale.sql", import.meta.url), "utf8");
  await client.query(sql);
  console.log("Migration 001_fable5_scale applied or already present.");
} finally {
  await client.end();
}
