import { NextResponse } from "next/server";
import { prisma, parseJson } from "@/lib/db";
import { scoreByAi, isAiConfigured } from "@/lib/score-ai";
import {
  scoreByLocalAi,
  localAiConfigured,
  localAiAvailable,
  type RuleSignals,
} from "@/lib/score-local";
import type { RuleDetail } from "@/lib/score-rules";
import { denyAnonymous } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
// Local CPU models can take a few minutes on a long CV; give them room.
export const maxDuration = 300;

/**
 * Screens one application and persists the verdict. Local-first: prefers the
 * free, private Ollama model when it's available, and only falls back to the
 * cloud screener if configured. Mirrors the UI's screening path, including the
 * rule-based grounding, so a programmatic screen behaves identically.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await denyAnonymous();
  if (denied) return denied;

  const { id } = await ctx.params;

  const application = await prisma.application.findUnique({
    where: { id },
    include: { candidate: true, job: true },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const useLocal = localAiConfigured() && (await localAiAvailable());
  if (!useLocal && !isAiConfigured()) {
    return NextResponse.json(
      {
        error:
          "No AI screener available. Run Ollama locally (free) or set ANTHROPIC_API_KEY.",
      },
      { status: 503 },
    );
  }

  const jobArg = {
    title: application.job.title,
    track: application.job.track,
    seniority: application.job.seniority,
    minYears: application.job.minYears,
    description: application.job.description,
    mustHave: parseJson<string[]>(application.job.mustHave, []),
    niceToHave: parseJson<string[]>(application.job.niceToHave, []),
  };

  // Ground the local model with the rule-based evidence already computed.
  const rd = parseJson<Partial<RuleDetail>>(application.ruleDetail, {});
  const signals: RuleSignals = {
    yearsDetected: rd.yearsDetected,
    yearsRequired: rd.yearsRequired ?? application.job.minYears,
    demonstrated: rd.demonstrated,
    listedOnly: rd.listedOnly,
    missingMustHave: rd.missingMustHave,
    semantic: rd.semantic,
  };

  const provider = useLocal ? "local" : "Claude";
  try {
    const result = useLocal
      ? await scoreByLocalAi(application.candidate.resumeText, jobArg, signals)
      : await scoreByAi(application.candidate.resumeText, jobArg);

    const updated = await prisma.application.update({
      where: { id },
      data: {
        aiScore: result.score,
        aiSummary: result.summary,
        aiDetail: JSON.stringify(result),
        aiScoredAt: new Date(),
      },
      include: { candidate: true },
    });

    await logActivity({
      jobId: application.jobId,
      applicationId: id,
      actor: `${provider} AI`,
      type: "screened",
      detail: `Screened ${application.candidate.name}: ${result.score}/100 (${result.recommendation})`,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error(`${provider} screening failed`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Screening failed" },
      { status: 502 },
    );
  }
}
