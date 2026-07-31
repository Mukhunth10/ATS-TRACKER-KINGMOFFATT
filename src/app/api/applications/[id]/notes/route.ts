import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { denyAnonymous } from "@/lib/api-auth";

const NoteInput = z.object({
  body: z.string().min(1).max(5000),
  author: z.string().default("recruiter"),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await denyAnonymous();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = NoteInput.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "note body is required" }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: { applicationId: id, ...parsed.data },
  });
  return NextResponse.json(note, { status: 201 });
}
