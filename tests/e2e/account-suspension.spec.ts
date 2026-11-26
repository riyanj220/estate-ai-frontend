import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const PATH = "/admin/accounts";

// The stub backend holds module-level state, so these tests must not interleave.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

async function startSession(page: Page, request: APIRequestContext, kind: "admin" | "user" = "admin") {
  await request.get(`${STUB_URL}/__force-session${kind === "admin" ? "?kind=admin" : ""}`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
}

const mode = (request: APIRequestContext, value: string) => request.get(`${STUB_URL}/__accounts-mode?value=${value}`);
const posts = async (request: APIRequestContext) =>
  (await (await request.get(`${STUB_URL}/__accounts-stats`)).json()).posts as { action: string; body: unknown; token: string }[];
const dialog = (page: Page) => page.getByRole("dialog");
const status = (page: Page) => page.getByTestId("accounts-status");
const notice = (page: Page) => page.getByTestId("accounts-notice");
const state = (page: Page) => page.getByTestId("account-state");

async function lookUp(page: Page, email = "ayesha@example.com") {
  await page.getByLabel("Email address of the account").fill(email);
  await page.getByLabel("Reason for the lookup").fill("Checking a reported account");
  await page.getByRole("button", { name: "Look up" }).click();
}

async function open(page: Page, request: APIRequestContext) {
  await startSession(page, request);
  await page.goto(PATH);
  await expect(page.getByRole("heading", { level: 1, name: "Accounts" })).toBeVisible();
}

async function ask(page: Page, verb: "Suspend" | "Reactivate", reason: string) {
  await page.getByLabel(verb === "Suspend" ? "Reason for suspending" : "Reason for reactivating").fill(reason);
  await page.getByRole("button", { name: `${verb} account` }).click();
}

test("only an administrator reaches the page; a lookup checks its fields and handles an unknown address", async ({ page, request }) => {
  const visitor = await request.get(`${APP_URL}${PATH}`, { maxRedirects: 0 });
  expect(visitor.status()).toBe(307);
  expect(visitor.headers().location).toBe(`/admin/sign-in?next=${encodeURIComponent(PATH)}`);

  await open(page, request);
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.getByLabel("Email address of the account")).toBeFocused();
  await expect(page.getByLabel("Reason for the lookup")).toHaveAccessibleDescription(/Enter a reason\./);
  expect(await posts(request)).toHaveLength(0);

  await lookUp(page, "nobody@example.com");
  await expect(notice(page)).toHaveText("No Individual or Agency account has that email address.");

  await mode(request, "invalid");
  await lookUp(page);
  await expect(page.getByLabel("Reason for the lookup")).toHaveAccessibleDescription(/Remove phone numbers/);

  await mode(request, "error");
  await lookUp(page);
  await expect(notice(page)).toContainText("Something went wrong");
  await expect(page.locator("body")).not.toContainText("Internal detail");

  await mode(request, "session_gone");
  await lookUp(page);
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin%2Faccounts$/);
});

test("suspend and reactivate: confirmed first, sent with the CSRF token, failures explained", async ({ page, request }) => {
  await open(page, request);
  await lookUp(page);
  await expect(state(page)).toHaveText("Active");
  await expect(page.getByRole("heading", { level: 2, name: "Ayesha Khan" })).toBeVisible();

  await ask(page, "Suspend", "abc");
  await expect(page.getByLabel("Reason for suspending")).toHaveAccessibleDescription(/Use at least 5 characters\./);
  await ask(page, "Suspend", "Misleading listings");
  await expect(dialog(page)).toContainText("its listings leave public view");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Suspend account" })).toBeFocused();
  expect(await posts(request)).toHaveLength(1); // the lookup only

  await mode(request, "invalid");
  await ask(page, "Suspend", "Misleading listings");
  await dialog(page).getByRole("button", { name: "Suspend" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByLabel("Reason for suspending")).toBeFocused();
  await expect(page.getByLabel("Reason for suspending")).toHaveAccessibleDescription(/Remove phone numbers/);

  await mode(request, "error");
  await ask(page, "Suspend", "Misleading listings");
  await dialog(page).getByRole("button", { name: "Suspend" }).click();
  await expect(dialog(page).getByRole("alert")).toContainText("Something went wrong");
  await dialog(page).getByRole("button", { name: "Cancel" }).click();

  await mode(request, "csrf_once");
  await ask(page, "Suspend", "Misleading listings");
  await dialog(page).getByRole("button", { name: "Suspend" }).click();
  await expect(status(page)).toHaveText("The account is now suspended.");
  await expect(state(page)).toHaveText("Suspended");
  await expect(page.getByTestId("account-suspension-reason")).toHaveText("Misleading listings");
  await expect.poll(async () => (await posts(request)).filter((post) => post.action === "suspend").length).toBe(4);
  const sent = (await posts(request)).at(-1)!;
  expect(sent).toMatchObject({ action: "suspend", body: { reason: "Misleading listings" } });
  expect(sent.token).toMatch(/^csrf-/);

  await mode(request, "ok");
  await ask(page, "Reactivate", "Resolved with the owner");
  await dialog(page).getByRole("button", { name: "Reactivate" }).click();
  await expect(status(page)).toHaveText("The account has been reactivated.");
  await expect(state(page)).toHaveText("Active");

  await mode(request, "conflict");
  await ask(page, "Suspend", "Misleading listings");
  await dialog(page).getByRole("button", { name: "Suspend" }).click();
  await expect(notice(page)).toContainText("already changed");
  await expect(state(page)).toHaveCount(0);
});

test("a suspended account reads the reason in a banner; others see none", async ({ page, request }) => {
  await startSession(page, request, "user");
  await page.goto("/dashboard");
  await expect(page.getByTestId("dashboard-state")).toBeVisible();
  await expect(page.getByTestId("suspension-banner")).toHaveCount(0);

  await request.get(`${STUB_URL}/__signin-mode?value=suspended`);
  await page.reload();
  await expect(page.getByTestId("suspension-banner")).toHaveText("Your account is suspended. Reason: Repeated misleading listings.");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  for (const [kind, title] of [
    ["account.suspended", "Your account was suspended."],
    ["account.reactivated", "Your account was reactivated."],
  ]) {
    await request.get(`${STUB_URL}/__notifications-add?kind=${kind}`);
    await page.goto("/account/notifications");
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
]) {
  test(`axe: account lookup, result and dialog at ${viewport.name}`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await open(page, request);
    const check = async () => {
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    };
    await page.getByRole("button", { name: "Look up" }).click();
    await check();
    await lookUp(page);
    await expect(state(page)).toBeVisible();
    await check();
    await ask(page, "Suspend", "Misleading listings");
    await expect(dialog(page)).toBeVisible();
    await check();
  });
}
