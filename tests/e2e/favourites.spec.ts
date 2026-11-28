import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Story 3.7, frontend half: Save on the public pages and the favourites page.
const id = (seq: number) => `00000000-0000-4000-b000-${String(seq).padStart(12, "0")}`;

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

async function startSession(page: Page, request: APIRequestContext, kind: "user" | "admin" = "user") {
  await request.get(`${STUB_URL}/__force-session${kind === "admin" ? "?kind=admin" : ""}`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
}

async function expectNoViolations(page: Page, label: string) {
  await expect(page).toHaveTitle(/.+/);
  expect((await new AxeBuilder({ page }).analyze()).violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}

const cards = (page: Page) => page.getByTestId("browse-card");

test("a Visitor is asked to sign in or register, and nothing is requested for them", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (request) => request.url().includes("/me/favourites") && asked.push(request.url()));
  await page.goto("/listings");
  await cards(page).first().getByRole("button", { name: /^Save/ }).click();
  const prompt = cards(page).first().getByTestId("save-prompt");
  await expect(prompt).toHaveText("Sign in or create an account to save listings.");
  await expect(prompt.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in?next=%2Flistings");
  await expect(prompt.getByRole("link", { name: "create an account" })).toHaveAttribute("href", "/register");
  await expect(page.getByRole("banner").getByRole("link", { name: "Favourites" })).toHaveCount(0);
  await expectNoViolations(page, "visitor prompt");
  expect(asked).toEqual([]);
});

test("save and unsave on a card and the detail @smoke", async ({ page, request }) => {
  await startSession(page, request);
  await page.goto("/listings");
  const button = cards(page).first().getByRole("button");
  await expect(button).toHaveText(/^Save:/);
  await button.click();
  await expect(button).toHaveText(/^Saved:/);
  await expect(cards(page).nth(1).getByRole("button")).toHaveText(/^Save:/);
  await page.goto(`/listings/${id(1)}`);
  const detail = page.getByRole("button", { name: /^Saved/ });
  await expect(detail).toBeVisible();
  await expectNoViolations(page, "detail saved");
  await detail.click();
  await expect(page.getByRole("button", { name: /^Save\b/ })).toBeVisible();
});

test("the cap message", async ({ page, request }) => {
  await startSession(page, request);
  await request.get(`${STUB_URL}/__favourites-mode?value=full`);
  await page.goto("/listings");
  await cards(page).first().getByRole("button").click();
  await expect(cards(page).first().getByTestId("save-status")).toHaveText("You have 500 saved listings, the most allowed. Remove one to save another.");
  await expect(cards(page).first().getByRole("button")).toHaveText(/^Save:/);
});

test("the favourites page: header and dashboard links, an unavailable row, remove, axe", async ({ page, request }) => {
  await startSession(page, request);
  await request.get(`${STUB_URL}/__favourites-preset?value=some`);
  await page.goto("/dashboard");
  await expect(page.getByRole("banner").getByRole("link", { name: "Favourites" })).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "Favourites" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Favourites" })).toBeVisible();
  await expect(page.getByTestId("favourite")).toContainText("Corner house with garden");
  const gone = page.getByTestId("favourite-unavailable");
  await expect(gone.getByRole("heading")).toHaveText("No longer available");
  await expect(gone).toContainText("21 Nov 2026");
  await expect(gone.getByRole("link")).toHaveCount(0);
  for (const size of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(size);
    await expectNoViolations(page, `favourites ${size.width}`);
  }
  await gone.getByRole("button", { name: /^Remove/ }).click();
  await expect(gone).toHaveCount(0);
  await expect(page.getByTestId("favourites-status")).toHaveText("Removed from favourites.");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.getByTestId("favourite").getByRole("button", { name: /^Remove/ }).click();
  await expect(page.getByTestId("favourites-empty")).toBeVisible();
  await expectNoViolations(page, "favourites empty");
});

test("guard: a Visitor is sent to sign in; an administrator has no favourites", async ({ page, request }) => {
  const raw = await request.get(`${APP_URL}/account/favourites`, { maxRedirects: 0 });
  expect(raw.status()).toBe(307);
  expect(raw.headers().location).toContain("/sign-in?next=%2Faccount%2Ffavourites");
  await startSession(page, request, "admin");
  await page.goto("/listings");
  await expect(cards(page).first()).toBeVisible();
  await expect(page.getByTestId("account-name")).toBeVisible();
  await expect(cards(page).first().getByRole("button")).toHaveCount(0);
});
