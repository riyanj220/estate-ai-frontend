"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getApi } from "@/lib/api";
import { withCsrf } from "@/lib/csrf";
import { REJECTED_ERROR, withTimeout } from "@/lib/forms";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { VOICE_MAX_MS, readTranscription, recordingType } from "@/lib/voice";

const INSTEAD = "Type your search instead, or use the filters below.";
const NOT_RECORDED = `Nothing was recorded. ${INSTEAD}`;

function microphoneMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return `Microphone access is blocked. ${INSTEAD}`;
  if (name === "NotFoundError") return `No microphone was found. ${INSTEAD}`;
  return `The microphone could not be started. ${INSTEAD}`;
}

// Absent on old browsers, and on any page that is not https or localhost. Unknown (null) on the server.
const never = () => () => {};
const canRecord = () => typeof window.MediaRecorder === "function" && typeof navigator.mediaDevices?.getUserMedia === "function";

type Phase = "idle" | "starting" | "recording" | "transcribing";

/**
 * Voice search (Story 6.3). The recording goes to our server for transcription (never the browser's own speech recognition) and the
 * words are handed to the text box, where they are checked, edited and searched like typed ones. Nothing is searched from here, and the
 * audio is kept nowhere. The typed text is only ever replaced by a transcript that arrived.
 */
export function VoiceSearch({ withNotice, onTranscript }: { withNotice: (start: () => void) => void; onTranscript: (text: string) => void }) {
  const supported = useSyncExternalStore<boolean | null>(never, canRecord, () => null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const discarded = useRef(false);
  const alive = useRef(true);
  const limit = useRef<number | undefined>(undefined);
  const button = useRef<HTMLButtonElement>(null);

  /** Ends the recording and releases the microphone; the recorder's `stop` event does the rest. */
  function stop(discard = false) {
    discarded.current = discard;
    window.clearTimeout(limit.current);
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  }

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop(true);
    };
  }, []);

  function finish(text: string) {
    busy.current = false;
    recorder.current = null;
    setPhase("idle");
    setMessage(text);
  }

  async function transcribe(recording: Blob) {
    setPhase("transcribing");
    try {
      const api = await getApi();
      // Longer than the server's own 12 second limit on the AI call.
      const { data, response } = await withCsrf((csrf) =>
        withTimeout((signal) => {
          const form = new FormData(); // a fresh body per attempt
          form.append("audio", recording, "search");
          return api.POST("/api/v1/public/search/transcription", {
            body: { audio: "" },
            bodySerializer: () => form,
            headers: { "X-CSRFToken": csrf },
            signal,
          });
        }),
      );
      if (!alive.current) return;
      if (!response.ok) return finish(`${failureMessage(response.status, response.headers.get("Retry-After"))} ${INSTEAD}`);
      const answer = readTranscription(data);
      if (!answer) return finish(`${REJECTED_ERROR} ${INSTEAD}`);
      if (!answer.transcript) return finish(answer.message || `${REJECTED_ERROR} ${INSTEAD}`);
      finish("Check the words in the box, change anything, then press Search.");
      onTranscript(answer.transcript);
    } catch (error) {
      if (alive.current) finish(`${thrownMessage(error)} ${INSTEAD}`);
    }
  }

  async function start() {
    if (busy.current) return;
    busy.current = true;
    discarded.current = false;
    setMessage("");
    setPhase("starting");
    let stream: MediaStream | null = null;
    const release = () => stream?.getTracks().forEach((track) => track.stop());
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) return release(); // the page was left while the browser was asking
      const type = recordingType();
      const made = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32_000 });
      const chunks: Blob[] = [];
      made.ondataavailable = (event) => chunks.push(event.data);
      made.onstop = () => {
        release();
        window.clearTimeout(limit.current);
        if (!alive.current) return;
        if (discarded.current) return finish("");
        const recording = new Blob(chunks, { type: made.mimeType });
        if (recording.size === 0) return finish(NOT_RECORDED);
        void transcribe(recording);
      };
      made.onerror = () => {
        discarded.current = true;
        release();
        if (alive.current) finish(`The recording failed. ${INSTEAD}`);
      };
      recorder.current = made;
      made.start();
      limit.current = window.setTimeout(() => stop(), VOICE_MAX_MS);
      setPhase("recording");
    } catch (error) {
      release();
      if (alive.current) finish(microphoneMessage(error));
    }
  }

  if (supported === null) return null;
  if (!supported) {
    return (
      <p className="hint" data-testid="voice-unsupported">
        Voice search is not available in this browser. Type your search in the box.
      </p>
    );
  }

  const waiting = phase === "starting" || phase === "transcribing";
  return (
    <div data-testid="voice-search">
      <div className="image-actions">
        <button
          ref={button}
          type="button"
          className={phase === "recording" ? "secondary-button voice-button voice-recording" : "secondary-button voice-button"}
          aria-disabled={waiting || undefined}
          onClick={() => (phase === "recording" ? stop() : phase === "idle" && withNotice(() => void start()))}
        >
          {phase === "recording" ? "Stop recording" : "Speak your request"}
        </button>
        {phase === "recording" && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              button.current?.focus();
              stop(true);
            }}
          >
            Cancel
          </button>
        )}
      </div>
      <div role="status" data-testid="voice-status" className="composer-status">
        {phase === "starting" && (
          <p className="busy-line">
            <span className="spinner" aria-hidden="true" />
            Waiting for the microphone…
          </p>
        )}
        {phase === "recording" && <p>Recording. Press &ldquo;Stop recording&rdquo; when you have finished (at most 30 seconds).</p>}
        {phase === "transcribing" && (
          <p className="busy-line">
            <span className="spinner" aria-hidden="true" />
            Writing down your words…
          </p>
        )}
        {message && <p>{message}</p>}
      </div>
    </div>
  );
}
