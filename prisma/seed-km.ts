/**
 * Seeds real, currently-active King & Moffatt roles (fetched July 2026) with
 * keyword criteria derived from their actual postings. Replaces the generic
 * sample roles so a demo matches against roles they genuinely hire for.
 *
 *   npx tsx prisma/seed-km.ts
 *
 * Scores are keyword-based here (seeding shouldn't download the embedding
 * model); the semantic layer applies when a CV is uploaded or a role rescored
 * in the app.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
});

// Built-in library keys that map cleanly onto M&E BIM work.
const ROLES = [
  {
    title: "BIM Coordinator",
    track: "BIM / MEP Coordination",
    location: "Edinburgh, UK",
    seniority: "mid",
    minYears: 3,
    description:
      "Coordinate multi-disciplinary MEP models across major construction projects, manage clash detection and resolution in Navisworks and Revit, and ensure models comply with the BIM Execution Plan and ISO 19650.",
    mustHave: ["revit", "navisworks", "ifc"],
    niceToHave: ["iso19650", "bcf", "acc"],
    customMustHave: [
      "Revit MEP | Revit for mechanical and electrical",
      "clash detection | clash resolution | interference checking",
      "MEP coordination | mechanical electrical and public health",
    ],
    customNiceToHave: [
      "ISO 19650 | information management standard",
      "BIM Execution Plan | BEP",
      "Common Data Environment | CDE",
      "AutoCAD",
    ],
  },
  {
    title: "Mechanical Project Engineer",
    track: "Mechanical / MEP",
    location: "Kettering, UK",
    seniority: "mid",
    minYears: 3,
    description:
      "Deliver mechanical building-services packages on major projects — HVAC, pipework and public health — from design coordination through installation and commissioning.",
    mustHave: [],
    niceToHave: [],
    customMustHave: [
      "mechanical building services | HVAC | heating ventilation",
      "MEP | mechanical electrical",
      "site delivery | installation | commissioning",
    ],
    customNiceToHave: ["Revit", "public health", "pipework", "data centre"],
  },
  {
    title: "Senior Planning Manager",
    track: "Planning / Programme",
    location: "Dublin, Ireland",
    seniority: "senior",
    minYears: 6,
    description:
      "Own the programme and delay analysis for large M&E projects — baseline development, critical-path management, and progress reporting across subcontractor packages.",
    mustHave: [],
    niceToHave: [],
    customMustHave: [
      "Primavera P6 | P6 | Oracle Primavera",
      "critical path | CPM | programme management",
      "delay analysis | EOT claims",
    ],
    customNiceToHave: ["MS Project", "construction planning", "data centre", "M&E"],
  },
  {
    title: "Electrical QA/QC Engineer",
    track: "Electrical / Quality",
    location: "Dublin, Ireland",
    seniority: "mid",
    minYears: 3,
    description:
      "Assure quality on electrical building-services installations — inspection and test plans, snagging, and handover documentation on data-centre and commercial projects.",
    mustHave: [],
    niceToHave: [],
    customMustHave: [
      "electrical building services | electrical installation",
      "QA QC | quality assurance | inspection and test",
      "commissioning | handover documentation",
    ],
    customNiceToHave: ["ISO 9001", "data centre", "snagging", "MEP"],
  },
];

async function main() {
  console.log("Seeding real King & Moffatt roles…");
  await prisma.note.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.application.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.job.deleteMany();

  for (const r of ROLES) {
    await prisma.job.create({
      data: {
        title: r.title,
        track: r.track,
        location: r.location,
        seniority: r.seniority,
        minYears: r.minYears,
        description: r.description,
        mustHave: JSON.stringify(r.mustHave),
        niceToHave: JSON.stringify(r.niceToHave),
        customMustHave: JSON.stringify(r.customMustHave),
        customNiceToHave: JSON.stringify(r.customNiceToHave),
      },
    });
  }
  console.log(`Seeded ${ROLES.length} King & Moffatt roles. Candidates cleared — upload real CVs to test.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
