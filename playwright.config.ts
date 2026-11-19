import { defineConfig } from "@playwright/test";

const STUB_PORT = 4010;
const APP_PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1, // tests share one stub backend
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
      command: `npx next dev -p ${APP_PORT}`,
      env: { BACKEND_URL: `http://127.0.0.1:${STUB_PORT}` },
      url: `http://127.0.0.1:${APP_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
