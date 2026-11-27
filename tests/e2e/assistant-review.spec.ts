import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { APP_URL, STUB_URL } from "./ports";

// Stories 5.11 to 5.13: confirming assistant values, the written description and what publication refuses until then.
const DRAFT = "/account/listings/00000000-0000-4000-9000-000000000001";
const setMode = (request: APIRequestContext, value: string) => request.get(`${STUB_URL}/__assistant-mode?value=${value}`);
const price = (page: Page) => page.getByTestId("review-asking_price");
const status = (page: Page) => page.getByTestId("review-status");
const description = (page: Page) => page.getByLabel("Your description");

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

async function open(page: Page, request: APIRequestContext, path = `${DRAFT}/review`) {
  await request.get(`${STUB_URL}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
  await request.get(`${STUB_URL}/__listings-preset?value=publish_ai_price`);
  await page.goto(path);
}

async function write(page: Page) {
  await page.getByRole("button", { name: "Write it with AI" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
}

test("@smoke an assistant price blocks publishing until it is confirmed on the review page", async ({ page, request }) => {
  await open(page, request, DRAFT);
  await page.getByTestId("publish-button").click();
  await expect(page.getByText("Confirm this value before publishing.").first()).toBeVisible();
  await page.getByRole("link", { name: "Review and confirm details" }).click();
  await expect(price(page)).toContainText("1,500,000.00");
  await expect(price(page)).toContainText("not confirmed. Needed before publishing.");
  await page.getByRole("button", { name: "Confirm asking price (pkr)" }).click();
  await expect(status(page)).toContainText("Confirmed: Asking price");
  await expect(status(page)).toBeFocused();
  await expect(price(page).getByRole("button")).toHaveCount(0);
  await page.getByRole("link", { name: "Back to the draft to edit or publish" }).click();
  await page.getByTestId("publish-button").click();
  await expect(page.getByTestId("published-allowance")).toBeVisible();
});

test("a written description shows its claims, can be kept or edited, and a manual one is replaced only on request", async ({ page, request }) => {
  await open(page, request);
  await write(page);
  await expect(description(page)).toHaveValue("This house is for sale.\n\nIt has <b>three</b> bedrooms.");
  await expect(page.getByTestId("review-claims")).toContainText("This house is for sale. (Purpose, Subtype)");
  await expect(page.getByTestId("review-left-out")).toContainText("Asking price");
  await page.getByRole("button", { name: "Keep this description" }).click();
  await expect(page.getByTestId("review-description-unconfirmed")).toHaveCount(0);

  await description(page).fill("My own words about the house.");
  await page.getByRole("button", { name: "Save description" }).click();
  await expect(status(page)).toContainText("Your description was saved.");
  await page.getByRole("button", { name: "Write it with AI" }).click();
  await expect(status(page)).toContainText("Writing a new one replaces it.");
  await expect(description(page)).toHaveValue("My own words about the house.");
  await page.getByRole("button", { name: "Replace my description" }).click();
  await expect(description(page)).toHaveValue(/This house is for sale/);
});

test("a failed generation keeps the draft as it was and shows no server text", async ({ page, request }) => {
  await open(page, request);
  await setMode(request, "describe_fail");
  await write(page);
  await expect(status(page)).toContainText("could not be written right now");
  await expect(description(page)).toHaveValue("");
  await expect(page.getByText("Raw server text.")).toHaveCount(0);
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 360, height: 740 },
]) {
  test(`axe: the review page with claims has no violations (${viewport.name})`, async ({ page, request }) => {
    await page.setViewportSize(viewport);
    await open(page, request);
    await write(page);
    await expect(page.getByTestId("review-claims")).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(violations).toEqual([]);
  });
}
