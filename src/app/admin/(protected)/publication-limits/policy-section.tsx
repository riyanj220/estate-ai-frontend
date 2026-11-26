"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/form-field";
import { getApi } from "@/lib/api";
import { withCsrf } from "@/lib/csrf";
import { readErrorBody, withTimeout } from "@/lib/forms";
import { formatResetDate as formatDate } from "@/lib/publication-allowance";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/use-profile-load";
import { fetchPolicy, NOT_AVAILABLE, SIGN_IN_PATH, TYPE_LABELS, type AccountType, type Policy } from "./quota-api";

const HEADING_ID = "limits-title";
const MAX_LIMIT = 1000;
const RANGE_MESSAGE = `Enter a whole number from 0 to ${MAX_LIMIT}.`;
const FIELD_MESSAGES: Record<string, string> = {
  required: "Enter a limit.",
  invalid: RANGE_MESSAGE,
  min_value: "The limit cannot be below 0.",
  max_value: `The limit cannot be above ${MAX_LIMIT}.`,
};
const perMonth = (limit: number) => `${limit} ${limit === 1 ? "publication" : "publications"} per month`;

/** The checked number, or the message to show. An empty number input also covers text the browser could not read. */
function readLimit(text: string): { limit: number } | { error: string } {
  if (!text.trim()) return { error: RANGE_MESSAGE };
  const limit = Number(text);
  if (!Number.isInteger(limit)) return { error: RANGE_MESSAGE };
  if (limit < 0) return { error: FIELD_MESSAGES.min_value };
  if (limit > MAX_LIMIT) return { error: FIELD_MESSAGES.max_value };
  return { limit };
}

type Props = {
  announce: (message: string) => void;
  resetAnnouncement: () => void;
  onSaved: (accountType: AccountType, limit: number) => void;
};

export function PolicySection({ announce, resetAnnouncement, onSaved }: Props) {
  const router = useRouter();
  const { load, read, retry, sessionGone } = useResourceLoad<Policy[]>(
    async (): Promise<ProfileFetch<Policy[]>> => {
      const answer = await fetchPolicy();
      if (answer.kind === "ready") return { kind: "ready", profile: answer.items };
      if (answer.kind === "gone") return "gone";
      if (answer.kind === "forbidden") {
        router.refresh(); // runs the server guard again
        return { kind: "forbidden" };
      }
      return { kind: "error", message: answer.message };
    },
    HEADING_ID,
    { signInPath: SIGN_IN_PATH, refreshOnFocus: false },
  );
  // Rows saved here replace the loaded ones.
  const [saved, setSaved] = useState<Partial<Record<AccountType, Policy>>>({});

  return (
    <section aria-labelledby={HEADING_ID} style={{ marginBottom: "2rem" }}>
      <h2 id={HEADING_ID} tabIndex={-1} className="section-title">
        Monthly limits
      </h2>
      {load.kind === "forbidden" ? (
        <p className="card">{NOT_AVAILABLE}</p>
      ) : load.kind !== "ready" ? (
        <ProfileLoadState load={load} onRetry={retry} noun="publication limits" determiner="the" titleId="limits-error-title" />
      ) : (
        load.profile.map((row) => (
          <LimitForm
            key={row.account_type}
            row={saved[row.account_type] ?? row}
            announce={announce}
            resetAnnouncement={resetAnnouncement}
            onSessionGone={sessionGone}
            onSaved={(next) => {
              setSaved((prev) => ({ ...prev, [next.account_type]: next }));
              onSaved(next.account_type, next.monthly_limit);
            }}
            // The outcome of a failed change is not always known: read what is in force now.
            onFailed={() => {
              void read(true).then((applied) => applied && setSaved({}));
            }}
          />
        ))
      )}
    </section>
  );
}

function LimitForm({
  row,
  announce,
  resetAnnouncement,
  onSessionGone,
  onSaved,
  onFailed,
}: {
  row: Policy;
  announce: (message: string) => void;
  resetAnnouncement: () => void;
  onSessionGone: () => Promise<void>;
  onSaved: (row: Policy) => void;
  onFailed: () => void;
}) {
  const type = row.account_type;
  const label = TYPE_LABELS[type];
  const name = `limit-${type}`;
  const [text, setText] = useState(String(row.monthly_limit));
  const [fieldError, setFieldError] = useState("");
  /** The number being confirmed; null while the dialog is closed. */
  const [pending, setPending] = useState<number | null>(null);
  const [working, setWorking] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const running = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  const focusAfterClose = useRef<"trigger" | "input">("trigger");
  const open = pending !== null;

  // The native modal dialog is opened and closed through the platform API; the state only mirrors it.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      cancel.current?.focus();
    } else if (!open && element.open) {
      element.close();
      (focusAfterClose.current === "input" ? input : trigger).current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (dialogError) alert.current?.focus();
  }, [dialogError]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    resetAnnouncement();
    const result = readLimit(text);
    if ("error" in result) {
      setFieldError(result.error);
      input.current?.focus();
      return;
    }
    setFieldError("");
    if (result.limit === row.monthly_limit) {
      announce(`The ${label} limit is already ${perMonth(row.monthly_limit)}. Nothing was changed.`);
      return;
    }
    setDialogError("");
    focusAfterClose.current = "trigger";
    setPending(result.limit);
  }

  function close() {
    if (!running.current) setPending(null);
  }

  async function confirm() {
    if (running.current || pending === null) return;
    running.current = true;
    setWorking(true);
    setDialogError("");
    try {
      const api = await getApi();
      const { data, error, response } = await withCsrf((csrf) =>
        withTimeout((signal) =>
          api.PUT("/api/v1/admin/quota-policy/{account_type}", {
            params: { path: { account_type: type } },
            body: { monthly_limit: pending },
            headers: { "X-CSRFToken": csrf },
            signal,
          }),
        ),
      );
      if (response.ok && data) {
        onSaved(data);
        setText(String(data.monthly_limit));
        setPending(null);
        announce(`The ${label} limit is now ${perMonth(data.monthly_limit)}. It applies to future publications only.`);
        return;
      }
      if (response.status === 401) {
        await onSessionGone();
        return;
      }
      const code = response.status === 400 ? readErrorBody(error)?.fields?.monthly_limit?.[0] : undefined;
      if (code) {
        setFieldError(FIELD_MESSAGES[code] ?? RANGE_MESSAGE);
        focusAfterClose.current = "input";
        setPending(null);
        return;
      }
      setDialogError(failureMessage(response.status, response.headers.get("Retry-After")));
      onFailed();
    } catch (thrown) {
      setDialogError(thrownMessage(thrown));
      onFailed();
    } finally {
      running.current = false;
      setWorking(false);
    }
  }

  // Tab stays between the two buttons of the dialog.
  function onKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const edge = event.shiftKey ? cancel.current : confirmButton.current;
    if (document.activeElement !== edge) return;
    event.preventDefault();
    (event.shiftKey ? confirmButton : cancel).current?.focus();
  }

  const busy = working ? true : undefined;
  return (
    <form className="card" noValidate onSubmit={onSubmit} aria-label={`${label} accounts`} style={{ marginBottom: "var(--space)" }}>
      <Field
        name={name}
        label={`${label} accounts: publications per month`}
        hint={`Current limit: ${row.monthly_limit}, in force since ${formatDate(row.effective_from)}.`}
        errors={fieldError ? [fieldError] : undefined}
      >
        {(props) => (
          <input
            {...props}
            ref={input}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_LIMIT}
            step={1}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        )}
      </Field>
      <button ref={trigger} type="submit" className="primary-button">
        Change {label} limit
      </button>
      <dialog
        ref={dialog}
        className="confirm-dialog"
        aria-labelledby={`${name}-dialog-title`}
        aria-describedby={`${name}-dialog-text`}
        onClose={() => {
          // A running change keeps its dialog even if the platform closed it.
          if (running.current) dialog.current?.showModal();
          else setPending(null);
        }}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onKeyDown={onKeyDown}
      >
        <h2 id={`${name}-dialog-title`} className="section-title">
          Change the {label} limit?
        </h2>
        <p id={`${name}-dialog-text`}>
          {open && `From ${row.monthly_limit} to ${perMonth(pending)}. This applies to future publications only.`}
        </p>
        {dialogError && (
          <p ref={alert} tabIndex={-1} role="alert" className="state-note">
            {dialogError}
          </p>
        )}
        <p role="status" className="sr-only">
          {working ? "Saving the limit…" : ""}
        </p>
        <div className="image-actions">
          <button ref={cancel} type="button" className="secondary-button" aria-disabled={busy} onClick={close}>
            Cancel
          </button>
          <button ref={confirmButton} type="button" className="primary-button" aria-disabled={busy} onClick={() => void confirm()}>
            {working ? "Saving…" : "Change limit"}
          </button>
        </div>
      </dialog>
    </form>
  );
}
