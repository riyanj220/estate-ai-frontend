"use client";

import { useCallback, useState } from "react";
import type { components } from "@/api/schema";
import { Field, PasswordField } from "@/components/form-field";
import { getApi } from "@/lib/api";
import { useAdminRead, useAdminWrite } from "../moderation-shared";

type Status = components["schemas"]["SecondFactor"];
type Secret = components["schemas"]["SecondFactorSecret"];

/**
 * Optional second factor (Story 10.10): the password, then the secret to type into an authenticator app, then a first
 * code. The secret is held in memory only. There is no QR code and no way to turn it off here.
 */
export function SecondFactorClient() {
  const send = useCallback(async (signal: AbortSignal) => (await getApi()).GET("/api/v1/admin/second-factor", { cache: "no-store", signal }), []);
  const { data, failure, reload, gone } = useAdminRead<Status>(send, "/admin/second-factor");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState<Secret | null>(null);
  const [passwordError, setPasswordError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [notice, setNotice] = useState("");
  const { working, write } = useAdminWrite(gone, setNotice);

  function start(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError(password ? "" : "Enter your password.");
    if (!password) return;
    void write<Secret>(
      async (csrf, signal) => (await getApi()).POST("/api/v1/admin/second-factor/enrolment", { body: { password }, headers: { "X-CSRFToken": csrf }, cache: "no-store", signal }),
      {
        done: (found) => {
          setPassword("");
          setSecret(found);
        },
        field: "password",
        invalid: () => setPasswordError("The current password is incorrect."),
        conflict: () => void reload(),
      },
    );
  }

  function confirm(event: React.FormEvent) {
    event.preventDefault();
    setCodeError(code.trim() ? "" : "Enter the code.");
    if (!code.trim()) return;
    void write<Status>(
      async (csrf, signal) => (await getApi()).POST("/api/v1/admin/second-factor/confirm", { body: { code: code.trim() }, headers: { "X-CSRFToken": csrf }, cache: "no-store", signal }),
      {
        done: () => {
          setCode("");
          setSecret(null);
          void reload();
        },
        field: "code",
        invalid: () => setCodeError("That code is not valid. Enter the current code from your app."),
        conflict: () => {
          setSecret(null);
          void reload();
        },
      },
    );
  }

  const busy = working || undefined;
  return (
    <>
      <h1 className="page-title">Second factor</h1>
      <p className="muted">A one-time code from an authenticator app, asked for at administrator sign-in in addition to your password.</p>
      <p role="status" aria-live="polite" className={notice ? "state-note" : "sr-only"} data-testid="second-factor-notice">
        {notice}
      </p>
      {failure && (
        <div role="alert" className="card">
          <p>{failure}</p>
          <button type="button" className="secondary-button" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      )}
      {!failure && !data && <p className="muted">Loading…</p>}
      {data?.enrolled && (
        <section className="card" data-testid="second-factor-state">
          <p>Your second factor is on. Each code works once.</p>
          <p className="muted">If you lose the authenticator, a server operator must run the provisioning command to remove it.</p>
        </section>
      )}
      {data && !data.enrolled && !secret && (
        <form className="card" noValidate onSubmit={start} aria-label="Set up a second factor">
          <p data-testid="second-factor-state">Your second factor is off.</p>
          <PasswordField name="current-password" label="Current password" autoComplete="current-password" value={password} onChange={setPassword} errors={passwordError ? [passwordError] : undefined} />
          <button type="submit" className="primary-button" aria-disabled={busy}>
            Set up
          </button>
        </form>
      )}
      {data && !data.enrolled && secret && (
        <form className="card" noValidate onSubmit={confirm} aria-label="Confirm the second factor">
          <p>Add this key to your authenticator app (time-based, 6 digits), then enter the code it shows. The key is not shown again.</p>
          <dl className="account-details">
            <dt>Key</dt>
            <dd className="account-text" data-testid="second-factor-secret">
              {secret.secret}
            </dd>
            <dt>Setup address</dt>
            <dd className="account-text" style={{ wordBreak: "break-all" }}>
              {secret.otpauth_uri}
            </dd>
          </dl>
          <Field name="code" label="Code" errors={codeError ? [codeError] : undefined}>
            {(props) => <input {...props} type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} />}
          </Field>
          <button type="submit" className="primary-button" aria-disabled={busy}>
            Turn on
          </button>
        </form>
      )}
    </>
  );
}
