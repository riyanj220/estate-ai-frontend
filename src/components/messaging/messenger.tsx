"use client";

import { usePathname } from "next/navigation";
import { ConversationList } from "@/components/messaging/conversation-list";
import { INBOX_PATH } from "@/lib/messaging/messaging";

/** The two panes of Messages: every conversation on the left, the open one on the right. A phone shows one at a time. */
export function Messenger({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const index = pathname === INBOX_PATH;
  return (
    <div className="app-wide grid h-[calc(100vh-9rem)] min-h-[32rem] grid-cols-[minmax(0,22rem)_minmax(0,1fr)] overflow-hidden rounded-large border border-line bg-surface max-[861px]:h-auto max-[861px]:grid-cols-[minmax(0,1fr)]">
      <div className={`flex min-h-0 flex-col border-r border-line bg-bg max-[861px]:border-r-0 ${index ? "" : "max-[861px]:hidden"}`}>
        <ConversationList />
      </div>
      <div className={`flex min-h-0 min-w-0 flex-col ${index ? "max-[861px]:hidden" : ""}`}>{children}</div>
    </div>
  );
}
