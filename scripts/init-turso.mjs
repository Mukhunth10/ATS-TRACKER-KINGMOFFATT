/**
 * One-time initialiser for the hosted (Turso / libSQL) database.
 *
 * Creates the schema and seeds the demo roles so a freshly-created Turso database
 * is ready for the deployed app. Safe to run more than once: it only creates
 * tables that don't exist and only seeds when the Job table is empty.
 *
 * Usage (from the `ats` folder, with your Turso details):
 *   TURSO_DATABASE_URL="libsql://your-db.turso.io" \
 *   TURSO_AUTH_TOKEN="eyJ..." \
 *   node scripts/init-turso.mjs
 *
 * You can also point it at a local file to test:  TURSO_DATABASE_URL="file:./x.db"
 */
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN for a real Turso DB).");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(here, "..", "prisma", "schema.sql");

const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

// --- Schema ---------------------------------------------------------------
// Strip Prisma's "-- CreateTable/-- CreateIndex" comment lines, then split into
// individual statements. Make each idempotent so re-runs don't error.
const raw = readFileSync(schemaPath, "utf8");
const statements = raw
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) =>
    s
      .replace(/^CREATE TABLE /i, "CREATE TABLE IF NOT EXISTS ")
      .replace(/^CREATE UNIQUE INDEX /i, "CREATE UNIQUE INDEX IF NOT EXISTS ")
      .replace(/^CREATE INDEX /i, "CREATE INDEX IF NOT EXISTS "),
  );

for (const s of statements) {
  await db.execute(s);
}
console.log(`Schema ready — ran ${statements.length} statements.`);

// --- Seed (only if empty) -------------------------------------------------
const { rows } = await db.execute("SELECT COUNT(*) AS n FROM Job");
if (Number(rows[0].n) > 0) {
  console.log(`Job table already has ${rows[0].n} rows — skipping seed.`);
  db.close();
  process.exit(0);
}

// A small, id-stable cuid generator isn't needed — libSQL accepts any text id.
let counter = 0;
const id = (prefix) => `${prefix}_seed_${(counter++).toString().padStart(4, "0")}`;

// Real King & Moffatt-style roles, matching the local demo seed.
const ROLES = [
  {
    title: "BIM Coordinator",
    track: "BIM / MEP Coordination",
    location: "Edinburgh, UK",
    seniority: "mid",
    minYears: 3,
    mustHave: ["autodesk_revit", "navisworks", "ifc"],
    niceToHave: ["acc"],
    customMustHave: ["Revit MEP | Revit MEP", "MEP coordination | M&E coordination"],
    customNiceToHave: ["ISO 19650", "common data environment | CDE", "AutoCAD"],
    description:
      "Coordinate federated M&E/BIM models on live construction projects; run clash detection and maintain the CDE to ISO 19650.",
  },
  {
    title: "Mechanical Project Engineer",
    track: "Mechanical / MEP",
    location: "Kettering, UK",
    seniority: "mid",
    minYears: 3,
    mustHave: [],
    niceToHave: [],
    customMustHave: ["mechanical building services | HVAC", "MEP", "site delivery"],
    customNiceToHave: ["data centre", "commissioning"],
    description:
      "Deliver mechanical building-services packages on data-centre and commercial projects, from design coordination through to site commissioning.",
  },
  {
    title: "Senior Planning Manager",
    track: "Planning / Programme",
    location: "Dublin, Ireland",
    seniority: "senior",
    minYears: 6,
    mustHave: [],
    niceToHave: [],
    customMustHave: ["Primavera P6 | P6", "critical path", "delay analysis"],
    customNiceToHave: ["earned value", "NEC"],
    description:
      "Own the programme on major construction projects: build and maintain the P6 schedule, run critical-path and delay analysis, and report progress.",
  },
  {
    title: "Electrical QA/QC Engineer",
    track: "Electrical / Quality",
    location: "Dublin, Ireland",
    seniority: "mid",
    minYears: 3,
    mustHave: [],
    niceToHave: [],
    customMustHave: ["electrical building services", "QA QC | quality assurance", "commissioning"],
    customNiceToHave: ["ISO 9001", "data centre"],
    description:
      "Own electrical quality on site: inspection and test plans, QA/QC documentation, and commissioning support for building-services installations.",
  },
];

for (const r of ROLES) {
  await db.execute({
    sql: `INSERT INTO Job (id, title, track, location, seniority, mustHave, niceToHave,
            customMustHave, customNiceToHave, minYears, status, description, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, CURRENT_TIMESTAMP)`,
    args: [
      id("job"),
      r.title,
      r.track,
      r.location,
      r.seniority,
      JSON.stringify(r.mustHave),
      JSON.stringify(r.niceToHave),
      JSON.stringify(r.customMustHave),
      JSON.stringify(r.customNiceToHave),
      r.minYears,
      r.description,
    ],
  });
}
console.log(`Seeded ${ROLES.length} demo roles.`);
db.close();
