import AxeBuilder from "@axe-core/playwright";
import { STUB_URL } from "./ports";
import { expect, test, type Page } from "@playwright/test";

// Story 3.5: the filter panel and sort control on /listings, a GET form generated from the stub's filter schema.
const KARACHI = "11111111-1111-4111-8111-111111111111";
const CLIFTON = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

const cards = (page: Page) => page.getByTestId("browse-card");
const panel = (page: Page) => page.getByTestId("filter-panel");
const group = (page: Page, name: string | RegExp) => panel(page).getByRole("group", { name }).first();
const chips = (page: Page) => page.getByTestId("active-filters");
const query = (page: Page) => decodeURIComponent(new URL(page.url()).search);
const open = (page: Page) => panel(page).locator("summary").click();
const apply = (page: Page) => page.getByRole("button", { name: "Apply filters" }).click();

async function expectNoViolations(page: Page, label: string) {
  await expect(page).toHaveTitle(/.+/);
  expect((await new AxeBuilder({ page }).analyze()).violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}

async function setEverything(page: Page) {
  await open(page);
  await group(page, "Purpose").getByLabel("Sale").check();
  await group(page, "Purpose").getByLabel("Rent").check();
  await group(page, "Category").getByLabel("House").check();
  await group(page, "City").getByLabel("Karachi").check();
  await group(page, /^Price/).getByLabel("Minimum").fill("1000");
  await group(page, /^Price/).getByLabel("Maximum").fill(" 2000000 ");
  await group(page, /^Amenities/).getByLabel("Elevator").check();
  await apply(page);
}

test("filters combine into a clean address, show as removable and clear again @smoke", async ({ page, request }) => {
  await page.goto("/listings");
  await expect(cards(page)).toHaveCount(2);
  await expect(chips(page)).toHaveCount(0);
  await setEverything(page);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText("Corner house with garden");
  await expect.poll(() => query(page)).toBe(`?purpose=sale,rent&category=house&asking_price_min=1000&asking_price_max=2000000&city=${KARACHI}&amenities=elevator`);
  const { requests } = await (await request.get(`${STUB_URL}/__public-requests`)).json();
  expect(decodeURIComponent(requests.at(-1).path)).toContain("purpose=sale,rent");

  // The panel shows what is applied.
  await expect(panel(page).locator("summary")).toHaveText("Filters (7 active)");
  await open(page);
  await expect(group(page, "Purpose").getByLabel("Rent")).toBeChecked();
  await expect(group(page, /^Price/).getByLabel("Maximum")).toHaveValue("2000000");

  await chips(page).getByRole("link", { name: "Remove Purpose: Sale" }).click();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByTestId("browse-empty")).toContainText("No listings match these filters.");
  await expect.poll(() => query(page)).toContain("purpose=rent&category=house");
  // The form follows a link navigation.
  await open(page);
  await expect(group(page, "Purpose").getByLabel("Sale")).not.toBeChecked();
  await chips(page).getByRole("link", { name: "Remove Minimum price (PKR): 1000" }).click();
  await expect(chips(page)).not.toContainText("Minimum price");
  await chips(page).getByRole("link", { name: "Clear all" }).click();
  await expect(cards(page)).toHaveCount(2);
  await expect.poll(() => query(page)).toBe("");
});

test("areas follow the chosen city and are removed with it", async ({ page }) => {
  await page.goto("/listings");
  await open(page);
  await expect(panel(page)).toContainText("Choose a city and apply the filters");
  await group(page, "City").getByLabel("Karachi").check();
  await apply(page);
  await open(page);
  await panel(page).getByRole("group", { name: "In Karachi" }).getByLabel("Clifton").check();
  await apply(page);
  await expect.poll(() => query(page)).toBe(`?city=${KARACHI}&locality=${CLIFTON}`);
  await expect(chips(page)).toContainText("Area or society: Clifton");
  await chips(page).getByRole("link", { name: "Remove City: Karachi" }).click();
  await expect(chips(page)).toHaveCount(0);
  await expect.poll(() => query(page)).toBe("");
});

test("sort by price and date; the next page keeps the filters and a change goes back to the first", async ({ page }) => {
  await page.goto("/listings?category=house");
  await page.getByLabel("Sort by").selectOption({ label: "Price: low to high" });
  await page.getByRole("button", { name: "Sort", exact: true }).click();
  await expect.poll(() => query(page)).toBe("?sort=price_asc&category=house");
  await expect(cards(page).first()).toContainText("Quiet family house");
  await page.getByTestId("browse-next").click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText("Corner house with garden");
  await expect.poll(() => query(page)).toContain("sort=price_asc&category=house&cursor=page2.");
  await expect(page.getByRole("link", { name: "Back to the first page" })).toHaveAttribute("href", "/listings?sort=price_asc&category=house");
  await page.getByLabel("Sort by").selectOption({ label: "Price: high to low" });
  await page.getByRole("button", { name: "Sort", exact: true }).click();
  await expect.poll(() => query(page)).toBe("?sort=price_desc&category=house");
  await expect(cards(page).first()).toContainText("Corner house with garden");
  await page.getByLabel("Sort by").selectOption({ label: "Newest first" });
  await page.getByRole("button", { name: "Sort", exact: true }).click();
  await expect.poll(() => query(page)).toBe("?category=house");
});

test("preferences have no controls but are carried along", async ({ page }) => {
  await page.goto("/listings?prefer_bedrooms_min=3");
  await expect(page.getByLabel("Sort by")).toHaveValue("relevance");
  await open(page);
  await group(page, "Purpose").getByLabel("Sale").check();
  await apply(page);
  await expect.poll(() => query(page)).toBe("?prefer_bedrooms_min=3&purpose=sale");
});

test("refused values, a stale page link and an unreadable filter schema", async ({ page, request }) => {
  await page.goto("/listings?bedrooms_min=5&bedrooms_max=2&colour=red&purpose=sale");
  const refused = page.getByTestId("browse-bad-filters");
  await expect(refused).toContainText("Maximum bedrooms: The upper bound is below the lower bound.");
  await expect(refused).toContainText("colour: This parameter is not accepted.");
  await expect(cards(page)).toHaveCount(0);
  // The panel opens on the refused input.
  await expect(group(page, "Bedrooms").getByLabel("Maximum")).toHaveAttribute("aria-invalid", "true");
  await refused.getByRole("link", { name: "Remove colour" }).click();
  await expect(refused).not.toContainText("colour");
  await refused.getByRole("link", { name: "Remove Maximum bedrooms" }).click();
  await expect(refused).toHaveCount(0);
  await expect.poll(() => query(page)).toBe("?bedrooms_min=5&purpose=sale");

  await page.goto("/listings?purpose=sale&cursor=page2");
  await page.getByTestId("browse-bad-page").getByRole("link", { name: "Go to the first page" }).click();
  await expect(cards(page)).toHaveCount(2);
  await expect.poll(() => query(page)).toBe("?purpose=sale");

  await request.get(`${STUB_URL}/__public-mode?value=filters_error`);
  await page.goto("/listings?purpose=rent");
  await expect(page.getByTestId("filters-unavailable")).toContainText("not available");
  await expect(cards(page)).toHaveCount(1);
  await expect(page.locator("main")).not.toContainText("Internal detail");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the form filters, sorts and clears", async ({ page }) => {
    await page.goto("/listings");
    await setEverything(page);
    await expect(cards(page)).toHaveCount(1);
    await expect.poll(() => query(page)).toBe(`?purpose=sale,rent&category=house&asking_price_min=1000&asking_price_max=2000000&city=${KARACHI}&amenities=elevator`);
    await page.getByRole("link", { name: "Clear all", exact: true }).click();
    await expect(cards(page)).toHaveCount(2);
    await expect.poll(() => query(page)).toBe("");
  });
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
]) {
  test(`axe: the filter panel, active filters and refused filters on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/listings?purpose=sale&city=${KARACHI}&amenities=elevator`);
    await open(page);
    await expectNoViolations(page, "open panel with results");
    await page.goto("/listings?bedrooms_min=x");
    await expect(page.getByTestId("browse-bad-filters")).toBeVisible();
    await expectNoViolations(page, "refused filters");
  });
}
