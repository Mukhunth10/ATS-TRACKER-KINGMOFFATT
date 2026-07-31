"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";

export type AdminState = {
  error?: string;
  ok?: string;
  /** A freshly generated password to show the admin once (never stored in plain). */
  tempPassword?: string;
  /** Which user the tempPassword belongs to, for the UI to place it. */
  forUserId?: string;
};

/** A readable-but-strong temporary password: no ambiguous characters. */
function tempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8)}`;
}

/** Create a staff account and return a one-time password for the admin to pass on. */
export async function createUser(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "recruiter") === "admin" ? "admin" : "recruiter";

  if (!name || !email) return { error: "Enter a name and an email." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "That email doesn't look right." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  const pw = tempPassword();
  const user = await prisma.user.create({
    data: { name, email, role, passwordHash: await hashPassword(pw) },
  });

  revalidatePath("/admin/users");
  return {
    ok: `Created ${name}. Share the temporary password below — they should change it after signing in.`,
    tempPassword: pw,
    forUserId: user.id,
  };
}

/** Reset a user's password to a fresh temporary one and revoke their sessions. */
export async function resetPassword(userId: string): Promise<AdminState> {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "User not found." };

  const pw = tempPassword();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(pw) },
  });
  // Force re-login everywhere with the new password.
  await prisma.session.deleteMany({ where: { userId } });

  revalidatePath("/admin/users");
  return {
    ok: `New password for ${user.name}. Share it securely; they should change it after signing in.`,
    tempPassword: pw,
    forUserId: userId,
  };
}

/** Promote/demote a user. Guards against the admin locking themselves out. */
export async function setRole(userId: string, role: string): Promise<AdminState> {
  const me = await requireAdmin();
  if (userId === me.id) return { error: "You can't change your own role." };
  const next = role === "admin" ? "admin" : "recruiter";
  await prisma.user.update({ where: { id: userId }, data: { role: next } });
  revalidatePath("/admin/users");
  return { ok: "Role updated." };
}

/** Disable/enable a user. You can't disable yourself. */
export async function setDisabled(userId: string, disabled: boolean): Promise<AdminState> {
  const me = await requireAdmin();
  if (userId === me.id) return { error: "You can't disable your own account." };
  await prisma.user.update({ where: { id: userId }, data: { disabled } });
  if (disabled) await prisma.session.deleteMany({ where: { userId } });
  revalidatePath("/admin/users");
  return { ok: disabled ? "Account disabled." : "Account enabled." };
}
