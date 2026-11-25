import type { NextConfig } from "next";
import { backendUrl } from "./src/lib/backend-url";

// The browser only talks to its own origin; Next.js proxies /api/* to Django.
// BACKEND_URL is read when this config loads (build time for `next build`).
const target = backendUrl();

const nextConfig: NextConfig = {
  // Parallel e2e shards each run their own dev server and need their own build directory (set by playwright.config.ts).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1"],
  // Next.js buffers a request body for a proxied path up to this size (default 10 MB) and answers 500 beyond it, even with `/api/` excluded
  // from the page proxy's matcher. Uploads are at most 6 MiB (the backend's cap, which refuses a bigger body itself with a 400), and the
  // Images section never sends more, so this only makes sure a bigger body reaches the backend's own answer. `check:prod-listings` proves it.
  experimental: { proxyClientMaxBodySize: "32mb" },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
  // The link carries a single-use token: no referrer leaks it and no cache keeps the page.
  async headers() {
    return [
      {
        source: "/verify-email",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/reset-password",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/confirm-email-change",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      // Signed-in areas depend on the session cookie: never cache them.
      { source: "/dashboard/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/account/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/sign-in", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
