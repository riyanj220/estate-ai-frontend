import AxeBuilder from "@axe-core/playwright";
import { STUB_URL } from "./ports";
import { expect, test } from "@playwright/test";

// The home page: search first, then the newest listings, for Visitors.
test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

test("home: newest listings, shortcuts and the quick search @smoke", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("home-card")).toHaveCount(2);
  await expect(page.getByRole("link", { name: /^Houses/ })).toHaveAttribute("href", "/listings?category=house");
  const quick = page.getByRole("form", { name: "Quick search" });
  await quick.getByText("Rent", { exact: true }).click();
  await quick.getByLabel("Property type").selectOption("apartment");
  await quick.getByRole("button", { name: "Search properties" }).click();
  // The browse page drops the empty values of the plain form.
  await expect(page).toHaveURL(/\/listings\?purpose=rent&category=apartment$/);
});

test("home: the area list is searched by typing, then sent with the quick search", async ({ page, request }) => {
  // Areas are offered on the home page when there is one city, as on the live site.
  await request.get(`${STUB_URL}/__cities-mode?value=one`);
  await page.goto("/");
  const quick = page.getByRole("form", { name: "Quick search" });
  await quick.getByRole("button", { name: "Area" }).click();
  const search = quick.getByRole("combobox", { name: "Search areas" });
  await expect(search).toBeFocused();
  await search.fill("zzzz");
  await expect(quick.getByRole("listbox").getByRole("option")).toHaveCount(0);
  await expect(quick.getByText("No area matches.")).toBeVisible();
  await search.fill("");
  const choice = quick.getByRole("listbox").getByRole("option").nth(1);
  const name = (await choice.textContent()) ?? "";
  await search.fill(name);
  await search.press("Enter");
  await expect(quick.getByRole("button", { name: "Area" })).toHaveText(name);
  await quick.getByRole("button", { name: "Search properties" }).click();
  await expect(page).toHaveURL(/\/listings\?.*locality=/);
});

for (const [name, width] of [["desktop", 1280], ["mobile", 375]] as const) {
  test(`axe: the home page at ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await expect(page.getByTestId("home-card").first()).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
}
