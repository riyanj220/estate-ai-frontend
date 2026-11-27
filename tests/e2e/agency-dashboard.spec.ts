import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Epic 8, frontend: the Agency portfolio on the dashboard (Stories 8.1, 8.2) and the view beacon of the public detail.
const LISTING = "00000000-0000-4000-b000-000000000001";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

async function startSession(page: Page, request: APIRequestContext) {
  await request.get(`${STUB_URL}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
}

async function expectNoViolations(page: Page, label: string) {
  await expect(page).toHaveTitle(/.+/);
  expect((await new AxeBuilder({ page }).analyze()).violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}

const recorded = async (request: APIRequestContext) => (await request.get(`${STUB_URL}/__portfolio-requests`)).json();

test("an Agency sees totals, views and inquiries and combines filters @smoke", async ({ page, request }) => {
  await request.get(`${STUB_URL}/__me-mode?value=agency`);
  await startSession(page, request);
  await page.goto("/dashboard");
  await expect(page.getByTestId("portfolio-total")).toHaveText("Total listings: 2");
  await expect(page.getByTestId("portfolio-inquiries")).toHaveText("Inquiries received: 3");
  await expect(page.getByTestId("portfolio-views")).toHaveText("Listing views: 12");
  await expect(page.getByTestId("portfolio-totals").getByRole("link", { name: "Open your inbox" })).toHaveAttribute("href", "/messages");
  const rows = page.getByTestId("portfolio-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Views: 12 · Inquiries: 3");

  const form = page.getByRole("form", { name: "Filter listings" });
  await form.getByLabel("Status").selectOption("published");
  await form.getByLabel("Category").selectOption("house");
  await form.getByLabel("Created from").fill("2026-11-01");
  await form.getByRole("button", { name: "Apply filters" }).click();
  await expect(rows).toHaveCount(1);
  expect((await recorded(request)).queries.at(-1)).toBe("?status=published&category=house&created_from=2026-11-01");

  await form.getByLabel("Created to").fill("2026-10-01");
  await form.getByRole("button", { name: "Apply filters" }).click();
  await expect(form.getByRole("alert")).toHaveText("The end date must not be before the start date.");

  for (const size of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(size);
    await expectNoViolations(page, `dashboard ${size.width}`);
  }
  await form.getByRole("button", { name: "Clear filters" }).click();
  await expect(rows).toHaveCount(2);
});

test("an Individual has no portfolio", async ({ page, request }) => {
  await startSession(page, request);
  await page.goto("/dashboard");
  await expect(page.getByTestId("allowance-card")).toBeVisible();
  await expect(page.getByTestId("portfolio-totals")).toHaveCount(0);
  expect((await recorded(request)).queries).toEqual([]);
});

test("showing a public Listing sends one view beacon, with the CSRF token only when signed in", async ({ page, request }) => {
  await page.goto(`/listings/${LISTING}`);
  await expect.poll(async () => (await recorded(request)).beacons).toEqual([{ listing: LISTING, token: null }]);

  await request.get(`${STUB_URL}/__reset`);
  await startSession(page, request);
  await page.goto(`/listings/${LISTING}`);
  await expect.poll(async () => (await recorded(request)).beacons.length).toBe(1);
  expect((await recorded(request)).beacons[0].token).toMatch(/^csrf-/);
});
