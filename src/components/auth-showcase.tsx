"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The branded left panel on the sign-in / sign-up screens: an auto-rotating
 * carousel that tells a first-time HR user what the tool does before they log
 * in. Deliberately calm — slides crossfade every 5s, pause on hover/focus, and
 * hold still entirely for anyone who prefers reduced motion. Nothing here
 * "shoots"; it settles.
 */

type Slide = {
  tag: string;
  title: string;
  body: string;
  icon: React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    tag: "Screening",
    title: "Rank every CV in seconds",
    body: "Evidence-weighted scoring reads each résumé for proven skills and real experience — free, offline, and unlimited.",
    icon: (
      <path d="M4 6h16M4 12h10M4 18h7" strokeWidth="2" strokeLinecap="round" />
    ),
  },
  {
    tag: "Meaning, not keywords",
    title: "Match by what they mean",
    body: "Semantic matching understands that “clash detection” and “interference checking” are the same skill — no exact wording required.",
    icon: (
      <path
        d="M8 12a4 4 0 0 1 4-4h1a3 3 0 0 1 0 6M16 12a4 4 0 0 1-4 4h-1a3 3 0 0 1 0-6"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
  },
  {
    tag: "Assessments",
    title: "Send a real technical test",
    body: "Attach a Revit or design task, record screen and camera with consent, and review the actual working time — not guesses.",
    icon: (
      <path
        d="M4 5h16v11H4zM9 20h6M12 16v4"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    tag: "Live pipeline",
    title: "Work the board together",
    body: "Stage moves, screenings and notes appear for the whole team in real time, with a full audit trail on every candidate.",
    icon: (
      <path
        d="M5 12l4 4L19 6M3 12h2m14 6v.01"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

const INTERVAL = 5000;

export function AuthShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Respect the OS reduced-motion setting: hold on the first slide.
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || paused) return;

    timer.current = setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length);
    }, INTERVAL);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused]);

  return (
    <div
      className="relative flex h-full min-h-[26rem] flex-col justify-between overflow-hidden rounded-2xl p-8 text-white lg:p-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Drifting brand aurora + a soft dark veil so text stays readable. */}
      <div className="aurora absolute inset-0 -z-10" aria-hidden />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/45 via-black/10 to-black/25"
        aria-hidden
      />

      {/* Brand lockup */}
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-base font-bold backdrop-blur-sm ring-1 ring-white/25">
          H
        </span>
        <span className="text-[15px] font-semibold tracking-tight">Hirebase</span>
      </div>

      {/* Slides — stacked, crossfading. The container reserves height so the
          form on the right never jumps as slides change. */}
      <div className="relative my-8 min-h-[11rem]">
        {SLIDES.map((s, i) => (
          <div
            key={s.title}
            aria-hidden={i !== active}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === active ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {i === active && (
              <div className="slide-in">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/20 backdrop-blur-sm">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5">
                    {s.icon}
                  </svg>
                  {s.tag}
                </span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight lg:text-[1.7rem]">
                  {s.title}
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/85">
                  {s.body}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dots — also clickable, so it's a control and not just decoration. */}
      <div className="flex items-center gap-2" role="tablist" aria-label="Highlights">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={s.title}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? "w-7 bg-white" : "w-2.5 bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
