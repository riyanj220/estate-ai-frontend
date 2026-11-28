"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAiNotice } from "@/components/ai-notice";
import { VoiceSearch } from "@/components/voice-search";
import { getApi } from "@/lib/api";
import { withCsrf } from "@/lib/csrf";
import { REJECTED_ERROR, withTimeout } from "@/lib/forms";
import { browseHref } from "@/lib/listing-filters";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { SEARCH_MAX_CHARS, readSearchAnswer, type SearchAnswer } from "@/lib/search";

// The typed request survives a full page load (the filter form is one) in this tab only. It is never put in an address.
const STORAGE_KEY = "estateai.search-text";
const USE_FILTERS = "You can use the filters below instead.";

type Outcome = { kind: "idle" } | { kind: "failed"; message: string; unsupported: string[] } | { kind: "searched"; answer: SearchAnswer };

/**
 * Search in plain words (Stories 6.1 and 6.2). One AI call turns the request into filters, which become the page address: the results,
 * the removable filter entries and every later change are the ordinary filters, with no AI. The input has no `name`, so even a native
 * submit before the page is ready sends no text. A spoken request (Story 6.3) only fills the box.
 */
export function SearchBox({ path }: { path: string }) {
  const router = useRouter();
  const { withNotice, notice } = useAiNotice();
  const input = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const [working, setWorking] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    try {
      const kept = window.sessionStorage.getItem(STORAGE_KEY);
      if (kept && input.current && !input.current.value) input.current.value = kept;
    } catch {
      // storage is a convenience only
    }
  }, []);

  function keep(text: string) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, text);
    } catch {
      // storage is a convenience only
    }
  }

  /** A spoken request lands in the box, to be read and edited: nothing is searched until Search is pressed. */
  function heard(text: string) {
    if (!input.current) return;
    input.current.value = text.slice(0, SEARCH_MAX_CHARS);
    keep(input.current.value);
    setEmpty(false);
    setOutcome({ kind: "idle" });
    input.current.focus();
  }

  const fail = (message: string, unsupported: string[] = []) => setOutcome({ kind: "failed", message, unsupported });

  async function search(query: string) {
    if (running.current) return;
    running.current = true;
    setWorking(true);
    setOutcome({ kind: "idle" });
    try {
      const api = await getApi();
      // Longer than the server's own 12 second limit on the AI call.
      const { data, response } = await withCsrf((csrf) =>
        withTimeout((signal) => api.POST("/api/v1/public/search", { body: { query }, headers: { "X-CSRFToken": csrf }, signal })),
      );
      if (!response.ok) return fail(`${failureMessage(response.status, response.headers.get("Retry-After"))} ${USE_FILTERS}`);
      const answer = readSearchAnswer(data);
      if (!answer) return fail(`${REJECTED_ERROR} ${USE_FILTERS}`);
      if (!answer.interpreted) return fail(answer.message || `${REJECTED_ERROR} ${USE_FILTERS}`, answer.unsupported);
      setOutcome({ kind: "searched", answer });
      router.push(browseHref(path, answer.params), { scroll: false });
    } catch (error) {
      fail(`${thrownMessage(error)} ${USE_FILTERS}`);
    } finally {
      running.current = false;
      setWorking(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const query = input.current?.value.trim() ?? "";
    setEmpty(!query);
    if (!query) return input.current?.focus();
    keep(query);
    withNotice(() => void search(query));
  }

  const unsupported = outcome.kind === "searched" ? outcome.answer.unsupported : outcome.kind === "failed" ? outcome.unsupported : [];

  return (
    <section className="card filter-form search-composer" aria-label="Search by description" data-testid="search-box">
      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="search-text">Describe what you are looking for</label>
          <p className="hint" id="search-hint">
            For example: house for sale in Clifton under 5 crore, at least 4 bedrooms, near a park.
          </p>
          {empty && (
            <p className="field-error" id="search-error">
              Describe what you are looking for.
            </p>
          )}
          <div className="composer-row">
          <input
            ref={input}
            id="search-text"
            type="text"
            maxLength={SEARCH_MAX_CHARS}
            autoComplete="off"
            enterKeyHint="search"
            aria-describedby={empty ? "search-error search-hint" : "search-hint"}
            aria-invalid={empty || undefined}
            onChange={(event) => keep(event.target.value)}
          />
            <VoiceSearch withNotice={withNotice} onTranscript={heard} />
            <button type="submit" className="primary-button composer-submit" aria-disabled={working || undefined}>
              Search
            </button>
          </div>
        </div>
      </form>
      <div role="status" className="composer-status">
        {working && (
          <p data-testid="search-progress" className="busy-line">
            <span className="spinner" aria-hidden="true" />
            Reading your request…
          </p>
        )}
        {outcome.kind === "failed" && <p data-testid="search-fallback">{outcome.message}</p>}
        {outcome.kind === "searched" && (
          <p data-testid="search-understood">
            {outcome.answer.params.size > 0
              ? "Your request is now the filters below. Remove or change any of them; that does not use AI."
              : "None of your request could be used as a filter, so all listings are shown."}
          </p>
        )}
        {unsupported.length > 0 && (
          <div data-testid="search-unsupported">
            <p>Not searched for:</p>
            <ul>
              {unsupported.map((phrase) => (
                <li key={phrase}>{phrase}</li>
              ))}
            </ul>
          </div>
        )}
        {outcome.kind === "searched" &&
          outcome.answer.notices.map((text) => (
            <p className="hint" key={text}>
              {text}
            </p>
          ))}
      </div>
      {notice}
    </section>
  );
}
