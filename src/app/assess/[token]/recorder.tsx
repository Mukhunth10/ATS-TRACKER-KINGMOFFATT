"use client";

import { useRef, useState } from "react";
import { startAttentionMonitor, type AttentionMonitor } from "./attention";
import { startProctor, type ProctorSession, type AssessmentSignals } from "./proctor";

const EMPTY_SIGNALS: AssessmentSignals = {
  awaySec: 0,
  events: 0,
  tabHiddenSec: 0,
  tabSwitches: 0,
  pastes: 0,
  copies: 0,
  fullscreenExits: 0,
  multiFace: 0,
  timeline: [],
};

type Phase = "idle" | "recording" | "uploading" | "done" | "error";

/**
 * Screen + webcam recorder.
 *
 * Captures the screen (getDisplayMedia) and the webcam (getUserMedia), then
 * composites them onto a canvas — screen filling the frame, the candidate's face
 * in the bottom-right corner — and records that single canvas as one video. A
 * reviewer watches one recording and sees both the work and the person's face
 * and eyes throughout.
 *
 * This is deliberately cooperative: the browser prompts for screen-share and
 * camera permission, and the candidate sees exactly what is captured. There is
 * no covert capture and no automated "cheating" verdict — a human reviews the
 * footage and judges. Covert capture would be both impossible here and unlawful
 * under GDPR.
 *
 * Requires a secure context (https or localhost). On plain http (e.g. a LAN IP)
 * browsers block both screen and camera access.
 */
export function Recorder({
  token,
  onUploaded,
}: {
  token: string;
  onUploaded: (ref: string, signals: AssessmentSignals) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [warn, setWarn] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const screenRef = useRef<MediaStream | null>(null);
  const camRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const attentionRef = useRef<AttentionMonitor | null>(null);
  const proctorRef = useRef<ProctorSession | null>(null);
  const statsRef = useRef<AssessmentSignals>(EMPTY_SIGNALS);
  // Mirror of phase for async closures that would otherwise see a stale value.
  const phaseRef = useRef<Phase>("idle");
  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const supported =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof window.MediaRecorder === "function";

  async function start() {
    setError("");
    let screen: MediaStream;
    let cam: MediaStream;

    // Screen first — if they cancel this prompt there is nothing to clean up.
    try {
      screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 10 },
        audio: false,
      });
    } catch {
      setError("Screen sharing was cancelled. Click record and choose “Entire Screen”.");
      return;
    }

    // Camera is required for this assessment.
    try {
      cam = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false,
      });
    } catch {
      screen.getTracks().forEach((t) => t.stop());
      setError("Camera access is required. Please allow the camera and try again.");
      return;
    }

    screenRef.current = screen;
    camRef.current = cam;

    // Stopping the share from the browser's own bar ends the recording cleanly.
    screen.getVideoTracks()[0].addEventListener("ended", () => stop());

    // --- Composite screen + camera onto a canvas ---
    const screenVideo = document.createElement("video");
    screenVideo.srcObject = screen;
    screenVideo.muted = true;
    await screenVideo.play();

    const camVideo = document.createElement("video");
    camVideo.srcObject = cam;
    camVideo.muted = true;
    await camVideo.play();

    // Behavioural proctoring (tab focus, paste, fullscreen) starts immediately.
    statsRef.current = EMPTY_SIGNALS;
    const proctor = startProctor();
    proctorRef.current = proctor;

    // Ask for fullscreen so leaving it (to open another app) is a recordable
    // signal. Best-effort — declining it doesn't block the test.
    document.documentElement.requestFullscreen?.().catch(() => {});

    // Attention monitoring runs on the camera feed. Best-effort: if it can't
    // start, recording continues without it. Its look-away / multi-face moments
    // are fed into the proctor timeline.
    startAttentionMonitor(
      camVideo,
      (active) => setWarn(active),
      (type) => proctorRef.current?.mark(type),
    )
      .then((m) => {
        // If the user already stopped before the model finished loading, close it.
        if (phaseRef.current !== "recording") m.stop();
        else attentionRef.current = m;
      })
      .catch(() => {});

    // Cap output size so the file stays reasonable regardless of monitor size.
    const W = 1280;
    const H = 720;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    const CAM_W = 240;
    const CAM_H = 180;
    const draw = () => {
      ctx.drawImage(screenVideo, 0, 0, W, H);
      // Face in the bottom-right, with a subtle border so it reads as a webcam.
      const x = W - CAM_W - 16;
      const y = H - CAM_H - 16;
      ctx.drawImage(camVideo, x, y, CAM_W, CAM_H);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, CAM_W, CAM_H);
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    // Show the candidate a live preview so they can confirm their face is framed.
    const composite = canvas.captureStream(10);
    if (previewRef.current) {
      previewRef.current.srcObject = composite;
      previewRef.current.play().catch(() => {});
    }

    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const rec = new MediaRecorder(composite, {
      mimeType: mime,
      videoBitsPerSecond: 1_500_000,
    });
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    rec.onstop = upload;
    rec.start(1000);
    recorderRef.current = rec;

    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    setPhaseBoth("recording");
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    // Capture attention + proctoring stats before tearing the camera down.
    const attention = attentionRef.current
      ? attentionRef.current.stop()
      : { awaySec: 0, events: 0, multiFaceEvents: 0 };
    attentionRef.current = null;
    const proctor = proctorRef.current?.stop() ?? {
      tabHiddenSec: 0,
      tabSwitches: 0,
      pastes: 0,
      copies: 0,
      fullscreenExits: 0,
      multiFace: 0,
      timeline: [],
    };
    proctorRef.current = null;
    statsRef.current = {
      awaySec: attention.awaySec,
      events: attention.events,
      ...proctor,
    };

    // Leave fullscreen we may have requested, so the "done" screen isn't stuck.
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    screenRef.current?.getTracks().forEach((t) => t.stop());
    camRef.current?.getTracks().forEach((t) => t.stop());
  }

  async function upload() {
    setPhaseBoth("uploading");
    setProgress(0);
    try {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });

      const target = await fetch(`/api/assess/${token}/upload`).then((r) => r.json());
      if (target.error) throw new Error(target.error);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", target.uploadUrl);
        xhr.setRequestHeader("Content-Type", "video/webm");
        xhr.upload.onprogress = (e) =>
          e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Upload failed (${xhr.status})`));
        xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
        xhr.send(blob);
      });

      onUploaded(target.ref, statsRef.current);
      setPhaseBoth("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPhaseBoth("error");
    }
  }

  if (!supported) {
    return (
      <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-muted">
        Your browser can't record here. Use Chrome or Edge on a computer, or record with
        a separate tool and paste the link below.
      </p>
    );
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="rounded-lg border border-line bg-surface-2 p-4">
      <p className="text-sm font-medium">Record your screen and camera</p>
      <p className="mt-1 text-xs text-ink-muted">
        Click record, then choose <strong>Entire Screen</strong> so your Revit window is
        captured, and allow the <strong>camera</strong> when asked. Your face is recorded
        in the corner so the review team can see you worked unaided. It uploads when you
        stop.
      </p>

      {/* Live preview while recording, so they can check their framing */}
      <div className={`relative mt-3 ${phase === "recording" ? "" : "hidden"}`}>
        <video
          ref={previewRef}
          muted
          playsInline
          className="w-full rounded-lg border border-line bg-black"
        />
        {/* Attention warning — shown to the candidate, logged for the reviewer,
            never an automatic rejection. */}
        {warn && (
          <div className="absolute inset-x-0 top-0 rounded-t-lg bg-danger px-3 py-2 text-center text-sm font-medium text-white">
            Please keep your attention on the assessment until you finish.
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {phase === "idle" && (
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-white" /> Start recording
          </button>
        )}

        {phase === "recording" && (
          <>
            <span className="inline-flex items-center gap-2 text-sm font-medium text-danger">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
              Recording {mmss}
            </span>
            <button
              type="button"
              onClick={stop}
              className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-hover"
            >
              Stop &amp; upload
            </button>
          </>
        )}

        {phase === "uploading" && (
          <div className="w-full">
            <p className="text-sm text-ink-muted">Uploading… {progress}%</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full bg-primary transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {phase === "done" && (
          <span className="text-sm font-medium text-success">
            ✓ Recording uploaded — now submit below.
          </span>
        )}

        {phase === "error" && (
          <button
            type="button"
            onClick={start}
            className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-hover"
          >
            Try again
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
