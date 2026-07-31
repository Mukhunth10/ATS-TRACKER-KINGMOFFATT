import Link from "next/link";
import { prisma, parseJson } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import {
  Card,
  EmptyState,
  PipelineBar,
  ScoreRing,
  SectionTitle,
  SkillChip,
  Stat,
  STAGES,
} from "@/components/ui";
import { NewRoleForm } from "@/components/new-role-form";

// Recruiters expect the pipeline to reflect the database right now. Without
// this, Next.js 16 prerenders the page at build time and serves stale counts.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requirePageUser();

  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      applications: {
        select: { id: true, stage: true, ruleScore: true, aiScore: true, createdAt: true },
      },
    },
  });

  const all = jobs.flatMap((j) => j.applications);
  const strong = all.filter((a) => (a.aiScore ?? a.ruleScore) >= 80).length;
  const inProcess = all.filter(
    (a) => a.stage !== "applied" && a.stage !== "rejected" && a.stage !== "hired",
  ).length;

  // "New this week" answers the question a director actually asks first:
  // is anything still coming in, or has this role gone quiet?
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thisWeek = all.filter((a) => a.createdAt >= weekAgo).length;

  const openRoles = jobs.filter((j) => j.status === "open").length;

  return (
    <div className="space-y-10">
      {/* Branded hero — a restrained gradient band that gives the dashboard a
          confident header without shouting. */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <div
          aria-hidden
          className="brand-grad pointer-events-none absolute inset-0 opacity-[0.07]"
        />
        <div
          aria-hidden
          className="brand-grad pointer-events-none absolute -top-16 -right-16 h-52 w-52 rounded-full opacity-20 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Hiring pipeline across every open role.
            </p>
          </div>
          <NewRoleForm />
        </div>
      </div>

      {/* --- Headline numbers: the directors' view --- */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat value={openRoles} label="Open roles" hint={`${jobs.length} total`} />
        <Stat
          value={all.length}
          label="Candidates"
          hint={thisWeek > 0 ? `${thisWeek} added this week` : "none added this week"}
        />
        <Stat
          value={inProcess}
          label="In process"
          hint="screening, interview or offer"
          tone="neutral"
        />
        <Stat
          value={strong}
          label="Strong matches"
          hint="scoring 80 or above"
          tone={strong > 0 ? "success" : "neutral"}
        />
      </div>

      {/* --- Roles --- */}
      <div>
        <SectionTitle>Roles</SectionTitle>

        {jobs.length === 0 ? (
          <EmptyState
            title="No roles yet"
            body="Create a role, set the keywords it screens for, then upload CVs against it."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {jobs.map((job, i) => {
              const mustHave = parseJson<string[]>(job.mustHave, []);
              const custom = parseJson<string[]>(job.customMustHave, []);
              const chips = [...mustHave, ...custom.map((c) => c.split("|")[0].trim())];

              const counts: Record<string, number> = {};
              for (const stage of STAGES) {
                counts[stage] = job.applications.filter((a) => a.stage === stage).length;
              }

              const best = job.applications.length
                ? Math.max(...job.applications.map((a) => a.aiScore ?? a.ruleScore))
                : null;

              const active = job.applications.filter(
                (a) => a.stage !== "rejected" && a.stage !== "hired",
              ).length;

              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="rise group block min-w-0"
                  // A short, capped stagger settles the grid in without a
                  // cascade — on reload it reads as calm, not "shooting in".
                  style={{ animationDelay: `${Math.min(i * 25, 100)}ms` }}
                >
                  <Card interactive className="h-full overflow-hidden p-4 sm:p-5">
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold transition-colors group-hover:text-primary">
                          {job.title}
                        </h3>
                        <p className="mt-1 truncate text-sm text-ink-muted">
                          {job.track} · {job.location}
                        </p>
                      </div>
                      <ScoreRing score={best} label="Top score" />
                    </div>

                    {chips.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {chips.slice(0, 4).map((k) => (
                          <SkillChip key={k} skillKey={k} />
                        ))}
                        {chips.length > 4 && (
                          <span className="px-1 py-0.5 text-xs text-ink-subtle">
                            +{chips.length - 4} more
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-5">
                      <PipelineBar counts={counts} total={job.applications.length} />
                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <span>
                          <span className="tabular font-semibold">
                            {job.applications.length}
                          </span>
                          <span className="ml-1 text-ink-muted">applicants</span>
                        </span>
                        <span>
                          <span className="tabular font-semibold">{active}</span>
                          <span className="ml-1 text-ink-muted">active</span>
                        </span>
                        <span className="ml-auto text-xs font-medium text-ink-subtle capitalize">
                          {job.seniority} · {job.minYears}+ yrs
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* --- How it works: kept because new HR staff land here first --- */}
      <div>
        <SectionTitle>How scoring works</SectionTitle>
        <Card className="p-5">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-sm font-medium">Free and unlimited</p>
              <p className="text-sm leading-relaxed text-ink-muted">
                Scoring runs offline with no per-CV cost. Skills are weighted by how
                strongly they predict ability in the role, then combined with experience.
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">Proof beats keywords</p>
              <p className="text-sm leading-relaxed text-ink-muted">
                A skill counts fully only when the CV proves it. “Built a Revit API add-in
                used by 400 modellers” earns full credit; the same words in a keyword list
                earn half.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
