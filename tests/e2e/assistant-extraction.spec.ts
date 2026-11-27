import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { APP_URL, STUB_URL } from "./ports";

// Stories 5.9 and 5.10: what a message saved to the Draft, the notices, the next question and the offer to review.
const ID = /\/account\/listings\/([0-9a-f-]{36})\/assistant$/;
const setMode = (request: APIRequestContext, value: string) => request.get(`${STUB_URL}/__assistant-mode?value=${value}`);
const next = (page: Page) => page.getByTestId("chat-next");

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

/** Signs in and starts a Draft with "Create with AI", accepting the notice. */
async function start(page: Page, request: APIRequestContext) {
  await request.get(`${STUB_URL}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
  await page.goto("/account/listings/new");
  await page.getByRole("radio", { name: "Sale", exact: true }).check();
  await page.getByLabel("Category", { exact: true }).selectOption("house");
  await page.getByLabel("Subtype", { exact: true }).selectOption("house");
  await page.getByRole("button", { name: "Create with AI" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(ID);
}

async function say(page: Page, text: string) {
  await page.getByLabel("Your message").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
}

test("@smoke a message fills the draft, says what it saved and asks only for what is missing", async ({ page, request }) => {
  await start(page, request);
  await expect(next(page)).toContainText("What is the area of the property");
  await setMode(request, "extract");
  await say(page, "Five bedrooms, asking 6 crore");
  await expect(page.getByTestId("chat-applied")).toContainText("Bedrooms: 5");
  await expect(page.getByTestId("chat-applied")).toContainText("Asking price: 60,000,000");
  await expect(page.getByTestId("chat-notice")).toHaveCount(2);
  await expect(page.getByTestId("chat-notice").last()).toContainText("<i>Please check</i>");
  await expect(next(page)).toContainText("Please choose the city in the form.");
  await next(page).getByRole("link", { name: "Open the form" }).click();
  await expect(page.getByLabel("Bedrooms")).toHaveValue("5");
});

test("when nothing required is missing the assistant offers a review", async ({ page, request }) => {
  await start(page, request);
  await setMode(request, "review");
  await say(page, "That is everything");
  await expect(next(page)).toContainText("Ready to review");
  await expect(next(page).getByRole("link", { name: "Review your listing" })).toBeVisible();
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 360, height: 740 },
]) {
  test(`axe: saved values, notices and the next step have no violations (${viewport.name})`, async ({ page, request }) => {
    await page.setViewportSize(viewport);
    await start(page, request);
    await setMode(request, "extract");
    await say(page, "Five bedrooms");
    await expect(page.getByTestId("chat-applied")).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(violations).toEqual([]);
  });
}
