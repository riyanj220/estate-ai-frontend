import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { APP_URL, STUB_URL } from "./ports";

// Story 5.3: the one-time external-service notice, through the "Create with AI" button (on in tests by AI_FEATURES=1).
const NEW = "/account/listings/new";
const KEY = "estateai.ai-notice";
const CHAT = /\/account\/listings\/[0-9a-f-]{36}\/assistant$/;

const entry = (page: Page) => page.getByRole("button", { name: "Create with AI" });
const dialog = (page: Page) => page.getByRole("dialog", { name: "AI features use an external service" });
const stored = (page: Page) => page.evaluate((key) => window.localStorage.getItem(key), KEY);

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

async function open(page: Page, request: APIRequestContext) {
  await request.get(`${STUB_URL}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
  await page.goto(NEW);
  await page.getByRole("radio", { name: "Sale", exact: true }).check();
  await page.getByLabel("Category", { exact: true }).selectOption("house");
  await page.getByLabel("Subtype", { exact: true }).selectOption("house");
}

test("@smoke the first use shows the notice, Continue starts the feature and it does not return", async ({ page, request }) => {
  await open(page, request);
  await expect(dialog(page)).toBeHidden();
  await entry(page).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText("sent to an outside AI provider");
  await expect(dialog(page)).toContainText("Audio is covered by this notice and is not redacted");
  await expect(page).toHaveURL(/\/new$/);
  await dialog(page).getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(CHAT);
  expect(await stored(page)).toBe("seen");

  await open(page, request);
  await entry(page).click();
  await expect(page).toHaveURL(CHAT);
});

test("by keyboard: Escape and Not now start nothing and keep the notice; Continue ends it", async ({ page, request }) => {
  await open(page, request);
  const notNow = dialog(page).getByRole("button", { name: "Not now" });

  await entry(page).focus();
  await page.keyboard.press("Enter");
  await expect(notNow).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(entry(page)).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(notNow).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeHidden();
  await expect(entry(page)).toBeFocused();
  await expect(page).toHaveURL(/\/new$/);
  expect(await stored(page)).toBeNull();

  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(dialog(page).getByRole("button", { name: "Continue" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(CHAT);
  expect(await stored(page)).toBe("seen");
});

test("Escape after an earlier Continue never counts as Continue", async ({ page, request }) => {
  await open(page, request);
  // With no Category the start is refused on the page, so the same dialog element can be opened again.
  await page.getByLabel("Category", { exact: true }).selectOption("");
  await entry(page).click();
  await dialog(page).getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("group", { name: "There is a problem" })).toBeVisible(); // the close event has run
  // The same page, so the same dialog element that was closed with "continue"; only the stored choice is forgotten.
  await page.evaluate((key) => window.localStorage.removeItem(key), KEY);
  await entry(page).click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  // Had the old "continue" been read again, the choice would have been stored again.
  await expect(entry(page)).toBeFocused();
  expect(await stored(page)).toBeNull();
});

test("with storage blocked the feature still starts and the notice shows once per visit", async ({ page, request }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await open(page, request);
  await page.getByLabel("Category", { exact: true }).selectOption("");
  await entry(page).click();
  await dialog(page).getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("group", { name: "There is a problem" })).toBeVisible();
  await entry(page).click();
  await expect(dialog(page)).toBeHidden();
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 360, height: 740 },
]) {
  test(`axe: the notice has no violations (${viewport.name})`, async ({ page, request }) => {
    await page.setViewportSize(viewport);
    await open(page, request);
    await entry(page).click();
    await expect(dialog(page)).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(violations).toEqual([]);
  });
}
