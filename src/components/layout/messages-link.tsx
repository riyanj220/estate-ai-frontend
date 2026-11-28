"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { unreadLabel } from "@/components/layout/notifications-link";
import { INBOX_PATH, UNREAD_CHANGED, fetchUnreadConversations } from "@/lib/messaging/messaging";

/**
 * The header link to the inbox, with the number of Conversations holding something unread (Story 7.5). The number is read when the
 * link appears, on each navigation, on return to the tab and when a page says it changed. No timer, and no socket of its own.
 */
export function MessagesLink({ accountId }: { accountId: string }) {
  const pathname = usePathname();
  const [held, setHeld] = useState<{ owner: string; count: number } | null>(null);

  useEffect(() => {
    let ticket = 0;
    let reading = false;
    const read = () => {
      const mine = ++ticket;
      reading = true;
      void fetchUnreadConversations().then((count) => {
        if (mine !== ticket) return;
        reading = false;
        if (count !== null) setHeld({ owner: accountId, count });
      });
    };
    const onReturn = () => {
      if (!reading && document.visibilityState === "visible") read();
    };
    read();
    window.addEventListener(UNREAD_CHANGED, read);
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      ticket += 1;
      window.removeEventListener(UNREAD_CHANGED, read);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [accountId, pathname]);

  const label = unreadLabel(held?.owner === accountId ? held.count : null);
  return (
    <Link href={INBOX_PATH} className="text-link" aria-current={pathname === INBOX_PATH ? "page" : undefined} aria-label={label ? `Messages, ${label} unread` : undefined}>
      Messages
      {label && (
        <>
          {" "}
          <span className="unread-badge" data-testid="unread-messages">
            {label}
          </span>
        </>
      )}
    </Link>
  );
}
