"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getApi } from "@/lib/http/api";
import { readErrorBody, withTimeout } from "@/lib/forms/forms";
import { failureMessage, thrownMessage } from "@/lib/http/request-errors";
import { scrubTokenFromHistory } from "@/lib/auth/scrub-token";
import { useSession } from "@/lib/auth/session";

type LinkFailure = "link_expired" | "link_used" | "link_invalid" | "missing";
type State = "init" | "ready" | "success" | LinkFailure;

const FAILURES: Record<LinkFailure, { title: string; text: string }> = {
  link_expired: { title: "This link has expired", text: "Email change links work for 24 hours." },
  link_used: {
    title: "This link was already used or replaced",
    text: "Each link works once, and only the newest link works.",
  },
  link_invalid: { title: "This link is not valid", text: "The link may be incomplete or mistyped." },
  missing: {
    title: "This link is not valid",
    text: "The link has no confirmation code. If you reloaded this page, open the link from your email again.",
  },
};

export function ConfirmEmailChangeClient() {
  const { refresh } = useSession();
  const [state, setState] = useState<State>("init");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  // The token lives only here: never in state that renders, storage, logs or the address bar.
  const token = useRef<string | null>(null);
  const started = useRef(false);
  const submitting = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    // The ref guard keeps strict mode and re-renders to one read. Nothing is sent until the person presses the button.
    if (started.current) return;
    started.current = true;
    token.current = scrubTokenFromHistory() || null; // the address bar and the router state lose the token at once
    setState(token.current === null ? "missing" : "ready");
  }, []);

  useEffect(() => {
    if (state !== "init" && state !== "ready") headingRef.current?.focus();
  }, [state]);

  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  function end(next: State) {
    token.current = null; // a spent, expired or invalid link is never kept
    setState(next);
  }

  // The confirm is anonymous: the backend view ignores the session cookie, so no CSRF token is needed (no withCsrf).
  async function onConfirm() {
    const sent = token.current; // captured once: this call sends exactly the token it started with
    if (submitting.current || sent === null) return;
    setNotice("");
    submitting.current = true;
    setPending(true);
    try {
      const api = await getApi();
      const { error, response } = await withTimeout((signal) =>
        api.POST("/api/v1/email-changes/confirm", { body: { token: sent }, signal }),
      );
      if (response.ok) {
        end("success");
        refresh().catch(() => undefined); // the sign-in address changed: the header re-reads who is signed in
        return;
      }
      const code = readErrorBody(error)?.code;
      if (response.status === 400) return end("link_invalid"); // any 400 means this link cannot be used
      if (response.status === 410 && code === "link_expired") return end("link_expired");
      if (response.status === 409 && code === "link_used") return end("link_used");
      setNotice(failureMessage(response.status, response.headers.get("Retry-After")));
    } catch (error) {
      setNotice(thrownMessage(error));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  if (state === "init") {
    return (
      <section className="card" aria-labelledby="result-title">
        <h2 id="result-title" className="section-title">
          Checking your link
        </h2>
        <p className="muted">Please wait a moment.</p>
      </section>
    );
  }

  if (state === "success") {
    return (
      <section className="card" aria-labelledby="result-title">
        <h2 id="result-title" tabIndex={-1} ref={headingRef} className="section-title">
          Email address changed
        </h2>
        <p>Your sign-in email address was changed. Use the new address to sign in next time.</p>
        <p>
          <Link href="/sign-in" className="text-link">
            Sign in
          </Link>
        </p>
        <p>
          <Link href="/account/profile" className="text-link">
            Go to your profile
          </Link>
        </p>
      </section>
    );
  }

  if (state !== "ready") {
    const failure = FAILURES[state];
    return (
      <section className="card" aria-labelledby="result-title">
        <h2 id="result-title" tabIndex={-1} ref={headingRef} className="section-title">
          {failure.title}
        </h2>
        <p className="muted">{failure.text}</p>
        <Link href="/account/profile" className="text-link">
          Request the change again
        </Link>
      </section>
    );
  }

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {pending ? "Confirming the change." : ""}
      </div>
      {notice && (
        <p ref={noticeRef} tabIndex={-1} role="alert" className="notice" data-testid="form-notice">
          {notice}
        </p>
      )}
      <section className="card" aria-labelledby="result-title" aria-busy={pending}>
        <h2 id="result-title" className="section-title">
          Confirm the change
        </h2>
        <p className="muted">Press the button to make this your sign-in email address.</p>
        <button type="button" className="primary-button" onClick={() => void onConfirm()} disabled={pending}>
          {pending ? "Confirming…" : "Confirm the change"}
        </button>
      </section>
    </>
  );
}
