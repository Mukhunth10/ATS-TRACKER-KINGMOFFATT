"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Workday-style live board. Mounted on a job page, it opens a Server-Sent
 * Events connection for that job and, whenever anyone changes the pipeline
 * (moves a candidate, finishes a screening, a candidate submits a test), asks
 * Next.js to re-fetch the server component — so two recruiters looking at the
 * same role see each other's changes within a second, without refreshing.
 *
 * Fail-soft: if the stream can't connect (proxy strips SSE, offline), the page
 * simply stops updating live — everything still works on manual refresh. The
 * small indicator tells the user which mode they're in.
 */
export function LiveJob({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [live, setLive] = useState(false);
  // Debounce a burst of changes (e.g. a batch upload) into one refresh.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/stream/${jobId}`);

    es.addEventListener("ready", () => setLive(true));
    es.addEventListener("change", () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 300);
    });
    es.onerror = () => setLive(false);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      es.close();
    };
  }, [jobId, router]);

  return (
    <span
      className="inline-flex items-center gap-1.5 text-2xs font-medium text-ink-subtle"
      title={live ? "Live — updates appear automatically" : "Not live — refresh to see changes"}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          live ? "bg-success animate-pulse" : "bg-line-strong"
        }`}
        aria-hidden
      />
      {live ? "Live" : "Offline"}
    </span>
  );
}
