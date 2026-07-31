/**
 * Behavioural proctoring for the assessment — the "what were they doing" layer
 * that sits alongside the webcam attention monitor.
 *
 * Captures, in the candidate's own browser and only while the test is running:
 *   - focus loss: leaving the test tab or switching to another app (the single
 *     biggest tell — going off to search for answers)
 *   - paste / copy into the page
 *   - leaving fullscreen
 *   - (fed in from the webcam monitor) sustained look-away and a second face
 *
 * Every signal is behavioural, not biometric, and every one is a REVIEWER AID —
 * a flag with a timestamp for a human to scrub the recording against, never an
 * automatic pass/fail. It is also easily defeated by a determined cheater; the
 * recording remains the ground truth. Fail-open by design: if anything here
 * throws, the assessment continues unaffected.
 */

export type ProctorEventType =
  | "tab_hidden"
  | "tab_visible"
  | "paste"
  | "copy"
  | "fullscreen_exit"
  | "look_away"
  | "multi_face";

export interface ProctorEvent {
  /** Seconds since the recording started. */
  t: number;
  type: ProctorEventType;
}

export interface ProctorStats {
  tabHiddenSec: number;
  tabSwitches: number;
  pastes: number;
  copies: number;
  fullscreenExits: number;
  multiFace: number;
  timeline: ProctorEvent[];
}

export interface ProctorSession {
  /** Fed by the webcam monitor for look-away / multi-face moments. */
  mark(type: "look_away" | "multi_face"): void;
  stop(): ProctorStats;
}

/** Everything captured during one recording — webcam attention + behavioural
 *  proctoring merged — as handed to the submission form. */
export interface AssessmentSignals extends ProctorStats {
  awaySec: number;
  events: number;
}

/** Begins capturing. Call the returned mark() from the attention monitor, and
 *  stop() when the recording ends to get the accumulated stats + timeline. */
export function startProctor(): ProctorSession {
  const startedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const now = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const timeline: ProctorEvent[] = [];
  let tabSwitches = 0;
  let pastes = 0;
  let copies = 0;
  let fullscreenExits = 0;
  let multiFace = 0;
  let tabHiddenMs = 0;
  let hiddenSince: number | null = null;
  let away = false; // deduped focus state (blur and visibility both feed it)

  const secs = () => Math.max(0, Math.round((now() - startedAt) / 1000));
  const push = (type: ProctorEventType) => {
    // Cap so a pathological run can't balloon the payload.
    if (timeline.length < 600) timeline.push({ t: secs(), type });
  };

  const lose = () => {
    if (away) return;
    away = true;
    tabSwitches += 1;
    hiddenSince = now();
    push("tab_hidden");
  };
  const gain = () => {
    if (!away) return;
    away = false;
    if (hiddenSince !== null) {
      tabHiddenMs += now() - hiddenSince;
      hiddenSince = null;
    }
    push("tab_visible");
  };

  const onVisibility = () => (document.hidden ? lose() : gain());
  const onPaste = () => {
    pastes += 1;
    push("paste");
  };
  const onCopy = () => {
    copies += 1;
    push("copy");
  };
  const onFsChange = () => {
    if (!document.fullscreenElement) {
      fullscreenExits += 1;
      push("fullscreen_exit");
    }
  };

  try {
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", lose);
    window.addEventListener("focus", gain);
    window.addEventListener("paste", onPaste, true);
    window.addEventListener("copy", onCopy, true);
    document.addEventListener("fullscreenchange", onFsChange);
  } catch {
    /* listeners unavailable — proctoring simply records nothing */
  }

  return {
    mark(type) {
      if (type === "multi_face") multiFace += 1;
      push(type);
    },
    stop() {
      try {
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("blur", lose);
        window.removeEventListener("focus", gain);
        window.removeEventListener("paste", onPaste, true);
        window.removeEventListener("copy", onCopy, true);
        document.removeEventListener("fullscreenchange", onFsChange);
      } catch {
        /* ignore */
      }
      if (hiddenSince !== null) {
        tabHiddenMs += now() - hiddenSince;
        hiddenSince = null;
      }
      timeline.sort((a, b) => a.t - b.t);
      return {
        tabHiddenSec: Math.round(tabHiddenMs / 1000),
        tabSwitches,
        pastes,
        copies,
        fullscreenExits,
        multiFace,
        timeline,
      };
    },
  };
}
