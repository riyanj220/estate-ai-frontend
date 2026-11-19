import type { NextConfig } from "next";
import { backendUrl } from "./src/lib/backend-url";

// The browser only talks to its own origin; Next.js proxies /api/* to Django.
// BACKEND_URL is read when this config loads (build time for `next build`).
const target = backendUrl();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
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
      // Signed-in areas depend on the session cookie: never cache them.
      { source: "/dashboard/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/sign-in", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
