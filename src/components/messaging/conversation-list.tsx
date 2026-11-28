"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiveEvents } from "@/lib/messaging/live";
import { INBOX_PATH, UNREAD_CHANGED, conversationPath, fetchInbox, listingHeading, type Conversation, type Inbox } from "@/lib/messaging/messaging";
import { BROWSE_PATH } from "@/lib/listing/public-listings";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/account/use-profile-load";

const HEADING_ID = "inbox-title";
const activeAt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

async function load(): Promise<ProfileFetch<Inbox>> {
  const result = await fetchInbox();
  if (result.kind === "ok") return { kind: "ready", profile: result.inbox };
  if (result.kind === "forbidden") return { kind: "forbidden" };
  return result.kind === "gone" ? "gone" : { kind: "error", message: result.message };
}

/** Each Conversation once, latest activity first; the first page (read again on live events) wins over older pages. */
function merge(first: Conversation[], older: Conversation[]): Conversation[] {
  const byId = new Map([...older, ...first].map((row) => [row.id, row]));
  return [...byId.values()].sort((a, b) => Date.parse(b.last_message_at) - Date.parse(a.last_message_at));
}

/** The inbox (Story 7.5): every Conversation of this account, refreshed when a Message arrives or one is read. */
export function ConversationList() {
  const pathname = usePathname();
  // The page heading is this list's on the inbox, and the open conversation's beside it otherwise.
  const Heading = pathname === INBOX_PATH ? "h1" : "h2";
  const { load: state, read, retry, sessionGone } = useResourceLoad<Inbox>(load, HEADING_ID, {
    signInPath: `/sign-in?next=${encodeURIComponent(pathname)}`,
  });
  const [older, setOlder] = useState<Inbox | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  // The header's unread count reads again on this event, and so does this list (below).
  const refresh = () => window.dispatchEvent(new Event(UNREAD_CHANGED));
  useEffect(() => {
    const reread = () => void read(true);
    window.addEventListener(UNREAD_CHANGED, reread);
    return () => window.removeEventListener(UNREAD_CHANGED, reread);
  }, [read]);
  useLiveEvents(state.kind === "ready", refresh, refresh); // a read answers 401 if the session really is gone

  const first = state.kind === "ready" ? state.profile : null;
  const rows = first ? merge(first.results, older?.results ?? []) : [];
  const next = older ? older.next : (first?.next ?? null);

  async function more() {
    if (busy || !next) return;
    setBusy(true);
    setNotice("");
    const result = await fetchInbox(next);
    setBusy(false);
    if (result.kind === "gone") return sessionGone();
    if (result.kind !== "ok") return setNotice("We could not load more conversations. Try again.");
    setOlder((held) => ({ results: [...(held?.results ?? []), ...result.inbox.results], next: result.inbox.next }));
  }

  return (
    <>
      <Heading id={HEADING_ID} tabIndex={-1} className="border-b border-line px-5 py-4 font-serif text-[1.5rem] font-semibold">
        Messages
      </Heading>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {state.kind === "forbidden" && (
          <p className="p-5" data-testid="inbox-forbidden">
            Messages are not available for this account.
          </p>
        )}
        <ProfileLoadState load={state} onRetry={retry} noun="messages" />
        {first && rows.length === 0 && (
          <p className="p-5 text-muted" data-testid="inbox-empty">
            You have no conversations yet.{" "}
            <Link href={BROWSE_PATH} className="text-link">
              Browse listings
            </Link>
          </p>
        )}
        {rows.length > 0 && (
          <ul className="list-none p-2" data-testid="inbox">
            {rows.map((row) => {
              const name = row.counterpart_name ?? "Deleted user";
              const open = pathname === conversationPath(row.id);
              return (
                <li key={row.id} className={`relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl p-3 ${open ? "bg-accent text-white" : "hover:bg-accent-soft"}`}>
                  <span aria-hidden="true" className={`flex size-11 items-center justify-center rounded-full font-serif text-[1.125rem] font-semibold uppercase ${open ? "bg-white/20" : "bg-accent-soft text-accent"}`}>
                    {name.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-[0.9375rem] font-semibold">
                      <Link href={conversationPath(row.id)} aria-current={open ? "page" : undefined} className="after:absolute after:inset-0">
                        {listingHeading(row)}
                      </Link>
                    </h2>
                    <p className={`truncate text-[0.8125rem] ${open ? "text-white/85" : "text-muted"}`}>
                      With {name} · <time dateTime={row.last_message_at}>{activeAt.format(new Date(row.last_message_at))}</time>
                    </p>
                  </div>
                  {row.unread_count > 0 && (
                    <p>
                      <strong className="rounded-full bg-accent px-2 py-0.5 text-[0.75rem] whitespace-nowrap text-white">{row.unread_count} unread</strong>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {next && (
          <p className="p-3 text-center">
            <button type="button" className="secondary-button" aria-disabled={busy ? true : undefined} onClick={() => void more()}>
              {busy ? "Loading…" : "Load more"}
            </button>
          </p>
        )}
        <p role="status" className={notice ? "muted px-5" : "sr-only"}>
          {notice}
        </p>
      </div>
    </>
  );
}
