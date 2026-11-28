"use client";

import { useRef } from "react";

/**
 * The one-time external-service notice (Story 5.3, FR-32). Every AI feature, text or voice, signed in or not, starts through
 * `useAiNotice`: the first time it shows the notice and runs the feature only on "Continue"; after that it runs at once. The
 * choice is kept per browser in localStorage. "Not now" and Escape run nothing and remember nothing, so the notice returns.
 */
export const AI_NOTICE_STORAGE_KEY = "estateai.ai-notice";
export const AI_NOTICE_TITLE = "AI features use an external service";

// Only where storage refuses the write: the choice is then kept for as long as the page's scripts live.
let seenThisVisit = false;

function hasSeenNotice(): boolean {
  try {
    return window.localStorage.getItem(AI_NOTICE_STORAGE_KEY) !== null || seenThisVisit;
  } catch {
    return seenThisVisit;
  }
}

function rememberNotice(): void {
  try {
    window.localStorage.setItem(AI_NOTICE_STORAGE_KEY, "seen");
  } catch {
    seenThisVisit = true; // blocked or full storage: the notice returns on the next visit
  }
}

/** `withNotice(start)` is the only way to start an AI feature; render `notice` once beside the control that calls it. */
export function useAiNotice(): { withNotice: (start: () => void) => void; notice: React.ReactNode } {
  const dialog = useRef<HTMLDialogElement>(null);
  const waiting = useRef<(() => void) | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  function withNotice(start: () => void) {
    if (hasSeenNotice()) {
      start();
      return;
    }
    waiting.current = start;
    opener.current = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    if (!element || element.open) return;
    element.returnValue = ""; // it outlives a close: Escape must never read an earlier "continue"
    element.showModal();
  }

  /** Every way out ends here (the buttons, and Escape through the platform's own close). */
  function onClose() {
    const start = dialog.current?.returnValue === "continue" ? waiting.current : null;
    waiting.current = null;
    opener.current?.focus();
    if (start) {
      rememberNotice();
      start();
    }
  }

  const notice = (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      aria-labelledby="ai-notice-title"
      aria-describedby="ai-notice-text"
      data-testid="ai-notice"
      onClose={onClose}
    >
      <h2 id="ai-notice-title" className="section-title">
        {AI_NOTICE_TITLE}
      </h2>
      <div id="ai-notice-text">
        <p>What you type or say to an AI feature is sent to an outside AI provider to be processed.</p>
        <p>
          Phone numbers, email addresses and street addresses are removed from text before it is sent, but this can miss some. Audio is
          covered by this notice and is not redacted: a voice recording is sent as it is.
        </p>
      </div>
      {/* No <form>: the notice sits on pages that have their own. Escape closes with an empty return value. */}
      <div className="image-actions">
        <button type="button" className="secondary-button" onClick={() => dialog.current?.close()} autoFocus>
          Not now
        </button>
        <button type="button" className="primary-button" onClick={() => dialog.current?.close("continue")}>
          Continue
        </button>
      </div>
    </dialog>
  );
  return { withNotice, notice };
}
