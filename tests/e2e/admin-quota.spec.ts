import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const PATH = "/admin/publication-limits";

// The stub backend holds module-level state, so these tests must not interleave.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

async function startSession(page: Page, request: APIRequestContext, kind: "admin" | "user" = "admin") {
  await request.get(`${STUB_URL}/__force-session${kind === "admin" ? "?kind=admin" : ""}`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
}

async function open(page: Page, request: APIRequestContext) {
  await startSession(page, request);
  await page.goto(PATH);
  await expect(input(page, "Individual")).toHaveValue("2");
}

const mode = (request: APIRequestContext, value: string) => request.get(`${STUB_URL}/__quota-mode?value=${value}`);
const stats = async (request: APIRequestContext) => (await request.get(`${STUB_URL}/__quota-stats`)).json();
const puts = async (request: APIRequestContext) => (await stats(request)).puts as { accountType: string; body: unknown; token: string }[];
const input = (page: Page, type: string) => page.getByLabel(`${type} accounts: publications per month`);
const change = (page: Page, type: string) => page.getByRole("button", { name: `Change ${type} limit` });
const dialog = (page: Page) => page.getByRole("dialog");
const status = (page: Page) => page.getByTestId("quota-status");
const rows = (page: Page) => page.getByRole("table").locator("tbody tr");

async function ask(page: Page, type: string, value: string) {
  await input(page, type).fill(value);
  await change(page, type).click();
}

test("only an administrator reaches the page, from the admin navigation", async ({ page, request }) => {
  const visitor = await request.get(`${APP_URL}${PATH}`, { maxRedirects: 0 });
  expect(visitor.status()).toBe(307);
  expect(visitor.headers().location).toBe(`/admin/sign-in?next=${encodeURIComponent(PATH)}`);
  expect(await visitor.text()).not.toContain("Publication limits");

  await startSession(page, request, "user");
  await page.goto(PATH);
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=/);
  expect(await stats(request)).toMatchObject({ policyGets: 0, usageGets: 0 });

  await startSession(page, request);
  await page.goto("/admin");
  const link = page.getByRole("navigation", { name: "Administration", exact: true }).getByRole("link", { name: "Publication limits" });
  await link.click();
  await expect(page.getByRole("heading", { level: 1, name: "Publication limits" })).toBeVisible();
  await expect(link).toHaveAttribute("aria-current", "page");
  await expect(input(page, "Agency")).toHaveValue("10");
  await expect(page.getByText("Current limit: 2, in force since 1 January 2026.")).toBeVisible();
});

test("a change is confirmed first, then saved with the CSRF token and announced", async ({ page, request }) => {
  await open(page, request);
  await ask(page, "Individual", "4");
  await expect(dialog(page)).toContainText("From 2 to 4 publications per month. This applies to future publications only.");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(change(page, "Individual")).toBeFocused();
  expect(await puts(request)).toHaveLength(0);

  await change(page, "Individual").click();
  await dialog(page).getByRole("button", { name: "Change limit" }).click();
  await expect(status(page)).toHaveText("The Individual limit is now 4 publications per month. It applies to future publications only.");
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByText("Current limit: 4,")).toBeVisible();
  await expect(rows(page).first()).toContainText("1 / 4");
  await expect.poll(async () => (await puts(request)).length).toBe(1);
  const [sent] = await puts(request);
  expect(sent).toMatchObject({ accountType: "individual", body: { monthly_limit: 4 } });
  expect(sent.token).toMatch(/^csrf-/);

  // The same value again asks nothing and sends nothing.
  await change(page, "Individual").click();
  await expect(status(page)).toContainText("Nothing was changed.");
  await expect(dialog(page)).toBeHidden();
  expect(await puts(request)).toHaveLength(1);
});

test("invalid numbers are refused on the page and from the server, and failures keep the dialog", async ({ page, request }) => {
  await open(page, request);
  for (const [value, message] of [
    ["", "Enter a whole number from 0 to 1000."],
    ["2.5", "Enter a whole number from 0 to 1000."],
    ["-1", "The limit cannot be below 0."],
    ["1001", "The limit cannot be above 1000."],
  ]) {
    await ask(page, "Agency", value);
    await expect(input(page, "Agency")).toHaveAttribute("aria-invalid", "true");
    await expect(input(page, "Agency")).toHaveAccessibleDescription(new RegExp(message.replaceAll(".", "\\.")));
    await expect(dialog(page)).toBeHidden();
  }
  expect(await puts(request)).toHaveLength(0);

  await mode(request, "put_invalid");
  await ask(page, "Agency", "12");
  await dialog(page).getByRole("button", { name: "Change limit" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(input(page, "Agency")).toHaveAccessibleDescription(/The limit cannot be above 1000\./);
  await expect(input(page, "Agency")).toBeFocused();

  for (const failing of ["put_error", "csrf_always"]) {
    await mode(request, failing);
    await ask(page, "Agency", "12");
    await dialog(page).getByRole("button", { name: "Change limit" }).click();
    await expect(dialog(page).getByRole("alert")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Internal detail");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Current limit: 10,")).toBeVisible();
  }

  // A stale token is refetched and the change goes through.
  await mode(request, "csrf_once");
  await ask(page, "Agency", "12");
  await dialog(page).getByRole("button", { name: "Change limit" }).click();
  await expect(status(page)).toContainText("The Agency limit is now 12 publications per month.");
});

test("a session that ended during a change goes to the admin sign-in", async ({ page, request }) => {
  await open(page, request);
  await mode(request, "session_gone");
  await ask(page, "Individual", "3");
  await dialog(page).getByRole("button", { name: "Change limit" }).click();
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin%2Fpublication-limits$/);
});

test("usage: load more, a failed page, an out-of-date cursor and the empty state", async ({ page, request }) => {
  await open(page, request);
  await expect(page.getByText("From 1 November 2026. Resets on 1 December 2026.")).toBeVisible();
  await expect(rows(page)).toHaveCount(20);
  await expect(rows(page).first()).toContainText("u***@host1.example.com");
  await expect(rows(page).first()).toContainText("Individual");

  const more = page.getByRole("button", { name: "Load more" });
  await mode(request, "more_fail");
  await more.click();
  await expect(page.getByRole("alert").filter({ hasText: "Something went wrong" })).toBeVisible();
  await expect(rows(page)).toHaveCount(20);

  await mode(request, "stale_cursor");
  const before = (await stats(request)).usageGets;
  await more.click();
  await expect(status(page)).toHaveText("The usage list was out of date and has been reloaded.");
  await expect.poll(async () => (await stats(request)).usageGets).toBe(before + 2);

  await mode(request, "ok");
  await more.click();
  await expect(rows(page)).toHaveCount(23);
  await expect(rows(page).nth(20)).toBeFocused();
  await expect(more).toHaveCount(0);

  await mode(request, "empty");
  await page.reload();
  await expect(page.getByTestId("usage-empty")).toBeVisible();
});

test("a failed load says so and Retry recovers", async ({ page, request }) => {
  await startSession(page, request);
  await mode(request, "load_error");
  await page.goto(PATH);
  await expect(page.getByRole("heading", { name: "We could not load the publication limits" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "We could not load the usage list" })).toBeVisible();
  await mode(request, "ok");
  await page.getByRole("button", { name: "Retry" }).first().click();
  await expect(input(page, "Individual")).toHaveValue("2");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(rows(page)).toHaveCount(20);
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
]) {
  test(`axe: publication limits, errors and dialog at ${viewport.name}`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await open(page, request);
    await expect(rows(page)).toHaveCount(20);
    const check = async () => {
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    };
    await ask(page, "Individual", "1001");
    await check();
    await ask(page, "Individual", "5");
    await expect(dialog(page)).toBeVisible();
    await check();
  });
}
