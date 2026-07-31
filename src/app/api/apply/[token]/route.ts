import { NextResponse } from "next/server";
import { prisma, parseJson } from "@/lib/db";
import { extractText, extractContact } from "@/lib/resume-parse";
import { scoreByRules, type JobCriteria } from "@/lib/score-rules";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CV_BYTES = 10 * 1024 * 1024; // 10 MB

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

/**
 * PUBLIC candidate application intake. Handled by an API route (not a Server
 * Action) because Server Actions carrying a file fail ALPN negotiation over
 * HTTP/2 — a plain multipart POST here is reliable. The secret apply token in
 * the URL is what authorises reaching this role; no session is required.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const job = await prisma.job.findUnique({ where: { applyToken: token } });
  if (!job) return NextResponse.json({ error: "This application link is not valid." }, { status: 404 });
  if (!job.applyOpen || job.status === "closed") {
    return NextResponse.json({ error: "This role is not accepting applications right now." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Couldn't read the form. Please try again." }, { status: 400 });
  }

  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const phone = String(form.get("phone") ?? "").trim();
  const consent = form.get("consent") === "1";
  const file = form.get("cv");

  const bad = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });
  if (!name || !email) return bad("Enter your name and email.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("That email doesn't look right.");
  if (!consent) return bad("Please tick the consent box so we may process your application.");
  if (!(file instanceof File) || file.size === 0) return bad("Attach your CV (PDF, DOCX, TXT or MD).");
  if (file.size > MAX_CV_BYTES) return bad("That file is too large (max 10 MB).");

  let text = "";
  try {
    text = await extractText(Buffer.from(await file.arrayBuffer()), file.name);
  } catch {
    return bad("We couldn't read that file. Please upload a PDF, DOCX, TXT or MD CV.");
  }
  if (text.trim().length < 50) {
    return bad("That file has no readable text (a scanned image?). Please upload a text-based CV.");
  }

  const contact = extractContact(text);
  const finalPhone = phone || contact.phone || null;

  const candidate = await prisma.candidate.upsert({
    where: { email },
    update: { resumeText: text, resumeFile: file.name, name, ...(finalPhone ? { phone: finalPhone } : {}) },
    create: { name, email, phone: finalPhone, resumeText: text, resumeFile: file.name },
  });

  const rules = scoreByRules(text, criteriaFor(job));

  const prior = await prisma.application.findUnique({
    where: { jobId_candidateId: { jobId: job.id, candidateId: candidate.id } },
  });

  const application = await prisma.application.upsert({
    where: { jobId_candidateId: { jobId: job.id, candidateId: candidate.id } },
    update: { ruleScore: rules.score, ruleDetail: JSON.stringify(rules.detail) },
    create: {
      jobId: job.id,
      candidateId: candidate.id,
      source: "careers page",
      ruleScore: rules.score,
      ruleDetail: JSON.stringify(rules.detail),
    },
  });

  await logActivity({
    jobId: job.id,
    applicationId: application.id,
    actor: "candidate",
    type: prior ? "reviewed" : "uploaded",
    detail: prior
      ? `${name} re-applied via the careers page`
      : `${name} applied via the careers page`,
  });

  return NextResponse.json({
    ok: "Thank you — your application has been received. We'll be in touch if there's a fit.",
  });
}
