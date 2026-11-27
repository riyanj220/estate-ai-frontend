import AxeBuilder from "@axe-core/playwright";
import { STUB_URL } from "./ports";
import { expect, test, type Page } from "@playwright/test";

// Stories 6.1 and 6.2: search in plain words on /listings, against the stub's fixed interpretation (AI_FEATURES=1 in tests).
const QUERY = "house to buy with parking near a park and near a metro station";

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

const box = (page: Page) => page.getByTestId("search-box");
const input = (page: Page) => page.getByLabel("Describe what you are looking for");
const chips = (page: Page) => page.getByTestId("active-filters");
const query = (page: Page) => decodeURIComponent(new URL(page.url()).search);
const requests = async (page: Page) => (await (await page.request.get(`${STUB_URL}/__search-requests`)).json()).requests;

async function search(page: Page, text: string) {
  await input(page).fill(text);
  await box(page).getByRole("button", { name: "Search" }).click();
}

/** The one-time external-service notice comes first. */
async function firstSearch(page: Page, text = QUERY) {
  await page.goto("/listings");
  await search(page, text);
  await page.getByTestId("ai-notice").getByRole("button", { name: "Continue" }).click();
}

async function expectNoViolations(page: Page, label: string) {
  await expect(page).toHaveTitle(/.+/);
  expect((await new AxeBuilder({ page }).analyze()).violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}

test("a request becomes removable filters, with what was not searched named @smoke", async ({ page, request }) => {
  await request.get(`${STUB_URL}/__search-mode?value=slow`);
  await page.setViewportSize({ width: 375, height: 800 });
  await firstSearch(page);
  await expect(page.getByTestId("search-progress")).toBeVisible();
  await expect(page.getByTestId("search-understood")).toBeVisible();
  await expect.poll(() => query(page)).toBe("?purpose=sale&category=house&prefer_parking_spaces_min=1&prefer_amenities=nearby_park");
  await expect(page.getByTestId("search-unsupported")).toContainText("near a metro station");
  await expect(box(page)).toContainText("seller-declared and not verified");
  await expect(chips(page)).toContainText("Purpose: Sale");
  await expect(chips(page)).toContainText("Preferred: Minimum parking spaces: 1");
  await expect(chips(page)).toContainText("Preferred: Amenity: Park (seller-declared)");
  await expect(page.getByLabel("Sort by")).toHaveValue("relevance");
  await expect(input(page)).toHaveValue(QUERY);
  await expectNoViolations(page, "interpreted");

  // The text went in the body only.
  expect(await requests(page)).toEqual([{ url: "/api/v1/public/search", body: { query: QUERY } }]);
  expect(page.url()).not.toContain("metro");

  // Editing the interpretation uses no AI.
  await chips(page).getByRole("link", { name: "Remove Preferred: Amenity: Park" }).click();
  await expect.poll(() => query(page)).toBe("?purpose=sale&category=house&prefer_parking_spaces_min=1");
  await chips(page).getByRole("link", { name: "Remove Preferred: Minimum parking" }).click();
  await expect.poll(() => query(page)).toBe("?purpose=sale&category=house");
  await page.getByLabel("Sort by").selectOption({ label: "Price: low to high" });
  await page.getByRole("button", { name: "Sort", exact: true }).click();
  await expect.poll(() => query(page)).toContain("sort=price_asc");
  expect(await requests(page)).toHaveLength(1);
  // A full page load keeps the typed text.
  await expect(input(page)).toHaveValue(QUERY);
});

for (const [mode, message] of [
  ["fallback", "Search by description is unavailable right now."],
  ["rate_limited", "Too many attempts."],
  ["error", "Something went wrong on our side."],
] as const) {
  test(`${mode}: the filters are offered and the text is kept`, async ({ page, request }) => {
    await request.get(`${STUB_URL}/__search-mode?value=${mode}`);
    await firstSearch(page);
    await expect(page.getByTestId("search-fallback")).toContainText(message);
    await expect(page.getByTestId("search-fallback")).toContainText(/filters/i);
    await expect(box(page)).not.toContainText("Internal detail");
    await expect(input(page)).toHaveValue(QUERY);
    expect(query(page)).toBe("");
    await expect(page.getByTestId("browse-card")).toHaveCount(2);
    await expectNoViolations(page, mode);
    await page.getByTestId("filter-panel").locator("summary").click();
    await page.getByTestId("filter-panel").getByRole("group", { name: "Purpose" }).getByLabel("Sale").check();
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect.poll(() => query(page)).toBe("?purpose=sale");
    await expect(input(page)).toHaveValue(QUERY);
  });
}

test("an empty request and a declined notice send nothing", async ({ page }) => {
  await page.goto("/listings");
  await box(page).getByRole("button", { name: "Search" }).click();
  await expect(box(page)).toContainText("Describe what you are looking for.");
  await expectNoViolations(page, "empty");
  await search(page, QUERY);
  await page.getByTestId("ai-notice").getByRole("button", { name: "Not now" }).click();
  expect(await requests(page)).toHaveLength(0);
  await expect(input(page)).toHaveValue(QUERY);
});
