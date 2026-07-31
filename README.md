# BIM ATS

Applicant tracking built specifically for **BIM software development** hiring.

The premise: generic ATS keyword matching cannot tell the difference between
someone who has modelled in Revit for ten years and someone who has *written a
Revit API add-in*. For a development team those are completely different hires.
This app is built around that distinction.

**It runs entirely free and offline. No API key, no subscription, no usage limit.**

## What it does

- **Roles** with a BIM-specific skills taxonomy (Revit API, IFC/IfcOpenShell,
  Autodesk Platform Services, Tekla Open API, Dynamo, Speckle, and ~35 more),
  split into must-have and nice-to-have.
- **Resume intake** from PDF, DOCX, TXT or MD, with contact details auto-extracted.
- **Evidence-weighted scoring** — deterministic, instant, unlimited, free.
- **Pipeline** across applied → screening → interview → offer → hired/rejected,
  with per-candidate notes.

### Why the scoring is different

A skill counts fully only when the CV *proves* it:

| CV line | Credit |
| --- | --- |
| "Architected a Revit API add-in suite used by 400 modellers" | **full** |
| "Skills: Revit API, C#, Dynamo" | **half** |
| "Assisted the team, familiar with Revit API" | **half** (hedge detected) |

Two CVs with identical skills lists score **100** and **60** depending on
whether the experience section backs them up. That is what stops a CV written
for the filter from out-ranking a real developer.

Every candidate page shows the exact resume line that earned each skill its
credit, so your team can check the reasoning rather than trust a number.

### Optional: AI screening

There is also a Claude-powered screening feature that adds a written verdict per
candidate. **It is off by default and hidden from the UI** — it costs roughly
$0.04–0.08 per candidate. You never need it; the free scoring does the filtering.
See "Enabling AI screening" below if you ever want it.

## Setup

```bash
cd ats
npm install
npx prisma migrate dev      # creates dev.db
npx tsx prisma/seed.ts      # 4 sample roles + 4 sample candidates
npm run dev                 # http://localhost:3000
```

### Enabling AI screening (optional, costs money)

You do not need this. Skip it unless the free scoring proves too blunt.

To turn it on, add your key to `.env`:

```ini
ANTHROPIC_API_KEY="sk-ant-..."
```

Get one at <https://console.anthropic.com/settings/keys>. Set it to a real key or
leave the line commented out — an empty `""` still wins credential precedence and
breaks authentication.

With no key set, the AI section and its button are **hidden entirely** so nobody
on your team can trigger a charge by accident. Adding a key makes them appear;
removing it hides them again. No other behaviour changes.

To delete the feature permanently: remove `src/lib/score-ai.ts`,
`src/components/screen-button.tsx`, `src/app/api/applications/[id]/screen/`, and
the `screenWithAi` action in `src/app/actions.ts`.

## Tuning the scoring

Three levels, from no-code to code:

**1. Per role, in the browser.** Your HR team ticks must-have and nice-to-have
skills when creating a role, plus minimum years and seniority. No code involved.

**2. `src/lib/bim-taxonomy.ts`** — the skill list. Each entry has a `weight` (1–5)
for how strongly it predicts BIM *development* ability (Revit API is 5, plain
Revit is 3), and `aliases` for the ways it actually appears on CVs (`Forge` vs
`APS`, `IfcOpenShell` vs `ifc open shell`). Add your own stack here.

The same file holds `ACTION_VERBS` (what counts as proving a skill) and
`PASSIVE_CONTEXT` (hedging phrases like "familiar with"). Keep `PASSIVE_CONTEXT`
narrow — an over-broad entry silently demotes real builders. `used` is
deliberately excluded, because "an add-in used by 400 modellers" is a claim of
impact, not a hedge.

**3. `src/lib/score-rules.ts`** — the point split (60% must-have / 20%
nice-to-have / 20% experience) and `LISTED_CREDIT`, the 0.5 multiplier applied to
a skill that is listed but not demonstrated. Lower it to punish keyword-stuffing
harder; raise it toward 1.0 to ignore evidence entirely.

If AI screening is enabled, its rubric is the `RUBRIC` constant in
`src/lib/score-ai.ts`, written in plain English.

## Semantic matching (meaning, not just words)

CVs rarely use a role's exact keywords. A candidate who wrote *"coordinated
mechanical and electrical models and ran interference checks"* should match a
role needing *"Revit MEP, clash detection"* — same meaning, no shared words.

Three layers handle this, cheapest first:

1. **Keyword + alias** (always on, free, instant) — exact and alias matches.
2. **Semantic** (`SEMANTIC_MATCHING="on"`, free, offline) — a local embedding
   model (`SEMANTIC_MODEL`, default `bge-base-en-v1.5`) matches skills the
   keywords missed *by meaning*. Runs on your machine; downloads the model once
   (~110MB) on first use. `SEMANTIC_THRESHOLD` tunes strictness.
3. **Claude AI screening** (paid, opt-in) — the deepest judgement.

Honest limits of the free semantic layer:

- It matches *related concepts*, so it occasionally over-fires ("produced
  drawings" is genuinely near "AutoCAD"). Because of that, a semantic match is
  worth **half credit**, never full, and every one is shown to the reviewer
  under *"Matched by meaning — please confirm"* with the CV line it matched.
  It's a lead for a human to check, not a decision.
- It's not RAG. RAG (retrieve-then-generate) is the Claude layer. This is
  semantic *similarity*, which is the right tool for matching.
- Fail-open: if the model can't load, scoring silently falls back to keywords.
- Tune `SEMANTIC_THRESHOLD` and `SEMANTIC_MODEL` against your own CVs. A bigger
  model separates true matches from loose ones better, at some CPU cost.

## Privacy and GDPR

> **This provides the technical mechanisms GDPR asks for. It does not make your
> deployment lawful, and it is not legal advice.** Compliance is mostly
> organisational — a lawful basis, a DPIA, retention enforcement, and a real
> person accountable — none of which code can do for you. Have your data
> protection lead or a lawyer review this before real candidates use it.

What the app does provide:

- **A candidate-facing privacy notice** (`src/components/privacy-notice.tsx`),
  shown before consent, filled from your details in `.env`:
  `COMPANY_NAME`, `PRIVACY_CONTACT_EMAIL`, `DATA_RETENTION`,
  `PRIVACY_NOTICE_VERSION`. Set these to real values — the notice is a legal
  document.
- **Granular, unbundled consent** — the candidate consents to screen recording
  and camera recording *separately*, plus acknowledges the notice. Recording is
  unavailable until all three are given, and the notice tells them they may
  decline and be assessed another way.
- **A consent record** stored on each assessment: which consents were given,
  which notice version, and when. This is the "demonstrate consent" requirement.
  No IP is stored — data minimisation.
- **Right to erasure** — on a candidate's page, *Delete candidate & all data*
  removes the person and every application, note, assessment **and stored
  recording/test file** (local or R2). *Delete recording* withdraws consent for
  just the recording and deletes it, leaving the rest.

What is still yours to do:

- **Choose a lawful basis.** For recruitment, consent is often *not* the right
  basis (the power imbalance can make it not "freely given"); legitimate
  interest is common but needs a documented assessment. Decide this with advice.
- **Run a DPIA.** Camera monitoring of candidates is exactly the high-risk
  processing that makes a Data Protection Impact Assessment **legally required**
  under Article 35. Do it before you switch the camera on for real.
- **Enforce retention.** The notice states a period; you must actually delete
  data when it expires. Nothing here does that automatically yet.
- **Appoint a contact** and monitor the `PRIVACY_CONTACT_EMAIL` inbox for access,
  deletion, and withdrawal requests.

## Deploying to Postgres

The schema deliberately avoids enums and array columns so the same models run on
both SQLite and Postgres. Switching takes three edits:

1. `prisma/schema.prisma` — change `provider = "sqlite"` to `"postgresql"`.
2. `.env` — point `DATABASE_URL` at your Postgres instance.
3. `src/lib/db.ts` and `prisma/seed.ts` — swap the driver adapter:

   ```bash
   npm install @prisma/adapter-pg
   npm uninstall @prisma/adapter-better-sqlite3
   ```

   ```ts
   import { PrismaPg } from "@prisma/adapter-pg";
   const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
   ```

Then `npx prisma migrate deploy`. Neon and Supabase both work on their free tiers.

## Accounts and sign-in

Every page, API route and Server Action requires a login.

Create a staff account:

```bash
npx tsx prisma/create-user.ts someone@company.com "Their Name"
```

A strong password is generated and printed **once** — save it in a password
manager. To set one yourself, pass it as a third argument. Re-running for an
existing email resets that person's password and signs out their active
sessions, which is also how you revoke access when someone leaves.

How it is enforced, in three layers:

| Layer | File | Purpose |
| --- | --- | --- |
| Route guard | `src/proxy.ts` | Redirects anonymous visitors to `/login` |
| Page guard | `requirePageUser()` in each page | Redirects if the session is invalid |
| Action/API guard | `requireUser()` / `denyAnonymous()` | The actual security boundary |

The third layer is the one that matters. Server Actions are reachable by direct
POST and API routes by direct `fetch`, so neither of the first two can be relied
on alone — during development this app served the entire candidate list
anonymously because the guard file sat in the wrong directory and silently never
ran. Never add a page, action or route without its own check.

Passwords are hashed with scrypt (Node standard library, no native dependency to
compile) and compared in constant time. Sessions are rows in the database, so
deleting one revokes a login immediately.

## Before this touches real candidate data

- **Resumes are personal data.** Resume text is stored in full in the database.
  With AI screening off, it never leaves your machine. Add a retention and
  deletion policy, and confirm this fits your obligations to candidates.
- **The dev server binds to your network by default.** `npm run dev` prints a
  `Network:` address, meaning anyone on the same WiFi can reach the login page.
  That is fine now that auth exists, but use `next dev -H 127.0.0.1` if you want
  it strictly local.
- **No HTTPS locally.** Session cookies are marked `secure` only in production.
  Put this behind HTTPS before serving it beyond your own machine.
- **No rate limiting on login.** Fine for a small internal tool on a trusted
  network; add throttling before exposing it to the internet.

Also worth knowing: **scores are advisory, not decisions.** The scorer reads
words; it cannot tell that a candidate's "Revit API" work was two lines of
boilerplate, and it will misread unusual CV layouts. Every score links to the
resume line behind it precisely so a human can overrule it. Do not auto-reject
on score alone.

## Architecture

| Path | Purpose |
| --- | --- |
| `src/lib/bim-taxonomy.ts` | Skill definitions, weights, aliases, text detection |
| `src/lib/score-rules.ts` | Deterministic baseline scoring |
| `src/lib/score-ai.ts` | Claude screening — rubric, JSON schema, API call |
| `src/lib/resume-parse.ts` | PDF/DOCX/TXT extraction, contact heuristics |
| `src/app/actions.ts` | Server Actions used by the UI |
| `src/app/api/` | REST routes for external integration (job boards, scripts) |

The UI uses Server Actions; the REST routes exist so a careers page or an
importer can drive the same logic without going through the browser.

Built on Next.js 16 (App Router), Prisma 7, Tailwind 4. Data pages are
`force-dynamic` — Next 16 would otherwise prerender them at build time and serve
stale pipeline counts.
