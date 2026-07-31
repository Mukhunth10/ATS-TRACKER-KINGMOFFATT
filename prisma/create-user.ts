/**
 * Creates or updates a staff login.
 *
 *   npx tsx prisma/create-user.ts you@company.com "Your Name"
 *   npx tsx prisma/create-user.ts you@company.com "Your Name" "chosen-password"
 *
 * With no password given, a strong one is generated and printed once. There is
 * deliberately no default password baked into the app — a shipped default that
 * nobody changes is how internal tools end up wide open.
 */
import "dotenv/config";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
});

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

/** Ambiguous characters (0/O, 1/l/I) removed so it can be read aloud safely. */
function generatePassword(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(20);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function main() {
  const [emailArg, nameArg, passwordArg] = process.argv.slice(2);

  if (!emailArg || !nameArg) {
    console.error('Usage: npx tsx prisma/create-user.ts <email> "<name>" [password]');
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const password = passwordArg || generatePassword();
  const generated = !passwordArg;

  if (password.length < 10) {
    console.error("Password must be at least 10 characters.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name: nameArg },
    create: { email, name: nameArg, passwordHash, role: "admin" },
  });

  // Any existing sessions are invalidated, so a password reset actually locks
  // out whoever was signed in with the old one.
  const { count } = await prisma.session.deleteMany({ where: { userId: user.id } });

  console.log(`\n  Login ready for ${user.name}`);
  console.log(`  Email:    ${user.email}`);
  if (generated) {
    console.log(`  Password: ${password}`);
    console.log(`\n  This password is shown once. Save it in a password manager now.`);
  } else {
    console.log(`  Password: (the one you supplied)`);
  }
  if (count > 0) console.log(`\n  ${count} existing session(s) signed out.`);
  console.log();

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
