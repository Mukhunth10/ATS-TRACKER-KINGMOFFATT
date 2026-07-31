import Link from "next/link";
import { prisma } from "@/lib/db";
import { isAiConfigured } from "@/lib/score-ai";
import { Card, EmptyState, ScoreRing, StageBadge } from "@/components/ui";
import { requirePageUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  await requirePageUser();

  const candidates = await prisma.candidate.findMany({
    orderBy: { createdAt: "desc" },
    include: { applications: { include: { job: true } } },
  });

  const aiEnabled = isAiConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Candidates</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {candidates.length} {candidates.length === 1 ? "person" : "people"} across every
          role.
        </p>
      </div>

      {candidates.length === 0 ? (
        <EmptyState
          title="No candidates yet"
          body="Open a role and upload CVs against it — everyone you add shows up here."
        />
      ) : (
        <div className="space-y-3">
          {candidates.map((c, i) => (
            <Card
              key={c.id}
              className="rise overflow-hidden"
              style={{ animationDelay: `${Math.min(i * 30, 200)}ms` }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line px-4 py-3">
                <p className="font-medium">{c.name}</p>
                <p className="truncate text-sm text-ink-muted">{c.email}</p>
              </div>

              <ul className="divide-y divide-[var(--border)]">
                {c.applications.map((a) => {
                  // The score to show is the AI verdict where it ran, else the
                  // baseline. Showing an empty AI ring on every row when
                  // screening is off is pure clutter, so it only appears when
                  // there is an actual AI score to show.
                  const primary = a.aiScore ?? a.ruleScore;

                  return (
                    <li key={a.id}>
                      <Link
                        href={`/applications/${a.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-surface-hover"
                      >
                        <ScoreRing
                          score={primary}
                          label={a.aiScore !== null ? "AI score" : "Score"}
                          size={40}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">
                          {a.job.title}
                        </span>
                        {aiEnabled && a.aiScore !== null && (
                          <span className="hidden rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary sm:inline">
                            AI
                          </span>
                        )}
                        <StageBadge stage={a.stage} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
