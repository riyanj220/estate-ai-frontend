import "client-only";
import type { components } from "@/api/schema";
import { getApi } from "../http/api";
import { withCsrf } from "../http/csrf";
import { readErrorBody, withTimeout } from "../forms/forms";
import { failureMessage, thrownMessage } from "../http/request-errors";

/** Messaging (Story 7.1). The backend decides who may read and send; this only shows what it answers. Live delivery is `live.ts`. */
export type Conversation = components["schemas"]["Conversation"];
export type Message = components["schemas"]["Message"];

export const MAX_MESSAGE = 2000;
export const INBOX_PATH = "/messages";
/** Fired on `window` when what is unread may have changed, so the header reads its count again. */
export const UNREAD_CHANGED = "estate:unread-messages-changed";
export const conversationPath = (id: string) => `/messages/${encodeURIComponent(id)}`;

/** What is wrong with a draft before it is sent; "" when nothing is. Counted in characters, like the backend. */
export function draftProblem(text: string): string {
  const clean = text.replace(/\r\n?/g, "\n").trim();
  if (!clean) return "Write a message.";
  return [...clean].length > MAX_MESSAGE ? "Use at most 2,000 characters." : "";
}

export const READ_ONLY_NOTES: Record<NonNullable<Conversation["read_only_reason"]>, string> = {
  conversation_read_only: "This listing is no longer available, so you cannot send messages about it.",
  counterpart_unavailable: "This user is no longer available.",
  messaging_unavailable: "Your account is suspended, so you cannot send messages. You can still read them.",
  messaging_email_unverified: "Verify your email address to send messages.",
};

/** The header: the title only while the backend sends one. */
export function listingHeading({ listing }: Conversation): string {
  if (listing.availability === "available") return listing.title ?? "Untitled listing";
  if (listing.availability === "sold") return "Sold";
  return listing.availability === "rented" ? "Rented" : "Listing no longer available";
}

export type Failed = { kind: "gone" } | { kind: "failed"; message: string };

// Refusals whose own sentence is fixed and written for the reader.
const OWN_SENTENCES = ["own_listing", "conversation_read_only", "counterpart_unavailable", "messaging_unavailable", "messaging_email_unverified"];

function failed(status: number, error: unknown, retryAfter: string | null): Failed {
  if (status === 401) return { kind: "gone" };
  const body = readErrorBody(error);
  if (body && OWN_SENTENCES.includes(body.code)) return { kind: "failed", message: body.message };
  if (status === 404) return { kind: "failed", message: "This listing is no longer available." };
  return { kind: "failed", message: failureMessage(status, retryAfter) };
}

/** The caller's own inquiry about a Listing, if there is one. */
export async function findInquiry(listingId: string): Promise<{ kind: "ok"; conversationId: string | null } | Failed> {
  try {
    const api = await getApi();
    const { data, error, response } = await withTimeout((signal) =>
      api.GET("/api/v1/conversations", { params: { query: { listing_id: listingId } }, cache: "no-store", signal }),
    );
    if (response.ok && data) return { kind: "ok", conversationId: data.results[0]?.id ?? null };
    return failed(response.status, error, response.headers.get("Retry-After"));
  } catch (error) {
    return { kind: "failed", message: thrownMessage(error) };
  }
}

/** Starts (or continues) the inquiry. `key` is the client message id: the same key for a retry never sends twice. */
export async function startInquiry(listingId: string, body: string, key: string): Promise<{ kind: "ok"; conversationId: string } | Failed> {
  try {
    const api = await getApi();
    const { data, error, response } = await withCsrf((csrf) =>
      withTimeout((signal) =>
        api.POST("/api/v1/conversations", {
          params: { header: { "Idempotency-Key": key } },
          headers: { "X-CSRFToken": csrf },
          body: { listing_id: listingId, body },
          signal,
        }),
      ),
    );
    if (response.ok && data) return { kind: "ok", conversationId: data.conversation.id };
    return failed(response.status, error, response.headers.get("Retry-After"));
  } catch (error) {
    return { kind: "failed", message: thrownMessage(error) };
  }
}

export async function sendReply(conversationId: string, body: string, key: string): Promise<{ kind: "ok"; message: Message } | Failed> {
  try {
    const api = await getApi();
    const { data, error, response } = await withCsrf((csrf) =>
      withTimeout((signal) =>
        api.POST("/api/v1/conversations/{conversation_id}/messages", {
          params: { path: { conversation_id: conversationId }, header: { "Idempotency-Key": key } },
          headers: { "X-CSRFToken": csrf },
          body: { body },
          signal,
        }),
      ),
    );
    if (response.ok && data) return { kind: "ok", message: data };
    return failed(response.status, error, response.headers.get("Retry-After"));
  } catch (error) {
    return { kind: "failed", message: thrownMessage(error) };
  }
}

export type Thread = { conversation: Conversation; messages: Message[] };

/** The Conversation and its Messages after `after`, all pages. `missing` is a Conversation that is not the caller's. */
export async function fetchThread(id: string, after = 0): Promise<{ kind: "ok"; thread: Thread } | { kind: "missing" } | Failed> {
  try {
    const api = await getApi();
    const path = { conversation_id: id };
    const head = await withTimeout((signal) => api.GET("/api/v1/conversations/{conversation_id}", { params: { path }, cache: "no-store", signal }));
    if (head.response.status === 404) return { kind: "missing" };
    if (!head.response.ok || !head.data) return failed(head.response.status, head.error, head.response.headers.get("Retry-After"));
    const messages: Message[] = [];
    for (let from = after; ; ) {
      const page = await withTimeout((signal) =>
        api.GET("/api/v1/conversations/{conversation_id}/messages", { params: { path, query: { after: from } }, cache: "no-store", signal }),
      );
      if (!page.response.ok || !page.data) return failed(page.response.status, page.error, page.response.headers.get("Retry-After"));
      messages.push(...page.data.results);
      const last = page.data.results.at(-1)?.seq;
      if (!page.data.has_more || last === undefined || last <= from) break;
      from = last;
    }
    return { kind: "ok", thread: { conversation: head.data, messages } };
  } catch (error) {
    return { kind: "failed", message: thrownMessage(error) };
  }
}

/** The last `seq` held with nothing missing before it: where reading resumes, so a gap is always filled. */
export function resumeSeq(messages: Message[]): number {
  return messages.reduce((last, message) => (message.seq === last + 1 ? message.seq : last), 0);
}

/** Messages by `seq`, each once. */
export function mergeMessages(held: Message[], more: Message[]): Message[] {
  const bySeq = new Map([...held, ...more].map((message) => [message.seq, message]));
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

export type Inbox = { results: Conversation[]; next: string | null };

/** One page of the inbox, latest activity first (Story 7.5). `forbidden`: this account has no inbox. */
export async function fetchInbox(cursor?: string): Promise<{ kind: "ok"; inbox: Inbox } | { kind: "forbidden" } | Failed> {
  try {
    const api = await getApi();
    const { data, error, response } = await withTimeout((signal) =>
      api.GET("/api/v1/conversations", { params: { query: cursor ? { cursor } : {} }, cache: "no-store", signal }),
    );
    if (response.ok && data) return { kind: "ok", inbox: { results: data.results, next: data.next } };
    if (response.status === 403 || response.status === 404) return { kind: "forbidden" };
    return failed(response.status, error, response.headers.get("Retry-After"));
  } catch (error) {
    return { kind: "failed", message: thrownMessage(error) };
  }
}

/** How many Conversations hold something unread; null when it cannot be read (the header then shows no number). */
export async function fetchUnreadConversations(): Promise<number | null> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) => api.GET("/api/v1/conversations/unread-count", { cache: "no-store", signal }));
    return response.ok && typeof data?.unread === "number" ? data.unread : null;
  } catch {
    return null;
  }
}

/** Says the Conversation has been read up to `seq`. False when it was not recorded. */
export async function markRead(conversationId: string, seq: number): Promise<boolean> {
  try {
    const api = await getApi();
    const { response } = await withCsrf((csrf) =>
      withTimeout((signal) =>
        api.POST("/api/v1/conversations/{conversation_id}/read", {
          params: { path: { conversation_id: conversationId } },
          headers: { "X-CSRFToken": csrf },
          body: { seq },
          signal,
        }),
      ),
    );
    if (response.ok) window.dispatchEvent(new Event(UNREAD_CHANGED));
    return response.ok;
  } catch {
    return false;
  }
}
