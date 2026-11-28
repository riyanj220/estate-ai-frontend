/** Voice search (Story 6.3): recording choices and the answer of `POST /api/v1/public/search/transcription`. */
export const VOICE_MAX_MS = 30_000;

// In order of preference. The server accepts these containers and the provider takes them as they are, so nothing is converted here:
// WebM (Chrome, Edge, Firefox, newer Safari), MP4 (older Safari), Ogg.
const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** The recorder type to ask for, or undefined to let the browser choose (the server then judges the bytes). */
export function recordingType(): string | undefined {
  return TYPES.find((type) => window.MediaRecorder.isTypeSupported?.(type));
}

export function readTranscription(data: unknown): { transcript: string; message: string } | null {
  const body = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  if (body.status !== "transcribed" && body.status !== "fallback") return null;
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  return { transcript: body.status === "transcribed" ? text(body.transcript) : "", message: text(body.message) };
}
