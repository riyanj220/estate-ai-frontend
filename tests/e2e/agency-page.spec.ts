import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type Page } from "@playwright/test";

// Story 3.8, frontend half: the public Agency page, rendered on the server from the stub's public Agency endpoints.
const SUNRISE = "66666666-6666-4666-8666-666666666666";
const HARBOUR = "77777777-7777-4777-8777-777777777777";
const UNKNOWN = "88888888-8888-4888-8888-888888888888";

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

const cards = (page: Page) => page.getByTestId("browse-card");
const profile = (page: Page) => page.getByTestId("agency-profile");
const query = (page: Page) => decodeURIComponent(new URL(page.url()).search);

async function expectNoViolations(page: Page, label: string) {
  await expect(page).toHaveTitle(/.+/);
  expect((await new AxeBuilder({ page }).analyze()).violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}

test("the advertiser link on a card and on the detail opens the agency page @smoke", async ({ page }) => {
  await page.goto("/listings");
  await page.getByTestId("browse-advertiser").first().getByRole("link", { name: "Sunrise Estates" }).click();
  await expect(page).toHaveURL(`${APP_URL}/agencies/${SUNRISE}`);
  await expect(page).toHaveTitle("Sunrise Estates | EstateAI");
  await expect(page.getByRole("heading", { level: 1, name: "Sunrise Estates" })).toBeVisible();
  await expect(profile(page).getByRole("img", { name: "Logo of Sunrise Estates" })).toHaveAttribute("src", `/api/v1/agencies/${SUNRISE}/logo`);
  await expect(profile(page)).toContainText("Homes across Karachi.");
  await expect(profile(page)).toContainText("Not verified");
  await page.goto("/listings/00000000-0000-4000-b000-000000000001");
  await page.getByTestId("listing-advertiser").getByRole("link", { name: "Sunrise Estates" }).click();
  await expect(profile(page)).toBeVisible();
});

test("server-rendered without private values; its listings are paged and filtered within the agency", async ({ page, request }) => {
  const html = await (await request.get(`${APP_URL}/agencies/${SUNRISE}`)).text();
  expect(html).toContain("Homes across Karachi.");
  expect(html).toContain("Corner house with garden");
  for (const secret of ["+923009998877", "Cedar Lane"]) expect(html).not.toContain(secret);

  await page.goto(`/agencies/${SUNRISE}`);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText("Corner house with garden");
  await page.getByTestId("browse-next").click();
  await expect(cards(page)).toContainText("Agency town house");
  await expect.poll(() => query(page)).toBe("?cursor=page2");
  await page.getByRole("link", { name: "Back to the first page" }).click();

  const panel = page.getByTestId("filter-panel");
  await panel.locator("summary").click();
  await panel.getByRole("group", { name: /^Price/ }).first().getByLabel("Maximum").fill("800000");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText("Agency town house");
  expect(new URL(page.url()).pathname).toBe(`/agencies/${SUNRISE}`);
  await expect.poll(() => query(page)).toBe("?asking_price_max=800000");
  const { requests } = await (await request.get(`${STUB_URL}/__public-requests`)).json();
  expect(requests.at(-1).path).toContain("/api/v1/public/");
  expect(requests.some((entry: { path: string }) => entry.path === `/api/v1/public/agencies/${SUNRISE}/listings?asking_price_max=800000`)).toBe(true);

  await page.getByRole("link", { name: "Clear all", exact: true }).click();
  await expect.poll(() => query(page)).toBe("");
  await page.goto(`/agencies/${SUNRISE}?bedrooms_min=x`);
  await expect(page.getByTestId("browse-bad-filters")).toBeVisible();
});

test("empty, verified, not found and error", async ({ page, request }) => {
  await page.goto(`/agencies/${HARBOUR}`);
  await expect(profile(page)).toContainText("Verified agency");
  await expect(profile(page).getByRole("img")).toHaveCount(0);
  await expect(page.getByTestId("browse-empty")).toHaveText("This agency has no published listings.");
  for (const bad of [UNKNOWN, "nope"]) {
    const response = await page.goto(`/agencies/${bad}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByTestId("agency-not-found")).toBeVisible();
    await expect(profile(page)).toHaveCount(0);
  }
  await request.get(`${STUB_URL}/__public-mode?value=error`);
  await page.goto(`/agencies/${SUNRISE}`);
  await expect(page.getByTestId("agency-error")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Internal detail");
});

for (const width of [1280, 320]) {
  test(`axe: the agency page and its not-found state at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/agencies/${SUNRISE}`);
    await expectNoViolations(page, "profile");
    await page.goto(`/agencies/${UNKNOWN}`);
    await expectNoViolations(page, "not found");
  });
}
