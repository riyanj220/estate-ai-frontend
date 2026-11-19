"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getApi } from "@/lib/api";
import { readErrorBody, withTimeout } from "@/lib/forms";
import { RequestLinkForm } from "./request-link-form";

type State = "pending" | "success" | "link_expired" | "link_used" | "link_invalid" | "missing" | "retry";

const FAILURES: Record<"link_expired" | "link_used" | "link_invalid" | "missing", { title: string; text: string }> = {
  link_expired: {
    title: "This link has expired",
    text: "Verification links work for 24 hours. Request a new link below.",
  },
  link_used: {
    title: "This link was already used or replaced",
    text: "If you already verified your email address, you can sign in once sign-in is available. Otherwise request a new link below; only the newest link works.",
  },
  link_invalid: {
    title: "This link is not valid",
    text: "The link may be incomplete or mistyped. Request a new link below.",
  },
  missing: {
    title: "This link is not valid",
    text: "The link has no verification code. If you reloaded this page, open the link from your email again; otherwise request a new link below.",
  },
};

export function VerifyEmailClient() {
  const [state, setState] = useState<State>("pending");
  const token = useRef<string | null>(null);
  const started = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  async function confirm() {
    setState("pending");
    try {
      const api = await getApi();
      const { error, response } = await withTimeout((signal) =>
        api.POST("/api/v1/email-verifications/confirm", { body: { token: token.current ?? "" }, signal }),
      );
      if (response.ok) return setState("success");
      if (response.status >= 500) return setState("retry");
      const code = readErrorBody(error)?.code;
      if (code === "link_expired" || code === "link_used" || code === "link_invalid") return setState(code);
      setState("retry");
    } catch {
      setState("retry");
    }
  }

  useEffect(() => {
    // The ref guard keeps strict mode and re-renders to a single request; the token never leaves memory.
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    token.current = params.get("token")?.trim() || null;
    if (params.has("token")) {
      params.delete("token");
      const query = params.toString();
      history.replaceState(history.state, "", window.location.pathname + (query ? `?${query}` : "") + window.location.hash);
    }
    if (token.current === null) setState("missing");
    else void confirm();
  }, []);

  useEffect(() => {
    if (state !== "pending") headingRef.current?.focus();
  }, [state]);

  if (state === "pending") {
    return (
      <section className="card" aria-labelledby="result-title">
        <h2 id="result-title" className="section-title">
          Confirming your email address
        </h2>
        <p role="status" aria-live="polite" className="muted">
          Please wait a moment.
        </p>
      </section>
    );
  }

  if (state === "success") {
    return (
      <section className="card" aria-labelledby="result-title">
        <h2 id="result-title" tabIndex={-1} ref={headingRef} className="section-title">
          Email verified
        </h2>
        <p role="status" className="muted">
          Thank you. Your email address is confirmed and your account is ready.
        </p>
        <Link href="/" className="text-link">
          Go to the home page
        </Link>
      </section>
    );
  }

  if (state === "retry") {
    return (
      <>
      <section className="card" aria-labelledby="result-title">
        <h2 id="result-title" tabIndex={-1} ref={headingRef} className="section-title">
          We could not confirm your email address
        </h2>
        <p role="alert" className="muted">
          Something went wrong, so we could not check your link. Try again; if it keeps failing, request a new link below.
        </p>
        <button type="button" className="primary-button" onClick={() => void confirm()}>
          Try again
        </button>
      </section>
      <RequestLinkForm />
    </>
    );
  }

  const failure = FAILURES[state];
  return (
    <>
      <section className="card" aria-labelledby="result-title">
        <h2 id="result-title" tabIndex={-1} ref={headingRef} className="section-title">
          {failure.title}
        </h2>
        <p role="alert" className="muted">
          {failure.text}
        </p>
      </section>
      <RequestLinkForm />
    </>
  );
}
