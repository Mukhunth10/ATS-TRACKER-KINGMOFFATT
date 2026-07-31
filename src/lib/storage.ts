import "server-only";

import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * Storage for candidate screen recordings.
 *
 * Two backends behind one interface:
 *   - Local disk (default) — files under ./uploads, served by an authenticated
 *     route. Works with zero configuration, good for local use and the demo.
 *   - Cloudflare R2 (when the R2_* env vars are set) — S3-compatible object
 *     storage, free tier 10GB with no egress fees. Uploads go straight from the
 *     browser to R2 via a presigned URL, so a multi-hundred-MB video never
 *     streams through this server.
 *
 * The rest of the app only cares about a stored key and whether R2 is on; it
 * never touches the backend directly.
 */

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

/** A storage key is opaque; keep it filesystem- and URL-safe. */
export function makeKey(prefix: string, ext = "webm"): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 10);
  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, "").slice(0, 40);
  return `${safePrefix}-${stamp}-${rand}.${ext}`;
}

// --- R2 (lazy: only construct the client if configured, so the SDK isn't loaded
// on a local-only install) ---

async function r2Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

/** A presigned PUT the browser uploads to directly. R2 only. */
export async function presignPut(key: string, contentType: string): Promise<string> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = await r2Client();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 3600 },
  );
}

/** A short-lived presigned GET so a reviewer can play the video. R2 only. */
export async function presignGet(key: string): Promise<string> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = await r2Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }),
    { expiresIn: 3600 },
  );
}

// --- Local disk ---

/** Streams an incoming body to ./uploads/<key>. Local backend only. */
export async function saveLocal(key: string, body: ReadableStream<Uint8Array>): Promise<void> {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

  // Confine to the upload dir — key is generated server-side, but never trust a
  // path into a filesystem write without checking it can't escape.
  const dest = path.join(UPLOAD_DIR, path.basename(key));
  if (!dest.startsWith(UPLOAD_DIR)) throw new Error("invalid key");

  // Stream rather than buffer, so a large recording doesn't sit in memory.
  await pipeline(Readable.fromWeb(body as never), createWriteStream(dest));
}

/** Absolute path for reading a locally-stored file, or null if it escapes. */
export function localPath(key: string): string | null {
  const p = path.join(UPLOAD_DIR, path.basename(key));
  return p.startsWith(UPLOAD_DIR) ? p : null;
}

export async function deleteLocal(key: string): Promise<void> {
  const p = localPath(key);
  if (p && existsSync(p)) await unlink(p);
}

async function deleteR2(key: string): Promise<void> {
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await r2Client();
  await client.send(
    new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }),
  );
}

/**
 * Deletes whatever a stored reference points at — used to honour a candidate's
 * right to erasure. A plain external link (a pasted URL) is not ours to delete,
 * so it is left alone. Failures are swallowed: a missing file must not block the
 * database deletion that actually removes the person's record.
 */
export async function deleteStored(ref: string): Promise<void> {
  try {
    if (ref.startsWith("local:")) await deleteLocal(ref.slice(6));
    else if (ref.startsWith("r2:")) await deleteR2(ref.slice(3));
  } catch {
    /* best effort */
  }
}

/**
 * The value stored in Assessment.videoUrl. For local storage it's an in-app
 * path the authenticated playback route understands; for R2 it's a marker the
 * reviewer view swaps for a fresh presigned GET at view time (so stored URLs
 * never go stale).
 */
export function storedRef(key: string): string {
  return isR2Configured() ? `r2:${key}` : `local:${key}`;
}
