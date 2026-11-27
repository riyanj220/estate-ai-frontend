import "client-only";
import type { components } from "@/api/schema";
import { getApi } from "./api";
import { withCsrf } from "./csrf";
import { readErrorBody, withTimeout } from "./forms";
import { failureMessage, thrownMessage } from "./request-errors";

/** The account's own support requests (Story 10.9). The backend decides every rule. */
export type SupportRequest = components["schemas"]["SupportRequest"];
export type SupportCategory = SupportRequest["category"];

export const SUPPORT_CATEGORIES: Record<SupportCategory, string> = {
  account: "My account",
  decision: "Contest a decision",
  technical: "A technical problem",
  other: "Something else",
};

export type Loaded = { kind: "ok"; requests: SupportRequest[] } | { kind: "gone" } | { kind: "forbidden" } | { kind: "failed"; message?: string };
export type Sent =
  | { kind: "ok"; request: SupportRequest }
  | { kind: "invalid"; code: string }
  | { kind: "gone" }
  | { kind: "forbidden" }
  | { kind: "failed"; message: string };

export async function fetchSupportRequests(): Promise<Loaded> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) => api.GET("/api/v1/me/support-requests", { cache: "no-store", signal }));
    if (response.ok && Array.isArray(data?.results)) return { kind: "ok", requests: data.results };
    if (response.status === 401) return { kind: "gone" };
    if (response.status === 403) return { kind: "forbidden" };
    return { kind: "failed", message: response.status === 429 ? failureMessage(429, response.headers.get("Retry-After")) : undefined };
  } catch (error) {
    return { kind: "failed", message: thrownMessage(error) };
  }
}

export async function sendSupportRequest(category: SupportCategory, message: string): Promise<Sent> {
  try {
    const api = await getApi();
    const { data, error, response } = await withCsrf((csrf) =>
      withTimeout((signal) => api.POST("/api/v1/me/support-requests", { body: { category, message }, headers: { "X-CSRFToken": csrf }, cache: "no-store", signal })),
    );
    if (response.ok && data) return { kind: "ok", request: data };
    const code = response.status === 400 ? readErrorBody(error)?.fields?.message?.[0] : undefined;
    if (code) return { kind: "invalid", code };
    if (response.status === 401) return { kind: "gone" };
    if (response.status === 403) return { kind: "forbidden" };
    return { kind: "failed", message: failureMessage(response.status, response.headers.get("Retry-After")) };
  } catch (error) {
    return { kind: "failed", message: thrownMessage(error) };
  }
}
