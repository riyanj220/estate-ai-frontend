"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatResetDate as formatDate } from "@/lib/publication-allowance";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/use-profile-load";
import { fetchUsage, NOT_AVAILABLE, SIGN_IN_PATH, TYPE_LABELS, type AccountType, type Usage, type UsagePage } from "./quota-api";

const HEADING_ID = "usage-title";
const rowId = (id: string) => `usage-${id}`;

/** This month's usage by account, newest first, with load more by cursor. Addresses arrive masked and are shown as sent. */
export function UsageSection({ saved, announce }: { saved: Partial<Record<AccountType, number>>; announce: (message: string) => void }) {
  const router = useRouter();
  const { load, read, retry, sessionGone } = useResourceLoad<UsagePage>(
    async (): Promise<ProfileFetch<UsagePage>> => {
      const answer = await fetchUsage();
      if (answer.kind === "ready") return { kind: "ready", profile: answer };
      if (answer.kind === "gone") return "gone";
      if (answer.kind === "forbidden") {
        router.refresh(); // runs the server guard again
        return { kind: "forbidden" };
      }
      return { kind: "error", message: answer.message };
    },
    HEADING_ID,
    { signInPath: SIGN_IN_PATH, refreshOnFocus: false },
  );

  // The first page plus whatever load more added; a fresh first page starts over (done while rendering, not in an effect).
  const [list, setList] = useState<{ source: UsagePage | null; items: Usage[]; next: string | null }>({ source: null, items: [], next: null });
  if (load.kind === "ready" && list.source !== load.profile) {
    setList({ source: load.profile, items: load.profile.items, next: load.profile.next });
  }
  const [loadingMore, setLoadingMore] = useState(false);
  const loading = useRef(false);
  const [moreError, setMoreError] = useState("");
  const focusRow = useRef<string | null>(null);

  useEffect(() => {
    if (!focusRow.current) return;
    document.getElementById(focusRow.current)?.focus();
    focusRow.current = null;
  }, [list]);

  async function loadMore() {
    if (loading.current || !list.next) return;
    loading.current = true;
    setLoadingMore(true);
    setMoreError("");
    try {
      const answer = await fetchUsage(list.next);
      if (answer.kind === "ready") {
        const known = new Set(list.items.map((item) => item.account_id));
        const fresh = answer.items.filter((item) => !known.has(item.account_id));
        focusRow.current = fresh.length ? rowId(fresh[0].account_id) : HEADING_ID;
        setList((prev) => ({ ...prev, items: [...prev.items, ...fresh], next: answer.next }));
        announce(`${fresh.length} more ${fresh.length === 1 ? "account" : "accounts"} loaded.`);
      } else if (answer.kind === "gone") {
        await sessionGone();
      } else if (answer.kind === "forbidden") {
        setMoreError(NOT_AVAILABLE);
        router.refresh();
      } else if (answer.status === 400) {
        // A cursor from an earlier month is refused: start again from the first page.
        if (await read(true)) announce("The usage list was out of date and has been reloaded.");
        else setMoreError(answer.message);
      } else {
        setMoreError(answer.message);
      }
    } finally {
      loading.current = false;
      setLoadingMore(false);
    }
  }

  return (
    <section aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID} tabIndex={-1} className="section-title">
        Usage this month
      </h2>
      {load.kind === "forbidden" ? (
        <p className="card">{NOT_AVAILABLE}</p>
      ) : load.kind !== "ready" ? (
        <ProfileLoadState load={load} onRetry={retry} noun="usage list" determiner="the" titleId="usage-error-title" />
      ) : (
        <>
          <p className="muted">
            From {formatDate(load.profile.periodStart)}. Resets on {formatDate(load.profile.resetsAt)}.
          </p>
          {list.items.length === 0 ? (
            <p className="card" data-testid="usage-empty">
              No account has used a publication this month.
            </p>
          ) : (
            <table className="usage-table" aria-labelledby={HEADING_ID}>
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Type</th>
                  <th scope="col">Used / limit</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr key={item.account_id} id={rowId(item.account_id)} tabIndex={-1}>
                    <td>{item.email}</td>
                    <td>{TYPE_LABELS[item.account_type] ?? item.account_type}</td>
                    <td>
                      {item.used} / {saved[item.account_type] ?? item.limit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {moreError && (
            <p role="alert" className="state-note">
              {moreError}
            </p>
          )}
          {list.next && (
            <button type="button" className="secondary-button" aria-disabled={loadingMore ? true : undefined} onClick={() => void loadMore()}>
              {loadingMore ? "Loading more…" : "Load more"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
