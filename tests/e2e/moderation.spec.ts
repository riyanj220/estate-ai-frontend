import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Epic 9, frontend: report a listing (9.1), review reports (9.2), browse listings (9.3) and moderate them (9.4).
test.describe.configure({ mode: "serial" });

const id = "00000000-0000-4000-b000-000000000001";
const DRAFT = "00000000-0000-4000-b000-000000000099";

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

async function signInAs(page: Page, request: APIRequestContext, who: "user" | "admin") {
  await request.get(`${STUB_URL}/__force-session${who === "admin" ? "?kind=admin" : ""}`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
}

async function expectNoViolations(page: Page, label: string) {
  await expect(page).toHaveTitle(/.+/);
  for (const size of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(size);
    expect((await new AxeBuilder({ page }).analyze()).violations, `${label} ${size.width}`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} ${size.width} overflow`).toBe(false);
  }
}

test("a listing is reported once, then reviewed by an administrator @smoke", async ({ page, request }) => {
  await signInAs(page, request, "user");
  await page.goto(`/listings/${id}`);
  await page.getByRole("button", { name: "Report listing" }).click();
  const form = page.getByRole("form", { name: "Report listing" });
  await form.getByRole("button", { name: "Send report" }).click();
  await expect(form.getByLabel("Reason")).toHaveAttribute("aria-invalid", "true");
  await expectNoViolations(page, "report form");
  await form.getByLabel("Reason").selectOption("ai_generated_content");
  await form.getByLabel("Details (optional)").fill("The text looks made up");
  await form.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByTestId("report-status")).toContainText("Your report was sent");
  await page.getByRole("button", { name: "Report listing" }).click();
  await form.getByLabel("Reason").selectOption("other");
  await form.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByTestId("report-status")).toContainText("already have an open report");

  await signInAs(page, request, "admin");
  await page.goto("/admin/reports");
  await expect(page.getByTestId("report-counts")).toHaveText("Unresolved: 1 pending, 0 reviewing.");
  await page.getByLabel("Reason").selectOption("duplicate");
  await expect(page.getByTestId("report-row")).toHaveCount(0);
  await page.getByLabel("Reason").selectOption("ai_generated_content");
  await page.getByRole("button", { name: "Review report on Corner house with garden" }).click();
  const detail = page.getByTestId("report-detail");
  await expect(detail.getByTestId("report-snapshot")).toContainText("Near the park.");
  await expectNoViolations(page, "report detail");
  await detail.getByRole("button", { name: "Start review" }).click();
  await expect(page.getByTestId("report-notice")).toHaveText("The report is being reviewed.");
  await detail.getByRole("button", { name: "Resolve" }).click();
  await expect(detail.getByLabel("Notes")).toHaveAttribute("aria-invalid", "true");
  await detail.getByLabel("Notes").fill("Checked and confirmed");
  await detail.getByRole("button", { name: "Resolve" }).click();
  await expect(page.getByTestId("report-notice")).toHaveText("The report was resolved.");
  await expect(detail.getByRole("list", { name: "Review history" })).toContainText("Checked and confirmed");
});

test("an administrator restricts, removes and restores a listing, and reads a draft only with a reason", async ({ page, request }) => {
  await signInAs(page, request, "admin");
  await page.goto("/admin/listings");
  await expect(page.getByTestId("admin-listing-row")).toHaveCount(1);
  await expectNoViolations(page, "listing list");
  await page.getByRole("link", { name: "Corner house with garden" }).click();
  const listing = page.getByTestId("admin-listing");
  const state = page.getByTestId("admin-listing-status");
  const notice = page.getByTestId("moderation-notice");
  await listing.getByRole("button", { name: "Restrict" }).click();
  await expect(listing.getByLabel("Reason")).toHaveAttribute("aria-invalid", "true");
  await listing.getByLabel("Reason").fill("Photos look wrong");
  await listing.getByRole("button", { name: "Restrict" }).click();
  await expect(notice).toHaveText("The listing was restricted.");
  await expect(state).toHaveText("Published · Restricted");
  await listing.getByLabel("Reason").fill("Not a real property");
  await listing.getByRole("button", { name: "Remove" }).click();
  await expect(state).toHaveText("Removed · Restricted");
  await listing.getByLabel("Reason").fill("Reviewed and cleared");
  await listing.getByRole("button", { name: "Restore to published" }).click();
  await expect(state).toHaveText("Published · Restricted");
  await listing.getByLabel("Reason").fill("Reviewed and cleared");
  await listing.getByRole("button", { name: "Lift restriction" }).click();
  await expect(state).toHaveText("Published");
  await expect(listing.getByRole("list", { name: "Moderation history" }).getByRole("listitem")).toHaveCount(4);
  await expectNoViolations(page, "listing review");

  await page.goto("/admin/listings");
  await page.getByLabel("Status").selectOption("draft");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByRole("link", { name: "House draft" }).click();
  await expect(page).toHaveURL(new RegExp(`${DRAFT}\\?draft=1$`));
  await expect(page.getByText("Half written draft")).toHaveCount(0);
  const open = page.getByRole("form", { name: "Open draft" });
  await open.getByRole("button", { name: "Show draft" }).click();
  await expect(open.getByLabel("Reason for opening")).toHaveAttribute("aria-invalid", "true");
  await open.getByLabel("Reason for opening").fill("Checking a user complaint");
  await open.getByRole("button", { name: "Show draft" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Half written draft" })).toBeVisible();
  await expect(page.getByTestId("no-actions")).toBeVisible();
});

test("the owner sees the under review note; a non-administrator has no review pages", async ({ page, request }) => {
  await request.get(`${STUB_URL}/__listings-preset?value=published_one_image`);
  await signInAs(page, request, "user");
  const own = "00000000-0000-4000-9000-000000000001";
  await page.goto(`/account/listings/${own}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("under-review")).toHaveCount(0);
  await request.get(`${STUB_URL}/__listing-lifecycle?id=${own}&under_review=1`);
  await page.reload();
  await expect(page.getByTestId("under-review")).toContainText("Under review");
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { name: "Reports", exact: true })).toHaveCount(0);
});
