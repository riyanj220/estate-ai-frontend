"use client";

import Link from "next/link";
import { useState } from "react";
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

/** The inbox (Story 7.5): every Conversation of this account, refreshed when a Message arrives. */
export function InboxClient() {
  const { load: state, read, retry, sessionGone } = useResourceLoad<Inbox>(load, HEADING_ID, {
    signInPath: `/sign-in?next=${encodeURIComponent(INBOX_PATH)}`,
  });
  const [older, setOlder] = useState<Inbox | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = () => {
    window.dispatchEvent(new Event(UNREAD_CHANGED));
    void read(true);
  };
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
      <h1 id={HEADING_ID} tabIndex={-1} className="page-title">
        Messages
      </h1>
      {state.kind === "forbidden" && (
        <p className="card" data-testid="inbox-forbidden">
          Messages are not available for this account.
        </p>
      )}
      <ProfileLoadState load={state} onRetry={retry} noun="messages" />
      {first && rows.length === 0 && (
        <p className="card" data-testid="inbox-empty">
          You have no conversations yet.{" "}
          <Link href={BROWSE_PATH} className="text-link">
            Browse listings
          </Link>
        </p>
      )}
      {rows.length > 0 && (
        <ul className="chat-list" data-testid="inbox">
          {rows.map((row) => (
            <li key={row.id} className="card">
              <h2 className="section-title">
                <Link href={conversationPath(row.id)} className="text-link">
                  {listingHeading(row)}
                </Link>
              </h2>
              <p className="muted">
                With {row.counterpart_name ?? "Deleted user"} · <time dateTime={row.last_message_at}>{activeAt.format(new Date(row.last_message_at))}</time>
              </p>
              {row.unread_count > 0 && (
                <p>
                  <strong>{row.unread_count} unread</strong>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {next && (
        <p>
          <button type="button" className="secondary-button" aria-disabled={busy ? true : undefined} onClick={() => void more()}>
            {busy ? "Loading…" : "Load more"}
          </button>
        </p>
      )}
      <p role="status" className={notice ? "muted" : "sr-only"}>
        {notice}
      </p>
    </>
  );
}
