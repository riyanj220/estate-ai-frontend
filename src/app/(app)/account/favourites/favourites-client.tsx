"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ListingCard } from "@/components/listing-card";
import { getApi } from "@/lib/api";
import { FAVOURITES_PATH, changeFavourite } from "@/lib/favourites";
import { withTimeout } from "@/lib/forms";
import { BROWSE_PATH, publishedText, readCard, type PublicCard } from "@/lib/public-listings";
import { failureMessage, thrownMessage } from "@/lib/request-errors";
import { ProfileLoadState, useResourceLoad, type ProfileFetch } from "@/lib/use-profile-load";

/** `card` is null for a Listing that is no longer available: nothing about it is shown. */
type Item = { listingId: string; savedOn: string | null; card: PublicCard | null };
type Page = { items: Item[]; cursor: string | null };

const HEADING_ID = "favourites-title";

function readPage(data: unknown): Page | null {
  const { results, next } = (data ?? {}) as { results?: unknown; next?: unknown };
  if (!Array.isArray(results)) return null;
  const items = results.flatMap((value): Item[] => {
    const { listing_id, saved_at, listing } = (value ?? {}) as Record<string, unknown>;
    if (typeof listing_id !== "string") return [];
    const date = typeof saved_at === "string" ? new Date(saved_at) : null;
    const savedOn = date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;
    const card = typeof listing === "object" && listing !== null ? readCard(listing as Parameters<typeof readCard>[0]) : null;
    return [{ listingId: listing_id, savedOn, card }];
  });
  const cursor = typeof next === "string" ? new URL(next, window.location.origin).searchParams.get("cursor") : null;
  return { items, cursor };
}

async function fetchPage(cursor?: string): Promise<ProfileFetch<Page>> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) =>
      api.GET("/api/v1/me/favourites", { params: { query: cursor ? { cursor } : {} }, cache: "no-store", signal }),
    );
    if (response.ok) {
      const page = readPage(data);
      return page ? { kind: "ready", profile: page } : { kind: "error" };
    }
    if (response.status === 401) return "gone";
    if (response.status === 403) return { kind: "forbidden" };
    return { kind: "error", message: failureMessage(response.status, response.headers.get("Retry-After")) };
  } catch (error) {
    return { kind: "error", message: thrownMessage(error) };
  }
}

/** The signed-in account's favourites (Story 3.7), read on the client behind the server guard. */
export function FavouritesClient() {
  const { load, retry, sessionGone } = useResourceLoad<Page>(() => fetchPage(), HEADING_ID, {
    signInPath: `/sign-in?next=${encodeURIComponent(FAVOURITES_PATH)}`,
    refreshOnFocus: false,
  });
  const [more, setMore] = useState<Page | null>(null); // the pages after the first
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState({ text: "", error: false });
  const busy = useRef(false);
  const focusHeading = useRef(false);

  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    document.getElementById(HEADING_ID)?.focus();
  }, [removed]);

  const first = load.kind === "ready" ? load.profile : null;
  const items = first ? [...first.items, ...(more?.items ?? [])].filter((item) => !removed.has(item.listingId)) : [];
  const cursor = more ? more.cursor : (first?.cursor ?? null);

  async function remove(listingId: string) {
    if (busy.current) return;
    busy.current = true;
    setMessage({ text: "", error: false });
    const result = await changeFavourite(listingId, false);
    busy.current = false;
    if (result.kind === "ok") {
      focusHeading.current = true; // the button is gone with its row
      setRemoved((previous) => new Set([...previous, listingId]));
      setMessage({ text: "Removed from favourites.", error: false });
    } else if (result.kind === "gone") {
      await sessionGone();
    } else {
      setMessage({ text: result.message, error: true });
    }
  }

  async function loadMore() {
    if (busy.current || !cursor) return;
    busy.current = true;
    setMessage({ text: "", error: false });
    const answer = await fetchPage(cursor);
    busy.current = false;
    if (answer === "gone") await sessionGone();
    else if (answer.kind === "ready") {
      setMore((previous) => ({ items: [...(previous?.items ?? []), ...answer.profile.items], cursor: answer.profile.cursor }));
    } else setMessage({ text: "We could not load more favourites. Try again.", error: true });
  }

  const removeButton = (listingId: string, name: string) => (
    <button type="button" className="secondary-button" onClick={() => void remove(listingId)}>
      Remove<span className="sr-only"> {name} from favourites</span>
    </button>
  );

  return (
    <>
      <h1 id={HEADING_ID} tabIndex={-1} className="page-title">
        Favourites
      </h1>
      <p role="status" className={message.text ? (message.error ? "state-note" : "muted") : "sr-only"} data-testid="favourites-status">
        {message.text}
      </p>
      {load.kind === "forbidden" && <p className="card">Favourites are not available for this account.</p>}
      <ProfileLoadState load={load} onRetry={retry} noun="favourites" />
      {first && (
        <>
          {items.length === 0 && !cursor ? (
            <p className="card" data-testid="favourites-empty">
              You have no saved listings.{" "}
              <Link href={BROWSE_PATH} className="text-link">
                Browse listings
              </Link>
            </p>
          ) : (
            <ul className="browse-grid" aria-label="Favourites">
              {items.map((item) =>
                item.card ? (
                  <ListingCard key={item.listingId} card={item.card} testId="favourite">
                    {removeButton(item.listingId, item.card.listing.fields.title ?? "Untitled listing")}
                  </ListingCard>
                ) : (
                  <li key={item.listingId} className="card" data-testid="favourite-unavailable">
                    <h2 className="browse-title">No longer available</h2>
                    {item.savedOn && (
                      <p className="hint">
                        Saved <time dateTime={item.savedOn}>{publishedText(item.savedOn)}</time>
                      </p>
                    )}
                    {removeButton(item.listingId, "the unavailable listing")}
                  </li>
                ),
              )}
            </ul>
          )}
          {cursor && (
            <button type="button" className="secondary-button" onClick={() => void loadMore()}>
              Load more
            </button>
          )}
        </>
      )}
    </>
  );
}
