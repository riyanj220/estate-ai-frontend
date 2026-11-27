"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MessageForm } from "@/components/message-form";
import { useLiveEvents } from "@/lib/live";
import { READ_ONLY_NOTES, conversationPath, fetchThread, listingHeading, mergeMessages, resumeSeq, sendReply, type Message, type Thread } from "@/lib/messaging";
import { BROWSE_PATH } from "@/lib/public-listings";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/use-profile-load";

const HEADING_ID = "conversation-title";
const sentAt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

async function load(id: string): Promise<ProfileFetch<Thread>> {
  const result = await fetchThread(id);
  if (result.kind === "ok") return { kind: "ready", profile: result.thread };
  if (result.kind === "missing") return { kind: "forbidden" };
  return result.kind === "gone" ? "gone" : { kind: "error", message: result.message };
}

/**
 * One Conversation (Stories 7.1 and 7.3), read on the client behind the server guard. New Messages arrive live; the button that
 * checks for them stays for when the live connection is down.
 */
export function ConversationClient({ id }: { id: string }) {
  const { load: state, retry, sessionGone } = useResourceLoad<Thread>(() => load(id), HEADING_ID, {
    signInPath: `/sign-in?next=${encodeURIComponent(conversationPath(id))}`,
    refreshOnFocus: false,
  });
  const [latest, setLatest] = useState<Thread | null>(null);
  const [notice, setNotice] = useState("");

  const first = state.kind === "ready" ? state.profile : null;
  const thread = first && {
    conversation: latest?.conversation ?? first.conversation,
    messages: mergeMessages(first.messages, latest?.messages ?? []),
  };

  const held = useRef<Message[]>([]);
  useEffect(() => {
    held.current = thread?.messages ?? [];
  });
  // Live reads run one after another, so each starts from what the one before it brought.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const catchUp = () => {
    queue.current = queue.current.then(() => update(true, true)).catch(() => undefined);
  };
  const live = useLiveEvents(
    Boolean(thread),
    (event) => {
      if (event.type === "ready" || event.conversation_id === id) catchUp();
    },
    catchUp, // the read answers 401 if the session really is gone
  );

  /** Fetches what came after the newest Message on screen, and the header as it reads now. */
  async function update(quiet = false, announce = false): Promise<void> {
    if (!thread) return;
    const result = await fetchThread(id, resumeSeq(held.current));
    if (result.kind === "gone") return sessionGone();
    if (result.kind !== "ok") {
      if (!quiet) setNotice("We could not check for new messages. Try again.");
      return;
    }
    const { conversation, messages } = result.thread;
    const known = new Set(held.current.map((message) => message.seq));
    const arrived = messages.filter((message) => !known.has(message.seq));
    held.current = mergeMessages(held.current, messages);
    setLatest((shown) => ({ conversation, messages: mergeMessages(shown?.messages ?? [], messages) }));
    if (announce && arrived.some((message) => !message.mine)) setNotice("New message.");
    if (!quiet) setNotice(messages.length ? "New messages shown." : "No new messages.");
  }

  async function send(body: string, key: string): Promise<string> {
    setNotice("");
    const result = await sendReply(id, body, key);
    if (result.kind === "gone") {
      await sessionGone();
      return "";
    }
    if (result.kind === "failed") {
      await update(true); // the thread may have become read-only
      return result.message;
    }
    // The saved Message first; then whatever the other side wrote before it.
    await update(true);
    setLatest((shown) => shown && { ...shown, messages: mergeMessages(shown.messages, [result.message]) });
    setNotice("Message sent.");
    return "";
  }

  const conversation = thread?.conversation;
  const who = conversation?.counterpart_name ?? "Deleted user";
  return (
    <>
      <h1 id={HEADING_ID} tabIndex={-1} className="page-title">
        {conversation ? listingHeading(conversation) : "Conversation"}
      </h1>
      {state.kind === "forbidden" && (
        <p className="card" data-testid="conversation-missing">
          Conversation not found.{" "}
          <Link href={BROWSE_PATH} className="text-link">
            Back to browse
          </Link>
        </p>
      )}
      <ProfileLoadState load={state} onRetry={retry} noun="conversation" determiner="the" />
      {thread && conversation && (
        <section className="card" aria-label="Messages">
          <p className="muted" data-testid="conversation-with">
            Conversation with {who}
          </p>
          {conversation.listing.availability === "available" && (
            <p>
              <Link href={`${BROWSE_PATH}/${conversation.listing_id}`} className="text-link">
                View listing
              </Link>
            </p>
          )}
          <ol className="chat-list" data-testid="messages">
            {thread.messages.map((message) => (
              <li key={message.id}>
                <p className="muted">
                  {message.mine ? "You" : who} · <time dateTime={message.created_at}>{sentAt.format(new Date(message.created_at))}</time>
                </p>
                <p className="chat-text">{message.body}</p>
              </li>
            ))}
          </ol>
          <p className="muted" data-testid="live-status">
            {live === "live" ? "New messages appear as they arrive." : live === "off" ? "Live updates are paused. Check for new messages below." : "Connecting…"}
          </p>
          <p>
            <button type="button" className="secondary-button" onClick={() => void update()}>
              Check for new messages
            </button>
          </p>
          <p role="status" className={notice ? "muted" : "sr-only"} data-testid="conversation-status">
            {notice}
          </p>
          {conversation.read_only_reason ? (
            <p className="state-note" data-testid="conversation-read-only">
              {READ_ONLY_NOTES[conversation.read_only_reason]}
            </p>
          ) : (
            <MessageForm label="Reply" send={send} />
          )}
        </section>
      )}
    </>
  );
}
