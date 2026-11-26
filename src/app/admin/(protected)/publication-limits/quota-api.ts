import type { components } from "@/api/schema";
import { getApi } from "@/lib/api";
import { withTimeout } from "@/lib/forms";
import { failureMessage, thrownMessage } from "@/lib/request-errors";

export type Policy = components["schemas"]["QuotaPolicy"];
export type Usage = components["schemas"]["QuotaUsage"];
export type AccountType = Policy["account_type"];
export type UsagePage = { periodStart: string; resetsAt: string; items: Usage[]; next: string | null };

export const SIGN_IN_PATH = `/admin/sign-in?next=${encodeURIComponent("/admin/publication-limits")}`;
export const NOT_AVAILABLE = "Publication limits are not available for this account.";
export const TYPE_LABELS: Record<AccountType, string> = { individual: "Individual", agency: "Agency" };

type Failure = { kind: "gone" } | { kind: "forbidden" } | { kind: "error"; status: number; message: string };

/** 401 is a lost session; 404 is the server's answer to a non-administrator. */
function failure(response: Response): Failure {
  if (response.status === 401) return { kind: "gone" };
  if (response.status === 404) return { kind: "forbidden" };
  return { kind: "error", status: response.status, message: failureMessage(response.status, response.headers.get("Retry-After")) };
}

export async function fetchPolicy(): Promise<{ kind: "ready"; items: Policy[] } | Failure> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) => api.GET("/api/v1/admin/quota-policy", { cache: "no-store", signal }));
    if (!response.ok) return failure(response);
    if (!Array.isArray(data?.items)) return { kind: "error", status: 0, message: failureMessage(500, null) };
    return { kind: "ready", items: data.items };
  } catch (error) {
    return { kind: "error", status: 0, message: thrownMessage(error) };
  }
}

export async function fetchUsage(cursor?: string): Promise<({ kind: "ready" } & UsagePage) | Failure> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) =>
      api.GET("/api/v1/admin/quota-usage", { params: { query: cursor ? { cursor } : {} }, cache: "no-store", signal }),
    );
    if (!response.ok) return failure(response);
    if (!Array.isArray(data?.results)) return { kind: "error", status: 0, message: failureMessage(500, null) };
    // `next` is a full URL on the backend's own origin: only its cursor is used.
    const next = data.next ? new URL(data.next, window.location.origin).searchParams.get("cursor") : null;
    return { kind: "ready", periodStart: data.period_start, resetsAt: data.resets_at, items: data.results, next };
  } catch (error) {
    return { kind: "error", status: 0, message: thrownMessage(error) };
  }
}
