"use client";

import { useState } from "react";
import { useAiNotice } from "@/components/ai-notice";

export const AI_NOT_READY = "The AI assistant is not available yet. Use the form above.";

/**
 * Where "Create with AI" will start (Story 5.8). Hidden unless the server has `AI_FEATURES=1`; until the assistant exists it only
 * shows the external-service notice (Story 5.3) and says so.
 */
export function CreateWithAi() {
  const { withNotice, notice } = useAiNotice();
  const [message, setMessage] = useState("");
  return (
    <section className="card" aria-labelledby="create-with-ai-title" data-testid="create-with-ai">
      <h2 id="create-with-ai-title" className="section-title">
        Start with AI
      </h2>
      <button type="button" className="secondary-button" onClick={() => withNotice(() => setMessage(AI_NOT_READY))}>
        Create with AI
      </button>
      <p role="status" className="muted">
        {message}
      </p>
      {notice}
    </section>
  );
}
