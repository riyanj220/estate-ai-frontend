"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Account } from "./account";
import { canOwnListings } from "./account";
import { getApi } from "./api";
import { withCsrf } from "./csrf";
import { withTimeout } from "./forms";
import { failureMessage, thrownMessage } from "./request-errors";
import { useSession } from "./session";

/** Favourites (Story 3.7). The backend decides who may save and what; this only chooses which button to offer. */
export const FAVOURITES_PATH = "/account/favourites";
export const FAVOURITES_FULL = "You have 500 saved listings, the most allowed. Remove one to save another.";
export const SAVE_UNAVAILABLE = "This listing is no longer available.";
export const SAVE_FORBIDDEN = "Your account cannot save listings right now.";

/** Individual and Agency accounts keep favourites; a deactivated one does not. */
export const keepsFavourites = (account: Account): boolean => canOwnListings(account.account_type) && account.state !== "deactivated";

export type ChangeResult = { kind: "ok" } | { kind: "gone" } | { kind: "failed"; message: string };

/** Saves (`PUT`) or removes (`DELETE`) one favourite. Removing one that is already gone counts as done. */
export async function changeFavourite(listingId: string, save: boolean): Promise<ChangeResult> {
  try {
    const api = await getApi();
    const { response } = await withCsrf((csrf) =>
      withTimeout((signal) => {
        const options = { params: { path: { listing_id: listingId } }, headers: { "X-CSRFToken": csrf }, signal };
        return save ? api.PUT("/api/v1/me/favourites/{listing_id}", options) : api.DELETE("/api/v1/me/favourites/{listing_id}", options);
      }),
    );
    if (response.status === 204 || (!save && response.status === 404)) return { kind: "ok" };
    if (response.status === 401) return { kind: "gone" };
    if (save && response.status === 404) return { kind: "failed", message: SAVE_UNAVAILABLE };
    if (save && response.status === 403) return { kind: "failed", message: SAVE_FORBIDDEN };
    const retryAfter = response.headers.get("Retry-After");
    // The cap answers 429 without a wait: it clears when a favourite is removed, not after a time.
    if (save && response.status === 429 && !retryAfter) return { kind: "failed", message: FAVOURITES_FULL };
    return { kind: "failed", message: failureMessage(response.status, retryAfter) };
  } catch (error) {
    return { kind: "failed", message: thrownMessage(error) };
  }
}

type Value = { saved: ReadonlySet<string> | null; mark: (listingId: string, saved: boolean) => void };

const FavouritesContext = createContext<Value | null>(null);

/** The ids the signed-in account has saved, read once for all the Save buttons of a page. A Visitor reads nothing. */
export function FavouritesProvider({ children }: { children: React.ReactNode }) {
  const { status, account } = useSession();
  const owner = status === "signed_in" && account && keepsFavourites(account) ? account.id : null;
  const [held, setHeld] = useState<{ owner: string; ids: ReadonlySet<string> } | null>(null);

  useEffect(() => {
    if (!owner) return;
    let current = true;
    void (async () => {
      try {
        const api = await getApi();
        const { data, response } = await withTimeout((signal) => api.GET("/api/v1/me/favourites/ids", { cache: "no-store", signal }));
        if (current && response.ok && Array.isArray(data?.listing_ids)) setHeld({ owner, ids: new Set(data.listing_ids) });
      } catch {
        // Without the ids no button is offered; reloading the page asks again.
      }
    })();
    return () => {
      current = false;
    };
  }, [owner]);

  // Ids that belong to another account are never used.
  const saved = held && held.owner === owner ? held.ids : null;
  const mark = useCallback((listingId: string, on: boolean) => {
    setHeld((previous) => {
      if (!previous) return previous;
      const ids = new Set(previous.ids);
      if (on) ids.add(listingId);
      else ids.delete(listingId);
      return { owner: previous.owner, ids };
    });
  }, []);
  const value = useMemo(() => ({ saved, mark }), [saved, mark]);
  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}

export function useFavourites(): Value {
  const value = useContext(FavouritesContext);
  if (!value) throw new Error("useFavourites must be used inside FavouritesProvider");
  return value;
}
