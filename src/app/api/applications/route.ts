import { NextResponse } from "next/server";
import { prisma, parseJson } from "@/lib/db";
import { extractText, extractContact } from "@/lib/resume-parse";
import { scoreCandidate } from "@/lib/score-rules";
import { denyAnonymous } from "@/lib/api-auth";

export const runtime = "nodejs"; // pdf-parse and mammoth need Node APIs

/**
 * Intake: accepts a resume upload against a job, extracts text, upserts the
 * candidate, and returns the application with its rules-based score already
 * computed. AI screening is a separate, explicit call so a bad API key or a
 * rate limit never blocks a candidate from entering the pipeline.
 */
export async function POST(req: Request) {
  const denied = await denyAnonymous();
  if (denied) return denied;

  const form = await req.formData();
  const jobId = form.get("jobId");
  const file = form.get("resume");

  if (typeof jobId !== "string" || !jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "resume file is required" }, { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    text = await extractText(buffer, file.name);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read resume" },
      { status: 400 },
    );
  }

  if (text.trim().length < 100) {
    return NextResponse.json(
      { error: "Extracted almost no text — the file may be a scanned image rather than a text PDF." },
      { status: 400 },
    );
  }

  const contact = extractContact(text);
  // Form fields override parsed values, so the recruiter can correct a bad parse.
  const name = (form.get("name") as string) || contact.name;
  const email = (form.get("email") as string) || contact.email;

  if (!email) {
    return NextResponse.json(
      { error: "No email found in the resume — supply one in the form." },
      { status: 400 },
    );
  }

  const candidate = await prisma.candidate.upsert({
    where: { email },
    // A returning candidate's latest resume is the one worth scoring against.
    update: { resumeText: text, resumeFile: file.name, name: name ?? undefined },
    create: {
      name: name ?? email,
      email,
      phone: (form.get("phone") as string) || contact.phone,
      location: (form.get("location") as string) || null,
      resumeText: text,
      resumeFile: file.name,
    },
  });

  const rules = await scoreCandidate(text, {
    mustHave: parseJson<string[]>(job.mustHave, []),
    niceToHave: parseJson<string[]>(job.niceToHave, []),
    customMustHave: parseJson<string[]>(job.customMustHave, []),
    customNiceToHave: parseJson<string[]>(job.customNiceToHave, []),
    minYears: job.minYears,
  });

  const source = (form.get("source") as string)?.trim() || "direct";

  // Keep a record of every portal a duplicate arrived through rather than
  // overwriting — the same person applying via LinkedIn and Indeed is signal.
  const prior = await prisma.application.findUnique({
    where: { jobId_candidateId: { jobId, candidateId: candidate.id } },
  });
  const mergedSource =
    prior && !prior.source.split(",").map((s) => s.trim()).includes(source)
      ? `${prior.source}, ${source}`
      : source;

  const application = await prisma.application.upsert({
    where: { jobId_candidateId: { jobId, candidateId: candidate.id } },
    update: {
      ruleScore: rules.score,
      ruleDetail: JSON.stringify(rules.detail),
      source: mergedSource,
    },
    create: {
      jobId,
      candidateId: candidate.id,
      source,
      ruleScore: rules.score,
      ruleDetail: JSON.stringify(rules.detail),
    },
    include: { candidate: true },
  });

  return NextResponse.json(application, { status: 201 });
}
