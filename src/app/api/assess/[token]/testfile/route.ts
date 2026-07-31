import { createReadStream, statSync, existsSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { prisma } from "@/lib/db";
import { localPath, presignGet } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Candidate download of the test file. PUBLIC but token-gated — the candidate
 * has no login, so the assessment token in the path is the credential. Only the
 * file attached to *this* assessment is reachable.
 *
 * Handles a stored file (local:/r2:) by streaming or redirecting. A plain URL
 * testUrl never reaches here — the page links to it directly.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const assessment = await prisma.assessment.findUnique({ where: { token } });
  if (!assessment || !assessment.testUrl) {
    return new Response("Not found", { status: 404 });
  }

  const ref = assessment.testUrl;

  if (ref.startsWith("r2:")) {
    // Hand back a short-lived signed URL and let the browser fetch from R2.
    const url = await presignGet(ref.slice(3));
    return Response.redirect(url, 302);
  }

  if (ref.startsWith("local:")) {
    const key = ref.slice(6);
    const filePath = localPath(key);
    if (!filePath || !existsSync(filePath)) return new Response("Not found", { status: 404 });

    const size = statSync(filePath).size;
    // Give the download a clean name that keeps the original extension.
    const ext = path.extname(key) || ".zip";
    const filename = `test-file${ext}`;
    const stream = createReadStream(filePath);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(size),
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // A plain external link — just send them there.
  return Response.redirect(ref, 302);
}
