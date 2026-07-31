import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { denyAnonymous } from "@/lib/api-auth";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { STAGES } from "@/components/ui";

const PatchInput = z.object({
  stage: z.enum(STAGES),
  dispositionReason: z.string().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await denyAnonymous();
  if (denied) return denied;

  const { id } = await ctx.params;
  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      candidate: true,
      job: true,
      notes: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  return NextResponse.json(application);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await denyAnonymous();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = PatchInput.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "stage must be one of: " + STAGES.join(", ") },
      { status: 400 },
    );
  }

  const user = await getSessionUser();
  const stage = parsed.data.stage;
  const dispositionReason =
    stage === "rejected" ? (parsed.data.dispositionReason ?? "").trim() : "";

  const application = await prisma.application.update({
    where: { id },
    data: { stage, dispositionReason },
    include: { candidate: true },
  });

  // Same audit-trail + live-update path as the UI action, so a programmatic
  // move shows up on the board and in the process history just like a manual one.
  await logActivity({
    jobId: application.jobId,
    applicationId: id,
    actor: user?.name ?? "api",
    type: "stage_change",
    detail:
      stage === "rejected"
        ? `Declined ${application.candidate.name}${dispositionReason ? ` — ${dispositionReason}` : ""}`
        : `Moved ${application.candidate.name} to ${stage}`,
  });

  return NextResponse.json(application);
}
