import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Postgres everywhere — local dev and production point at the same kind of
 * server via DATABASE_URL, so there's no adapter branching to keep in sync.
 */
function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
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
