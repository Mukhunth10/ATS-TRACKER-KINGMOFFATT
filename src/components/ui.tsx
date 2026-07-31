import { labelForKey } from "@/lib/bim-taxonomy";

// Workday-style recruiting pipeline, with an Assessment stage (the technical
// test) between screening and interview.
export const STAGES = [
  "applied",
  "screening",
  "assessment",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;

/** Stage colours run cool → warm → resolved, so progress reads left to right. */
export const STAGE_STYLE: Record<string, string> = {
  applied: "bg-surface-2 text-ink-muted ring-line",
  screening: "bg-primary-soft text-primary ring-primary/25",
  assessment: "bg-primary-soft text-primary ring-primary/30",
  interview: "bg-primary-soft text-primary ring-primary/40",
  offer: "bg-warn-soft text-warn ring-warn-border",
  hired: "bg-success-soft text-success ring-success-border",
  rejected: "bg-danger-soft text-danger ring-danger-border",
};

/** Workday-style disposition reasons — chosen when a candidate is declined, so
 *  rejections are consistent, reportable, and auditable. */
export const DISPOSITION_REASONS = [
  "Not enough relevant experience",
  "Skills mismatch",
  "Failed the technical assessment",
  "Stronger candidates available",
  "Position filled",
  "Candidate withdrew",
  "Salary expectations",
  "Location / right to work",
  "Other",
] as const;

type Tone = "success" | "warn" | "danger" | "neutral";

/** Bands match the scoring rubric: 80+ strong, 60+ worth reading, under 40 no. */
function toneForScore(score: number): Tone {
  if (score >= 80) return "success";
  if (score >= 60) return "neutral";
  if (score >= 40) return "warn";
  return "danger";
}

const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  warn: "text-warn",
  danger: "text-danger",
  neutral: "text-primary",
};

const TONE_STROKE: Record<Tone, string> = {
  success: "stroke-success",
  warn: "stroke-warn",
  danger: "stroke-danger",
  neutral: "stroke-primary",
};

/**
 * Score as a ring rather than a number in a box.
 *
 * A recruiter scanning fifty rows reads fill-level pre-attentively — far faster
 * than parsing two digits. The number stays for precision, and the tone is
 * doubled up with the arc length so the meaning does not rest on colour alone
 * (WCAG: never convey information by colour only).
 */
export function ScoreRing({
  score,
  label,
  size = 44,
}: {
  score: number | null;
  label?: string;
  size?: number;
}) {
  const stroke = size >= 44 ? 4 : 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  if (score === null) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full border border-dashed border-line text-ink-subtle"
        style={{ width: size, height: size }}
        title={label ? `${label}: not scored` : "Not scored"}
        aria-label={label ? `${label}: not scored` : "Not scored"}
      >
        <span className="text-xs">—</span>
      </div>
    );
  }

  const tone = toneForScore(score);
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      title={label ? `${label}: ${score} out of 100` : `${score} out of 100`}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={label ? `${label}: ${score} out of 100` : `${score} out of 100`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-line"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${TONE_STROKE[tone]} transition-[stroke-dashoffset] duration-500 ease-out`}
        />
      </svg>
      <span
        className={`tabular absolute inset-0 flex items-center justify-center font-semibold ${TONE_TEXT[tone]}`}
        style={{ fontSize: size >= 44 ? 13 : 11 }}
      >
        {score}
      </span>
    </div>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${
        STAGE_STYLE[stage] ?? STAGE_STYLE.applied
      }`}
    >
      {stage}
    </span>
  );
}

/** Renders a taxonomy key or a raw keyword as a readable chip. */
export function SkillChip({
  skillKey,
  tone = "neutral",
}: {
  skillKey: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const styles = {
    neutral: "bg-surface-2 text-ink-muted ring-line",
    good: "bg-success-soft text-success ring-success-border",
    bad: "bg-danger-soft text-danger ring-danger-border",
  }[tone];

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles}`}
    >
      {labelForKey(skillKey)}
    </span>
  );
}

export function Card({
  children,
  className = "",
  interactive = false,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`rounded-xl border border-line bg-surface shadow-card ${
        interactive
          ? "transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-xs font-semibold tracking-wider text-ink-subtle uppercase">
        {children}
      </h2>
      {action}
    </div>
  );
}

/** A headline number with its label. The directors' view is built from these. */
export function Stat({
  value,
  label,
  hint,
  tone = "neutral",
}: {
  value: string | number;
  label: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <Card className="p-3 sm:p-4">
      <p className="text-2xs font-medium tracking-wide text-ink-subtle uppercase sm:text-xs">
        {label}
      </p>
      <p className={`tabular mt-1 text-2xl font-semibold sm:mt-1.5 sm:text-3xl ${TONE_TEXT[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </Card>
  );
}

/** Horizontal stacked bar showing how a pipeline is distributed. */
export function PipelineBar({
  counts,
  total,
}: {
  counts: Record<string, number>;
  total: number;
}) {
  if (total === 0) {
    return <div className="h-2 rounded-full bg-surface-2" aria-hidden />;
  }

  const FILL: Record<string, string> = {
    applied: "bg-line-strong",
    screening: "bg-primary/50",
    assessment: "bg-primary/70",
    interview: "bg-primary",
    offer: "bg-warn",
    hired: "bg-success",
    rejected: "bg-danger/40",
  };

  return (
    <div
      className="flex h-2 overflow-hidden rounded-full bg-surface-2"
      role="img"
      aria-label={STAGES.filter((s) => counts[s])
        .map((s) => `${counts[s]} ${s}`)
        .join(", ")}
    >
      {STAGES.map((stage) => {
        const n = counts[stage] ?? 0;
        if (n === 0) return null;
        return (
          <div
            key={stage}
            className={`${FILL[stage]} transition-[width] duration-500 ease-out`}
            style={{ width: `${(n / total) * 100}%` }}
            title={`${n} ${stage}`}
          />
        );
      })}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="px-6 py-14 text-center">
      <p className="font-medium text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

/* --- Buttons: one primary per view, everything else subordinate --- */

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg shadow-sm transition-[background-color,transform,box-shadow] duration-150 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink transition-[background-color,transform] duration-150 hover:bg-surface-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink";

export const inputBase =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle transition-colors duration-150 focus:border-primary focus:outline-none";
