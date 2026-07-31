"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";

export type SignupState = { error?: string };

/**
 * Self-registration, gated by a shared invite code.
 *
 * The gate is what makes it safe to host this for an HR demo: without it, anyone
 * who found the URL could register and read every candidate's CV. With it, only
 * people you gave the code to can create an account.
 */
export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const code = process.env.SIGNUP_CODE;
  if (!code) {
    return { error: "Self-signup is disabled. Ask an admin to create your account." };
  }

  const givenCode = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (givenCode !== code) {
    return { error: "That invite code is not correct." };
  }
  if (!name || !email || !password) {
    return { error: "Fill in your name, email and a password." };
  }
  if (password.length < 8) {
    return { error: "Use a password of at least 8 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists — sign in instead." };
  }

  // The very first account to be created is the admin — so there's always
  // someone who can manage users and reset passwords. Everyone after is a
  // recruiter (an admin can promote them later).
  const isFirstUser = (await prisma.user.count()) === 0;

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: isFirstUser ? "admin" : "recruiter",
    },
  });

  await createSession(user.id);
  redirect("/");
}
