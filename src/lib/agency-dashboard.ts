import "client-only";
import type { components, operations } from "@/api/schema";
import { getApi } from "./api";
import { withTimeout } from "./forms";
import { failureMessage, thrownMessage } from "./request-errors";

/** The Agency dashboard (Story 8.1) with the view counts of Story 8.2. Agency accounts only; the backend decides. */
export type Totals = components["schemas"]["Dashboard"];
export type DashboardRow = components["schemas"]["DashboardListing"];
export type DashboardPage = components["schemas"]["DashboardListingPage"];
export type Filters = Omit<NonNullable<operations["list_agency_dashboard_listings"]["parameters"]["query"]>, "cursor" | "page_size">;

export const STATUSES: DashboardRow["status"][] = ["draft", "published", "archived", "sold", "rented", "removed"];

export type Failed = { kind: "gone" } | { kind: "forbidden" } | { kind: "failed"; message?: string };

function failed(status: number, retryAfter: string | null): Failed {
  if (status === 401) return { kind: "gone" };
  if (status === 403) return { kind: "forbidden" };
  return { kind: "failed", message: status === 429 ? failureMessage(429, retryAfter) : undefined };
}

export async function fetchTotals(): Promise<{ kind: "ok"; totals: Totals } | Failed> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) => api.GET("/api/v1/me/agency-dashboard", { cache: "no-store", signal }));
    // A body without the counts is a failed load, never a page of zeros.
    if (response.ok && typeof data?.total_listings === "number" && data.by_status) return { kind: "ok", totals: data };
    return failed(response.status, response.headers.get("Retry-After"));
  } catch (error) {
    return { kind: "failed", message: thrownMessage(error) };
  }
}

/** One page of the matching Listings. `next` is the server's link; only its cursor is used. */
export async function fetchRows(filters: Filters, next: string | null = null): Promise<{ kind: "ok"; page: DashboardPage } | Failed> {
  try {
    const cursor = next ? (new URL(next, window.location.origin).searchParams.get("cursor") ?? undefined) : undefined;
    const api = await getApi();
    const { data, response } = await withTimeout((signal) =>
      api.GET("/api/v1/me/agency-dashboard/listings", { params: { query: { ...filters, cursor } }, cache: "no-store", signal }),
    );
    if (response.ok && Array.isArray(data?.results)) return { kind: "ok", page: data };
    return failed(response.status, response.headers.get("Retry-After"));
  } catch (error) {
    return { kind: "failed", message: thrownMessage(error) };
  }
}
