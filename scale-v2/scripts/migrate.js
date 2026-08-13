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

  // 001 creates the fable5_app role with a default password so a local box
  // works out of the box. That default is in the repository, which is fine on
  // localhost and unacceptable on a database reachable from the internet.
  // Any deployment sets APP_DB_PASSWORD and the role is rotated to it here.
  const appPassword = process.env.APP_DB_PASSWORD;
  if (appPassword) {
    // ALTER ROLE is a utility statement and cannot take a bind parameter, so
    // the literal is escaped server-side with format(%L) — never by string
    // concatenation in JS — and only then executed.
    const { rows } = await client.query(
      `SELECT format('ALTER ROLE fable5_app WITH PASSWORD %L', $1::text) AS stmt`,
      [appPassword],
    );
    await client.query(rows[0].stmt);
    console.log("Role fable5_app password set from APP_DB_PASSWORD.");
  } else if (process.env.NODE_ENV === "production") {
    // Refuse to leave a known password on a production database.
    throw new Error(
      "APP_DB_PASSWORD is required when NODE_ENV=production — refusing to leave the fable5_app role on the default password committed to this repository.",
    );
  }
} finally {
  await client.end();
}
