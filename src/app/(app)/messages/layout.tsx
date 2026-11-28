import { Messenger } from "@/components/messaging/messenger";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <Messenger>{children}</Messenger>;
}
