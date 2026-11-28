"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAiNotice } from "@/components/ai/ai-notice";
import { Composer } from "@/components/chat/composer";
import { TypingDots } from "@/components/chat/typing-dots";
import { getApi } from "@/lib/http/api";
import {
  ASSISTANT_FORBIDDEN,
  FAILED_OUTCOME_MESSAGES,
  KNOWLEDGE_NOTICE,
  MAX_MESSAGE,
  MESSAGE_REFUSED,
  MESSAGE_REQUIRED,
  NOT_A_DRAFT,
  NO_EXPLANATIONS,
  SAVED_HEADING,
  SEND_CONFLICT,
  TURN_TIMEOUT_MS,
  appliedText,
  readNextStep,
  readSession,
  readSummary,
  readTurn,
  type AssistantSession,
  type AssistantTurn,
} from "@/lib/ai/assistant";
import { withCsrf } from "@/lib/http/csrf";
import { withTimeout } from "@/lib/forms/forms";
import { newIdempotencyKey } from "@/lib/http/idempotency";
import { detailLabel } from "@/lib/listing/listing-details";
import { isListingId } from "@/lib/listing/listing-labels";
import { LISTINGS_PATH, LISTING_NOT_FOUND, signInPathFor } from "@/lib/listing/listing-messages";
import { failureMessage, thrownMessage } from "@/lib/http/request-errors";
import { useSession } from "@/lib/auth/session";
import { usePageshowRecheck } from "@/lib/auth/use-pageshow-recheck";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/account/use-profile-load";

const HEADING_ID = "assistant-title";

type Opened = { session: AssistantSession } | { refusal: string };

/** Creates or opens the Draft's session; the backend keeps one per Draft, so asking again is safe. */
async function openSession(id: string): Promise<ProfileFetch<Opened>> {
  if (!isListingId(id)) return { kind: "ready", profile: { refusal: LISTING_NOT_FOUND } };
  try {
    const api = await getApi();
    const { data, response } = await withCsrf((csrf) =>
      withTimeout((signal) =>
        api.POST("/api/v1/assistant/sessions", { body: { listing_id: id }, headers: { "X-CSRFToken": csrf }, signal }),
      ),
    );
    if (response.ok) {
      const session = readSession(data);
      return session ? { kind: "ready", profile: { session } } : { kind: "error" };
    }
    if (response.status === 401) return "gone";
    if (response.status === 400 || response.status === 404) return { kind: "ready", profile: { refusal: LISTING_NOT_FOUND } };
    if (response.status === 403) return { kind: "ready", profile: { refusal: ASSISTANT_FORBIDDEN } };
    if (response.status === 409) return { kind: "ready", profile: { refusal: NOT_A_DRAFT } };
    return { kind: "error", message: failureMessage(response.status, response.headers.get("Retry-After")) };
  } catch (error) {
    return { kind: "error", message: thrownMessage(error) };
  }
}

/**
 * The chat of one Draft (Story 5.8). The manual form is one link away at any time: it edits the same Draft. Messages and replies
 * are rendered as plain text, and nothing is stored in the browser.
 */
export function AssistantClient({ id, admin }: { id: string; admin: boolean }) {
  const signInPath = signInPathFor(`${LISTINGS_PATH}/${id}/assistant`, admin);
  const { load, read, retry, sessionGone } = useResourceLoad<Opened>(() => openSession(id), HEADING_ID, {
    signInPath,
    refreshOnFocus: false,
  });
  usePageshowRecheck(signInPath, () => void read(false));
  const manual = isListingId(id) ? `${LISTINGS_PATH}/${id}` : LISTINGS_PATH;
  return (
    <div className="app-wide">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-[linear-gradient(120deg,var(--color-accent-strong),#2c5a46)] text-[1.375rem] text-white">
            ✦
          </span>
          <h1 id={HEADING_ID} tabIndex={-1} className="page-title mb-0 tracking-[-0.02em]">
            Listing assistant
          </h1>
        </div>
        <Link href={manual} className="secondary-button inline-flex items-center no-underline">
          Switch to the manual form
        </Link>
      </div>
      {load.kind !== "ready" ? (
        <ProfileLoadState load={load} onRetry={retry} noun="assistant" determiner="the" />
      ) : "refusal" in load.profile ? (
        <p className="card" data-testid="assistant-refusal">
          {load.profile.refusal}
        </p>
      ) : (
        <Chat key={load.profile.session.id} session={load.profile.session} manual={manual} signInPath={signInPath} onSessionGone={sessionGone} />
      )}
    </div>
  );
}

// The two sides of the chat.
const MINE = "ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-md bg-accent px-4 py-2.5 text-white";
const THEIRS = "w-fit max-w-[85%] rounded-3xl rounded-bl-md border border-line bg-surface px-4 py-3";

function Turn({ message, turn }: { message: string; turn?: AssistantTurn }) {
  const { reply, sources, applied, notices } = turn ?? {};
  return (
    <li className="grid gap-3" data-testid="chat-turn">
      <p className={`chat-text ${MINE}`}>
        <strong className="sr-only">You: </strong>
        {message}
      </p>
      {turn && (
        <div className={`grid gap-3 ${THEIRS}`}>
          {reply !== undefined && (
            <p className="chat-text" data-testid="chat-reply">
              <strong className="sr-only">Assistant: </strong>
              {reply}
            </p>
          )}
          {applied && applied.length > 0 && (
            <div className="rounded-xl bg-accent-soft p-3 text-[0.9375rem]" data-testid="chat-applied">
              <p className="font-semibold text-accent">{SAVED_HEADING}</p>
              <ul className="mt-1 grid list-none gap-0.5 p-0">
                {applied.map((item) => (
                  <li key={item.field} className="chat-text before:text-accent before:content-['✓_'_/_'']">
                    {appliedText(item)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {notices?.map((text, index) => (
            <p key={index} className="chat-text rounded-xl bg-sand p-3 text-[0.875rem]" data-testid="chat-notice">
              {text}
            </p>
          ))}
          {sources && sources.length > 0 && (
            <div className="border-t border-line pt-2 text-[0.8125rem] text-muted" data-testid="chat-sources">
              <p className="font-semibold">Sources</p>
              <ul className="list-disc pl-5">
                {sources.map((source, index) => (
                  <li key={index}>
                    {source.title} ({source.source})
                  </li>
                ))}
              </ul>
              <p className="mt-1">{KNOWLEDGE_NOTICE}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Chat({
  session,
  manual,
  signInPath,
  onSessionGone,
}: {
  session: AssistantSession;
  manual: string;
  signInPath: string;
  onSessionGone: () => Promise<void>;
}) {
  const router = useRouter();
  const { account } = useSession();
  const { withNotice, notice } = useAiNotice();
  const [turns, setTurns] = useState<AssistantTurn[]>(session.turns);
  const [nextStep, setNextStep] = useState(() => readNextStep(session.next_step));
  const [summary, setSummary] = useState(() => readSummary(session.summary));
  const [text, setText] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const [info, setInfo] = useState("");
  const [unanswered, setUnanswered] = useState(false); // a message got no answer: offer the manual form beside the reason
  const box = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  // The same message sent again after an unknown result keeps its id, so the server answers it only once.
  const attempt = useRef<{ text: string; id: string } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The newest message stays in view.
  useEffect(() => {
    const log = scroller.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [turns.length, sending]);

  async function send(message: string) {
    if (busy.current) return;
    busy.current = true;
    setSending(message);
    setProblem("");
    setInfo("");
    setUnanswered(false);
    if (attempt.current?.text !== message) attempt.current = { text: message, id: newIdempotencyKey() };
    // The server takes a UUID; the fallback key is 32 hex digits, which is one without its hyphens.
    const key = attempt.current.id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
    try {
      const api = await getApi();
      const { data, response } = await withCsrf((csrf) =>
        withTimeout(
          (signal) =>
            api.POST("/api/v1/assistant/sessions/{session_id}/turns", {
              params: { path: { session_id: session.id } },
              body: { message, client_turn_id: key },
              headers: { "X-CSRFToken": csrf },
              signal,
            }),
          TURN_TIMEOUT_MS,
        ),
      );
      if (!mounted.current) return;
      if (response.status === 200) {
        const turn = readTurn(data?.turn);
        if (data?.outcome === "success" && turn) {
          setTurns((current) => [...current.filter((item) => item.id !== turn.id), turn]);
          setNextStep(readNextStep(data.next_step));
          setSummary(readSummary(data.summary));
          setText("");
          attempt.current = null;
          if (data.message) setInfo(NO_EXPLANATIONS);
          return;
        }
        const outcome = data?.outcome;
        setProblem(FAILED_OUTCOME_MESSAGES[outcome && outcome !== "success" ? outcome : "error"]);
        setUnanswered(true);
        return;
      }
      if (response.status === 401) {
        await onSessionGone();
        router.replace(signInPath);
        return;
      }
      if (response.status === 422) attempt.current = null;
      if (response.status === 400) setProblem(MESSAGE_REFUSED);
      else if (response.status === 403 && account?.state === "suspended") setProblem(ASSISTANT_FORBIDDEN);
      else if (response.status === 404) setProblem(LISTING_NOT_FOUND);
      else if (response.status === 409) setProblem(SEND_CONFLICT);
      else {
        setProblem(failureMessage(response.status, response.headers.get("Retry-After")));
        setUnanswered(true);
      }
    } catch (error) {
      if (mounted.current) {
        setProblem(thrownMessage(error));
        setUnanswered(true);
      }
    } finally {
      busy.current = false;
      if (mounted.current) setSending(null);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const message = text.trim();
    box.current?.focus();
    if (!message) {
      setUnanswered(false);
      setProblem(MESSAGE_REQUIRED);
      return;
    }
    withNotice(() => void send(message));
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="flex h-[calc(100vh-15rem)] min-h-[32rem] min-w-0 flex-col overflow-hidden rounded-large border border-line bg-surface" aria-label="Chat with the assistant">
        <div ref={scroller} role="log" aria-label="Conversation" tabIndex={0} className="min-h-0 flex-1 overflow-y-auto bg-bg/60 p-5">
          <p className={`mb-4 ${THEIRS}`}>
            Ask about property terms or tell the assistant about your property. It fills in your draft for you to check; it cannot publish it.
            Do not type phone numbers, email addresses or street addresses: those go in the form.
          </p>
          <ol className="grid list-none gap-4 p-0">
            {turns.map((turn) => (
              <Turn key={turn.id} message={turn.message} turn={turn} />
            ))}
            {sending !== null && <Turn message={sending} />}
          </ol>
          <div className={sending !== null || info ? `mt-3 flex items-center gap-3 ${THEIRS}` : "sr-only"}>
            {sending !== null && <TypingDots />}
            <p role="status" className="text-[0.875rem] text-muted" data-testid="chat-progress">
              {sending !== null ? "The assistant is replying…" : info}
            </p>
          </div>
        </div>
        <div className="border-t border-line p-4" aria-busy={sending !== null}>
          {problem && (
            <p role="alert" className="mb-2 text-[0.875rem] font-semibold text-error" data-testid="chat-problem">
              {problem}
            </p>
          )}
          {problem && unanswered && (
            <p className="mb-2 text-[0.875rem]" data-testid="chat-fallback">
              Your draft is unchanged by a message that was not answered.{" "}
              <Link href={manual} className="text-link">
                Continue in the manual form
              </Link>
            </p>
          )}
          <Composer
            id="chat-message"
            label="Your message"
            box={box}
            value={text}
            onChange={setText}
            onSubmit={onSubmit}
            problem=""
            hint="Up to 2,000 characters. Enter sends; Shift and Enter starts a new line."
            busy={sending !== null}
            busyLabel="Send"
            readOnly={sending !== null}
            maxLength={MAX_MESSAGE}
          />
        </div>
      </section>
      <aside className="grid gap-4 lg:sticky lg:top-24">
        {nextStep && (
          <div className="rounded-large bg-accent-soft p-5" data-testid="chat-next">
            <p className="chat-text">
              <strong className="text-accent">{nextStep.kind === "review" ? "Ready to review: " : "Next: "}</strong>
              {nextStep.question}
            </p>
            {(nextStep.kind === "review" || nextStep.in_form) && (
              <p className="mt-2">
                <Link href={nextStep.kind === "review" ? `${manual}/review` : manual} className="text-link font-semibold">
                  {nextStep.kind === "review" ? "Review your listing" : "Open the form"}
                </Link>
              </p>
            )}
          </div>
        )}
        {summary.length > 0 && (
          <div className="card" data-testid="chat-summary">
            <p className="mb-2 font-serif text-[1.125rem] font-semibold">On your listing so far:</p>
            <ul className="mb-3 list-none divide-y divide-line p-0 text-[0.9375rem]">
              {summary.map((fact) => (
                <li key={fact.field} className="chat-text py-2">
                  {detailLabel(fact.field)}: {fact.value}
                  {!fact.confirmed && " (not confirmed)"}
                </li>
              ))}
            </ul>
            <p>
              <Link href={`${manual}/review`} className="text-link font-semibold">
                Check and confirm these
              </Link>
            </p>
          </div>
        )}
      </aside>
      {notice}
    </div>
  );
}
