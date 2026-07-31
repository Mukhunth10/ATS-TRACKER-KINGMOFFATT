import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { denyAnonymous } from "@/lib/api-auth";

const JobInput = z.object({
  title: z.string().min(1),
  track: z.string().min(1),
  location: z.string().min(1),
  seniority: z.enum(["junior", "mid", "senior", "lead"]),
  mustHave: z.array(z.string()).default([]),
  niceToHave: z.array(z.string()).default([]),
  minYears: z.number().int().min(0).max(40).default(0),
  description: z.string().default(""),
});

export async function GET() {
  const denied = await denyAnonymous();
  if (denied) return denied;

  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });
  return NextResponse.json(jobs);
}

export async function POST(req: Request) {
  const denied = await denyAnonymous();
  if (denied) return denied;

  const parsed = JobInput.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { mustHave, niceToHave, ...rest } = parsed.data;
  const job = await prisma.job.create({
    data: {
      ...rest,
      mustHave: JSON.stringify(mustHave),
      niceToHave: JSON.stringify(niceToHave),
    },
  });

  return NextResponse.json(job, { status: 201 });
}
