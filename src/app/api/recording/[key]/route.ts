import { createReadStream, statSync, existsSync } from "node:fs";
import { Readable } from "node:stream";
import { getSessionUser } from "@/lib/auth";
import { localPath } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Streams a locally-stored recording to a signed-in reviewer.
 *
 * AUTHENTICATED — unlike the candidate upload side, playback is staff-only, so
 * this checks the session. Range requests are honoured so the reviewer can
 * scrub the video instead of downloading the whole thing first.
 */
export async function GET(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Not authenticated", { status: 401 });

  const { key } = await ctx.params;
  const filePath = localPath(decodeURIComponent(key));
  if (!filePath || !existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }

  const size = statSync(filePath).size;
  const range = req.headers.get("range");

  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    const start = match ? parseInt(match[1], 10) : 0;
    const end = match && match[2] ? parseInt(match[2], 10) : size - 1;
    const stream = createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        "content-type": "video/webm",
        "content-length": String(end - start + 1),
        "content-range": `bytes ${start}-${end}/${size}`,
        "accept-ranges": "bytes",
      },
    });
  }

  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "content-type": "video/webm",
      "content-length": String(size),
      "accept-ranges": "bytes",
    },
  });
}
