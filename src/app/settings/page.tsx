import { requirePageUser } from "@/lib/auth";
import { Card, SectionTitle } from "@/components/ui";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requirePageUser();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Signed in as {user.name} ({user.email}) · {user.role}.
        </p>
      </div>

      <div>
        <SectionTitle>Change password</SectionTitle>
        <Card className="p-5">
          <ChangePasswordForm />
        </Card>
      </div>
    </div>
  );
}
