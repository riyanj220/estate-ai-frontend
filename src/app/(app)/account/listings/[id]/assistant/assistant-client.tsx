"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAiNotice } from "@/components/ai-notice";
import { getApi } from "@/lib/api";
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
} from "@/lib/assistant";
import { withCsrf } from "@/lib/csrf";
import { withTimeout } from "@/lib/forms";
import { newIdempotencyKey } from "@/lib/idempotency";
import { detailLabel } from "@/lib/listing-details";
import { isListingId } from "@/lib/listing-labels";
import { LISTINGS_PATH, LISTING_NOT_FOUND, signInPathFor } from "@/lib/listing-messages";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { useSession } from "@/lib/session";
import { usePageshowRecheck } from "@/lib/use-pageshow-recheck";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/use-profile-load";

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
    <>
      <h1 id={HEADING_ID} tabIndex={-1} className="page-title">
        Listing assistant
      </h1>
      <p>
        <Link href={manual} className="text-link">
          Switch to the manual form
        </Link>
      </p>
      {load.kind !== "ready" ? (
        <ProfileLoadState load={load} onRetry={retry} noun="assistant" determiner="the" />
      ) : "refusal" in load.profile ? (
        <p className="card" data-testid="assistant-refusal">
          {load.profile.refusal}
        </p>
      ) : (
        <Chat key={load.profile.session.id} session={load.profile.session} manual={manual} signInPath={signInPath} onSessionGone={sessionGone} />
      )}
    </>
  );
}

function Turn({ message, turn }: { message: string; turn?: AssistantTurn }) {
  const { reply, sources, applied, notices } = turn ?? {};
  return (
    <li className="card" data-testid="chat-turn">
      <p className="chat-text">
        <strong>You: </strong>
        {message}
      </p>
      {reply !== undefined && (
        <p className="chat-text" data-testid="chat-reply">
          <strong>Assistant: </strong>
          {reply}
        </p>
      )}
      {applied && applied.length > 0 && (
        <div data-testid="chat-applied">
          <p>{SAVED_HEADING}</p>
          <ul>
            {applied.map((item) => (
              <li key={item.field} className="chat-text">
                {appliedText(item)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {notices?.map((text, index) => (
        <p key={index} className="chat-text notice" data-testid="chat-notice">
          {text}
        </p>
      ))}
      {sources && sources.length > 0 && (
        <div className="muted" data-testid="chat-sources">
          <p>Sources</p>
          <ul>
            {sources.map((source, index) => (
              <li key={index}>
                {source.title} ({source.source})
              </li>
            ))}
          </ul>
          <p>{KNOWLEDGE_NOTICE}</p>
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
    <>
      <p className="muted">
        Ask about property terms or tell the assistant about your property. It fills in your draft for you to check; it cannot publish it.
        Do not type phone numbers, email addresses or street addresses: those go in the form.
      </p>
      <div role="log" aria-label="Conversation">
        <ol className="chat-list">
          {turns.map((turn) => (
            <Turn key={turn.id} message={turn.message} turn={turn} />
          ))}
          {sending !== null && <Turn message={sending} />}
        </ol>
      </div>
      <p role="status" className="muted" data-testid="chat-progress">
        {sending !== null ? "The assistant is replying…" : info}
      </p>
      {problem && (
        <p role="alert" className="notice" data-testid="chat-problem">
          {problem}
        </p>
      )}
      {problem && unanswered && (
        <p data-testid="chat-fallback">
          Your draft is unchanged by a message that was not answered.{" "}
          <Link href={manual} className="text-link">
            Continue in the manual form
          </Link>
        </p>
      )}
      {nextStep && (
        <div className="card" data-testid="chat-next">
          <p className="chat-text">
            <strong>{nextStep.kind === "review" ? "Ready to review: " : "Next: "}</strong>
            {nextStep.question}
          </p>
          {(nextStep.kind === "review" || nextStep.in_form) && (
            <p>
              <Link href={nextStep.kind === "review" ? `${manual}/review` : manual} className="text-link">
                {nextStep.kind === "review" ? "Review your listing" : "Open the form"}
              </Link>
            </p>
          )}
        </div>
      )}
      {summary.length > 0 && (
        <div className="card" data-testid="chat-summary">
          <p>On your listing so far:</p>
          <ul>
            {summary.map((fact) => (
              <li key={fact.field} className="chat-text">
                {detailLabel(fact.field)}: {fact.value}
                {!fact.confirmed && " (not confirmed)"}
              </li>
            ))}
          </ul>
          <p>
            <Link href={`${manual}/review`} className="text-link">
              Check and confirm these
            </Link>
          </p>
        </div>
      )}
      <form method="post" onSubmit={onSubmit} noValidate className="card" aria-busy={sending !== null}>
        <div className="field">
          <label htmlFor="chat-message">Your message</label>
          <p id="chat-message-hint" className="hint">
            Up to 2,000 characters.
          </p>
          <textarea
            id="chat-message"
            ref={box}
            rows={3}
            maxLength={MAX_MESSAGE}
            aria-describedby="chat-message-hint"
            readOnly={sending !== null}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <button type="submit" className="primary-button" aria-disabled={sending !== null ? true : undefined}>
          Send
        </button>
      </form>
      {notice}
    </>
  );
}
