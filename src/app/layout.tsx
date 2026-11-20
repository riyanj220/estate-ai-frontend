import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SessionProvider } from "@/lib/session";
import { UnreadCountProvider } from "@/lib/use-unread-count";
import "./globals.css";

export const metadata: Metadata = {
  title: "EstateAI",
  description: "EstateAI property marketplace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <UnreadCountProvider>
            <SiteHeader />
            {children}
          </UnreadCountProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
