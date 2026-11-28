"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bubble } from "@/components/chat/bubble";
import { MessageForm } from "@/components/messaging/message-form";
import { ReportConversation } from "@/components/messaging/report-conversation";
import { useLiveEvents } from "@/lib/messaging/live";
import { INBOX_PATH, READ_ONLY_NOTES, conversationPath, fetchThread, listingHeading, markRead, mergeMessages, resumeSeq, sendReply, type Message, type Thread } from "@/lib/messaging/messaging";
import { BROWSE_PATH } from "@/lib/listing/public-listings";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/account/use-profile-load";

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
  // Opening the thread reads it (Story 7.5): the other side's newest Message is marked once it is on a visible page.
  const incoming = thread?.messages.reduce((last, message) => (message.mine ? last : Math.max(last, message.seq)), 0) ?? 0;
  const readOnServer = thread ? thread.conversation.last_seq - thread.conversation.unread_count : 0;
  const marked = useRef(0);
  useEffect(() => {
    const mark = () => {
      if (document.visibilityState !== "visible" || incoming <= Math.max(readOnServer, marked.current)) return;
      const before = marked.current;
      marked.current = incoming;
      void markRead(id, incoming).then((saved) => {
        if (!saved) marked.current = before; // tried again on the next change or return to the tab
      });
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    window.addEventListener("focus", mark);
    return () => {
      document.removeEventListener("visibilitychange", mark);
      window.removeEventListener("focus", mark);
    };
  }, [id, incoming, readOnServer]);

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

  // The newest message stays in view.
  const scroller = useRef<HTMLDivElement>(null);
  const count = thread?.messages.length ?? 0;
  useEffect(() => {
    const box = scroller.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [count]);

  const conversation = thread?.conversation;
  const who = conversation?.counterpart_name ?? "Deleted user";
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3">
        <div className="min-w-0">
          <h1 id={HEADING_ID} tabIndex={-1} className="truncate font-serif text-[1.25rem] font-semibold">
            {conversation ? listingHeading(conversation) : "Conversation"}
          </h1>
          {conversation && (
            <p className="text-[0.8125rem] text-muted" data-testid="conversation-with">
              Conversation with {who}
            </p>
          )}
        </div>
        <p className="flex gap-4 text-[0.875rem]">
          {conversation && conversation.listing.availability === "available" && (
            <Link href={`${BROWSE_PATH}/${conversation.listing_id}`} className="text-link inline-flex min-h-11 items-center font-semibold">
              View listing
            </Link>
          )}
          <Link href={INBOX_PATH} className="text-link inline-flex min-h-11 items-center">
            All messages
          </Link>
        </p>
      </header>
      {state.kind === "forbidden" && (
        <p className="p-5" data-testid="conversation-missing">
          Conversation not found.{" "}
          <Link href={BROWSE_PATH} className="text-link">
            Back to browse
          </Link>
        </p>
      )}
      <ProfileLoadState load={state} onRetry={retry} noun="conversation" determiner="the" />
      {thread && conversation && (
        <section className="flex min-h-0 flex-1 flex-col" aria-label="Messages">
          <div ref={scroller} tabIndex={0} role="group" aria-label="Message history" className="min-h-40 flex-1 overflow-y-auto bg-bg/50 px-5 py-4">
            <ol className="grid list-none gap-3 p-0" data-testid="messages">
              {thread.messages.map((message) => (
                <Bubble
                  key={message.id}
                  mine={message.mine}
                  meta={
                    <>
                      {message.mine ? "You" : who} · <time dateTime={message.created_at}>{sentAt.format(new Date(message.created_at))}</time>
                    </>
                  }
                >
                  {message.body}
                </Bubble>
              ))}
            </ol>
          </div>
          <div className="border-t border-line px-5 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 text-[0.8125rem] text-muted">
              <p data-testid="live-status">
                {live === "live" ? "New messages appear as they arrive." : live === "off" ? "Live updates are paused. Check for new messages below." : "Connecting…"}
              </p>
              <button type="button" className="text-link min-h-11 cursor-pointer font-semibold" onClick={() => void update()}>
                Check for new messages
              </button>
            </div>
            <p role="status" className={notice ? "mb-2 text-[0.8125rem] text-muted" : "sr-only"} data-testid="conversation-status">
              {notice}
            </p>
            {conversation.read_only_reason ? (
              <p className="state-note" data-testid="conversation-read-only">
                {READ_ONLY_NOTES[conversation.read_only_reason]}
              </p>
            ) : (
              <MessageForm label="Reply" send={send} chat />
            )}
            <ReportConversation conversationId={id} messages={thread.messages} who={who} gone={sessionGone} />
          </div>
        </section>
      )}
    </>
  );
}
