"use client";

import { getApi } from "@/lib/api";
import { withTimeout } from "@/lib/forms";
import { formatResetDate, readAllowance, remainingText, type Allowance } from "@/lib/publication-allowance";
import { failureMessage } from "@/lib/request-errors";
import { ProfileLoadState, useProfileLoad, type ProfileFetch } from "@/lib/use-profile-load";

const HEADING_ID = "allowance-title";
/** Re-reads on focus and visibility are coalesced to one per this long. */
const FOCUS_INTERVAL_MS = 5000;
const SIGN_IN_PATH = "/sign-in?next=%2Fdashboard";

async function fetchAllowance(): Promise<ProfileFetch<Allowance>> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) => api.GET("/api/v1/me/publication-allowance", { cache: "no-store", signal }));
    if (response.ok) {
      const allowance = readAllowance(data);
      return allowance ? { kind: "ready", profile: allowance } : { kind: "error" };
    }
    if (response.status === 401) return "gone";
    if (response.status === 403) return { kind: "forbidden" };
    return { kind: "error", message: response.status === 429 ? failureMessage(429, response.headers.get("Retry-After")) : undefined };
  } catch {
    return { kind: "error" }; // a timeout or a network failure: the generic load-failure text and Retry
  }
}

/** The "Publications this month" card of an Individual or Agency owner (administrators never mount it). */
export function AllowanceCard() {
  const { load, retry, stale } = useProfileLoad<Allowance>(fetchAllowance, HEADING_ID, { signInPath: SIGN_IN_PATH, focusIntervalMs: FOCUS_INTERVAL_MS });
  if (load.kind === "forbidden") return null;
  if (load.kind !== "ready") return <ProfileLoadState load={load} onRetry={retry} noun="publication allowance" />;
  const { limit, used, remaining, resetsAt } = load.profile;
  const date = formatResetDate(resetsAt);
  return (
    <section className="card" aria-labelledby={HEADING_ID} data-testid="allowance-card">
      <h2 id={HEADING_ID} tabIndex={-1} className="section-title">
        Publications this month
      </h2>
      <p data-testid="allowance-summary">
        {used} of {limit} used, {remainingText(remaining)}
      </p>
      <progress aria-labelledby={HEADING_ID} aria-valuetext={`${used} of ${limit} used`} max={Math.max(limit, 1)} value={Math.min(used, limit)} data-testid="allowance-progress" />
      {limit === 0 ? (
        <p data-testid="allowance-none">Your account has no publications this month.</p>
      ) : remaining === 0 ? (
        <p data-testid="allowance-exhausted">You have used all your publications this month. The allowance resets on {date}.</p>
      ) : (
        <p className="muted" data-testid="allowance-reset">
          Resets on {date}
        </p>
      )}
      {stale && (
        <p className="muted" data-testid="allowance-stale">
          These numbers may be out of date. We could not refresh them.
        </p>
      )}
    </section>
  );
}
