import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { privacyConfig } from "@/lib/privacy";
import { Card } from "@/components/ui";
import { ApplyForm } from "./apply-form";

export const dynamic = "force-dynamic";

export default async function ApplyPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;

  const job = await prisma.job.findUnique({
    where: { applyToken: token },
    select: {
      title: true,
      track: true,
      location: true,
      seniority: true,
      minYears: true,
      description: true,
      applyOpen: true,
      status: true,
    },
  });

  if (!job) notFound();

  const cfg = privacyConfig();
  const open = job.applyOpen && job.status !== "closed";

  return (
    <div className="mx-auto max-w-xl space-y-6 py-4">
      <div>
        <p className="text-sm font-medium text-primary">{cfg.company} · Careers</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{job.title}</h1>
        <p className="mt-1 text-sm text-ink-muted capitalize">
          {job.track} · {job.location} · {job.seniority} · {job.minYears}+ years
        </p>
        {job.description && (
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{job.description}</p>
        )}
      </div>

      {!open ? (
        <Card className="p-6 text-center text-sm text-ink-muted">
          This role is not accepting applications right now. Thank you for your interest.
        </Card>
      ) : (
        <Card className="p-5 sm:p-6">
          <ApplyForm token={token} />
        </Card>
      )}

      <details className="rounded-lg border border-line bg-surface-2 p-4 text-sm">
        <summary className="cursor-pointer font-medium text-ink">
          How {cfg.company} uses your data
        </summary>
        <div className="mt-3 space-y-2 leading-relaxed text-ink-muted">
          <p>
            We use the details and CV you submit solely to consider you for this role. The
            legal basis is your consent, given by ticking the box and submitting.
          </p>
          <p>
            We keep your data for {cfg.retention}, then delete it. You can ask us to access,
            correct or delete it, or withdraw consent, at any time by emailing{" "}
            <a href={`mailto:${cfg.contactEmail}`} className="text-primary hover:underline">
              {cfg.contactEmail}
            </a>
            .
          </p>
        </div>
      </details>
    </div>
  );
}
