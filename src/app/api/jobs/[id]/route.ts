import { NextResponse } from "next/server";
import { prisma, parseJson } from "@/lib/db";
import { scoreCandidate } from "@/lib/score-rules";
import { denyAnonymous } from "@/lib/api-auth";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await denyAnonymous();
  if (denied) return denied;

  const { id } = await ctx.params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      applications: {
        include: { candidate: true },
        orderBy: [{ aiScore: "desc" }, { ruleScore: "desc" }],
      },
    },
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({
    ...job,
    mustHave: parseJson<string[]>(job.mustHave, []),
    niceToHave: parseJson<string[]>(job.niceToHave, []),
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await denyAnonymous();
  if (denied) return denied;

  const { id } = await ctx.params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  for (const field of ["title", "track", "location", "seniority", "description", "status"]) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (body.minYears !== undefined) data.minYears = body.minYears;

  // Any of these changes what the role screens for, so existing candidates must
  // be rescored — otherwise the ranking reflects the old criteria and lies.
  const criteriaFields = ["mustHave", "niceToHave", "customMustHave", "customNiceToHave"];
  let criteriaChanged = body.minYears !== undefined;
  for (const field of criteriaFields) {
    if (body[field] !== undefined) {
      data[field] = JSON.stringify(body[field]);
      criteriaChanged = true;
    }
  }

  const job = await prisma.job.update({ where: { id }, data });

  if (criteriaChanged) {
    const criteria = {
      mustHave: parseJson<string[]>(job.mustHave, []),
      niceToHave: parseJson<string[]>(job.niceToHave, []),
      customMustHave: parseJson<string[]>(job.customMustHave, []),
      customNiceToHave: parseJson<string[]>(job.customNiceToHave, []),
      minYears: job.minYears,
    };

    const applications = await prisma.application.findMany({
      where: { jobId: id },
      include: { candidate: true },
    });

    for (const app of applications) {
      const rules = await scoreCandidate(app.candidate.resumeText, criteria);
      await prisma.application.update({
        where: { id: app.id },
        data: { ruleScore: rules.score, ruleDetail: JSON.stringify(rules.detail) },
      });
    }
  }

  return NextResponse.json(job);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await denyAnonymous();
  if (denied) return denied;

  const { id } = await ctx.params;
  await prisma.job.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
