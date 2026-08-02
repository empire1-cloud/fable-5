import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
const { Client } = pg;

const connectionString = process.env.DATABASE_ADMIN_URL;
if (!connectionString) throw new Error("DATABASE_ADMIN_URL is required");

const migrationsDir = new URL("../migrations/", import.meta.url);

const client = new Client({ connectionString });
await client.connect();
try {
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    console.log("No migrations found.");
  }
  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir.pathname, file), "utf8");
    await client.query(sql);
    console.log(`Migration ${path.basename(file, ".sql")} applied or already present.`);
  }
} finally {
  await client.end();
}
