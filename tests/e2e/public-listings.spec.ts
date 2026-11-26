import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type Page } from "@playwright/test";

// Story 3.1, frontend half: the public browse and detail pages, rendered on the server from the stub's public endpoints.
const id = (seq: number) => `00000000-0000-4000-b000-${String(seq).padStart(12, "0")}`;
const PRIVATE = ["Cedar Lane", "Plot 12", "24.860000", "+923009998877", "Revision", "Street", "House number", "Latitude"];

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

async function expectNoViolations(page: Page, label: string) {
  await expect(page).toHaveTitle(/.+/);
  expect((await new AxeBuilder({ page }).analyze()).violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}

test("browse: the header link, cards, the next page and the forwarded cookie @smoke", async ({ page, request }) => {
  await page.context().addCookies([{ name: "sessionid", value: "abc123", url: APP_URL }]);
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "Browse" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Browse listings" })).toBeVisible();
  const cards = page.getByTestId("browse-card");
  await expect(cards).toHaveCount(2);
  for (const text of ["PKR 1,500,000.00 (Total)", "Sale · House · House", "10 Marla", "Bedrooms: 4", "Clifton, Karachi", "20 Nov 2026"]) {
    await expect(cards.first()).toContainText(text);
  }
  await expect(cards.first().getByRole("img")).toHaveAttribute("src", `/api/v1/listings/${id(1)}/images/00000000-0000-4000-c000-000000000001/file`);
  await expect(cards.nth(1)).toContainText("No image");
  // Story 3.6: who advertises, in text; the logo is decorative beside the name, and an unverified Agency carries no mark.
  const advertisers = page.getByTestId("browse-advertiser");
  await expect(advertisers.first()).toHaveText("Listed by agency: Sunrise Estates");
  await expect(advertisers.first().locator("img")).toHaveAttribute("src", /^\/api\/v1\/agencies\/[0-9a-f-]{36}\/logo$/);
  await expect(advertisers.nth(1)).toHaveText("Listed by an individual");
  await expect(advertisers.nth(1).locator("img")).toHaveCount(0);
  await expect(cards.first()).toMatchAriaSnapshot(`
    - paragraph:
      - text: "Listed by agency:"
      - link "Sunrise Estates"
  `);
  await expect(page.getByTestId("browse-next")).toHaveAttribute("href", "/listings?cursor=page2");
  await page.getByTestId("browse-next").click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Older house near the market");
  await expect(advertisers).toContainText("Listed by agency: Harbour Homes");
  await expect(advertisers).toContainText("Verified agency");
  await expect(page.getByTestId("browse-next")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to the first page" })).toHaveAttribute("href", "/listings");
  const { requests } = await (await request.get(`${STUB_URL}/__public-requests`)).json();
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every((entry: { cookie: string }) => entry.cookie.includes("sessionid=abc123"))).toBe(true);
});

test("detail: advertiser, images, facts, seller-declared statements, description and no private value", async ({ page }) => {
  await page.goto("/listings");
  await page.getByRole("link", { name: "Corner house with garden" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Corner house with garden" })).toBeVisible();
  await expect(page).toHaveTitle("Corner house with garden | EstateAI");
  await expect(page.getByTestId("listing-advertiser")).toHaveText("Listed by agency: Sunrise Estates");
  await expect(page.getByTestId("listing-advertiser").locator("img")).toHaveCount(1);
  await expect(page.getByTestId("listing-images").getByRole("img")).toHaveCount(2);
  // Possession is the seller's statement: labelled in the text a screen reader gets, with no platform mark.
  const possession = page.getByTestId("listing-detail-possession_availability");
  await expect(possession).toContainText("Seller-declared");
  await expect(possession).toMatchAriaSnapshot(`- definition: /Seller-declared/`);
  await expect(page.getByTestId("listing-facts")).not.toContainText(/verified|EstateAI/i);
  await expect(page.getByTestId("listing-price")).toHaveText("PKR 1,500,000.00 (Total)");
  await expect(page.getByTestId("listing-location-city")).toHaveText("Karachi");
  await expect(page.getByTestId("listing-location-locality")).toHaveText("Clifton");
  await expect(page.getByTestId("listing-location-society")).toHaveText("Palm Society");
  await expect(page.getByTestId("listing-detail-bedrooms")).toHaveText("4");
  await expect(page.getByTestId("listing-detail-basement")).toHaveText("Yes");
  await expect(page.getByTestId("listing-amenities-on_property")).toContainText("Elevator");
  await expect(page.getByTestId("listing-amenities-nearby")).toContainText("Seller-declared");
  await expect(page.getByTestId("listing-description")).toHaveText("Three bedrooms near the park.\nQuiet street.");
  // Neither the page nor the server-rendered payload carries a private value.
  const body = await page.locator("main").innerText();
  const html = await page.content();
  for (const secret of PRIVATE) expect(body).not.toContain(secret);
  for (const secret of ["Cedar Lane", "Plot 12", "24.860000", "+923009998877"]) expect(html).not.toContain(secret);
});

test("empty, error, invalid page link and not found", async ({ page, request }) => {
  await request.get(`${STUB_URL}/__public-mode?value=empty`);
  await page.goto("/listings");
  await expect(page.getByTestId("browse-empty")).toBeVisible();
  await request.get(`${STUB_URL}/__public-mode?value=error`);
  await page.goto("/listings");
  await expect(page.getByTestId("browse-error")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Internal detail");
  await page.goto(`/listings/${id(1)}`);
  await expect(page.getByTestId("listing-error")).toBeVisible();
  await request.get(`${STUB_URL}/__public-mode?value=ok`);
  await page.getByRole("link", { name: "Try again" }).click();
  await expect(page.getByTestId("listing-price")).toBeVisible();
  await page.goto("/listings?cursor=bogus");
  await expect(page.getByTestId("browse-bad-page")).toBeVisible();
  for (const path of [`/listings/${id(99)}`, "/listings/not-an-id"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByTestId("listing-not-found")).toBeVisible();
  }
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
]) {
  test(`accessibility: browse, detail and not found on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const path of ["/listings", `/listings/${id(1)}`, `/listings/${id(99)}`]) {
      await page.goto(path);
      await expectNoViolations(page, path);
    }
  });
}
