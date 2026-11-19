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
};

export default nextConfig;
