/**
 * Client-side attention monitor.
 *
 * Runs Google's MediaPipe face-landmark model on the candidate's webcam, in
 * their browser, for free. It estimates whether they are facing the screen and
 * counts sustained periods of looking away.
 *
 * Design decisions that matter, all aimed at NOT wrongly flagging good people:
 *   - It's a REVIEWER AID, never a verdict. The output is "worth a look",
 *     handed to a human who watches the actual footage.
 *   - Only *sustained* looking-away counts. A glance at the keyboard or a
 *     moment's thought (under AWAY_GRACE_MS) is ignored — that's normal, and
 *     especially normal for CAD work on dual monitors.
 *   - Everything is best-effort and fail-open: if the model can't load, or a
 *     frame errors, monitoring silently does nothing and the assessment
 *     proceeds. A detection library must never be able to block someone's test.
 *
 * Head turn is estimated from face geometry (nose position relative to the eye
 * centre, normalised by eye distance) rather than raw matrix decomposition —
 * simpler and more robust across faces, glasses, and lighting.
 */

const SAMPLE_MS = 400; // how often to run detection (not every frame — costly)
const AWAY_GRACE_MS = 3000; // must look away this long before it counts
const MULTI_GRACE_MS = 1500; // a second face must persist this long before it counts
const YAW_THRESHOLD = 0.42; // nose-offset ratio beyond which the head is "turned"

export interface AttentionStats {
  awaySec: number;
  events: number;
  /** Distinct sustained periods where a second face was visible in frame. */
  multiFaceEvents: number;
}

export interface AttentionMonitor {
  stop(): AttentionStats;
}

/**
 * Starts monitoring `video`. `onWarn(active)` is called when a sustained
 * look-away begins (true) and ends (false) so the UI can show/hide a warning.
 * `onEvent` (optional) fires once per sustained look-away or multi-face run, so
 * a proctor timeline can record when it happened. Returns a handle whose stop()
 * yields the accumulated stats.
 */
export async function startAttentionMonitor(
  video: HTMLVideoElement,
  onWarn: (active: boolean) => void,
  onEvent?: (type: "look_away" | "multi_face") => void,
): Promise<AttentionMonitor> {
  let landmarker: import("@mediapipe/tasks-vision").FaceLandmarker | null = null;

  try {
    const vision = await import("@mediapipe/tasks-vision");
    const fileset = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
    );
    landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      // Look for up to two faces so a second person in frame can be flagged.
      numFaces: 2,
    });
  } catch {
    // Model couldn't load — monitoring is unavailable, but recording goes on.
    return { stop: () => ({ awaySec: 0, events: 0, multiFaceEvents: 0 }) };
  }

  let events = 0;
  let awayMs = 0;
  let awaySinceMonotonic: number | null = null; // when the current away-run began
  let warnedThisRun = false;
  let multiFaceEvents = 0;
  let multiSinceMonotonic: number | null = null; // when the current 2-face run began
  let countedThisMultiRun = false;
  let lastTick = performance.now();
  let stopped = false;

  const isFacingForward = (
    result: import("@mediapipe/tasks-vision").FaceLandmarkerResult,
  ): boolean => {
    const faces = result.faceLandmarks;
    if (!faces || faces.length === 0) return false; // no face = away/absent

    const lm = faces[0];
    // 33 = left-eye outer, 263 = right-eye outer, 1 = nose tip.
    const leftEye = lm[33];
    const rightEye = lm[263];
    const nose = lm[1];
    if (!leftEye || !rightEye || !nose) return true; // can't tell — don't penalise

    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const interEye = Math.abs(rightEye.x - leftEye.x) || 0.0001;
    const noseOffset = Math.abs(nose.x - eyeMidX) / interEye;
    return noseOffset < YAW_THRESHOLD;
  };

  const tick = () => {
    if (stopped || !landmarker) return;
    const now = performance.now();

    try {
      // detectForVideo needs monotonically increasing timestamps.
      const result = landmarker.detectForVideo(video, now);
      const facing = isFacingForward(result);
      const faceCount = result.faceLandmarks?.length ?? 0;

      if (facing) {
        // Back on task — close any open away-run and clear the warning.
        if (awaySinceMonotonic !== null && warnedThisRun) onWarn(false);
        awaySinceMonotonic = null;
        warnedThisRun = false;
      } else {
        if (awaySinceMonotonic === null) awaySinceMonotonic = now;
        const runLength = now - awaySinceMonotonic;
        if (runLength >= AWAY_GRACE_MS) {
          // Sustained: accumulate time, and on first crossing count an event + warn.
          awayMs += now - lastTick;
          if (!warnedThisRun) {
            events += 1;
            warnedThisRun = true;
            onWarn(true);
            onEvent?.("look_away");
          }
        }
      }

      // A second face in frame, sustained past the grace window, is worth one
      // flag per appearance — someone else helping or taking the test.
      if (faceCount >= 2) {
        if (multiSinceMonotonic === null) multiSinceMonotonic = now;
        if (now - multiSinceMonotonic >= MULTI_GRACE_MS && !countedThisMultiRun) {
          multiFaceEvents += 1;
          countedThisMultiRun = true;
          onEvent?.("multi_face");
        }
      } else {
        multiSinceMonotonic = null;
        countedThisMultiRun = false;
      }
    } catch {
      /* a bad frame — ignore, keep going */
    }

    lastTick = now;
  };

  const interval = setInterval(tick, SAMPLE_MS);

  return {
    stop() {
      stopped = true;
      clearInterval(interval);
      try {
        landmarker?.close();
      } catch {
        /* ignore */
      }
      onWarn(false);
      return { awaySec: Math.round(awayMs / 1000), events, multiFaceEvents };
    },
  };
}
