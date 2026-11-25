import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const STUB = STUB_URL;
const PAGE = "/dashboard";

// The stub backend holds module-level state, so these tests must not interleave.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

const setMode = (request: APIRequestContext, kind: string, value: string) => request.get(`${STUB}/__${kind}-mode?value=${value}`);
const allowance = (request: APIRequestContext, value: string) => setMode(request, "allowance", value);
const gets = async (request: APIRequestContext): Promise<number> => (await (await request.get(`${STUB}/__allowance-stats`)).json()).gets;

const card = (page: Page) => page.getByTestId("allowance-card");
const retryButton = (page: Page) => page.getByRole("main").getByRole("button", { name: "Retry" });
const summary = (page: Page) => page.getByTestId("allowance-summary");

async function startSession(page: Page, request: APIRequestContext, kind: "user" | "admin" = "user") {
  await request.get(`${STUB}/__force-session${kind === "admin" ? "?kind=admin" : ""}`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
}

async function open(page: Page, request: APIRequestContext, kind: "user" | "admin" = "user") {
  await startSession(page, request, kind);
  await page.goto(PAGE);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
}

async function expectNoViolations(page: Page, label: string) {
  await expect(page).toHaveTitle(/.+/);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];

test("open: the card shows used, remaining, a progress bar with its values and the reset date @smoke", async ({ page, request }) => {
  await open(page, request);
  await expect(card(page).getByRole("heading", { level: 2, name: "Publications this month" })).toBeVisible();
  await expect(summary(page)).toHaveText("1 of 2 used, 1 publication remaining");
  const bar = card(page).getByRole("progressbar", { name: "Publications this month" });
  await expect(bar).toHaveAttribute("max", "2");
  await expect(bar).toHaveAttribute("value", "1");
  await expect(page.getByTestId("allowance-reset")).toHaveText("Resets on 1 December 2026");
  expect(await gets(request)).toBe(1);
});

test("empty and plural: nothing used says all publications remain", async ({ page, request }) => {
  await allowance(request, "empty");
  await open(page, request);
  await expect(summary(page)).toHaveText("0 of 2 used, 2 publications remaining");
  await expect(card(page).getByRole("progressbar")).toHaveAttribute("value", "0");
});

test("an Agency sees its own limit", async ({ page, request }) => {
  await setMode(request, "me", "agency");
  await open(page, request);
  await expect(summary(page)).toHaveText("1 of 10 used, 9 publications remaining");
  await expect(card(page).getByRole("progressbar")).toHaveAttribute("max", "10");
});

test("exhausted: the message names the reset date and the bar is full", async ({ page, request }) => {
  await allowance(request, "exhausted");
  await open(page, request);
  await expect(summary(page)).toHaveText("2 of 2 used, 0 publications remaining");
  await expect(page.getByTestId("allowance-exhausted")).toHaveText("You have used all your publications this month. The allowance resets on 1 December 2026.");
  await expect(card(page).getByRole("progressbar")).toHaveAttribute("value", "2");
});

test("used above the limit (the limit was lowered) is shown as used and nothing remaining", async ({ page, request }) => {
  await allowance(request, "over");
  await open(page, request);
  await expect(summary(page)).toHaveText("4 of 2 used, 0 publications remaining");
  await expect(card(page).getByRole("progressbar")).toHaveAttribute("value", "2");
  await expect(page.getByTestId("allowance-exhausted")).toBeVisible();
});

test("the date is read in Asia/Karachi whatever the browser time zone is", async ({ browser, request }) => {
  await request.get(`${STUB}/__force-session`);
  // 2026-12-01 00:00 +05:00 is 2026-11-30 19:00 UTC: the same instant is still November in UTC and in the Americas.
  for (const timezoneId of ["UTC", "America/Los_Angeles", "Pacific/Pago_Pago", "Asia/Karachi"]) {
    const context = await browser.newContext({ timezoneId, baseURL: APP_URL });
    await context.addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
    const page = await context.newPage();
    await page.goto(PAGE);
    await expect(page.getByTestId("allowance-reset"), timezoneId).toHaveText("Resets on 1 December 2026");
    expect(await page.evaluate(() => new Date("2026-12-01T00:00:00+05:00").getMonth() + 1 === 12), `${timezoneId} browser month`).toBe(timezoneId === "Asia/Karachi");
    await context.close();
  }
});

test("year end: a reset in January names the next year", async ({ page, request }) => {
  await allowance(request, "year_end");
  await open(page, request);
  await expect(page.getByTestId("allowance-reset")).toHaveText("Resets on 1 January 2027");
});

test("the last publication: singular wording at the Agency limit", async ({ page, request }) => {
  await setMode(request, "me", "agency");
  await allowance(request, "last");
  await open(page, request);
  await expect(summary(page)).toHaveText("9 of 10 used, 1 publication remaining");
});

test("a limit of zero says so, with an empty bar and no exhausted message", async ({ page, request }) => {
  await allowance(request, "zero");
  await open(page, request);
  await expect(summary(page)).toHaveText("0 of 0 used, 0 publications remaining");
  await expect(page.getByTestId("allowance-none")).toHaveText("Your account has no publications this month.");
  await expect(page.getByTestId("allowance-exhausted")).toHaveCount(0);
  await expect(card(page).getByRole("progressbar")).toHaveAttribute("value", "0");
});

test("a suspended owner still sees the card", async ({ page, request }) => {
  await setMode(request, "signin", "suspended");
  await open(page, request);
  await expect(page.getByTestId("dashboard-state")).toHaveText("Account state: Account restricted");
  await expect(summary(page)).toHaveText("1 of 2 used, 1 publication remaining");
});

test("an unverified owner still sees the card", async ({ page, request }) => {
  await setMode(request, "signin", "unverified");
  await open(page, request);
  await expect(page.getByTestId("dashboard-state")).toHaveText("Account state: Email not verified");
  await expect(summary(page)).toHaveText("1 of 2 used, 1 publication remaining");
});

test("an administrator sees no card and sends no request @smoke", async ({ page, request }) => {
  await open(page, request, "admin");
  await expect(card(page)).toHaveCount(0);
  await expect(page.getByText("Publications this month")).toHaveCount(0);
  expect(await gets(request)).toBe(0);
});

test("a Visitor never reaches the card: the server redirects to sign in with no card markup @smoke", async ({ page, request }) => {
  const raw = await request.get(`${APP_URL}${PAGE}`, { maxRedirects: 0 });
  expect(raw.status()).toBe(307);
  expect(raw.headers().location).toContain("/sign-in?next=%2Fdashboard");
  const body = await raw.text();
  expect(body).not.toContain("Publications this month");
  expect(body).not.toContain("allowance");
  await page.goto(PAGE);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard$/);
  await expect(card(page)).toHaveCount(0);
  expect(await gets(request)).toBe(0);
});

test("the answer is never cached: a cacheable answer is not reused on reload", async ({ page, request }) => {
  await allowance(request, "cacheable");
  const [first] = await Promise.all([page.waitForResponse((r) => r.url().includes("/api/v1/me/publication-allowance")), open(page, request)]);
  expect(first.headers()["cache-control"]).toBeTruthy();
  await expect(summary(page)).toHaveText("1 of 2 used, 1 publication remaining");
  await allowance(request, "empty");
  await page.reload();
  await expect(summary(page)).toHaveText("0 of 2 used, 2 publications remaining");
  expect(await gets(request)).toBe(2); // a second request went out, the first answer was not reused
});

// ---------------------------------------------------------------- failures

for (const mode of ["error", "broken", "malformed", "float", "negative", "remaining_over_limit", "over_with_remaining", "bad_date", "bad_zone", "missing", "remaining_mismatch", "remaining_mismatch_high", "no_offset", "odd_date", "mid_month", "extra_key"]) {
  test(`fail closed: ${mode} shows the failure and Retry, never a number`, async ({ page, request }) => {
    await allowance(request, mode);
    await open(page, request);
    await expect(page.getByRole("heading", { level: 2, name: "We could not load your publication allowance" })).toBeVisible();
    await expect(retryButton(page)).toBeVisible();
    await expect(page.getByTestId("allowance-summary")).toHaveCount(0);
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(page.getByText("Internal detail")).toHaveCount(0);
    // The rest of the dashboard is intact.
    await expect(page.getByTestId("dashboard-name")).toBeVisible();
  });
}

test("Retry shows its Retrying state, then loads and moves focus to the card heading", async ({ page, request }) => {
  await allowance(request, "error");
  await open(page, request);
  const retry = retryButton(page);
  await expect(retry).toBeVisible();
  await allowance(request, "hang");
  await page.clock.install();
  await retry.click();
  await expect(retry).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Retrying…")).toBeVisible();
  await page.clock.runFor(21_000); // the hung read times out and the button is usable again
  await expect(retry).not.toHaveAttribute("aria-disabled", "true");
  await allowance(request, "ok");
  await retry.click();
  await expect(summary(page)).toHaveText("1 of 2 used, 1 publication remaining");
  await expect(card(page).getByRole("heading", { name: "Publications this month" })).toBeFocused();
});

test("a hung request times out into the failure state with Retry", async ({ page, request }) => {
  await allowance(request, "hang");
  await startSession(page, request);
  await page.clock.install();
  await page.goto(PAGE);
  await expect(page.getByTestId("profile-loading")).toBeVisible();
  await page.clock.runFor(21_000);
  await expect(retryButton(page)).toBeVisible();
  await expect(page.getByTestId("allowance-summary")).toHaveCount(0);
});

const focusWindow = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("focus")));

test("returning to the tab re-reads quietly, at most once per five seconds", async ({ page, request }) => {
  await open(page, request);
  await expect(summary(page)).toHaveText("1 of 2 used, 1 publication remaining");
  await page.clock.install();
  await allowance(request, "empty");
  await focusWindow(page);
  await expect(summary(page)).toHaveText("0 of 2 used, 2 publications remaining");
  await expect(page.getByTestId("profile-loading")).toHaveCount(0);
  expect(await gets(request)).toBe(2);
  // focus and visibility together, and a second focus soon after, send nothing more
  await allowance(request, "exhausted");
  await focusWindow(page);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.clock.runFor(1000);
  expect(await gets(request)).toBe(2);
  await expect(summary(page)).toHaveText("0 of 2 used, 2 publications remaining");
  await page.clock.runFor(5000);
  await focusWindow(page);
  await expect(summary(page)).toHaveText("2 of 2 used, 0 publications remaining");
  expect(await gets(request)).toBe(3);
});

test("a failed quiet re-read keeps the numbers with a note, and the next good one clears it", async ({ page, request }) => {
  await open(page, request);
  await expect(summary(page)).toBeVisible();
  await page.clock.install();
  await allowance(request, "error");
  await focusWindow(page);
  await expect(page.getByTestId("allowance-stale")).toHaveText("These numbers may be out of date. We could not refresh them.");
  await expect(summary(page)).toHaveText("1 of 2 used, 1 publication remaining");
  await expect(retryButton(page)).toHaveCount(0);
  await allowance(request, "empty");
  await page.clock.runFor(6000);
  await focusWindow(page);
  await expect(summary(page)).toHaveText("0 of 2 used, 2 publications remaining");
  await expect(page.getByTestId("allowance-stale")).toHaveCount(0);
});

test("a 401 on a quiet re-read goes to sign in once", async ({ page, request }) => {
  await open(page, request);
  await expect(summary(page)).toBeVisible();
  await allowance(request, "session_gone");
  await focusWindow(page);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard$/);
  await expect(card(page)).toHaveCount(0);
  expect(await gets(request)).toBe(2);
});

test("a throttled answer shows the wait", async ({ page, request }) => {
  await allowance(request, "rate_limited");
  await open(page, request);
  await expect(page.getByTestId("load-error-message")).toContainText("Too many attempts");
});

test("a 403 shows no card and no error", async ({ page, request }) => {
  await allowance(request, "forbidden");
  await open(page, request);
  await expect(page.getByTestId("dashboard-name")).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  await expect(retryButton(page)).toHaveCount(0);
});

test("a 401 sends the person back to sign in and returns to the dashboard", async ({ page, request }) => {
  await allowance(request, "session_gone");
  await open(page, request);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard$/);
});

test("loading: the status shows while the request is open", async ({ page, request }) => {
  await allowance(request, "hang");
  await startSession(page, request);
  await page.goto(PAGE);
  await expect(page.getByTestId("profile-loading")).toHaveText("Loading your publication allowance…");
  await expect(page.getByTestId("dashboard-name")).toBeVisible();
  await expect(summary(page)).toHaveCount(0);
});

// ---------------------------------------------------------------- accessibility

for (const viewport of viewports) {
  for (const mode of ["ok", "empty", "exhausted", "error"]) {
    test(`axe: ${mode} at ${viewport.name} width has no violations`, async ({ page, request }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await allowance(request, mode);
      await open(page, request);
      await expect(card(page).or(retryButton(page))).toBeVisible();
      await expectNoViolations(page, `${mode} ${viewport.name}`);
    });
  }
  test(`axe: loading at ${viewport.name} width has no violations`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await allowance(request, "hang");
    await startSession(page, request);
    await page.goto(PAGE);
    await expect(page.getByTestId("profile-loading")).toBeVisible();
    await expectNoViolations(page, `loading ${viewport.name}`);
  });
}
