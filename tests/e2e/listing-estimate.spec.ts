import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { APP_URL, STUB_URL } from "./ports";

// Stories 4.6 and 4.7, frontend half: the price insight of a public Listing page.
const ID = "00000000-0000-4000-b000-000000000001";
const LISTING = `/listings/${ID}`;
const NOTE = "AI-generated approximation from the listing’s attributes. It is not a verified market valuation or a guaranteed return.";

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

const mode = (page: Page, value: string) => page.request.get(`${STUB_URL}/__listing-estimate-mode?value=${value}`);
const insight = (page: Page) => page.getByTestId("price-insight");

async function expectNoViolations(page: Page) {
  await expect(page).toHaveTitle(/.+/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
}

test("listing estimate: asking price beside the estimate, the forecast range and one info button @smoke", async ({ page }) => {
  await page.goto(LISTING);
  await expect(page.getByTestId("asking-total")).toHaveText("PKR 1,500,000.00");
  await expect(page.getByTestId("listing-estimate-value")).toHaveText("PKR 2,000,000.00");
  await expect(page.getByTestId("price-comparison")).toHaveText("The asking price is 25.0% below the estimate.");
  await expect(insight(page).getByRole("heading", { name: "5-Year Price Forecast" })).toBeVisible();
  await expect(page.getByTestId("price-forecast")).toHaveText("PKR 2,433,000.00 to PKR 3,525,000.00 in 5 years (middle scenario PKR 2,939,000.00).");
  const drivers = page.getByTestId("price-drivers").getByRole("listitem");
  await expect(drivers).toHaveText(["Location↑ raises by 18.4%", "Condition↓ lowers by 6.0%", "Amenities↑ raises by 2.1%"]);
  await expect(page.getByRole("button", { name: "About this estimate" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Recompute estimate" })).toHaveCount(0);
  await page.getByRole("button", { name: "About this estimate" }).click();
  await expect(page.getByTestId("listing-estimate-note")).toContainText(NOTE);
});

for (const [value, text] of [
  ["above", "The asking price is 20.0% above the estimate."],
  ["about_equal", "The asking price is about equal to the estimate."],
] as const) {
  test(`listing estimate: ${value}`, async ({ page }) => {
    await mode(page, value);
    await page.goto(LISTING);
    await expect(page.getByTestId("price-comparison")).toHaveText(text);
  });
}

for (const value of ["unavailable", "error"]) {
  test(`listing estimate: ${value} shows no price insight card at all, and the page still renders`, async ({ page }) => {
    await mode(page, value);
    await page.goto(LISTING);
    await expect(page.getByTestId("listing-price")).toBeVisible();
    await expect(insight(page)).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(/Estimate unavailable|Forecast unavailable|Internal detail/);
  });
}

async function openAsOwner(page: Page, value: string) {
  await mode(page, value);
  await page.request.get(`${STUB_URL}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
  await page.goto(LISTING);
}

test("listing estimate: the owner recomputes and sees the outcome", async ({ page }) => {
  await openAsOwner(page, "owner");
  await page.getByRole("button", { name: "Recompute estimate" }).click();
  await expect(page.getByTestId("recompute-status")).toHaveText("The estimate was recalculated.");
  await expect(page.getByTestId("listing-estimate-value")).toHaveText("PKR 2,100,000.00");
});

test("listing estimate: a throttled recompute keeps the figures and says why", async ({ page }) => {
  await page.request.get(`${STUB_URL}/__estimate-mode?value=rate_limited`);
  await openAsOwner(page, "owner");
  await page.getByRole("button", { name: "Recompute estimate" }).click();
  await expect(page.getByTestId("recompute-status")).toHaveText("Too many attempts. Try again in 2 minutes.");
  await expect(page.getByTestId("listing-estimate-value")).toHaveText("PKR 2,000,000.00");
});

for (const viewport of [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
]) {
  test(`axe: listing estimate with the popover open, and without an estimate, on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openAsOwner(page, "owner");
    await page.getByRole("button", { name: "About this estimate" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("listing-estimate-note")).toContainText(NOTE);
    await expectNoViolations(page);
    await mode(page, "owner_unavailable");
    await page.goto(LISTING);
    await expect(insight(page)).toHaveCount(0); // for the owner too
    await expectNoViolations(page);
  });
}
