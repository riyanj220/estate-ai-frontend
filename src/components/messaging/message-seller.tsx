"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { MessageForm } from "@/components/messaging/message-form";
import { canOwnListings } from "@/lib/account/account";
import { conversationPath, findInquiry, startInquiry } from "@/lib/messaging/messaging";
import { safeNext } from "@/lib/auth/next-target";
import { useSession } from "@/lib/auth/session";

/**
 * "Message seller" on a public Listing (Story 7.1). A Visitor is asked to sign in; administrators have no button. An existing
 * Conversation is opened; otherwise the inquiry form is. Who may send is the backend's answer.
 */
export function MessageSeller({ listingId }: { listingId: string }) {
  const { status, account, refresh } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState("");
  const busy = useRef(false);

  if (status !== "signed_in" && status !== "signed_out") return null;

  if (status === "signed_out") {
    const next = encodeURIComponent(safeNext(pathname));
    return (
      <div className="save-control">
        <button type="button" className="primary-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          Message seller
        </button>
        <p role="status" className={open ? "save-note" : "sr-only"} data-testid="message-prompt">
          {open && (
            <>
              <Link href={`/sign-in?next=${next}`} className="text-link">
                Sign in
              </Link>{" "}
              or{" "}
              <Link href="/register" className="text-link">
                create an account
              </Link>{" "}
              to message the seller.
            </>
          )}
        </p>
      </div>
    );
  }

  if (!account || !canOwnListings(account.account_type)) return null;

  async function press() {
    if (busy.current || open) return;
    busy.current = true;
    setFailure("");
    const found = await findInquiry(listingId);
    busy.current = false;
    if (found.kind === "gone") await refresh();
    else if (found.kind === "failed") setFailure(found.message);
    else if (found.conversationId) router.push(conversationPath(found.conversationId));
    else setOpen(true);
  }

  async function send(body: string, key: string): Promise<string> {
    const result = await startInquiry(listingId, body, key);
    if (result.kind === "ok") router.push(conversationPath(result.conversationId));
    else if (result.kind === "gone") await refresh();
    else return result.message;
    return "";
  }

  return (
    <div className="save-control">
      <button type="button" className="primary-button" aria-expanded={open} onClick={() => void press()}>
        Message seller
      </button>
      <p role="status" className={failure ? "state-note" : "sr-only"} data-testid="message-status">
        {failure}
      </p>
      {open && <MessageForm label="Your message to the seller" send={send} onCancel={() => setOpen(false)} />}
    </div>
  );
}
