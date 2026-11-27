"use client";

import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/form-field";
import { getApi } from "@/lib/api";
import { withCsrf } from "@/lib/csrf";
import { readErrorBody, withTimeout } from "@/lib/forms";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { CHANGED_ELSEWHERE, CHANGE_REASON, GONE_ACCOUNT, checkReason, reasonMessage, type AccountStatus, type AdminAccount } from "./accounts-api";

/** Suspend or Reactivate, whichever the account's state allows: a reason, then a confirmation dialog. */
export function AccountAction({
  account,
  onStart,
  onChanged,
  onSessionGone,
  onUnavailable,
}: {
  account: Pick<AdminAccount, "id" | "state" | "email">;
  onStart: () => void;
  onChanged: (next: AccountStatus) => void;
  onSessionGone: () => Promise<void>;
  onUnavailable: (message: string) => void;
}) {
  const suspend = account.state !== "suspended";
  const verb = suspend ? "Suspend" : "Reactivate";
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [open, setOpen] = useState(false);
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
    onStart();
    const problem = checkReason(reason, CHANGE_REASON);
    setFieldError(problem);
    if (problem) {
      input.current?.focus();
      return;
    }
    setDialogError("");
    focusAfterClose.current = "trigger";
    setOpen(true);
  }

  function close() {
    if (!running.current) setOpen(false);
  }

  async function confirm() {
    if (running.current) return;
    running.current = true;
    setWorking(true);
    setDialogError("");
    try {
      const api = await getApi();
      const { data, error, response } = await withCsrf((csrf) =>
        withTimeout((signal) => {
          const options = {
            params: { path: { account_id: account.id } },
            body: { reason: reason.trim() },
            headers: { "X-CSRFToken": csrf },
            cache: "no-store" as const,
            signal,
          };
          return suspend
            ? api.POST("/api/v1/admin/accounts/{account_id}/suspend", options)
            : api.POST("/api/v1/admin/accounts/{account_id}/reactivate", options);
        }),
      );
      if (response.ok && data) return onChanged(data);
      if (response.status === 401) return await onSessionGone();
      if (response.status === 404) return onUnavailable(GONE_ACCOUNT);
      if (response.status === 409) return onUnavailable(CHANGED_ELSEWHERE);
      const code = response.status === 400 ? readErrorBody(error)?.fields?.reason?.[0] : undefined;
      if (code) {
        setFieldError(reasonMessage(code, CHANGE_REASON));
        focusAfterClose.current = "input";
        setOpen(false);
        return;
      }
      setDialogError(failureMessage(response.status, response.headers.get("Retry-After")));
    } catch (thrown) {
      setDialogError(thrownMessage(thrown));
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
    <form noValidate onSubmit={onSubmit} aria-label={`${verb} account`}>
      <Field
        name="change-reason"
        label={suspend ? "Reason for suspending" : "Reason for reactivating"}
        hint={`5 to 500 characters, without contact details.${suspend ? " The account holder sees this reason." : ""}`}
        errors={fieldError ? [fieldError] : undefined}
      >
        {(props) => <input {...props} ref={input} type="text" autoComplete="off" value={reason} onChange={(event) => setReason(event.target.value)} />}
      </Field>
      <button ref={trigger} type="submit" className="primary-button">
        {verb} account
      </button>
      <dialog
        ref={dialog}
        className="confirm-dialog"
        aria-labelledby="change-dialog-title"
        aria-describedby="change-dialog-text"
        onClose={() => {
          // A running change keeps its dialog even if the platform closed it.
          if (running.current) dialog.current?.showModal();
          else setOpen(false);
        }}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onKeyDown={onKeyDown}
      >
        <h2 id="change-dialog-title" className="section-title">
          {verb} this account?
        </h2>
        <p id="change-dialog-text" className="account-text">
          {suspend
            ? `${account.email} will not be able to publish or change listings, and its listings leave public view.`
            : `${account.email} gets its access back. Published listings of an active account become visible again.`}
        </p>
        {dialogError && (
          <p ref={alert} tabIndex={-1} role="alert" className="state-note">
            {dialogError}
          </p>
        )}
        <p role="status" className="sr-only">
          {working ? "Saving…" : ""}
        </p>
        <div className="image-actions">
          <button ref={cancel} type="button" className="secondary-button" aria-disabled={busy} onClick={close}>
            Cancel
          </button>
          <button ref={confirmButton} type="button" className="primary-button" aria-disabled={busy} onClick={() => void confirm()}>
            {working ? "Saving…" : verb}
          </button>
        </div>
      </dialog>
    </form>
  );
}
