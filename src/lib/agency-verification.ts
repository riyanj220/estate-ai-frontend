import "client-only";
import type { components } from "@/api/schema";
import { getApi } from "./api";
import { withCsrf } from "./csrf";
import { readErrorBody, withTimeout } from "./forms";
import { failureMessage, thrownMessage } from "./request-errors";

/** The Agency's own Verification status and request (Story 8.3). The backend decides every rule. */
export type Verification = components["schemas"]["OwnVerification"];
export type Draft = { business_name: string; registration_number: string; note: string };
export type FieldCodes = Partial<Record<keyof Draft, string>>;

export type Loaded = { kind: "ok"; view: Verification } | { kind: "gone" } | { kind: "forbidden" } | { kind: "failed"; message?: string };
export type Changed = Loaded | { kind: "conflict" } | { kind: "invalid"; fields: FieldCodes };

export async function fetchVerification(): Promise<Loaded> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) => api.GET("/api/v1/me/agency-verification", { cache: "no-store", signal }));
    if (response.ok && typeof data?.status === "string") return { kind: "ok", view: data };
    if (response.status === 401) return { kind: "gone" };
    if (response.status === 403) return { kind: "forbidden" };
    return { kind: "failed", message: response.status === 429 ? failureMessage(429, response.headers.get("Retry-After")) : undefined };
  } catch (error) {
    return { kind: "failed", message: thrownMessage(error) };
  }
}

/** Submit a request, or withdraw the pending one when `draft` is null. */
export async function changeVerification(draft: Draft | null): Promise<Changed> {
  try {
    const api = await getApi();
    const { data, error, response } = await withCsrf((csrf) =>
      withTimeout((signal) => {
        const options = { headers: { "X-CSRFToken": csrf }, cache: "no-store" as const, signal };
        return draft
          ? api.POST("/api/v1/me/agency-verification/requests", { ...options, body: draft })
          : api.POST("/api/v1/me/agency-verification/withdraw", options);
      }),
    );
    if (response.ok && data) return { kind: "ok", view: data };
    if (response.status === 401) return { kind: "gone" };
    if (response.status === 409) return { kind: "conflict" };
    const fields = response.status === 400 ? readErrorBody(error)?.fields : undefined;
    if (fields?.business_name || fields?.registration_number || fields?.note) {
      return {
        kind: "invalid",
        fields: { business_name: fields.business_name?.[0], registration_number: fields.registration_number?.[0], note: fields.note?.[0] },
      };
    }
    return { kind: "failed", message: failureMessage(response.status, response.headers.get("Retry-After")) };
  } catch (error) {
    return { kind: "failed", message: thrownMessage(error) };
  }
}
