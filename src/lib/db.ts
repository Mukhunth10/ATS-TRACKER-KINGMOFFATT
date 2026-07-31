import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";

/**
 * One schema, two homes.
 *
 * Locally (and on your own laptop) we talk to a plain SQLite file through the
 * better-sqlite3 driver — fully offline, no server. When deployed to a host with
 * no persistent disk (Render, Vercel, …) we point at Turso instead — hosted
 * libSQL, which IS SQLite, so the schema, migrations and queries are identical.
 * The only difference is this adapter choice, driven by env vars.
 *
 * Set TURSO_DATABASE_URL (libsql://…) + TURSO_AUTH_TOKEN to use Turso; leave them
 * unset to use the local file.
 */
function createClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;

  if (tursoUrl) {
    const adapter = new PrismaLibSql({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return new PrismaClient({ adapter });
  }

  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

// Next.js dev mode hot-reloads modules, which would otherwise open a new
// connection on every edit until the driver refuses more.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Columns holding JSON strings (for SQLite/Postgres portability). */
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
