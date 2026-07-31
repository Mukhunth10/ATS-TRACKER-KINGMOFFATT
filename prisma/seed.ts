import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { scoreByRules } from "../src/lib/score-rules";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
});

const JOBS = [
  {
    title: "Senior Revit API Developer",
    track: "Revit API / C#",
    location: "Chennai (Hybrid)",
    seniority: "senior",
    minYears: 5,
    mustHave: ["revit-api", "csharp", "revit"],
    niceToHave: ["dynamo", "aps-forge", "testing", "aec-domain", "navisworks-api"],
    description:
      "Own our Revit add-in suite: parametric content generation, model QA automation, and data extraction into our analytics platform. You will work directly with structural and MEP teams to turn manual modelling workflows into tooling.",
  },
  {
    title: "BIM Interoperability Engineer (IFC)",
    track: "IFC / openBIM",
    location: "Remote (India)",
    seniority: "mid",
    minYears: 3,
    mustHave: ["ifc", "python", "ifc-sdk"],
    niceToHave: ["bcf", "cobie", "geometry", "iso19650", "graphdb"],
    description:
      "Build and maintain our IFC import/export pipeline. Deep IFC4 schema work, geometry conversion, and validation rules. You will represent us in buildingSMART working groups.",
  },
  {
    title: "Full-Stack Engineer — BIM Cloud Platform",
    track: "APS / Web",
    location: "Bengaluru",
    seniority: "mid",
    minYears: 3,
    mustHave: ["aps-forge", "typescript", "forge-viewer"],
    niceToHave: ["threejs", "cloud", "sql", "csharp", "cicd"],
    description:
      "Our web platform federates models from Revit, Tekla and IFC and serves them to site teams. You will work across the APS Viewer front-end and the Node services behind it.",
  },
  {
    title: "Computational Design Developer",
    track: "Dynamo / Grasshopper",
    location: "Chennai",
    seniority: "junior",
    minYears: 1,
    mustHave: ["dynamo", "python"],
    niceToHave: ["grasshopper", "revit", "geometry", "revit-api", "rhino"],
    description:
      "Support our design technology team building Dynamo graphs and Zero-Touch nodes for facade and structural rationalisation. A good entry point for a graduate with scripting ability.",
  },
];

// Synthetic resumes spanning the range the scorer needs to separate — a strong
// API developer, a modeller with no code, and a generalist crossing over.
const CANDIDATES = [
  {
    name: "Arun Prakash",
    email: "arun.prakash@example.com",
    phone: "+91 98400 12345",
    location: "Chennai, India",
    resumeText: `Arun Prakash
Senior Software Engineer — AEC Technology
arun.prakash@example.com | +91 98400 12345 | Chennai, India

SUMMARY
8 years building desktop and cloud tooling for the AEC industry. Specialist in the
Revit API and Autodesk Platform Services.

EXPERIENCE
Lead Developer, Meinhardt Digital (2021 - present)
- Architected a Revit add-in suite (C#/.NET 8, WPF) used by 400 modellers across
  six offices; automated sheet setup, parameter QA and model health reporting.
- Built a Design Automation for Revit pipeline on Autodesk Platform Services that
  processes 2,000 models nightly and pushes quantities into Power BI.
- Wrote the IFC4 export validator using xBIM; cut coordination rework by 30%.
- Introduced NUnit coverage and Azure DevOps CI for the add-in codebase.

Software Engineer, Tata Consultancy Services (2017 - 2021)
- Navisworks API automation for clash grouping and BCF issue export.
- Dynamo Zero-Touch nodes in C# for structural rebar detailing.

SKILLS
C#, .NET, Python, Revit API, Navisworks API, Autodesk Platform Services (Forge),
Dynamo, IFC, xBIM, BCF, ISO 19650, Azure, SQL Server, NUnit, Git`,
  },
  {
    name: "Meera Raghavan",
    email: "meera.raghavan@example.com",
    phone: "+91 99620 55512",
    location: "Bengaluru, India",
    resumeText: `Meera Raghavan
BIM Coordinator
meera.raghavan@example.com | Bengaluru

PROFILE
6 years of BIM coordination on commercial and healthcare projects. Strong Revit
modelling and clash coordination background.

EXPERIENCE
Senior BIM Coordinator, L&T Construction (2020 - present)
- Managed federated models in Navisworks and BIM 360 for a 1.2M sqft hospital.
- Ran weekly clash detection cycles and issued BCF reports to design teams.
- Produced LOD 400 structural and MEP models in Revit.
- Maintained ISO 19650 naming standards and the project CDE structure.

BIM Modeller, Sobha Developers (2018 - 2020)
- Revit families and sheet production for residential towers.

SKILLS
Revit, Navisworks, BIM 360, AutoCAD, Solibri, ISO 19650, COBie, clash detection,
LOD standards, basic Dynamo scripting`,
  },
  {
    name: "Nikhil Sharma",
    email: "nikhil.sharma@example.com",
    phone: "+91 88450 77190",
    location: "Remote, India",
    resumeText: `Nikhil Sharma
Software Engineer
nikhil.sharma@example.com | Remote

SUMMARY
4 years of Python and TypeScript development. The last two years focused on
geometry processing and open standards for the built environment.

EXPERIENCE
Backend Engineer, Snaptrude (2022 - present)
- Built an IFC ingestion service in Python using IfcOpenShell; handles IFC2x3 and
  IFC4 with a tessellation fallback for malformed BRep geometry.
- Designed a Neo4j graph model for building element relationships, enabling
  spatial queries across federated models.
- Contributed BCF 3.0 support to an internal issue-tracking connector.
- Exposed a Speckle connector for round-tripping geometry into Rhino.

Software Engineer, Freshworks (2020 - 2022)
- Node.js and TypeScript microservices; React front-ends.

SKILLS
Python, TypeScript, IfcOpenShell, IFC4, BCF, Speckle, Neo4j, computational
geometry, Three.js, Docker, AWS, pytest`,
  },
  {
    name: "Divya Krishnan",
    email: "divya.krishnan@example.com",
    phone: "+91 90030 21148",
    location: "Chennai, India",
    resumeText: `Divya Krishnan
Graduate Engineer — Design Technology
divya.krishnan@example.com | Chennai

EDUCATION
B.Arch, Anna University (2023). Thesis on parametric facade optimisation.

EXPERIENCE
Design Technology Intern, Studio Ardete (2023 - present)
- 1 year building Dynamo graphs for panel layout and facade rationalisation.
- Python scripting inside Dynamo to drive Revit family placement from Excel.
- Grasshopper definitions for early-stage massing studies; some GHPython.

SKILLS
Dynamo, Python, Grasshopper, Rhino 3D, Revit, AutoCAD, Excel automation`,
  },
];

async function main() {
  console.log("Seeding...");

  // Idempotent: wipe and rebuild so re-running seed gives a known-good state.
  await prisma.note.deleteMany();
  await prisma.application.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.job.deleteMany();

  const jobs = [];
  for (const j of JOBS) {
    jobs.push(
      await prisma.job.create({
        data: {
          ...j,
          mustHave: JSON.stringify(j.mustHave),
          niceToHave: JSON.stringify(j.niceToHave),
        },
      }),
    );
  }

  const candidates = [];
  for (const c of CANDIDATES) {
    candidates.push(await prisma.candidate.create({ data: c }));
  }

  // Apply every candidate to every job so the ranking is immediately visible.
  for (const job of jobs) {
    for (const candidate of candidates) {
      const rules = scoreByRules(candidate.resumeText, {
        mustHave: JSON.parse(job.mustHave),
        niceToHave: JSON.parse(job.niceToHave),
        minYears: job.minYears,
      });

      await prisma.application.create({
        data: {
          jobId: job.id,
          candidateId: candidate.id,
          ruleScore: rules.score,
          ruleDetail: JSON.stringify(rules.detail),
        },
      });
    }
  }

  console.log(`Seeded ${jobs.length} jobs, ${candidates.length} candidates, ${jobs.length * candidates.length} applications.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
