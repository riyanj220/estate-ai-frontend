"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUnreadCount } from "@/lib/use-unread-count";

export const NOTIFICATIONS_PATH = "/account/notifications";

/** The count as shown: nothing at zero or unknown, "99+" above 99. */
export function unreadLabel(count: number | null): string {
  if (!count || count <= 0) return "";
  return count > 99 ? "99+" : String(count);
}

/** The header link to the notifications page. With unread items it reads "Notifications, 3 unread" (text, not colour). */
export function NotificationsLink() {
  const { count } = useUnreadCount();
  const label = unreadLabel(count);
  const pathname = usePathname();
  return (
    <Link href={NOTIFICATIONS_PATH} className="text-link" aria-current={pathname === NOTIFICATIONS_PATH ? "page" : undefined} aria-label={label ? `Notifications, ${label} unread` : undefined}>
      Notifications
      {label && (
        <>
          {" "}
          <span className="unread-badge" data-testid="unread-count">
            {label}
          </span>
        </>
      )}
    </Link>
  );
}
