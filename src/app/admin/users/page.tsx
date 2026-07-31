import { prisma } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth";
import { SectionTitle } from "@/components/ui";
import { UserManager } from "./user-manager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requirePageAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ disabled: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, email: true, role: true, disabled: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team &amp; access</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Create staff accounts, set roles, reset passwords, and disable access. Only
          admins can see this page.
        </p>
      </div>

      <div>
        <SectionTitle>People</SectionTitle>
        <UserManager users={users} currentUserId={me.id} />
      </div>
    </div>
  );
}
