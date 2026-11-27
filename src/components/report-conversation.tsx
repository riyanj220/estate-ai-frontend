"use client";

import { useId, useRef, useState } from "react";
import { MAX_DESCRIPTION, MAX_SELECTED, REPORT_REASONS, reportConversation, type ReportReason } from "@/lib/reports";
import type { Message } from "@/lib/messaging";

/** "Report conversation" (Story 9.5): the reporter picks the other side's Messages at issue. */
export function ReportConversation({ conversationId, messages, who, gone }: { conversationId: string; messages: Message[]; who: string; gone: () => Promise<void> }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [description, setDescription] = useState("");
  const [problems, setProblems] = useState({ messages: "", reason: "" });
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const theirs = messages.filter((message) => !message.mine);

  if (theirs.length === 0) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (running.current) return;
    setOutcome("");
    const found = {
      messages: chosen.length === 0 ? "Choose at least one message." : chosen.length > MAX_SELECTED ? `Choose at most ${MAX_SELECTED} messages.` : "",
      reason: reason ? "" : "Choose a reason.",
    };
    setProblems(found);
    if (found.messages || !reason) {
      form.current?.querySelector<HTMLElement>(found.messages ? "input[type=checkbox]" : "select")?.focus();
      return;
    }
    running.current = true;
    setBusy(true);
    const result = await reportConversation(conversationId, chosen, reason, description.trim());
    running.current = false;
    setBusy(false);
    if (result.kind === "gone") return void gone();
    setOutcome(result.message);
    if (result.kind === "done") {
      setOpen(false);
      setChosen([]);
    }
  }

  return (
    <div className="save-control">
      <button type="button" className="secondary-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        Report conversation
      </button>
      <p role="status" className={outcome ? "save-note" : "sr-only"} data-testid="conversation-report-status">
        {outcome}
      </p>
      {open && (
        <form ref={form} noValidate onSubmit={(event) => void submit(event)} aria-label="Report conversation">
          <fieldset className="field" aria-describedby={`${id}-messages`}>
            <legend>Messages from {who} to report</legend>
            {theirs.map((message) => (
              <label key={message.id} className="account-text" style={{ display: "block" }}>
                <input
                  type="checkbox"
                  checked={chosen.includes(message.id)}
                  onChange={(event) => setChosen((now) => (event.target.checked ? [...now, message.id] : now.filter((value) => value !== message.id)))}
                />{" "}
                {message.body}
              </label>
            ))}
            <p id={`${id}-messages`} role="alert" className="field-error">
              {problems.messages}
            </p>
          </fieldset>
          <div className="field">
            <label htmlFor={`${id}-reason`}>Reason</label>
            <select id={`${id}-reason`} value={reason} aria-invalid={problems.reason ? true : undefined} aria-describedby={`${id}-problem`} onChange={(event) => setReason(event.target.value as ReportReason | "")}>
              <option value="">Choose a reason</option>
              {Object.entries(REPORT_REASONS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
            <p id={`${id}-problem`} role="alert" className="field-error">
              {problems.reason}
            </p>
          </div>
          <div className="field">
            <label htmlFor={`${id}-description`}>Details (optional)</label>
            <textarea id={`${id}-description`} rows={3} maxLength={MAX_DESCRIPTION} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <p className="muted">The messages you choose, and up to 5 sent just before them, are shared with an administrator.</p>
          <button type="submit" className="primary-button" aria-disabled={busy || undefined}>
            Send report
          </button>
        </form>
      )}
    </div>
  );
}
