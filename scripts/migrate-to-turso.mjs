/**
 * One-time migration: copies real data from the local SQLite file (dev.db)
 * into a Turso database, in FK-safe order. Skips User/Session — the live site
 * gets its own real staff logins via the signup code, not the local test one.
 *
 * Usage (from the `ats` folder):
 *   TURSO_DATABASE_URL="libsql://your-db.turso.io" \
 *   TURSO_AUTH_TOKEN="eyJ..." \
 *   node scripts/migrate-to-turso.mjs
 *
 * Run scripts/init-turso.mjs FIRST so the schema exists on Turso.
 */
import { createClient } from "@libsql/client";

const destUrl = process.env.TURSO_DATABASE_URL;
if (!destUrl) {
  console.error("Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN).");
  process.exit(1);
}

const source = createClient({ url: "file:./dev.db" });
const dest = createClient({ url: destUrl, authToken: process.env.TURSO_AUTH_TOKEN });

// FK-safe order. User/Session intentionally excluded.
const TABLES = ["Job", "Candidate", "Application", "Assessment", "Activity", "Note"];

for (const table of TABLES) {
  const { rows, columns } = await source.execute(`SELECT * FROM "${table}"`);
  if (rows.length === 0) {
    console.log(`${table}: nothing to copy`);
    continue;
  }
  const placeholders = columns.map(() => "?").join(", ");
  const colList = columns.map((c) => `"${c}"`).join(", ");
  for (const row of rows) {
    const values = columns.map((c) => row[c]);
    await dest.execute({
      sql: `INSERT OR IGNORE INTO "${table}" (${colList}) VALUES (${placeholders})`,
      args: values,
    });
  }
  console.log(`${table}: copied ${rows.length} rows`);
}

console.log("Migration complete.");
source.close();
dest.close();
