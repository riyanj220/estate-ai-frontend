"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { changeFavourite, keepsFavourites, useFavourites } from "@/lib/listing/favourites";
import { safeNext } from "@/lib/auth/next-target";
import { useSession } from "@/lib/auth/session";

/**
 * Save / Saved on a public card and detail (Story 3.7). A Visitor is asked to sign in or register, and nothing is stored for
 * them. Administrators have no button; a Suspended account can only remove what it already saved.
 */
export function SaveButton({ listingId, title }: { listingId: string; title: string }) {
  const { status, account, refresh } = useSession();
  const { saved, mark } = useFavourites();
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const pathname = usePathname();
  const query = useSearchParams().toString();

  if (status !== "signed_in" && status !== "signed_out") return null;
  const label = <span className="sr-only">: {title}</span>;

  if (status === "signed_out") {
    const next = encodeURIComponent(safeNext(query ? `${pathname}?${query}` : pathname));
    return (
      <div className="save-control">
        <button type="button" className="secondary-button" aria-expanded={asking} onClick={() => setAsking((open) => !open)}>
          Save{label}
        </button>
        <p role="status" className={asking ? "save-note" : "sr-only"} data-testid="save-prompt">
          {asking && (
            <>
              <Link href={`/sign-in?next=${next}`} className="text-link">
                Sign in
              </Link>{" "}
              or{" "}
              <Link href="/register" className="text-link">
                create an account
              </Link>{" "}
              to save listings.
            </>
          )}
        </p>
      </div>
    );
  }

  if (!account || !keepsFavourites(account) || !saved) return null;
  const isSaved = saved.has(listingId);
  if (!isSaved && account.state === "suspended") return null;

  async function toggle() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailure("");
    const result = await changeFavourite(listingId, !isSaved);
    if (result.kind === "ok") mark(listingId, !isSaved);
    else if (result.kind === "gone") await refresh();
    else setFailure(result.message);
    busyRef.current = false;
    setBusy(false);
  }

  return (
    <div className="save-control">
      <button type="button" className="secondary-button" aria-disabled={busy ? true : undefined} onClick={() => void toggle()}>
        {isSaved ? "Saved" : "Save"}
        {label}
        {isSaved && <span className="sr-only">. Remove from favourites</span>}
      </button>
      <p role="status" className={failure ? "state-note" : "sr-only"} data-testid="save-status">
        {failure}
      </p>
    </div>
  );
}
