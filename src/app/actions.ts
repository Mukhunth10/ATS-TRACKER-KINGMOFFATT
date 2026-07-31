"use server";

import { revalidatePath } from "next/cache";
import { prisma, parseJson } from "@/lib/db";
import { extractText, extractContact } from "@/lib/resume-parse";
import { redirect } from "next/navigation";
import { scoreByRules, type JobCriteria, type RuleDetail } from "@/lib/score-rules";
import { scoreByAi, isAiConfigured } from "@/lib/score-ai";
import {
  scoreByLocalAi,
  localAiConfigured,
  localAiAvailable,
  type RuleSignals,
} from "@/lib/score-local";
import { requireUser } from "@/lib/auth";
import { deleteStored } from "@/lib/storage";
import { logActivity } from "@/lib/activity";

/** Unpacks a Job row's JSON columns into the shape the scorer expects. */
function criteriaFor(job: {
  mustHave: string;
  niceToHave: string;
  customMustHave: string;
  customNiceToHave: string;
  minYears: number;
}): JobCriteria {
  return {
    mustHave: parseJson<string[]>(job.mustHave, []),
    niceToHave: parseJson<string[]>(job.niceToHave, []),
    customMustHave: parseJson<string[]>(job.customMustHave, []),
    customNiceToHave: parseJson<string[]>(job.customNiceToHave, []),
    minYears: job.minYears,
  };
}

/** Splits a textarea of keywords (one per line, or comma separated) into terms. */
function parseKeywordList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * AUTH: every action below starts with `await requireUser()`.
 *
 * Server Actions are reachable by direct POST, not only through the UI, so the
 * redirect in proxy.ts is not a security boundary — it only saves a human a
 * wasted page load. requireUser() throws when there is no valid session, so an
 * action that forgets the call fails closed rather than leaking data.
 */

export type ActionState = { error?: string; ok?: string };

const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;
export type Stage = (typeof STAGES)[number];

export async function moveStage(applicationId: string, stage: string, reason?: string) {
  const user = await requireUser();
  if (!STAGES.includes(stage as Stage)) return;

  const before = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { jobId: true, stage: true, candidate: { select: { name: true } } },
  });
  if (!before) return;

  // A disposition reason only applies when declining.
  const dispositionReason = stage === "rejected" ? (reason ?? "").trim() : "";

  await prisma.application.update({
    where: { id: applicationId },
    data: { stage, dispositionReason },
  });

  await logActivity({
    jobId: before.jobId,
    applicationId,
    actor: user.name,
    type: "stage_change",
    detail:
      stage === "rejected"
        ? `Declined ${before.candidate.name}${dispositionReason ? ` — ${dispositionReason}` : ""}`
        : `Moved ${before.candidate.name} to ${stage}`,
  });

  revalidatePath(`/jobs/${before.jobId}`);
  revalidatePath(`/applications/${applicationId}`);
}

export async function addNote(
  applicationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Note cannot be empty." };

  // Attribute the note to whoever is signed in, rather than a generic label.
  await prisma.note.create({ data: { applicationId, body, author: user.name } });

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { jobId: true, candidate: { select: { name: true } } },
  });
  await logActivity({
    jobId: app?.jobId,
    applicationId,
    actor: user.name,
    type: "note",
    detail: `Note on ${app?.candidate.name ?? "candidate"}: ${
      body.length > 80 ? body.slice(0, 80) + "…" : body
    }`,
  });

  revalidatePath(`/applications/${applicationId}`);
  revalidatePath(`/jobs/${app?.jobId}`);
  return { ok: "Note added." };
}

/**
 * LLM screening. Prefers the free, private local model (Ollama) when it's
 * available; otherwise uses the paid Claude screener. The stored result is the
 * same shape either way, so the UI doesn't care which ran.
 */
async function runScreen(applicationId: string): Promise<ActionState> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { candidate: true, job: true },
  });
  if (!app) return { error: "Application not found." };

  const jobArg = {
    title: app.job.title,
    track: app.job.track,
    seniority: app.job.seniority,
    minYears: app.job.minYears,
    description: app.job.description,
    mustHave: parseJson<string[]>(app.job.mustHave, []),
    niceToHave: parseJson<string[]>(app.job.niceToHave, []),
  };

  const useLocal = localAiConfigured() && (await localAiAvailable());
  if (!useLocal && !isAiConfigured()) {
    return {
      error:
        "No AI screener available. Either run Ollama locally (free, see .env) or set ANTHROPIC_API_KEY.",
    };
  }

  // Hand the local model the rule-based evidence already computed for this
  // application, so it corroborates real signals instead of starting cold.
  const rd = parseJson<Partial<RuleDetail>>(app.ruleDetail, {});
  const signals: RuleSignals = {
    yearsDetected: rd.yearsDetected,
    yearsRequired: rd.yearsRequired ?? app.job.minYears,
    demonstrated: rd.demonstrated,
    listedOnly: rd.listedOnly,
    missingMustHave: rd.missingMustHave,
    semantic: rd.semantic,
  };

  const provider = useLocal ? "local" : "Claude";
  try {
    const result = useLocal
      ? await scoreByLocalAi(app.candidate.resumeText, jobArg, signals)
      : await scoreByAi(app.candidate.resumeText, jobArg);

    await prisma.application.update({
      where: { id: applicationId },
      data: {
        aiScore: result.score,
        aiSummary: result.summary,
        aiDetail: JSON.stringify(result),
        aiScoredAt: new Date(),
      },
    });

    await logActivity({
      jobId: app.jobId,
      applicationId,
      actor: `${provider} AI`,
      type: "screened",
      detail: `Screened ${app.candidate.name}: ${result.score}/100 (${result.recommendation})`,
    });

    revalidatePath(`/applications/${applicationId}`);
    revalidatePath(`/jobs/${app.jobId}`);
    return {
      ok: `Screened with ${provider} AI — ${result.score}/100 (${result.recommendation}).`,
    };
  } catch (err) {
    console.error(`${provider} screening failed`, err);
    return { error: err instanceof Error ? err.message : "Screening failed." };
  }
}

/** Screen one application. Surfaced as a button on the candidate page. */
export async function screenWithAi(
  applicationId: string,
  _prev: ActionState,
): Promise<ActionState> {
  await requireUser();
  return runScreen(applicationId);
}

/**
 * Agentic batch screen: screen every not-yet-screened candidate on a role in one
 * action. Runs sequentially so a local model isn't overwhelmed, and reports how
 * many it processed. This is the "autonomously evaluate the whole pipeline" step.
 */
export async function screenJob(jobId: string, _prev: ActionState): Promise<ActionState> {
  await requireUser();

  const useLocal = localAiConfigured() && (await localAiAvailable());
  if (!useLocal && !isAiConfigured()) {
    return { error: "No AI screener available. Run Ollama locally, or set ANTHROPIC_API_KEY." };
  }

  // The LLM writes a paragraph per candidate — seconds each — so it is a
  // shortlist tool, never a "run on all 500" button. We deep-screen only the
  // top of the ranking (by the instant score); everyone else stays filterable
  // by their evidence score, and any individual can still be screened by hand.
  const SHORTLIST_CAP = 15;
  const pending = await prisma.application.findMany({
    where: { jobId, aiScore: null },
    select: { id: true },
    orderBy: { ruleScore: "desc" },
    take: SHORTLIST_CAP,
  });
  if (pending.length === 0) return { ok: "The top candidates on this role are already screened." };

  let done = 0;
  let failed = 0;
  for (const { id } of pending) {
    const r = await runScreen(id);
    if (r.error) failed++;
    else done++;
  }

  revalidatePath(`/jobs/${jobId}`);
  return {
    ok: `Deep-screened the top ${done} candidate${done === 1 ? "" : "s"} by score${
      failed ? `, ${failed} failed` : ""
    }.`,
  };
}

/**
 * Bulk resume intake. Accepts many files at once because applications arrive in
 * batches from LinkedIn, Indeed, jobs.ie and the careers page — uploading them
 * one at a time is not a real workflow.
 *
 * Each file is processed independently: one unreadable CV in a batch of fifty
 * must not discard the other forty-nine, so failures are collected and
 * reported rather than thrown.
 */
export async function uploadResume(
  jobId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const files = formData.getAll("resume").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return { error: "Choose at least one CV (PDF, DOCX, TXT or MD)." };
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return { error: "Job not found." };

  const criteria = criteriaFor(job);
  const source = String(formData.get("source") ?? "direct").trim() || "direct";

  // Manual overrides only make sense for a single upload; with a batch we rely
  // entirely on what each CV contains.
  const single = files.length === 1;
  const overrideEmail = single ? String(formData.get("email") ?? "").trim() : "";
  const overrideName = single ? String(formData.get("name") ?? "").trim() : "";

  const added: string[] = [];
  const updated: string[] = [];
  const failed: string[] = [];

  for (const file of files) {
    try {
      const text = await extractText(Buffer.from(await file.arrayBuffer()), file.name);

      if (text.trim().length < 100) {
        failed.push(`${file.name}: no readable text (scanned image?)`);
        continue;
      }

      const contact = extractContact(text);
      const email = overrideEmail || contact.email;
      const name = overrideName || contact.name;

      if (!email) {
        failed.push(`${file.name}: no email address found`);
        continue;
      }

      // Email is the identity key, so the same person applying via LinkedIn and
      // Indeed lands on one record instead of two.
      const existing = await prisma.candidate.findUnique({ where: { email } });
      const candidate = await prisma.candidate.upsert({
        where: { email },
        update: { resumeText: text, resumeFile: file.name, ...(name ? { name } : {}) },
        create: {
          name: name ?? email,
          email,
          phone: contact.phone,
          resumeText: text,
          resumeFile: file.name,
        },
      });

      // Bulk intake uses the INSTANT evidence+keyword scorer (no embeddings, no
      // LLM), so 500 CVs rank in the time they take to parse. Semantic and the
      // LLM verdict are deep-dive tools you run on the shortlist afterwards, not
      // on every applicant.
      const rules = scoreByRules(text, criteria);

      const priorApplication = await prisma.application.findUnique({
        where: { jobId_candidateId: { jobId, candidateId: candidate.id } },
      });

      const application = await prisma.application.upsert({
        where: { jobId_candidateId: { jobId, candidateId: candidate.id } },
        update: {
          ruleScore: rules.score,
          ruleDetail: JSON.stringify(rules.detail),
          // Record every portal a duplicate arrived through, rather than
          // overwriting — knowing someone applied twice is useful signal.
          // Split-and-check so re-uploading from the same portal doesn't
          // accumulate "LinkedIn, LinkedIn, LinkedIn".
          source:
            priorApplication &&
            !priorApplication.source.split(",").map((s) => s.trim()).includes(source)
              ? `${priorApplication.source}, ${source}`
              : (priorApplication?.source ?? source),
        },
        create: {
          jobId,
          candidateId: candidate.id,
          source,
          ruleScore: rules.score,
          ruleDetail: JSON.stringify(rules.detail),
        },
      });

      if (priorApplication || existing) {
        updated.push(`${candidate.name} (${rules.score})`);
      } else {
        added.push(`${candidate.name} (${rules.score})`);
      }

      await logActivity({
        jobId,
        applicationId: application.id,
        actor: user.name,
        type: priorApplication ? "reviewed" : "uploaded",
        detail: priorApplication
          ? `Refreshed ${candidate.name} — rule score ${rules.score}`
          : `Added ${candidate.name} (${source}) — rule score ${rules.score}`,
      });
    } catch (err) {
      failed.push(`${file.name}: ${err instanceof Error ? err.message : "unreadable"}`);
    }
  }

  revalidatePath(`/jobs/${jobId}`);

  const parts: string[] = [];
  if (added.length) parts.push(`${added.length} added`);
  if (updated.length) parts.push(`${updated.length} already known, refreshed`);

  if (parts.length === 0) {
    return { error: `Nothing imported. ${failed.join("; ")}` };
  }

  return {
    ok: `${parts.join(", ")}.${failed.length ? ` ${failed.length} failed: ${failed.join("; ")}` : ""}`,
  };
}

/**
 * Re-runs scoring for every candidate on a role. Needed whenever the role's
 * keywords change — otherwise existing applicants keep scores computed against
 * the old criteria and the ranking silently lies.
 */
export async function rescoreJob(jobId: string, _prev: ActionState): Promise<ActionState> {
  await requireUser();

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { applications: { include: { candidate: true } } },
  });
  if (!job) return { error: "Job not found." };

  const criteria = criteriaFor(job);

  // Instant scorer, so re-ranking a whole role (even hundreds of CVs) against
  // edited keywords is immediate.
  for (const app of job.applications) {
    const rules = scoreByRules(app.candidate.resumeText, criteria);
    await prisma.application.update({
      where: { id: app.id },
      data: { ruleScore: rules.score, ruleDetail: JSON.stringify(rules.detail) },
    });
  }

  revalidatePath(`/jobs/${jobId}`);
  return { ok: `Rescored ${job.applications.length} candidates.` };
}

/** Update a role's keywords, then rescore everyone against the new criteria. */
export async function updateJobKeywords(
  jobId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  await prisma.job.update({
    where: { id: jobId },
    data: {
      customMustHave: JSON.stringify(
        parseKeywordList(String(formData.get("customMustHave") ?? "")),
      ),
      customNiceToHave: JSON.stringify(
        parseKeywordList(String(formData.get("customNiceToHave") ?? "")),
      ),
      minYears: Number(formData.get("minYears") ?? 0) || 0,
    },
  });

  return rescoreJob(jobId, {});
}

/**
 * Right to erasure. Deletes a candidate and everything tied to them —
 * applications, notes, assessments (all cascade in the database) — plus the
 * actual recording and test files those assessments referenced, which the
 * database cascade cannot reach. This is the technical half of a GDPR deletion
 * request; the organisation still logs and honours the request itself.
 */
export async function deleteCandidate(candidateId: string): Promise<void> {
  await requireUser();

  // Collect stored file references before the cascade removes the rows.
  const assessments = await prisma.assessment.findMany({
    where: { application: { candidateId } },
    select: { videoUrl: true, testUrl: true },
  });

  for (const a of assessments) {
    if (a.videoUrl) await deleteStored(a.videoUrl);
    if (a.testUrl) await deleteStored(a.testUrl);
  }

  await prisma.candidate.delete({ where: { id: candidateId } });

  revalidatePath("/candidates");
  redirect("/candidates");
}

/**
 * Withdraw consent for a single assessment recording and delete it. Leaves the
 * rest of the candidate's record intact — the narrower "delete this recording"
 * a candidate might ask for without wanting to leave the process.
 */
export async function deleteRecording(applicationId: string): Promise<void> {
  await requireUser();

  const a = await prisma.assessment.findUnique({
    where: { applicationId },
    select: { videoUrl: true },
  });
  if (a?.videoUrl) await deleteStored(a.videoUrl);

  await prisma.assessment.update({
    where: { applicationId },
    data: { videoUrl: "", consentScreen: false, consentCamera: false, consentAt: null },
  });

  revalidatePath(`/applications/${applicationId}`);
}

/** Create a role from the new-role form. */
/** Open or close public applications for a role (the /apply link keeps working
 *  but rejects submissions when closed). */
export async function setApplyOpen(jobId: string, open: boolean): Promise<ActionState> {
  await requireUser();
  await prisma.job.update({ where: { id: jobId }, data: { applyOpen: open } });
  revalidatePath(`/jobs/${jobId}`);
  return { ok: open ? "Applications opened." : "Applications closed." };
}

export async function createJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const job = await prisma.job.create({
    data: {
      title,
      track: String(formData.get("track") ?? "General"),
      location: String(formData.get("location") ?? "Unspecified"),
      seniority: String(formData.get("seniority") ?? "mid"),
      minYears: Number(formData.get("minYears") ?? 0) || 0,
      description: String(formData.get("description") ?? ""),
      mustHave: JSON.stringify(formData.getAll("mustHave").map(String)),
      niceToHave: JSON.stringify(formData.getAll("niceToHave").map(String)),
      customMustHave: JSON.stringify(
        parseKeywordList(String(formData.get("customMustHave") ?? "")),
      ),
      customNiceToHave: JSON.stringify(
        parseKeywordList(String(formData.get("customNiceToHave") ?? "")),
      ),
    },
  });

  await logActivity({
    jobId: job.id,
    actor: user.name,
    type: "created",
    detail: `Opened the "${job.title}" role`,
  });

  revalidatePath("/");
  return { ok: `Created “${job.title}”.` };
}
