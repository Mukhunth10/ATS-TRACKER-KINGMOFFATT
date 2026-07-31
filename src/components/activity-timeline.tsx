import { relativeTime } from "@/lib/time";

type Activity = {
  id: string;
  actor: string;
  type: string;
  detail: string;
  createdAt: Date;
};

/** A small coloured dot per activity type, so the timeline scans at a glance. */
const DOT: Record<string, string> = {
  created: "bg-primary",
  uploaded: "bg-primary",
  reviewed: "bg-primary",
  screened: "bg-success",
  stage_change: "bg-warn",
  note: "bg-line-strong",
  assessment_sent: "bg-primary",
  assessment_submitted: "bg-success",
};

/**
 * Workday-style process history for one role. Read-only, newest first — answers
 * "who did what, when" and, paired with the live stream, updates as colleagues
 * work the pipeline.
 */
export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-ink-subtle">
        No activity yet. Uploads, screenings, stage changes and notes appear here.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {activities.map((a) => (
        <li key={a.id} className="flex gap-2.5">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[a.type] ?? "bg-line-strong"}`}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm leading-snug text-ink">{a.detail}</p>
            <p className="text-2xs text-ink-subtle">
              {a.actor} · {relativeTime(a.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
