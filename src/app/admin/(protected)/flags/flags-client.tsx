"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { components } from "@/api/schema";
import { getApi } from "@/lib/api";
import { withTimeout } from "@/lib/forms";
import { formatResetDate as formatDate } from "@/lib/publication-allowance";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { STATUS_LABELS, useSessionGone } from "../moderation-shared";

type Flag = components["schemas"]["ListingFlag"];
type Kind = Flag["kind"];

const KINDS: Record<Kind, string> = { duplicate: "Possible duplicate", suspicious: "Suspicious" };

type List = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; rows: Flag[]; next: string | null };

function why(flag: Flag): string {
  if (flag.kind === "suspicious") return `Open reports from ${flag.reporter_count} different people within 7 days.`;
  return `Same owner, locality and area, with a near-identical ${flag.matched.join(" and ")}.`;
}

function FlaggedLink({ listing }: { listing: Flag["listing"] }) {
  return (
    <p className="account-text">
      <Link href={`/admin/listings/${listing.id}`} className="text-link">
        {listing.title ?? "Untitled listing"}
      </Link>{" "}
      <span className="muted">{STATUS_LABELS[listing.status as keyof typeof STATUS_LABELS] ?? listing.status}</span>
    </p>
  );
}

/** The advisory flags (Story 9.6). Nothing here changes a Listing; actions are on the Listing's review page. */
export function FlagsReview() {
  const router = useRouter();
  const gone = useSessionGone("/admin/flags");
  const [kind, setKind] = useState<Kind | "">("");
  const [list, setList] = useState<List>({ kind: "loading" });
  const ticket = useRef(0);

  const read = useCallback(
    async (wanted: Kind | "", after: string | null = null, kept: Flag[] = []) => {
      const mine = ++ticket.current;
      try {
        const cursor = after ? (new URL(after, window.location.origin).searchParams.get("cursor") ?? undefined) : undefined;
        const api = await getApi();
        const { data, response } = await withTimeout((signal) => api.GET("/api/v1/admin/flags", { params: { query: { kind: wanted || undefined, cursor } }, cache: "no-store", signal }));
        if (mine !== ticket.current) return;
        if (response.ok && Array.isArray(data?.results)) return setList({ kind: "ready", rows: [...kept, ...data.results], next: data.next });
        if (response.status === 401) return await gone();
        if (response.status === 404) router.refresh();
        setList({ kind: "error", message: failureMessage(response.status, response.headers.get("Retry-After")) });
      } catch (thrown) {
        if (mine === ticket.current) setList({ kind: "error", message: thrownMessage(thrown) });
      }
    },
    [gone, router],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the state is set after the request answers
    void read(kind);
  }, [read, kind]);

  return (
    <>
      <h1 className="page-title">Flags</h1>
      <p className="muted">Flags are advice from fixed rules. They never change a listing.</p>
      <div className="field">
        <label htmlFor="flag-kind">Kind</label>
        <select
          id="flag-kind"
          value={kind}
          onChange={(event) => {
            setList({ kind: "loading" });
            setKind(event.target.value as Kind | "");
          }}
        >
          <option value="">All flags</option>
          {Object.entries(KINDS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </div>
      {list.kind === "loading" && <p className="muted">Loading flags…</p>}
      {list.kind === "error" && (
        <div role="alert">
          <p>{list.message}</p>
          <button type="button" className="secondary-button" onClick={() => void read(kind)}>
            Try again
          </button>
        </div>
      )}
      {list.kind === "ready" && list.rows.length === 0 && <p className="muted">No flags.</p>}
      {list.kind === "ready" && list.rows.length > 0 && (
        <ul className="listing-list" aria-label="Flags">
          {list.rows.map((flag) => (
            <li key={flag.id} className="listing-item" data-testid="flag-row">
              <h2 className="section-title">{KINDS[flag.kind]}</h2>
              <FlaggedLink listing={flag.listing} />
              {flag.other_listing && <FlaggedLink listing={flag.other_listing} />}
              <p className="muted">
                {why(flag)} Flagged {formatDate(flag.flagged_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {list.kind === "ready" && list.next && (
        <button type="button" className="secondary-button" onClick={() => void read(kind, list.next, list.rows)}>
          Load more
        </button>
      )}
    </>
  );
}
