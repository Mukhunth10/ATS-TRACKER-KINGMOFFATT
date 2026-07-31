"use server";

import { prisma } from "@/lib/db";
import { requireUser, verifyPassword, hashPassword } from "@/lib/auth";

export type PasswordState = { error?: string; ok?: string };

/** Lets a signed-in user change their own password, re-checking the current one. */
export async function changeOwnPassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const me = await requireUser();

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!current || !next) return { error: "Fill in every field." };
  if (next.length < 8) return { error: "Your new password must be at least 8 characters." };
  if (next === current) return { error: "Choose a password different from your current one." };
  if (next !== confirm) return { error: "The new passwords don't match." };

  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    return { error: "Your current password is incorrect." };
  }

  await prisma.user.update({
    where: { id: me.id },
    data: { passwordHash: await hashPassword(next) },
  });

  return { ok: "Password changed." };
}
