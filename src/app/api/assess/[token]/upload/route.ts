import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isR2Configured,
  makeKey,
  presignPut,
  saveLocal,
  storedRef,
} from "@/lib/storage";

export const runtime = "nodejs";
// A screen recording can run long; don't let the request time out mid-upload.
export const maxDuration = 300;

/**
 * Candidate recording upload. PUBLIC — no login; the assessment token in the
 * path is the credential, exactly like the submission page. A wrong token finds
 * no assessment and gets a 404.
 *
 * Two shapes, chosen by whether R2 is configured:
 *   GET  → hand back an upload target. For R2 that's a presigned PUT the browser
 *          uploads to directly; for local it's this same route with ?put=1.
 *   PUT  → local backend only: stream the recording to disk.
 * Either way the browser ends up with a storedRef it passes to submitAssessment.
 */

async function assessmentFor(token: string) {
  return prisma.assessment.findUnique({ where: { token } });
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const assessment = await assessmentFor(token);
  if (!assessment) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (assessment.status === "reviewed") {
    return NextResponse.json({ error: "This assessment is closed" }, { status: 409 });
  }

  const key = makeKey(`assess-${assessment.applicationId}`);

  if (isR2Configured()) {
    const url = await presignPut(key, "video/webm");
    return NextResponse.json({ mode: "r2", uploadUrl: url, ref: storedRef(key) });
  }

  // Local: the browser PUTs the blob back to this route with the key.
  return NextResponse.json({
    mode: "local",
    uploadUrl: `/api/assess/${token}/upload?key=${encodeURIComponent(key)}`,
    ref: storedRef(key),
  });
}

export async function PUT(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const assessment = await assessmentFor(token);
  if (!assessment) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (isR2Configured()) {
    // With R2 the browser uploads straight to R2, not here.
    return NextResponse.json({ error: "Not applicable" }, { status: 400 });
  }

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key || !req.body) {
    return NextResponse.json({ error: "Missing key or body" }, { status: 400 });
  }

  // The key we issued is prefixed with this application's id; reject a key that
  // was minted for a different assessment.
  if (!key.startsWith(`assess-${assessment.applicationId}-`)) {
    return NextResponse.json({ error: "Key mismatch" }, { status: 400 });
  }

  try {
    await saveLocal(key, req.body);
  } catch (err) {
    console.error("recording save failed", err);
    return NextResponse.json({ error: "Could not save the recording" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
