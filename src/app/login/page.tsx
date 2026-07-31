import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthShowcase } from "@/components/auth-showcase";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in? Don't show the form again.
  if (await getSessionUser()) redirect("/");

  return (
    <div className="mx-auto grid min-h-[80vh] max-w-5xl items-center gap-8 lg:grid-cols-2">
      {/* Branded carousel — hidden on small screens where it would only push the
          form below the fold. */}
      <div className="fade-in hidden lg:block">
        <AuthShowcase />
      </div>

      {/* Sign-in card */}
      <div className="mx-auto w-full max-w-sm">
        <div className="rise">
          <div className="mb-8 text-center lg:hidden">
            <span
              aria-hidden
              className="brand-grad mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl text-lg font-bold text-white shadow-lift"
            >
              H
            </span>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              Sign in to your Hirebase workspace.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-7">
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Have an invite code?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>

          <p className="mt-4 text-center text-xs leading-relaxed text-ink-subtle">
            Candidate records are confidential. Do not share your login or leave this open
            on a shared machine.
          </p>
        </div>
      </div>
    </div>
  );
}
