import { defineConfig } from "@playwright/test";

// One shard = one stub backend + one Next dev server + one Playwright worker, on ports derived from E2E_SHARD (0-based). The stub keeps
// global mutable state (modes, counters), so tests of different shards must never share one. `npm run test:e2e` starts several shards
// in parallel (scripts/e2e.mjs); a bare `npx playwright test` runs everything serially on shard 0 (4010 / 3100) as before.
const SHARD = Number(process.env.E2E_SHARD ?? 0);
const PARALLEL = Number(process.env.E2E_SHARDS ?? 1) > 1;
// E2E_SERVER=start serves a production build (`next build` once per run, then `next start`) instead of `next dev`: much less CPU.
const PROD = process.env.E2E_SERVER === "start";
const STUB_PORT = 4010 + SHARD;
const APP_PORT = 3100 + SHARD;
// Read by tests/e2e/ports.ts (workers load this config too, so they see the same values).
process.env.E2E_STUB_PORT = String(STUB_PORT);
process.env.E2E_APP_PORT = String(APP_PORT);

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1, // tests inside a shard share its stub backend
  // Several dev servers and browsers compete for the cores: more headroom than the 30 s / 5 s defaults.
  timeout: PARALLEL ? 60_000 : 30_000,
  expect: { timeout: PARALLEL ? 10_000 : 5_000 },
  outputDir: `test-results/shard-${SHARD}`,
  // PW_CHANNEL=chrome runs against an installed Chrome instead of the downloaded Chromium.
  use: { baseURL: `http://127.0.0.1:${APP_PORT}`, channel: process.env.PW_CHANNEL || undefined },
  webServer: [
    {
      command: "node tests/e2e/stub-backend.mjs",
      env: { STUB_PORT: String(STUB_PORT) },
      url: `http://127.0.0.1:${STUB_PORT}/__ping`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: PROD ? `npx next build && npx next start -p ${APP_PORT}` : `npx next dev -p ${APP_PORT}`,
      // Each server needs its own build directory (Next locks it, and the stub URL is baked into a build); shard 0 keeps the
      // default .next for dev only.
      env: { BACKEND_URL: `http://127.0.0.1:${STUB_PORT}`, ...(SHARD > 0 || PROD ? { NEXT_DIST_DIR: `.next-e2e-${SHARD}` } : {}) },
      url: `http://127.0.0.1:${APP_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: PROD ? 400_000 : 180_000,
    },
  ],
});
