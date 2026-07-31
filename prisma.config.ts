import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 reads the migration connection URL from here rather than from
 * schema.prisma.
 *
 * To move to Postgres: change `provider` in prisma/schema.prisma to
 * "postgresql", point DATABASE_URL at the server, and swap the adapter in
 * src/lib/db.ts for @prisma/adapter-pg. The models themselves need no changes.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
