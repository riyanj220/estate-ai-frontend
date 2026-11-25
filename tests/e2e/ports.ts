// Ports of this shard's stub backend and app server. The Playwright config sets E2E_STUB_PORT / E2E_APP_PORT from E2E_SHARD
// (see playwright.config.ts); workers inherit them. Shard 0 (the default) is 4010 / 3100.
export const STUB_PORT = Number(process.env.E2E_STUB_PORT ?? 4010);
export const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3100);
export const STUB_URL = `http://127.0.0.1:${STUB_PORT}`;
export const APP_URL = `http://127.0.0.1:${APP_PORT}`;
// For toHaveURL(...) patterns: the app origin as a regex source.
export const APP_ORIGIN_RE = `127\\.0\\.0\\.1:${APP_PORT}`;
