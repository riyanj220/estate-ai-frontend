"use client";

import { useState } from "react";
import { Field } from "@/components/ui/form-field";
import { LOOKUP_REASON, checkReason, reasonMessage } from "./accounts/accounts-api";
import { useAdminWrite } from "./moderation-shared";

type Answer<T> = { data?: T; error?: unknown; response: Response };

/** Private data shown only after a reason, which is recorded (FR-69). One item at a time; nothing is exported. */
export function ReasonedRead<T>({
  title,
  send,
  show,
  onSessionGone,
}: {
  title: string;
  send: (reason: string, csrf: string, signal: AbortSignal) => Promise<Answer<T>>;
  show: (data: T) => React.ReactNode;
  onSessionGone: () => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState<T | null>(null);
  const { working, write } = useAdminWrite(onSessionGone, setNotice);
  const name = `read-${title.toLowerCase().replaceAll(" ", "-")}`;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const problem = checkReason(reason, LOOKUP_REASON);
    setError(problem);
    if (problem) return;
    void write<T>((csrf, signal) => send(reason.trim(), csrf, signal), {
      done: setData,
      field: "reason",
      invalid: (code) => setError(reasonMessage(code, LOOKUP_REASON)),
    });
  }

  return (
    <form noValidate onSubmit={onSubmit} aria-label={title}>
      <h2 className="section-title">{title}</h2>
      {data ? (
        <div data-testid="private-data">{show(data)}</div>
      ) : (
        <>
          <Field name={name} label="Reason for reading" hint="10 to 300 characters, without contact details. It is recorded." errors={error ? [error] : undefined}>
            {(props) => <input {...props} type="text" autoComplete="off" value={reason} onChange={(event) => setReason(event.target.value)} />}
          </Field>
          <button type="submit" className="secondary-button" aria-disabled={working || undefined}>
            Show {title.toLowerCase()}
          </button>
        </>
      )}
      <p role="status" aria-live="polite" className={notice ? "state-note" : "sr-only"}>
        {notice}
      </p>
    </form>
  );
}
