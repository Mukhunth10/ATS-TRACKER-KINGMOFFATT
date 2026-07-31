# Deploying the ATS (free, always-on link)

This puts the app on the internet so it works even when your laptop is off.
Everything here is **free and needs no credit card** — only a GitHub login.

**What works when deployed:** account signup/login, CV upload + parsing, keyword
& evidence scoring, ranking, the recruiter filters (work auth / degree /
location), assessments, the live board and audit trail.

**What does NOT work remotely:** the local Ollama AI "written verdict" — it needs
the model on your machine. Everything else runs fine; the verdict comes back when
you screen from your own laptop (or if you enable the paid Claude key).

Both pieces run on **Render**: a free Postgres database and a free web
service, ideally in the same region so every query stays fast.

---

## 1. Database — Render Postgres

1. On <https://render.com>, **New → PostgreSQL** → name it (e.g.
   `ats-tracker-db`) → pick the **same region** you'll use for the web service
   below → **Free** plan → **Create Database**.
2. Once it's up, copy the **External Database URL** (needed once, from your
   own laptop, to create the schema).

### Create the schema (run once, on your laptop)

In the `ats` folder:

```bash
# PowerShell
$env:DATABASE_URL="postgresql://...external database url.../ats_tracker_db?sslmode=require"
npx prisma migrate deploy
```

You should see `All migrations have been successfully applied.`

Also copy the **Internal Database URL** (used by the web service below — no
SSL hop needed since both live inside Render's network).

---

## 2. App — Render Web Service

1. **New → Blueprint** → connect the repo → Render reads `render.yaml` and
   proposes the service. Click **Apply**.
2. When prompted, fill the secret env vars:
   - `DATABASE_URL` — the **Internal Database URL** from step 1
   - `SIGNUP_CODE` — an invite code of your choice (share it only with your HR
     testers, e.g. `km-hiring-2026`)
   - `PRIVACY_CONTACT_EMAIL` — a monitored inbox
3. Click **Create / Deploy**. First build takes ~3–5 minutes.
4. When it's live you get a URL like `https://ats-tracker.onrender.com`.

### Share it

Send HR the URL + the `SIGNUP_CODE`. They open the link, create an account with
the code, and start screening. The link stays up with your laptop off.

> **Free-tier notes:** the web service sleeps after ~15 minutes with no
> visitors; the next visit wakes it in ~30 seconds (one slow load, then
> normal). Render's free Postgres plan has historically expired after a fixed
> period (check current terms on render.com) — worth confirming before
> relying on it long-term for real hiring data; upgrading to a paid Postgres
> plan removes that limit.

---

## Turning it off

Nothing to pay on the free tier, but when you're done: in Render, delete both
the web service and the Postgres database.

## Local development

Local development now points at the same kind of Postgres database (set
`DATABASE_URL` in `.env` to a Postgres connection string — the Render database
itself, or any other Postgres instance). The local Ollama AI screening step is
unaffected either way; it runs from your own machine regardless of where the
database lives.
