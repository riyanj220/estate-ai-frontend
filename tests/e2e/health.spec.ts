import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL, STUB_PORT } from "./ports";
import { expect, test } from "@playwright/test";

const STUB = STUB_URL;

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

test("health page shows ok and has no accessibility violations @smoke", async ({ page }) => {
  await page.goto("/health");
  await expect(page.getByTestId("health-status")).toHaveText("Status: ok");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("health page shows unavailable when the backend reports 503 @smoke", async ({ page, request }) => {
  await request.get(`${STUB}/__mode?value=down`);
  await page.goto("/health");
  await expect(page.getByTestId("health-status")).toHaveText("Status: unavailable");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("health page shows unavailable when the backend connection fails @smoke", async ({ page, request }) => {
  await request.get(`${STUB}/__mode?value=broken`);
  await page.goto("/health");
  await expect(page.getByTestId("health-status")).toHaveText("Status: unavailable");
  await expect(page.locator("body")).not.toContainText(/ECONNRESET|fetch failed|stack/i);
});

test("health page forwards the incoming cookie to the backend", async ({ page, context, request }) => {
  await request.get(`${STUB}/__reset`);
  await context.addCookies([{ name: "sessionid", value: "abc123", url: APP_URL }]);
  await page.goto("/health");
  const seen = await (await request.get(`${STUB}/__last-cookie`)).json();
  expect(seen.cookie).toContain("sessionid=abc123");
});

test("/api/* is proxied to the backend on the same origin", async ({ request }) => {
  const response = await request.get("/api/v1/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("health page shows unavailable when the backend never answers", async ({ page, request }) => {
  test.setTimeout(30_000);
  await request.get(`${STUB}/__mode?value=hang`);
  await page.goto("/health");
  await expect(page.getByTestId("health-status")).toHaveText("Status: unavailable");
});

for (const mode of ["broken", "down"]) {
  test(`proxy fails cleanly with no backend detail when the backend is ${mode}`, async ({ request }) => {
    await request.get(`${STUB}/__mode?value=${mode}`);
    const response = await request.get("/api/v1/health");
    if (mode === "down") {
      expect(response.status()).toBe(503); // passed through from the backend
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(500);
      expect(response.status()).toBeLessThan(600);
    }
    const body = await response.text();
    expect(body).not.toMatch(new RegExp(`ECONNRESET|127\\.0\\.0\\.1|${STUB_PORT}|stack|at .*\\(.*:\\d+`, "i"));
    // The app is still up afterwards.
    await request.get(`${STUB}/__reset`);
    expect((await request.get("/api/v1/health")).status()).toBe(200);
  });
}

test("stub rejects unknown modes", async ({ request }) => {
  expect((await request.get(`${STUB}/__mode?value=bogus`)).status()).toBe(400);
});

test("placeholder routes have no accessibility violations", async ({ page }) => {
  for (const path of ["/", "/dashboard", "/admin"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, path).toEqual([]);
  }
});

test("route groups render their placeholders", async ({ page, request }) => {
  // The signed-in and admin areas are guarded (Stories 1.17 and 1.23): give the stub a live administrator session cookie first.
  await request.get(`${STUB}/__force-session?kind=admin`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
  for (const [path, heading] of [
    ["/", "Find the home that fits your life"],
    ["/dashboard", "Dashboard"],
    ["/admin", "Administration"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
});
