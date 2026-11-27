import "client-only";
import type { components } from "@/api/schema";
import { getApi } from "./api";
import { withCsrf } from "./csrf";
import { withTimeout } from "./forms";
import { failureMessage, thrownMessage } from "./request-errors";

/** The account's own closure request (Story 10.1). The backend decides every rule. */
export type Closure = components["schemas"]["OwnClosure"];
export type ClosureKind = components["schemas"]["ClosureRequest"]["kind"];

export type Loaded = { kind: "ok"; view: Closure } | { kind: "gone" } | { kind: "forbidden" } | { kind: "failed"; message?: string };
export type Sent = Loaded | { kind: "conflict" };

export async function fetchClosure(): Promise<Loaded> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) => api.GET("/api/v1/me/closure-requests", { cache: "no-store", signal }));
    if (response.ok && typeof data?.can_submit === "boolean") return { kind: "ok", view: data };
    if (response.status === 401) return { kind: "gone" };
    if (response.status === 403) return { kind: "forbidden" };
    return { kind: "failed", message: response.status === 429 ? failureMessage(429, response.headers.get("Retry-After")) : undefined };
  } catch (error) {
    return { kind: "failed", message: thrownMessage(error) };
  }
}

export async function requestClosure(kind: ClosureKind): Promise<Sent> {
  try {
    const api = await getApi();
    const { data, response } = await withCsrf((csrf) =>
      withTimeout((signal) => api.POST("/api/v1/me/closure-requests", { body: { kind }, headers: { "X-CSRFToken": csrf }, cache: "no-store", signal })),
    );
    if (response.ok && data) return { kind: "ok", view: data };
    if (response.status === 401) return { kind: "gone" };
    if (response.status === 403) return { kind: "forbidden" };
    if (response.status === 409) return { kind: "conflict" };
    return { kind: "failed", message: failureMessage(response.status, response.headers.get("Retry-After")) };
  } catch (error) {
    return { kind: "failed", message: thrownMessage(error) };
  }
}
