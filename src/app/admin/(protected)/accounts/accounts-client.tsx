"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Field } from "@/components/ui/form-field";
import { STATE_LABELS, typeLabel } from "@/lib/account/account";
import { getApi } from "@/lib/http/api";
import { withCsrf } from "@/lib/http/csrf";
import { readErrorBody, withTimeout } from "@/lib/forms/forms";
import { formatResetDate as formatDate } from "@/lib/account/publication-allowance";
import { failureMessage, thrownMessage } from "@/lib/http/request-errors";
import { useSession } from "@/lib/auth/session";
import { useFormFeedback } from "@/lib/forms/use-form-feedback";
import { AccountAction } from "./account-action";
import { Directory } from "./directory";
import { LOOKUP_REASON, NOT_FOUND, SIGN_IN_PATH, checkReason, reasonMessage, type AccountStatus, type AdminAccount } from "./accounts-api";

/** Account lookup, suspension and reactivation (Story 2.21): the server decides every rule; the page shows its answers. */
export function Accounts() {
  const router = useRouter();
  const { refresh } = useSession();
  const { announcement, announce, resetAnnouncement, notice, setNotice, showNotice, noticeRef } = useFormFeedback();
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ email?: string; reason?: string }>({});
  const [searching, setSearching] = useState(false);
  const running = useRef(false);
  /** The account found; `lookup` counts the lookups so the action form starts afresh each time. */
  const [found, setFound] = useState<{ account: AdminAccount; lookup: number } | null>(null);
  const lookups = useRef(0);
  const emailInput = useRef<HTMLInputElement>(null);
  const reasonInput = useRef<HTMLInputElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const focusResult = useCallback(() => resultHeading.current?.focus(), []);

  // The session is gone: flip the provider to signed out, then sign in again and come back here.
  const sessionGone = useCallback(async () => {
    await refresh();
    router.replace(SIGN_IN_PATH);
  }, [refresh, router]);

  function showErrors(next: { email?: string; reason?: string }) {
    setErrors(next);
    // After the render that marks the field, so its error is announced with it.
    requestAnimationFrame(() => (next.email ? emailInput : reasonInput).current?.focus());
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (running.current) return;
    resetAnnouncement();
    setNotice("");
    const invalid = {
      email: email.trim() ? undefined : "Enter an email address.",
      reason: checkReason(reason, LOOKUP_REASON) || undefined,
    };
    if (invalid.email || invalid.reason) return showErrors(invalid);
    setErrors({});
    setFound(null);
    running.current = true;
    setSearching(true);
    try {
      const api = await getApi();
      const { data, error, response } = await withCsrf((csrf) =>
        withTimeout((signal) =>
          api.POST("/api/v1/admin/accounts/lookup", {
            body: { email: email.trim(), reason: reason.trim() },
            headers: { "X-CSRFToken": csrf },
            cache: "no-store",
            signal,
          }),
        ),
      );
      if (response.ok && data) {
        lookups.current += 1;
        setFound({ account: data, lookup: lookups.current });
        announce("Account found.");
        return;
      }
      if (response.status === 401) return await sessionGone();
      if (response.status === 404) {
        showNotice(NOT_FOUND);
        router.refresh(); // 404 is also the answer to a non-administrator: run the server guard again
        return;
      }
      const fields = response.status === 400 ? readErrorBody(error)?.fields : undefined;
      if (fields?.email || fields?.reason) {
        return showErrors({
          email: fields.email ? "Enter a valid email address." : undefined,
          reason: fields.reason ? reasonMessage(fields.reason[0], LOOKUP_REASON) : undefined,
        });
      }
      showNotice(failureMessage(response.status, response.headers.get("Retry-After")));
    } catch (thrown) {
      showNotice(thrownMessage(thrown));
    } finally {
      running.current = false;
      setSearching(false);
    }
  }

  function onChanged(next: AccountStatus) {
    setNotice("");
    setFound((prev) => prev && { ...prev, account: { ...prev.account, ...next } });
    announce(next.state === "suspended" ? "The account is now suspended." : "The account has been reactivated.");
  }

  const account = found?.account;
  return (
    <>
      <h1 className="page-title">Accounts</h1>
      <Directory />
      <h2 className="section-title">Look up by email</h2>
      <p className="muted">Look up an Individual or Agency account to suspend or reactivate it. Every lookup is recorded with your reason.</p>
      {/* The one live region of this page. */}
      <p role="status" aria-live="polite" className={announcement && !notice ? "muted" : "sr-only"} data-testid="accounts-status">
        {announcement}
      </p>
      <form className="card" noValidate onSubmit={(event) => void onSubmit(event)} aria-label="Account lookup" style={{ marginBottom: "var(--space)" }}>
        <Field name="email" label="Email address of the account" errors={errors.email ? [errors.email] : undefined}>
          {(props) => <input {...props} ref={emailInput} type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} />}
        </Field>
        <Field
          name="lookup-reason"
          label="Reason for the lookup"
          hint="10 to 300 characters, without contact details."
          errors={errors.reason ? [errors.reason] : undefined}
        >
          {(props) => <input {...props} ref={reasonInput} type="text" autoComplete="off" value={reason} onChange={(event) => setReason(event.target.value)} />}
        </Field>
        <button type="submit" className="primary-button" aria-disabled={searching || undefined}>
          {searching ? "Looking up…" : "Look up"}
        </button>
      </form>
      {notice && (
        <p ref={noticeRef} tabIndex={-1} className="state-note" data-testid="accounts-notice">
          {notice}
        </p>
      )}
      {found && account && (
        <section className="card" aria-labelledby="account-title">
          <h2 id="account-title" ref={resultHeading} tabIndex={-1} className="section-title account-text">
            {account.display_name || account.email}
          </h2>
          <dl className="account-details">
            <dt>Email</dt>
            <dd>{account.email}</dd>
            <dt>Account type</dt>
            <dd>{typeLabel(account.account_type)}</dd>
            <dt>State</dt>
            <dd data-testid="account-state">{account.state === "suspended" ? "Suspended" : (STATE_LABELS[account.state] ?? account.state)}</dd>
            <dt>Email verified</dt>
            <dd>{account.email_verified ? "Yes" : "No"}</dd>
            {account.state === "suspended" && (
              <>
                <dt>Suspension reason</dt>
                <dd data-testid="account-suspension-reason">{account.suspension_reason || "None recorded"}</dd>
                {account.suspended_at && (
                  <>
                    <dt>Suspended on</dt>
                    <dd>{formatDate(account.suspended_at)}</dd>
                  </>
                )}
              </>
            )}
          </dl>
          {account.state !== "deactivated" && (
            <AccountAction
              key={`${found.lookup}-${account.state}`}
              account={account}
              onChanged={(next) => {
                onChanged(next);
                requestAnimationFrame(focusResult);
              }}
              onStart={resetAnnouncement}
              onSessionGone={sessionGone}
              onUnavailable={(message) => {
                // The card no longer describes the account: drop it and say why.
                setFound(null);
                showNotice(message);
                router.refresh();
              }}
            />
          )}
        </section>
      )}
    </>
  );
}
