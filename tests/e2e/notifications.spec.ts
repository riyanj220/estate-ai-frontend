import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const STUB = STUB_URL;
const APP = APP_URL;
const PAGE = "/account/notifications";
const THROTTLED = "Too many attempts. Try again in 2 minutes.";
const SERVER = "Something went wrong on our side. Please try again in a moment.";
const NETWORK = "We could not reach the server. Check your connection and try again.";
const REJECTED = "This request could not be submitted. Please try again.";
const PASSWORD_TITLE = "Your password was changed.";
const PASSWORD_TEXT = "If this was not you, reset your password and contact support.";
const EMAIL_TITLE = "Your sign-in email address was changed.";
const EMAIL_TEXT = "If this was not you, contact support.";
const UNKNOWN_TITLE = "You have a notification.";
// The stub puts this in the payload of an unregistered kind; it must never reach the page.
const SECRET = "payload canary text";

// The stub backend holds module-level state, so these tests must not interleave.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

type Mode = "notifications" | "notification-read" | "notification-readall" | "unread-count" | "me" | "csrf";
const setMode = (request: APIRequestContext, kind: Mode, value: string) => request.get(`${STUB}/__${kind}-mode?value=${value}`);
const preset = (request: APIRequestContext, value: string) => request.get(`${STUB}/__notifications-preset?value=${value}`);
const stats = async (request: APIRequestContext) => (await request.get(`${STUB}/__notifications-stats`)).json();
const session = async (request: APIRequestContext) => (await request.get(`${STUB}/__session-stats`)).json();

const header = (page: Page) => page.getByRole("banner");
const items = (page: Page) => page.getByTestId("notification");
const status = (page: Page) => page.getByTestId("notifications-status");
const markButtons = (page: Page) => page.getByRole("button", { name: /^Mark as read/ });
const markAll = (page: Page) => page.getByRole("button", { name: "Mark all as read" });
const loadMore = (page: Page) => page.getByRole("button", { name: "Load more" });
const filterButton = (page: Page, name: "All" | "Unread") => page.getByRole("button", { name, exact: true });
const bellLink = (page: Page) => page.getByRole("link", { name: /^Notifications/ });

/** Gives the stub a live session of the given kind and the browser its cookie. */
async function startSession(page: Page, request: APIRequestContext, kind: "user" | "admin" = "user") {
  await request.get(`${STUB}/__force-session${kind === "admin" ? "?kind=admin" : ""}`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP }]);
}

async function open(page: Page, request: APIRequestContext, kind: "user" | "admin" = "user") {
  await startSession(page, request, kind);
  await page.goto(PAGE);
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  await expect(items(page).first().or(page.getByTestId("notifications-empty"))).toBeVisible();
}

async function expectNoViolations(page: Page, label: string) {
  await expect(page).toHaveTitle(/.+/); // the title can stream in after the body on a production server
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];

// ---------------------------------------------------------------- guard, caching, visitors

test("guard: a Visitor is redirected to sign in with next and sees no content @smoke", async ({ page, request }) => {
  const raw = await request.get(`${APP}${PAGE}`, { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(raw.status());
  expect(raw.headers().location).toContain("/sign-in?next=%2Faccount%2Fnotifications");
  expect(await raw.text()).not.toContain("Mark all as read");
  await page.goto(PAGE);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fnotifications$/);
  await expect(page.getByRole("heading", { name: "Notifications" })).toHaveCount(0);
  expect((await stats(request)).gets).toBe(0);
});

test("the page is not cacheable @smoke", async ({ page, request }) => {
  await startSession(page, request);
  const response = await page.goto(PAGE);
  expect(response?.headers()["cache-control"]).toContain("no-store");
});

test("a Visitor sees no Notifications link and the unread count is never requested @smoke", async ({ page, request }) => {
  await page.goto("/");
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(bellLink(page)).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  expect((await stats(request)).countGets).toBe(0);
});

// ---------------------------------------------------------------- the list

test("open: newest first with title, detail, time and an Unread marker in text; the heading is a focus target @smoke", async ({ page, request }) => {
  await open(page, request);
  await expect(items(page)).toHaveCount(20);
  const first = items(page).first();
  await expect(first.locator(".notification-title")).toHaveText(EMAIL_TITLE);
  await expect(first).toContainText(EMAIL_TEXT);
  await expect(first.getByText("Unread", { exact: true })).toBeVisible();
  await expect(first.locator("time")).toHaveAttribute("datetime", "2026-11-20T09:35:00.000Z");
  await expect(first.locator("time")).toHaveText(/2026/);
  const second = items(page).nth(1); // seq 24: password changed, already read
  await expect(second.locator(".notification-title")).toHaveText(PASSWORD_TITLE);
  await expect(second).toContainText(PASSWORD_TEXT);
  await expect(second.getByText("Unread", { exact: true })).toHaveCount(0);
  await expect(second.getByRole("button")).toHaveCount(0);
  await expect(page.getByTestId("unread-summary")).toHaveText("13 unread");
  await expect(page.locator("#notifications-title")).toHaveAttribute("tabindex", "-1");
  expect((await stats(request)).queries[0]).toContain("state=all");
});

test("known kinds use the catalogue; an unknown kind is generic and shows no payload", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await expect(items(page)).toHaveCount(3);
  await expect(items(page).nth(0).locator(".notification-title")).toHaveText(PASSWORD_TITLE);
  await expect(items(page).nth(0)).toContainText(PASSWORD_TEXT);
  await expect(items(page).nth(1).locator(".notification-title")).toHaveText(UNKNOWN_TITLE);
  await expect(items(page).nth(1).locator("p")).toHaveCount(0); // no detail line, no payload
  await expect(items(page).nth(2).locator(".notification-title")).toHaveText(EMAIL_TITLE);
  await expect(items(page).nth(2)).toContainText(EMAIL_TEXT);
  expect(await page.locator("body").innerText()).not.toContain(SECRET);
  expect(await page.content()).not.toContain(SECRET);
});

test("empty: all, and the unread wording", async ({ page, request }) => {
  await preset(request, "empty");
  await open(page, request);
  await expect(page.getByTestId("notifications-empty")).toHaveText("You have no notifications.");
  await expect(loadMore(page)).toHaveCount(0);
  await filterButton(page, "Unread").click();
  await expect(page.getByTestId("notifications-empty")).toHaveText("You have no unread notifications.");
});

test("load failure: message with Retry kept mounted, then recovery with focus on the heading", async ({ page, request }) => {
  await setMode(request, "notifications", "error");
  await startSession(page, request);
  await page.goto(PAGE);
  await expect(page.getByRole("heading", { name: "We could not load your notifications" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Internal detail");
  const retry = page.getByRole("button", { name: "Retry" });
  await retry.click();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible(); // still mounted while retrying
  await setMode(request, "notifications", "ok");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(items(page)).toHaveCount(20);
  await expect(page.locator("#notifications-title")).toBeFocused();
});

for (const mode of ["flaky", "broken", "malformed"]) {
  test(`load failure (${mode}) shows the message and Retry`, async ({ page, request }) => {
    await setMode(request, "notifications", mode);
    await startSession(page, request);
    await page.goto(PAGE);
    await expect(page.getByRole("heading", { name: "We could not load your notifications" })).toBeVisible();
    await setMode(request, "notifications", "ok");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(items(page)).toHaveCount(20);
  });
}

test("session gone (401) signs out and goes to the sign-in with next", async ({ page, request }) => {
  await setMode(request, "notifications", "session_gone");
  await startSession(page, request);
  await page.goto(PAGE);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fnotifications$/);
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(bellLink(page)).toHaveCount(0);
});

test("session gone for an administrator goes to the admin sign-in", async ({ page, request }) => {
  await setMode(request, "notifications", "session_gone");
  await startSession(page, request, "admin");
  await page.goto(PAGE);
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
});

// ---------------------------------------------------------------- filter and load more

test("filter: Unread reloads from the server with state=unread and resets the list; All goes back", async ({ page, request }) => {
  await open(page, request);
  await expect(filterButton(page, "All")).toHaveAttribute("aria-pressed", "true");
  await expect(filterButton(page, "Unread")).toHaveAttribute("aria-pressed", "false");
  await filterButton(page, "Unread").click();
  await expect(filterButton(page, "Unread")).toHaveAttribute("aria-pressed", "true");
  await expect(filterButton(page, "All")).toHaveAttribute("aria-pressed", "false");
  await expect(items(page)).toHaveCount(13);
  await expect(items(page).filter({ hasText: "Unread" })).toHaveCount(13);
  const queries = (await stats(request)).queries as string[];
  expect(queries.at(-1)).toContain("state=unread");
  expect(queries.at(-1)).not.toContain("cursor");
  await filterButton(page, "All").click();
  await expect(items(page)).toHaveCount(20);
  expect(((await stats(request)).queries as string[]).at(-1)).toContain("state=all");
});

test("filter reload failure shows Retry and keeps the filter buttons", async ({ page, request }) => {
  await open(page, request);
  await setMode(request, "notifications", "error");
  await filterButton(page, "Unread").click();
  await expect(page.getByRole("heading", { name: "We could not load your notifications" })).toBeVisible();
  await expect(filterButton(page, "Unread")).toHaveAttribute("aria-pressed", "true");
  await setMode(request, "notifications", "ok");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(items(page)).toHaveCount(13);
});

test("load more follows the server cursor, appends, and disappears at the end", async ({ page, request }) => {
  await open(page, request);
  await expect(items(page)).toHaveCount(20);
  await loadMore(page).click();
  await expect(items(page)).toHaveCount(25);
  await expect(loadMore(page)).toHaveCount(0);
  const queries = (await stats(request)).queries as string[];
  expect(queries.at(-1)).toContain("cursor=pos-6");
  await expect(status(page)).toHaveText("5 more notifications loaded.");
  await expect(items(page).nth(20)).toBeFocused(); // the first appended item
});

test("load more under the Unread filter keeps the filter in the request", async ({ page, request }) => {
  await preset(request, "unread_pages");
  await open(page, request);
  await filterButton(page, "Unread").click();
  await expect(items(page)).toHaveCount(20);
  await loadMore(page).click();
  await expect(items(page)).toHaveCount(30);
  const last = ((await stats(request)).queries as string[]).at(-1)!;
  expect(last).toContain("state=unread");
  expect(last).toContain("cursor=");
});

test("load more never shows an item twice", async ({ page, request }) => {
  await setMode(request, "notifications", "dup");
  await open(page, request);
  await loadMore(page).click();
  await expect(items(page)).toHaveCount(25);
  const titles = await items(page).locator(".notification-title").allTextContents();
  expect(titles).toHaveLength(25);
});

test("a load-more failure keeps the list and offers a retry message; retrying works", async ({ page, request }) => {
  await setMode(request, "notifications", "more_fail");
  await open(page, request);
  await loadMore(page).click();
  await expect(status(page)).toHaveText(SERVER);
  await expect(items(page)).toHaveCount(20);
  await expect(loadMore(page)).toBeVisible();
  await setMode(request, "notifications", "ok");
  await loadMore(page).click();
  await expect(items(page)).toHaveCount(25);
});

// ---------------------------------------------------------------- mark one read

test("mark one read: the item becomes read in place, the header count drops, one request with the token", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 2 unread");
  const target = items(page).first();
  await target.getByRole("button", { name: /^Mark as read/ }).click();
  await expect(target.getByText("Unread", { exact: true })).toHaveCount(0);
  await expect(target.getByRole("button")).toHaveCount(0);
  await expect(items(page)).toHaveCount(3);
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 1 unread");
  await expect(status(page)).toHaveText("Notification marked as read.");
  await expect(target).toBeFocused();
  const after = await stats(request);
  expect(after.readCount).toBe(1);
  expect(after.lastReadToken).toBe((await session(request)).csrfToken);
  expect(after.unread).toBe(1);
});

test("mark read under the Unread filter removes the item and moves focus to the next one, then the heading", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await filterButton(page, "Unread").click();
  await expect(items(page)).toHaveCount(2);
  await items(page).first().getByRole("button", { name: /^Mark as read/ }).click();
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first().locator(".notification-title")).toHaveText(UNKNOWN_TITLE);
  await expect(items(page).first()).toBeFocused();
  await markButtons(page).click();
  await expect(page.getByTestId("notifications-empty")).toHaveText("You have no unread notifications.");
  await expect(page.locator("#notifications-title")).toBeFocused();
  await expect(header(page).getByRole("link", { name: "Notifications", exact: true })).toBeVisible();
});

test("marking an item that is already gone (404) removes it quietly and refreshes the count", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await setMode(request, "notification-read", "gone");
  await items(page).first().getByRole("button", { name: /^Mark as read/ }).click();
  await expect(items(page)).toHaveCount(2);
  await expect(status(page)).toHaveText("");
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 1 unread");
});

const failures: Array<[string, string, string]> = [
  ["error", "5xx", SERVER],
  ["broken", "dropped upstream connection", SERVER], // the proxy answers 5xx when the backend drops the connection
  ["abort", "network", NETWORK], // the browser's request itself fails
  ["rate_limited", "429", THROTTLED],
  ["csrf_always", "second 403", REJECTED],
  ["forbidden", "403", REJECTED],
];
for (const [mode, label, message] of failures) {
  test(`mark read failure (${label}) shows a polite message and the item stays unread`, async ({ page, request }) => {
    await preset(request, "few");
    await open(page, request);
    if (mode === "abort") await page.route("**/api/v1/notifications/*/read", (route) => route.abort());
    else await setMode(request, "notification-read", mode);
    await items(page).first().getByRole("button", { name: /^Mark as read/ }).click();
    await expect(status(page)).toHaveText(message);
    await expect(status(page)).toHaveAttribute("aria-live", "polite");
    await expect(items(page).first().getByText("Unread", { exact: true })).toBeVisible();
    await expect(bellLink(page)).toHaveAccessibleName("Notifications, 2 unread");
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await page.unroute("**/api/v1/notifications/*/read");
    await setMode(request, "notification-read", "ok");
    await items(page).first().getByRole("button", { name: /^Mark as read/ }).click();
    await expect(items(page).first().getByText("Unread", { exact: true })).toHaveCount(0);
  });
}

test("mark read: a 401 signs out and goes to the sign-in", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await setMode(request, "notification-read", "session_gone");
  await items(page).first().getByRole("button", { name: /^Mark as read/ }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fnotifications$/);
});

test("CSRF self-heal: a first 403 refetches the token and retries once", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await setMode(request, "notification-read", "csrf_once");
  await items(page).first().getByRole("button", { name: /^Mark as read/ }).click();
  await expect(items(page).first().getByText("Unread", { exact: true })).toHaveCount(0);
  const after = await stats(request);
  expect(after.readCount).toBe(2);
  expect(after.lastReadToken).toBe((await session(request)).csrfToken);
  await expect(status(page)).toHaveText("Notification marked as read.");
});

test("double click on Mark as read sends exactly one request", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await setMode(request, "notification-read", "hang");
  const button = items(page).first().getByRole("button", { name: /^Mark as read/ });
  await button.dblclick();
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await page.waitForTimeout(300);
  expect((await stats(request)).readCount).toBe(1);
});

// ---------------------------------------------------------------- mark all read

test("mark all read: everything read in place, count zero, one announcement with the number", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  const getsBefore = (await stats(request)).gets;
  await markAll(page).click();
  await expect(status(page)).toHaveText("2 notifications marked as read.");
  await expect(items(page).getByText("Unread", { exact: true })).toHaveCount(0);
  await expect(markButtons(page)).toHaveCount(0);
  await expect(bellLink(page)).toHaveAccessibleName("Notifications");
  await expect(page.getByTestId("unread-summary")).toHaveText("0 unread");
  await expect(markAll(page)).toHaveAttribute("aria-disabled", "true");
  await expect(markAll(page)).toBeFocused();
  const after = await stats(request);
  expect(after.gets).toBe(getsBefore); // the loaded list is kept, not replaced by page one
  expect(after.readAllCount).toBe(1);
  expect(after.lastReadAllToken).toBe((await session(request)).csrfToken);
  expect(after.unread).toBe(0);
});

test("mark all read says the singular for one", async ({ page, request }) => {
  await preset(request, "one_unread");
  await open(page, request);
  await markAll(page).click();
  await expect(status(page)).toHaveText("1 notification marked as read.");
});

test("mark all read under the Unread filter leaves the empty unread state", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await filterButton(page, "Unread").click();
  await expect(items(page)).toHaveCount(2);
  await markAll(page).click();
  await expect(page.getByTestId("notifications-empty")).toHaveText("You have no unread notifications.");
  await expect(status(page)).toHaveText("2 notifications marked as read.");
});

test("mark all read when none are unread: the button is disabled and sends nothing", async ({ page, request }) => {
  await preset(request, "all_read");
  await open(page, request);
  await expect(markAll(page)).toBeDisabled();
  await markAll(page).click({ force: true });
  await expect(status(page)).toHaveText("No unread notifications.");
  expect((await stats(request)).readAllCount).toBe(0);
  await expect(bellLink(page)).toHaveAccessibleName("Notifications");
});

test("mark all read when the server marked nothing says so", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await setMode(request, "unread-count", "error"); // the header count keeps its last value, so the page cannot know yet
  await request.get(`${STUB}/__notifications-read-elsewhere?n=5`); // read in another tab
  await markAll(page).click();
  await expect(status(page)).toHaveText("No unread notifications.");
});

test("double click on Mark all as read sends exactly one request", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await setMode(request, "notification-readall", "hang");
  await markAll(page).dblclick();
  await page.waitForTimeout(300);
  expect((await stats(request)).readAllCount).toBe(1);
});

const allFailures: Array<[string, string]> = [
  ["error", SERVER],
  ["broken", SERVER],
  ["abort", NETWORK],
  ["rate_limited", THROTTLED],
  ["csrf_always", REJECTED],
];
for (const [mode, message] of allFailures) {
  test(`mark all read failure (${mode}) shows a message and keeps the list unread`, async ({ page, request }) => {
    await preset(request, "few");
    await open(page, request);
    if (mode === "abort") await page.route("**/api/v1/notifications/read-all", (route) => route.abort());
    else await setMode(request, "notification-readall", mode);
    await markAll(page).click();
    await expect(status(page)).toHaveText(message);
    await expect(markButtons(page)).toHaveCount(2);
    await expect(bellLink(page)).toHaveAccessibleName("Notifications, 2 unread");
  });
}

test("mark all read self-heals a stale CSRF token", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await setMode(request, "notification-readall", "csrf_once");
  await markAll(page).click();
  await expect(status(page)).toHaveText("2 notifications marked as read.");
  expect((await stats(request)).readAllCount).toBe(2);
});

// ---------------------------------------------------------------- the header link and its count

test("header: the link carries the unread count in text and in the accessible name; hidden at zero; capped at 99+", async ({ page, request }) => {
  await startSession(page, request);
  await page.goto("/dashboard");
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 13 unread");
  await expect(header(page).getByTestId("unread-count")).toHaveText("13");
  await expect(bellLink(page)).toHaveAttribute("href", PAGE);
  await request.get(`${STUB}/__notifications-read-elsewhere?n=100`);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(bellLink(page)).toHaveAccessibleName("Notifications");
  await expect(header(page).getByTestId("unread-count")).toHaveCount(0);
  await preset(request, "many_unread");
  await page.waitForTimeout(5100); // focus and visibility events within 5 seconds share one read
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 99+ unread");
  await expect(header(page).getByTestId("unread-count")).toHaveText("99+");
});

test("header: the link opens the page", async ({ page, request }) => {
  await startSession(page, request);
  await page.goto("/dashboard");
  await bellLink(page).click();
  await expect(page).toHaveURL(/\/account\/notifications$/);
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
});

test("header: the count is read once at sign-in, then on focus and on visibility, silently", async ({ page, request }) => {
  await startSession(page, request);
  await page.goto("/dashboard");
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 13 unread");
  const before = (await stats(request)).countGets;
  expect(before).toBeGreaterThanOrEqual(1);
  await request.get(`${STUB}/__notifications-read-elsewhere?n=3`);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 10 unread");
  await page.waitForTimeout(5100);
  await request.get(`${STUB}/__notifications-read-elsewhere?n=2`);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 8 unread");
  // No timer: with no focus or visibility event the number of reads does not move.
  const settled = (await stats(request)).countGets;
  await page.waitForTimeout(1500);
  expect((await stats(request)).countGets).toBe(settled);
});

test("header: a failing count read keeps the last count and shows no error", async ({ page, request }) => {
  await startSession(page, request);
  await page.goto("/dashboard");
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 13 unread");
  for (const mode of ["error", "broken"]) {
    await setMode(request, "unread-count", mode);
    if (mode === "broken") await page.waitForTimeout(5100); // one read per 5 seconds on focus
    const reads = (await stats(request)).countGets;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(async () => (await stats(request)).countGets).toBeGreaterThan(reads);
    await expect(bellLink(page)).toHaveAccessibleName("Notifications, 13 unread");
    await expect(header(page).getByTestId("header-status")).toHaveText("");
  }
});

test("header: a count that never loads does not block the page or the link", async ({ page, request }) => {
  await setMode(request, "unread-count", "error");
  await startSession(page, request);
  await page.goto(PAGE);
  await expect(items(page)).toHaveCount(20);
  await expect(bellLink(page)).toHaveAccessibleName("Notifications");
  await expect(header(page).getByTestId("unread-count")).toHaveCount(0);
});

test("header: signing out clears the count and the link", async ({ page, request }) => {
  await startSession(page, request);
  await page.goto("/dashboard");
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 13 unread");
  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(`${APP}/`);
  await expect(bellLink(page)).toHaveCount(0);
  const reads = (await stats(request)).countGets;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(300);
  expect((await stats(request)).countGets).toBe(reads);
});

// ---------------------------------------------------------------- account types

test("an individual sees the link and the page", async ({ page, request }) => {
  await open(page, request);
  await expect(header(page).getByRole("link", { name: /^Notifications/ })).toBeVisible();
  await expect(items(page)).toHaveCount(20);
});

test("an agency sees the link and the page", async ({ page, request }) => {
  await setMode(request, "me", "agency");
  await open(page, request);
  await expect(header(page).getByRole("link", { name: /^Notifications/ })).toBeVisible();
  await expect(items(page)).toHaveCount(20);
});

test("an administrator sees the link in the admin chrome and the page inside it", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await page.goto("/admin");
  const adminNav = page.getByRole("navigation", { name: "Administrator account" });
  await expect(adminNav.getByRole("link", { name: "Notifications, 13 unread" })).toHaveAttribute("href", PAGE);
  await adminNav.getByRole("link", { name: /^Notifications/ }).click();
  await expect(page).toHaveURL(/\/account\/notifications$/);
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  await expect(items(page)).toHaveCount(20);
  // Embedded in the signed-in layout's main (like the password page), so the header is not a banner landmark here.
  await expect(page.locator("header.site-header")).toHaveCount(1);
  await expect(page.locator("header.site-header")).toContainText("EstateAI Administration");
  await expect(page.getByRole("link", { name: "EstateAI", exact: true })).toHaveCount(0);
  await expect(page.getByRole("main")).toHaveCount(1);
  await items(page).first().getByRole("button", { name: /^Mark as read/ }).click();
  await expect(adminNav.getByRole("link", { name: "Notifications, 12 unread" })).toBeVisible();
});

// ---------------------------------------------------------------- privacy

test("privacy: no notification content, id or count in storage, console, the URL or the title", async ({ page, request }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  await open(page, request);
  await loadMore(page).click();
  await expect(items(page)).toHaveCount(25);
  await items(page).first().getByRole("button", { name: /^Mark as read/ }).click();
  await expect(status(page)).toHaveText("Notification marked as read.");
  await filterButton(page, "Unread").click();
  await expect(items(page)).toHaveCount(12);
  await markAll(page).click();
  await expect(page.getByTestId("notifications-empty")).toBeVisible();
  const kept = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]));
  expect(kept).toBe("[{},{}]");
  const idPattern = /00000000-0000-4000-8000-0000000000/;
  const output = logs.join("\n");
  expect(output).not.toMatch(idPattern);
  expect(output).not.toContain(SECRET);
  expect(output).not.toMatch(/unread|marked as read|notification/i); // no count or content in the console
  expect(page.url()).toBe(`${APP}${PAGE}`);
  expect(await page.title()).toBe("Notifications | EstateAI");
  expect(await page.evaluate(() => document.cookie)).not.toMatch(idPattern);
});

// ---------------------------------------------------------------- accessibility

for (const viewport of viewports) {
  test(`accessibility (${viewport.name}): list, filter, load more, empty and error states have no axe violations`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await open(page, request);
    await expectNoViolations(page, "list");
    await filterButton(page, "Unread").click();
    await expect(items(page)).toHaveCount(13);
    await expectNoViolations(page, "unread filter");
    await filterButton(page, "All").click();
    await expect(items(page)).toHaveCount(20);
    await loadMore(page).click();
    await expect(items(page)).toHaveCount(25);
    await expectNoViolations(page, "after load more");
    await markButtons(page).first().click();
    await expect(status(page)).toHaveText("Notification marked as read.");
    await expectNoViolations(page, "after mark read");
    await markAll(page).click();
    await expect(page.getByTestId("unread-summary")).toHaveText("0 unread");
    await expectNoViolations(page, "all read");
    await preset(request, "empty");
    await filterButton(page, "Unread").click();
    await expect(page.getByTestId("notifications-empty")).toBeVisible();
    await expectNoViolations(page, "empty");
    await setMode(request, "notifications", "error");
    await filterButton(page, "All").click();
    await expect(page.getByRole("heading", { name: "We could not load your notifications" })).toBeVisible();
    await expectNoViolations(page, "error");
  });

  test(`accessibility (${viewport.name}): the failure message and the admin chrome have no axe violations`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preset(request, "few");
    await open(page, request);
    await setMode(request, "notification-read", "error");
    await markButtons(page).first().click();
    await expect(status(page)).toHaveText(SERVER);
    await expectNoViolations(page, "failure message");
    await request.get(`${STUB}/__expire-session`);
    await page.context().clearCookies();
    await startSession(page, request, "admin");
    await setMode(request, "notification-read", "ok");
    await page.goto(PAGE);
    await expect(items(page).first()).toBeVisible();
    await expectNoViolations(page, "admin chrome");
  });
}

test("the live region announces a result once", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await page.evaluate(() => {
    const region = document.querySelector('[data-testid="notifications-status"]')!;
    (window as unknown as { __texts: string[] }).__texts = [];
    new MutationObserver(() => (window as unknown as { __texts: string[] }).__texts.push(region.textContent ?? "")).observe(region, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  await markButtons(page).first().click();
  await expect(status(page)).toHaveText("Notification marked as read.");
  await page.waitForTimeout(300);
  const texts = (await page.evaluate(() => (window as unknown as { __texts: string[] }).__texts)).filter(Boolean);
  expect(texts).toEqual(["Notification marked as read."]);
  await expect(page.getByRole("status").filter({ hasText: "Notification marked as read." })).toHaveCount(1);
});

// ================================================================ review round: races, timeouts, caching, counts

const observeStatus = (page: Page) =>
  page.evaluate(() => {
    const region = document.querySelector('[data-testid="notifications-status"]')!;
    const w = window as unknown as { __texts: string[]; __observer?: MutationObserver };
    w.__observer?.disconnect();
    w.__texts = [];
    w.__observer = new MutationObserver(() => w.__texts.push(region.textContent ?? ""));
    w.__observer.observe(region, { childList: true, characterData: true, subtree: true });
  });
const heard = async (page: Page) =>
  (await page.evaluate(() => (window as unknown as { __texts: string[] }).__texts)).filter(Boolean);
const focusEvent = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("focus")));
const visibilityEvent = (page: Page) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
const TIMEOUT = "The server took too long to answer. Please try again.";
const PASSWORD = ["correct", "horse", "battery", "staple"].join(" ");

// ---------------------------------------------------------------- timeouts

test("a hung list request times out into the error with Retry", async ({ page, request }) => {
  await setMode(request, "notifications", "hang");
  await startSession(page, request);
  await page.clock.install();
  await page.goto(PAGE);
  await expect(page.getByTestId("profile-loading")).toBeVisible();
  await page.clock.runFor(21_000);
  await expect(page.getByRole("main").getByRole("button", { name: "Retry" })).toBeVisible();
});

test("a hung mark-one request times out into a polite message and the item stays unread", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await setMode(request, "notification-read", "hang");
  await page.clock.install();
  await markButtons(page).first().click();
  await page.clock.runFor(21_000);
  await expect(status(page)).toHaveText(TIMEOUT);
  await expect(markButtons(page)).toHaveCount(2);
});

test("a hung mark-all request times out into a polite message and the items stay unread", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await setMode(request, "notification-readall", "hang");
  await page.clock.install();
  await markAll(page).click();
  await page.clock.runFor(21_000);
  await expect(status(page)).toHaveText(TIMEOUT);
  await expect(markButtons(page)).toHaveCount(2);
});

// ---------------------------------------------------------------- caching

test("the list and the count are never taken from a cache, even when the backend allows it", async ({ page, request }) => {
  await request.get(`${STUB}/__notifications-cacheable?value=1`);
  await open(page, request);
  await expect(page.getByTestId("unread-summary")).toHaveText("13 unread");
  expect((await stats(request)).gets).toBe(1);
  await filterButton(page, "Unread").click();
  await expect(items(page)).toHaveCount(13);
  await filterButton(page, "All").click(); // the same address as the first read: it must reach the backend again
  await expect(items(page)).toHaveCount(20);
  expect((await stats(request)).gets).toBe(3);
  await page.waitForTimeout(5100);
  const reads = (await stats(request)).countGets;
  await focusEvent(page); // the same address as the first count read
  await expect.poll(async () => (await stats(request)).countGets).toBe(reads + 1);
});

// ---------------------------------------------------------------- the count's loading rules

test("the count is read exactly once after the initial load", async ({ page, request }) => {
  await open(page, request);
  await expect(page.getByTestId("unread-summary")).toHaveText("13 unread");
  await page.waitForTimeout(800);
  expect((await stats(request)).countGets).toBe(1);
});

test("signing in on a page that was signed out shows the header count without a reload", async ({ page, request }) => {
  await page.goto("/sign-in?next=%2Fdashboard");
  await expect(bellLink(page)).toHaveCount(0);
  expect((await stats(request)).countGets).toBe(0);
  await page.getByLabel("Email address").fill("ayesha@example.com");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).and(page.locator("form button")).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 13 unread");
  expect((await stats(request)).countGets).toBe(1);
});

test("an account switch without a signed-out step never shows the previous account's count", async ({ page, request }) => {
  await startSession(page, request);
  await page.goto("/dashboard");
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 13 unread");
  await setMode(request, "unread-count", "error"); // the other account's count cannot be read (yet)
  await request.get(`${STUB}/__account-variant?value=2`);
  await focusEvent(page);
  await expect(bellLink(page)).toHaveAccessibleName("Notifications");
  await expect(header(page).getByTestId("unread-count")).toHaveCount(0);
  await setMode(request, "unread-count", "ok");
  await preset(request, "few");
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 2 unread", { timeout: 8000 }); // the one retry
});

test("focus and visibility together make one request", async ({ page, request }) => {
  await startSession(page, request);
  await page.goto("/dashboard");
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 13 unread");
  const reads = (await stats(request)).countGets;
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  await expect.poll(async () => (await stats(request)).countGets).toBe(reads + 1);
  await page.waitForTimeout(600);
  expect((await stats(request)).countGets).toBe(reads + 1);
  await visibilityEvent(page); // still inside the 5 second window
  await page.waitForTimeout(300);
  expect((await stats(request)).countGets).toBe(reads + 1);
});

for (const mode of ["forbidden", "rate_limited"]) {
  test(`a ${mode} count answer stops further reads until the next sign-in`, async ({ page, request }) => {
    await startSession(page, request);
    await page.goto("/dashboard");
    await expect(bellLink(page)).toHaveAccessibleName("Notifications, 13 unread");
    await setMode(request, "unread-count", mode);
    await page.waitForTimeout(5100);
    await focusEvent(page);
    await expect.poll(async () => (await stats(request)).countGets).toBe(2);
    await page.waitForTimeout(5100);
    await focusEvent(page);
    await visibilityEvent(page);
    await page.waitForTimeout(500);
    expect((await stats(request)).countGets).toBe(2);
    await expect(bellLink(page)).toHaveAccessibleName("Notifications, 13 unread"); // the last known count stays
  });
}

test("a failed first count read is retried once after a short delay", async ({ page, request }) => {
  await setMode(request, "unread-count", "error");
  await startSession(page, request);
  await page.goto("/dashboard");
  await expect.poll(async () => (await stats(request)).countGets).toBeGreaterThanOrEqual(1);
  await expect(bellLink(page)).toHaveAccessibleName("Notifications");
  await setMode(request, "unread-count", "ok");
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 13 unread", { timeout: 8000 });
  expect((await stats(request)).countGets).toBe(2);
});

test("a 401 on the count asks the session provider to check", async ({ page, request }) => {
  await startSession(page, request);
  await page.goto("/dashboard");
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 13 unread");
  await request.get(`${STUB}/__expire-session`);
  const checks = (await session(request)).meCount;
  await page.waitForTimeout(5100);
  await focusEvent(page);
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  expect((await session(request)).meCount).toBeGreaterThan(checks);
});

test("the header link marks the current page", async ({ page, request }) => {
  await open(page, request);
  await expect(bellLink(page)).toHaveAttribute("aria-current", "page");
  await page.goto("/dashboard");
  await expect(bellLink(page)).not.toHaveAttribute("aria-current", "page");
});

// ---------------------------------------------------------------- 401 and network failures

test("session gone on mark all read goes to the sign-in", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await setMode(request, "notification-readall", "session_gone");
  await markAll(page).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fnotifications$/);
});

test("session gone on load more goes to the sign-in", async ({ page, request }) => {
  await setMode(request, "notifications", "more_gone");
  await open(page, request);
  await loadMore(page).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fnotifications$/);
});

test("session gone on an administrator's mark read goes to the admin sign-in", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request, "admin");
  await setMode(request, "notification-read", "session_gone");
  await markButtons(page).first().click();
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
});

test("a network failure on the list shows the error with Retry; on load more it keeps the list", async ({ page, request }) => {
  await startSession(page, request);
  await page.route("**/api/v1/notifications?*", (route) => route.abort());
  await page.goto(PAGE);
  await expect(page.getByRole("heading", { name: "We could not load your notifications" })).toBeVisible();
  await page.unroute("**/api/v1/notifications?*");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(items(page)).toHaveCount(20);
  await page.route("**/api/v1/notifications?*cursor=*", (route) => route.abort());
  await loadMore(page).click();
  await expect(status(page)).toHaveText(NETWORK);
  await expect(items(page)).toHaveCount(20);
  await expect(loadMore(page)).toBeVisible();
});

test("a rate-limited list shows the wait and Retry; a 403 shows the plain note with no Retry", async ({ page, request }) => {
  await setMode(request, "notifications", "rate_limited");
  await startSession(page, request);
  await page.goto(PAGE);
  await expect(page.getByRole("main").getByText(THROTTLED)).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await setMode(request, "notifications", "forbidden");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("notifications-forbidden")).toHaveText("Notifications are not available for this account.");
  await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
});

// ---------------------------------------------------------------- parsing

test("a malformed item is skipped without failing the page", async ({ page, request }) => {
  await setMode(request, "notifications", "partial");
  await open(page, request);
  await expect(items(page)).toHaveCount(20);
});

test("a next link without a usable cursor is a load error with Retry", async ({ page, request }) => {
  await setMode(request, "notifications", "bad_next");
  await startSession(page, request);
  await page.goto(PAGE);
  await expect(page.getByRole("heading", { name: "We could not load your notifications" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("load more that only returns known items says so and ends the list", async ({ page, request }) => {
  await setMode(request, "notifications", "known_only");
  await open(page, request);
  await loadMore(page).click();
  await expect(status(page)).toHaveText("No more notifications to show.");
  await expect(items(page)).toHaveCount(20);
  await expect(loadMore(page)).toHaveCount(0);
});

test("a known kind renders only its catalogue text, never extra payload keys", async ({ page, request }) => {
  await preset(request, "empty");
  await request.get(`${STUB}/__notifications-add?kind=account.password_changed&payload=1`);
  await open(page, request);
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first().locator(".notification-title")).toHaveText(PASSWORD_TITLE);
  expect(await page.locator("body").innerText()).not.toContain(SECRET);
  expect(await page.content()).not.toContain(SECRET);
});

for (const kind of ["constructor", "__proto__", "toString"]) {
  test(`a kind named ${kind} renders the unknown-kind line`, async ({ page, request }) => {
    await preset(request, "empty");
    await request.get(`${STUB}/__notifications-add?kind=${kind}&payload=1`);
    await open(page, request);
    await expect(items(page).first().locator(".notification-title")).toHaveText(UNKNOWN_TITLE);
    await expect(items(page).first().locator("p")).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toContain(SECRET);
  });
}

// ---------------------------------------------------------------- state races

test("rapid All/Unread toggling with out-of-order answers ends on the last choice", async ({ page, request }) => {
  await open(page, request);
  const held: Array<import("@playwright/test").Route> = [];
  await page.route("**/api/v1/notifications?*", (route) => void held.push(route));
  await filterButton(page, "Unread").click();
  await filterButton(page, "All").click();
  await expect.poll(() => held.length).toBe(2);
  await held[1].continue(); // the answer to the last choice first
  await expect(items(page)).toHaveCount(20);
  await held[0].continue(); // then the stale Unread answer
  await page.waitForTimeout(500);
  await expect(filterButton(page, "All")).toHaveAttribute("aria-pressed", "true");
  await expect(items(page)).toHaveCount(20);
  await expect(items(page).filter({ hasNot: page.getByText("Unread", { exact: true }) })).not.toHaveCount(0); // read items still there
});

test("during a filter reload the toolbar stays mounted and mark actions are refused", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  let release: (() => void) | undefined;
  await page.route("**/api/v1/notifications?*", (route) => {
    release = () => void route.continue();
  });
  await filterButton(page, "Unread").click();
  await expect(page.getByTestId("notifications-reloading")).toBeVisible();
  await expect(filterButton(page, "Unread")).toBeVisible();
  await expect(markAll(page)).toHaveAttribute("aria-disabled", "true");
  await markAll(page).click({ force: true });
  expect((await stats(request)).readAllCount).toBe(0);
  release?.();
  await expect(items(page)).toHaveCount(2);
  await expect(markAll(page)).not.toHaveAttribute("aria-disabled", "true");
});

test("a mark-read answer that arrives after a reload leaves the list in agreement with the server", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  let release: (() => void) | undefined;
  await page.route("**/api/v1/notifications/*/read", (route) => {
    release = () => void route.continue();
  });
  await markButtons(page).first().click();
  await expect.poll(() => release !== undefined).toBe(true);
  await filterButton(page, "Unread").click();
  await expect(items(page)).toHaveCount(2); // the server has not applied the read yet
  release?.();
  await expect(items(page)).toHaveCount(1);
  await expect(bellLink(page)).toHaveAccessibleName("Notifications, 1 unread");
});

test("mark all read works from the loaded list when the count is stale at zero", async ({ page, request }) => {
  await preset(request, "all_read");
  await open(page, request);
  await expect(markAll(page)).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("unread-summary")).toHaveText("0 unread"); // the count is known before it goes stale
  await setMode(request, "unread-count", "error"); // the count cannot catch up
  await request.get(`${STUB}/__notifications-add`);
  await filterButton(page, "Unread").click();
  await expect(items(page)).toHaveCount(1);
  await filterButton(page, "All").click();
  await expect(items(page)).toHaveCount(5);
  await expect(page.getByTestId("unread-summary")).toHaveText("0 unread");
  await expect(markAll(page)).not.toHaveAttribute("aria-disabled", "true");
  await markAll(page).click();
  await expect(status(page)).toHaveText("1 notification marked as read.");
});

test("the Unread filter emptied by its own edits reads the next page, then shows the empty state", async ({ page, request }) => {
  await preset(request, "few");
  await setMode(request, "notifications", "small_pages");
  await open(page, request);
  await filterButton(page, "Unread").click();
  await expect(items(page)).toHaveCount(1);
  await expect(loadMore(page)).toBeVisible();
  await markButtons(page).first().click();
  await expect(items(page)).toHaveCount(1); // the next page was fetched, not a blank list
  await expect(items(page).first().locator(".notification-title")).toHaveText(UNKNOWN_TITLE);
  await markButtons(page).first().click();
  await expect(page.getByTestId("notifications-empty")).toHaveText("You have no unread notifications.");
  await expect(loadMore(page)).toHaveCount(0);
});

test("the refill finds nothing when the rest was read elsewhere: empty state, no lone Load more", async ({ page, request }) => {
  await preset(request, "few");
  await setMode(request, "notifications", "small_pages");
  await open(page, request);
  await filterButton(page, "Unread").click();
  await expect(items(page)).toHaveCount(1);
  let release: (() => void) | undefined;
  await page.route("**/api/v1/notifications?*cursor=*", (route) => {
    release = () => void route.continue();
  });
  await markButtons(page).first().click();
  await expect.poll(() => release !== undefined).toBe(true);
  await expect(page.getByTestId("notifications-reloading")).toBeVisible();
  await request.get(`${STUB}/__notifications-read-elsewhere?n=1`);
  release?.();
  await expect(page.getByTestId("notifications-empty")).toHaveText("You have no unread notifications.");
  await expect(loadMore(page)).toHaveCount(0);
});

test("mark all read keeps the loaded pages and does not re-read page one", async ({ page, request }) => {
  await open(page, request);
  await loadMore(page).click();
  await expect(items(page)).toHaveCount(25);
  await markAll(page).click();
  await expect(status(page)).toHaveText("13 notifications marked as read.");
  await expect(items(page)).toHaveCount(25);
  await expect(items(page).getByText("Unread", { exact: true })).toHaveCount(0);
  expect((await stats(request)).gets).toBe(2);
});

test("mark all read without a numeric count in the answer announces the generic line", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await page.route("**/api/v1/notifications/read-all", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ marked: "some" }) });
  });
  await markAll(page).click();
  await expect(status(page)).toHaveText("Notifications marked as read.");
});

// ---------------------------------------------------------------- double clicks, announcements, focus

test("double click on Load more sends one request and shows busy text meanwhile", async ({ page, request }) => {
  await open(page, request);
  let release: (() => void) | undefined;
  await page.route("**/api/v1/notifications?*cursor=*", (route) => {
    release = () => void route.continue();
  });
  const button = page.getByRole("button", { name: /^Load more|Loading more…$/ });
  await button.dblclick();
  await expect(button).toHaveText("Loading more…");
  await expect(button).toHaveAttribute("aria-disabled", "true");
  release?.();
  await expect(items(page)).toHaveCount(25);
  const cursorReads = ((await stats(request)).queries as string[]).filter((query) => query.includes("cursor"));
  expect(cursorReads).toHaveLength(1);
});

test("results are announced once, and the same message announces again", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await observeStatus(page);
  await markButtons(page).first().click();
  await expect(status(page)).toHaveText("Notification marked as read.");
  await page.waitForTimeout(300);
  await markButtons(page).first().click(); // the identical message again
  await expect.poll(async () => (await heard(page)).length).toBe(2);
  expect(await heard(page)).toEqual(["Notification marked as read.", "Notification marked as read."]);
});

test("mark all, load more and a failure each announce once", async ({ page, request }) => {
  await open(page, request);
  await observeStatus(page);
  await loadMore(page).click();
  await expect(status(page)).toHaveText("5 more notifications loaded.");
  await page.waitForTimeout(300);
  await markAll(page).click();
  await expect(status(page)).toHaveText("13 notifications marked as read.");
  await page.waitForTimeout(300);
  expect(await heard(page)).toEqual(["5 more notifications loaded.", "13 notifications marked as read."]);
  await preset(request, "few");
  await filterButton(page, "Unread").click();
  await expect(items(page)).toHaveCount(2);
  await observeStatus(page);
  await setMode(request, "notification-read", "error");
  await markButtons(page).first().click();
  await expect(status(page)).toHaveText(SERVER);
  await page.waitForTimeout(300);
  expect(await heard(page)).toEqual([SERVER]);
});

test("opening the page does not steal focus; after a 404 removal focus moves to the next item", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BODY");
  await setMode(request, "notification-read", "gone");
  await markButtons(page).first().click();
  await expect(items(page)).toHaveCount(2);
  await expect(items(page).first()).toBeFocused();
});

test("returning to the tab re-reads the first page, unless more pages are loaded", async ({ page, request }) => {
  await preset(request, "few");
  await open(page, request);
  await request.get(`${STUB}/__notifications-add`);
  await focusEvent(page);
  await expect(items(page)).toHaveCount(4);
  await preset(request, "default");
  await page.reload();
  await expect(items(page)).toHaveCount(20);
  await loadMore(page).click();
  await expect(items(page)).toHaveCount(25);
  const reads = (await stats(request)).gets;
  await page.waitForTimeout(5100);
  await focusEvent(page);
  await page.waitForTimeout(500);
  expect((await stats(request)).gets).toBe(reads);
  await expect(items(page)).toHaveCount(25);
});
