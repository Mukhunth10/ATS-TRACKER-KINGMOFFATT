# Deploying the ATS (free, always-on link)

This puts the app on the internet so it works even when your laptop is off.
Everything here is **free and needs no credit card** — only a GitHub login.

**What works when deployed:** account signup/login, CV upload + parsing, keyword
& evidence scoring, ranking, the recruiter filters (work auth / degree /
location), assessments, the live board and audit trail.

**What does NOT work remotely:** the local Ollama AI "written verdict" — it needs
the model on your machine. Everything else runs fine; the verdict comes back when
you screen from your own laptop (or if you enable the paid Claude key).

There are two free services: **Turso** (the database) and **Render** (the app).

---

## 1. Database — Turso (hosted SQLite)

1. Go to <https://turso.tech> → **Sign up** with GitHub (no card).
2. Create a database (any name, e.g. `ats`). Pick the region closest to you.
3. On the database page, copy two things:
   - **Database URL** — looks like `libsql://ats-yourname.turso.io`
   - **Auth token** — create one ("Generate token"); a long `eyJ...` string.

### Create the tables + demo roles (run once, on your laptop)

In the `ats` folder:

```bash
# PowerShell
$env:TURSO_DATABASE_URL="libsql://ats-yourname.turso.io"
$env:TURSO_AUTH_TOKEN="eyJ...your token..."
npm run init:turso
```

You should see `Schema ready …` and `Seeded 4 demo roles.` The database is now
ready. (Running it again is safe — it won't duplicate anything.)

---

## 2. App — Render

1. Go to <https://render.com> → **Sign up** with GitHub (no card).
2. **New → Blueprint** → connect the **`ats_tracker`** repo → Render reads
   `render.yaml` and proposes the service. Click **Apply**.
3. When prompted, fill the secret env vars:
   - `TURSO_DATABASE_URL` — the `libsql://…` URL from step 1
   - `TURSO_AUTH_TOKEN` — the `eyJ…` token from step 1
   - `SIGNUP_CODE` — an invite code of your choice (share it only with your HR
     testers, e.g. `km-demo-2026`)
   - `PRIVACY_CONTACT_EMAIL` — a monitored inbox
4. Click **Create / Deploy**. First build takes ~3–5 minutes.
5. When it's live you get a URL like `https://ats-tracker.onrender.com`.

### Share it

Send HR the URL + the `SIGNUP_CODE`. They open the link, create an account with
the code, and start screening. The link stays up with your laptop off.

> **Free-tier note:** after ~15 minutes with no visitors the service sleeps; the
> next visit wakes it in ~30 seconds (one slow load, then normal). Data is safe
> in Turso regardless.

---

## Turning it off

Nothing to pay, but when the demo's done: in Render, delete the service (or set
it to suspend). In Turso, delete the database. That's it.

## Back on your laptop

Local development is unchanged — it uses the offline SQLite file and your local
Ollama model. The Turso/Render setup is entirely separate and only active while
deployed.
