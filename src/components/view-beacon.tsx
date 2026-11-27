"use client";

import { useEffect, useRef } from "react";
import { getApi } from "@/lib/api";
import { withCsrf } from "@/lib/csrf";
import { withTimeout } from "@/lib/forms";
import { useSession } from "@/lib/session";

/**
 * Tells the backend that a public Listing was shown (Story 8.2): sent once from the browser, so a server render never counts.
 * It shows nothing and a failure is ignored. A signed-in request needs the CSRF token (it lets the backend skip the owner);
 * a Visitor's is sent bare, so counting sets no cookie. Which views count is the backend's decision.
 */
export function ViewBeacon({ listingId }: { listingId: string }) {
  const { status } = useSession();
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (status === "loading" || sent.current === listingId) return;
    sent.current = listingId;
    const send = async (csrf: string | null) => {
      const api = await getApi();
      return withTimeout((signal) =>
        api.POST("/api/v1/public/listings/{listing_id}/views", {
          params: { path: { listing_id: listingId } },
          headers: csrf ? { "X-CSRFToken": csrf } : undefined,
          signal,
        }),
      );
    };
    void (status === "signed_in" ? withCsrf(send) : send(null)).catch(() => undefined);
  }, [listingId, status]);

  return null;
}
