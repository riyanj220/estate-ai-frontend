import "client-only";
import type { components } from "@/api/schema";
import { getApi } from "../http/api";
import { withCsrf } from "../http/csrf";
import { readErrorBody, withTimeout } from "../forms/forms";
import { failureMessage, thrownMessage } from "../http/request-errors";

/** Reporting a Listing (Story 9.1) or Messages of a Conversation (Story 9.5). The backend decides who may report what. */
export type ReportReason = components["schemas"]["ReportCreateRequest"]["reason"];

export const REPORT_REASONS: Record<ReportReason, string> = {
  misleading: "Misleading",
  duplicate: "Duplicate",
  prohibited_content: "Prohibited content",
  abusive: "Abusive",
  ai_generated_content: "AI-generated content",
  other: "Other",
};
export const MAX_DESCRIPTION = 1000;
export const MAX_SELECTED = 10;

export const REPORT_SENT = "Your report was sent. We will tell you the outcome in your notifications.";
export const REPORT_ALREADY_OPEN = "You already have an open report on this listing.";
export const REPORT_FORBIDDEN = "You cannot report this listing. You cannot report your own listing, and a suspended account cannot report.";
export const REPORT_GONE = "This listing is no longer available.";

export type Reported = { kind: "done"; message: string } | { kind: "gone" } | { kind: "failed"; message: string };

export async function reportListing(listingId: string, reason: ReportReason, description: string): Promise<Reported> {
  try {
    const api = await getApi();
    const { error, response } = await withCsrf((csrf) =>
      withTimeout((signal) =>
        api.POST("/api/v1/listings/{listing_id}/reports", {
          params: { path: { listing_id: listingId } },
          body: { reason, description },
          headers: { "X-CSRFToken": csrf },
          cache: "no-store",
          signal,
        }),
      ),
    );
    if (response.ok) return { kind: "done", message: REPORT_SENT };
    if (response.status === 401) return { kind: "gone" };
    if (response.status === 409) return { kind: "done", message: REPORT_ALREADY_OPEN };
    if (response.status === 403) return { kind: "failed", message: readErrorBody(error) ? REPORT_FORBIDDEN : failureMessage(403, null) };
    if (response.status === 404) return { kind: "failed", message: REPORT_GONE };
    return { kind: "failed", message: failureMessage(response.status, response.headers.get("Retry-After")) };
  } catch (error) {
    return { kind: "failed", message: thrownMessage(error) };
  }
}

export const CONVERSATION_REPORT_SENT = "Your report was recorded. We will tell you the outcome in your notifications.";
export const CONVERSATION_REPORT_ALREADY_OPEN = "You already have an open report on this conversation.";
export const CONVERSATION_REPORT_FORBIDDEN = "You cannot report this conversation. A suspended account cannot report.";

export async function reportConversation(conversationId: string, messageIds: string[], reason: ReportReason, description: string): Promise<Reported> {
  try {
    const api = await getApi();
    const { error, response } = await withCsrf((csrf) =>
      withTimeout((signal) =>
        api.POST("/api/v1/conversations/{conversation_id}/reports", {
          params: { path: { conversation_id: conversationId } },
          body: { message_ids: messageIds, reason, description },
          headers: { "X-CSRFToken": csrf },
          cache: "no-store",
          signal,
        }),
      ),
    );
    if (response.ok) return { kind: "done", message: CONVERSATION_REPORT_SENT };
    if (response.status === 401) return { kind: "gone" };
    if (response.status === 409) return { kind: "done", message: CONVERSATION_REPORT_ALREADY_OPEN };
    if (response.status === 403) return { kind: "failed", message: readErrorBody(error) ? CONVERSATION_REPORT_FORBIDDEN : failureMessage(403, null) };
    return { kind: "failed", message: failureMessage(response.status, response.headers.get("Retry-After")) };
  } catch (error) {
    return { kind: "failed", message: thrownMessage(error) };
  }
}
