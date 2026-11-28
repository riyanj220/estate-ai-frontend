import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SessionProvider } from "@/lib/session";
import { UnreadCountProvider } from "@/lib/use-unread-count";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "./globals.css";
import "./design.css";

export const metadata: Metadata = {
  title: "EstateAI",
  description: "Property for sale and rent in Karachi, with AI help to search and list.",
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
