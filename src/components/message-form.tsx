"use client";

import { useId, useRef, useState } from "react";
import { newIdempotencyKey } from "@/lib/idempotency";
import { MAX_MESSAGE, draftProblem } from "@/lib/messaging";

/**
 * One text box and Send. The Idempotency-Key is kept while the same text is retried, so a lost answer never sends twice. `send` resolves
 * "" when the Message was saved (the box is then cleared), else the sentence to show; the draft stays.
 */
export function MessageForm({ label, send, onCancel }: { label: string; send: (body: string, key: string) => Promise<string>; onCancel?: () => void }) {
  const id = useId();
  const [text, setText] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const attempt = useRef<{ text: string; key: string } | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    const invalid = draftProblem(text);
    setProblem(invalid);
    if (invalid) {
      box.current?.focus();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    if (attempt.current?.text !== text) attempt.current = { text, key: newIdempotencyKey() };
    const failure = await send(text, attempt.current.key);
    busyRef.current = false;
    setBusy(false);
    setProblem(failure);
    if (!failure) {
      attempt.current = null;
      setText("");
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <textarea
          id={id}
          ref={box}
          rows={4}
          value={text}
          autoFocus={onCancel !== undefined}
          aria-describedby={`${id}-hint ${id}-problem`}
          aria-invalid={problem ? true : undefined}
          onChange={(event) => setText(event.target.value)}
        />
        <p id={`${id}-hint`} className="hint">
          Up to {MAX_MESSAGE.toLocaleString("en-US")} characters.
        </p>
        <p id={`${id}-problem`} role="alert" className="field-error">
          {problem}
        </p>
      </div>
      <button type="submit" className="primary-button" aria-disabled={busy ? true : undefined}>
        {busy ? "Sending…" : "Send"}
      </button>{" "}
      {onCancel && (
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}
