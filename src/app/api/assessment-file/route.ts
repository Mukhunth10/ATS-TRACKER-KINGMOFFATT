import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isR2Configured, makeKey, presignPut, saveLocal, storedRef } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * The test file a reviewer attaches to a role (e.g. a Revit .zip). AUTHENTICATED
 * — only staff upload; candidates only download, through the token-gated route.
 *
 * Same two-shape design as the recording upload:
 *   GET → an upload target (R2 presigned PUT, or this route with ?put=1&key=…)
 *   PUT → local backend only: stream the file to disk.
 * The browser ends up with a storedRef it saves as the assessment's testUrl.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(req.url);
  // Keep the original extension so the candidate downloads a sensibly-named file.
  const ext = (url.searchParams.get("ext") || "zip").replace(/[^a-z0-9]/gi, "").slice(0, 8);
  const key = makeKey("testfile", ext || "zip");

  if (isR2Configured()) {
    const putUrl = await presignPut(key, "application/octet-stream");
    return NextResponse.json({ mode: "r2", uploadUrl: putUrl, ref: storedRef(key) });
  }
  return NextResponse.json({
    mode: "local",
    uploadUrl: `/api/assessment-file?key=${encodeURIComponent(key)}`,
    ref: storedRef(key),
  });
}

export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isR2Configured()) return NextResponse.json({ error: "Not applicable" }, { status: 400 });

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key || !key.startsWith("testfile-") || !req.body) {
    return NextResponse.json({ error: "Missing or invalid key" }, { status: 400 });
  }

  try {
    await saveLocal(key, req.body);
  } catch (err) {
    console.error("test file save failed", err);
    return NextResponse.json({ error: "Could not save the file" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
