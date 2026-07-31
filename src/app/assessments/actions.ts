"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export type ActionState = { error?: string; ok?: string };

/** Non-negative integer from a form field. */
function intField(fd: FormData, name: string): number {
  return Math.max(0, Math.round(Number(fd.get(name)) || 0));
}

const PROCTOR_EVENT_TYPES = new Set([
  "tab_hidden",
  "tab_visible",
  "paste",
  "copy",
  "fullscreen_exit",
  "look_away",
  "multi_face",
]);

/**
 * The proctor timeline arrives as JSON from the (untrusted) candidate page, so
 * we validate it: keep only well-formed {t, type} events with a known type,
 * clamp the timestamp, and cap the length. Anything odd becomes an empty log
 * rather than being stored verbatim.
 */
function sanitizeLog(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string" || raw.length > 40_000) return "[]";
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return "[]";
    const clean = parsed
      .filter(
        (e) =>
          e &&
          typeof e === "object" &&
          PROCTOR_EVENT_TYPES.has(e.type) &&
          Number.isFinite(Number(e.t)),
      )
      .slice(0, 600)
      .map((e) => ({ t: Math.max(0, Math.round(Number(e.t))), type: String(e.type) }));
    return JSON.stringify(clean);
  } catch {
    return "[]";
  }
}

/** Best-effort URL sanity check so a pasted "drive.google..." typo is caught early. */
function looksLikeUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Create and send a technical assessment for one application.
 *
 * Generates the secret token that gates the candidate's submission page. The
 * token is the only thing standing between the public internet and this
 * candidate's test, so it is 32 random bytes, not a guessable id.
 */
export async function sendAssessment(
  applicationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const title = String(formData.get("title") ?? "").trim() || "Technical assessment";
  const instructions = String(formData.get("instructions") ?? "").trim();
  const testUrl = String(formData.get("testUrl") ?? "").trim();

  if (testUrl && !looksLikeUrl(testUrl)) {
    return { error: "The test file link doesn't look like a URL (needs http:// or https://)." };
  }

  const token = randomBytes(32).toString("hex");

  // upsert: re-sending replaces the previous assessment for this application and
  // resets the clock, rather than accumulating stale ones.
  await prisma.assessment.upsert({
    where: { applicationId },
    update: {
      title,
      instructions,
      testUrl,
      token,
      status: "sent",
      sentAt: new Date(),
      submittedAt: null,
      videoUrl: "",
      outputUrl: "",
      candidateNote: "",
      qualityScore: null,
      durationMin: null,
      reviewNotes: "",
      reviewedAt: null,
    },
    create: { applicationId, title, instructions, testUrl, token },
  });

  // Nudge the pipeline stage so a sent test is visible at a glance.
  const app = await prisma.application.update({
    where: { id: applicationId },
    data: { stage: "assessment" },
    select: { jobId: true, candidate: { select: { name: true } } },
  });

  await logActivity({
    jobId: app.jobId,
    applicationId,
    actor: user.name,
    type: "assessment_sent",
    detail: `Sent "${title}" to ${app.candidate.name}`,
  });

  revalidatePath(`/applications/${applicationId}`);
  revalidatePath(`/jobs/${app.jobId}`);
  return { ok: "Assessment ready. Copy the candidate link below and send it to them." };
}

/**
 * Candidate submission. PUBLIC — reached from the tokenised page with no login,
 * so the token IS the authentication. There is deliberately no requireUser here;
 * instead every lookup is scoped by the secret token, and a wrong token finds
 * nothing.
 */
export async function submitAssessment(
  token: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const assessment = await prisma.assessment.findUnique({ where: { token } });
  if (!assessment) return { error: "This assessment link is not valid." };
  if (assessment.status === "reviewed") {
    return { error: "This assessment has already been reviewed and can no longer be changed." };
  }

  const videoUrl = String(formData.get("videoUrl") ?? "").trim();
  const outputUrl = String(formData.get("outputUrl") ?? "").trim();
  const candidateNote = String(formData.get("candidateNote") ?? "").trim();
  const consentScreen = formData.get("consentScreen") === "1";
  const consentCamera = formData.get("consentCamera") === "1";
  const noticeVersion = String(formData.get("noticeVersion") ?? "").trim();

  // A recording without recorded consent must not be accepted — that's the
  // whole point of capturing it.
  if (videoUrl && (!consentScreen || !consentCamera)) {
    return { error: "Please give consent for screen and camera recording before submitting." };
  }

  if (!videoUrl) {
    return { error: "Record your screen and camera above, or paste a link." };
  }
  if (!looksLikeUrl(videoUrl)) {
    return { error: "The recording link doesn't look like a URL (needs http:// or https://)." };
  }
  if (outputUrl && !looksLikeUrl(outputUrl)) {
    return { error: "The output file link doesn't look like a URL." };
  }

  await prisma.assessment.update({
    where: { token },
    data: {
      videoUrl,
      outputUrl,
      candidateNote,
      status: "submitted",
      // Only stamp the submit time on the first submission, so re-submitting to
      // fix a broken link doesn't inflate the elapsed time.
      submittedAt: assessment.submittedAt ?? new Date(),
      // Persist the consent record: what was agreed, which notice version, when.
      consentScreen,
      consentCamera,
      consentNoticeVersion: noticeVersion,
      consentAt: assessment.consentAt ?? new Date(),
      // Attention monitoring result (a reviewer aid, computed client-side).
      attentionAwaySec: Math.max(0, Math.round(Number(formData.get("attentionAwaySec")) || 0)),
      attentionEvents: Math.max(0, Math.round(Number(formData.get("attentionEvents")) || 0)),
      // Extended behavioural proctoring signals + timeline (also reviewer aids).
      proctorTabHiddenSec: intField(formData, "proctorTabHiddenSec"),
      proctorTabSwitches: intField(formData, "proctorTabSwitches"),
      proctorPastes: intField(formData, "proctorPastes"),
      proctorCopies: intField(formData, "proctorCopies"),
      proctorFullscreenExits: intField(formData, "proctorFullscreenExits"),
      proctorMultiFace: intField(formData, "proctorMultiFace"),
      proctorLog: sanitizeLog(formData.get("proctorLog")),
    },
  });

  const app = await prisma.application.findUnique({
    where: { id: assessment.applicationId },
    select: { jobId: true, candidate: { select: { name: true } } },
  });
  // Any proctoring signal firing is worth surfacing on the timeline so a
  // reviewer knows to look — never a verdict, just "check the footage".
  const flagged =
    intField(formData, "attentionEvents") > 0 ||
    intField(formData, "proctorTabSwitches") > 0 ||
    intField(formData, "proctorPastes") > 0 ||
    intField(formData, "proctorFullscreenExits") > 0 ||
    intField(formData, "proctorMultiFace") > 0;
  await logActivity({
    jobId: app?.jobId,
    applicationId: assessment.applicationId,
    actor: "candidate",
    type: "assessment_submitted",
    detail: `${app?.candidate.name ?? "Candidate"} submitted the assessment${
      flagged ? " — proctoring flags to review" : ""
    }`,
  });

  revalidatePath(`/applications/${assessment.applicationId}`);
  if (app) revalidatePath(`/jobs/${app.jobId}`);
  return { ok: "Submitted. Thank you — you can close this page." };
}

/** Reviewer scores the work: quality (0-100) plus the real working time. */
export async function reviewAssessment(
  applicationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const quality = Number(formData.get("qualityScore"));
  const duration = formData.get("durationMin") ? Number(formData.get("durationMin")) : null;
  const reviewNotes = String(formData.get("reviewNotes") ?? "").trim();

  if (!Number.isFinite(quality) || quality < 0 || quality > 100) {
    return { error: "Quality score must be a number from 0 to 100." };
  }
  if (duration !== null && (!Number.isFinite(duration) || duration < 0)) {
    return { error: "Working time must be a positive number of minutes." };
  }

  await prisma.assessment.update({
    where: { applicationId },
    data: {
      qualityScore: Math.round(quality),
      durationMin: duration !== null ? Math.round(duration) : null,
      reviewNotes,
      status: "reviewed",
      reviewedAt: new Date(),
    },
  });

  const app = await prisma.assessment.findUnique({
    where: { applicationId },
    select: {
      application: { select: { jobId: true, candidate: { select: { name: true } } } },
    },
  });
  await logActivity({
    jobId: app?.application.jobId,
    applicationId,
    actor: user.name,
    type: "reviewed",
    detail: `Reviewed ${app?.application.candidate.name ?? "candidate"}'s assessment — quality ${Math.round(
      quality,
    )}/100${duration !== null ? `, ${Math.round(duration)} min` : ""}`,
  });

  revalidatePath(`/applications/${applicationId}`);
  if (app) revalidatePath(`/jobs/${app.application.jobId}`);

  return { ok: "Review saved." };
}
