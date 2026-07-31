import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthShowcase } from "@/components/auth-showcase";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/");

  // Self-signup is available only when an invite code is configured.
  const enabled = Boolean(process.env.SIGNUP_CODE);

  return (
    <div className="mx-auto grid min-h-[80vh] max-w-5xl items-center gap-8 lg:grid-cols-2">
      <div className="fade-in hidden lg:block">
        <AuthShowcase />
      </div>

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
            <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              Set up your Hirebase workspace to start screening.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-7">
            {enabled ? (
              <SignupForm />
            ) : (
              <p className="text-sm text-ink-muted">
                Self-signup is turned off. Ask your administrator to create an account for
                you.
              </p>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
