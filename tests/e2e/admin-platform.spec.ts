import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Stories 10.4 to 10.8, frontend: account review, reference data, AI oversight, audit log and dashboard.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

async function signInAsAdmin(page: Page, request: APIRequestContext) {
  await request.get(`${STUB_URL}/__me-mode?value=up`);
  await request.get(`${STUB_URL}/__signin-mode?value=ok`);
  await request.get(`${STUB_URL}/__force-session?kind=admin`);
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

test("the dashboard shows the counts @smoke", async ({ page, request }) => {
  await signInAsAdmin(page, request);
  await page.goto("/admin");
  await expect(page.getByTestId("count-individual-accounts")).toHaveText("12");
  await expect(page.getByTestId("count-unresolved-reports")).toHaveText("5");
  await expect(page.getByTestId("count-messages-sent")).toHaveText("11");
  await expectNoViolations(page, "dashboard");
});

test("an account is found, reviewed, and its contact details need a reason", async ({ page, request }) => {
  await signInAsAdmin(page, request);
  await page.goto("/admin/accounts");
  const search = page.getByRole("form", { name: "Search accounts" });
  await search.getByLabel("Name or account id").fill("nobody");
  await search.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId("account-row")).toHaveCount(0);
  await search.getByLabel("Name or account id").fill("ayesha");
  await search.getByRole("button", { name: "Search" }).click();
  expect(page.url()).not.toContain("ayesha");
  await page.getByRole("link", { name: "Ayesha Sample" }).click();
  await expect(page.getByTestId("review-state")).toHaveText("Active");
  await expect(page.getByRole("list", { name: "Account reports" })).toContainText("Reported house: Misleading");
  await expect(page.getByRole("list", { name: "Account closure requests" })).toContainText("Reason: Open report");
  await expect(page.getByRole("main")).not.toContainText("ayesha@example.com");
  const read = page.getByRole("form", { name: "Contact details" });
  await read.getByRole("button", { name: "Show contact details" }).click();
  await expect(read.getByLabel("Reason for reading")).toHaveAttribute("aria-invalid", "true");
  await read.getByLabel("Reason for reading").fill("Checking a complaint");
  await read.getByRole("button", { name: "Show contact details" }).click();
  await expect(read.getByTestId("private-data")).toContainText("+920000000000");
  await expectNoViolations(page, "account review");
});

test("a city is added and deactivated; a taken name is refused; fixed values have no controls", async ({ page, request }) => {
  await signInAsAdmin(page, request);
  await page.goto("/admin/reference");
  const add = page.getByRole("form", { name: "Add city" });
  const cities = page.getByRole("list", { name: "Cities" });
  const notice = page.getByTestId("reference-notice");
  await expect(cities).toContainText("Karachi");
  await add.getByLabel("City name").fill("karachi");
  await add.getByRole("button", { name: "Add city" }).click();
  await expect(notice).toHaveText("That value is not valid or is already in use.");
  await add.getByLabel("City name").fill("Quetta");
  await add.getByRole("button", { name: "Add city" }).click();
  await expect(notice).toHaveText("Saved.");
  await page.getByRole("button", { name: "Deactivate Quetta" }).click();
  await expect(cities).toContainText("Quetta - deactivated");
  await expect(page.getByTestId("fixed-catalogue")).toContainText("sqyd, marla");
  await expect(page.getByTestId("fixed-catalogue").getByRole("button")).toHaveCount(0);
  await expectNoViolations(page, "reference data");
});

test("an AI feature is turned off and the audit log lists records", async ({ page, request }) => {
  await signInAsAdmin(page, request);
  await page.goto("/admin/ai");
  await expect(page.getByRole("list", { name: "AI requests" })).toContainText("4 requests, 1 failed");
  await page.getByRole("button", { name: "Turn off Assistant chat" }).click();
  await expect(page.getByTestId("ai-notice")).toHaveText("Assistant chat is now off.");
  await expect(page.getByTestId("ai-switch")).toContainText("Off");
  await expect(page.getByRole("link", { name: "Reports about AI-generated content" })).toHaveAttribute("href", "/admin/reports?reason=ai_generated_content");
  await expectNoViolations(page, "AI oversight");

  await page.goto("/admin/audit");
  await expect(page.getByTestId("audit-row")).toContainText("Reason: Checking a complaint");
  const filters = page.getByRole("form", { name: "Filter records" });
  await filters.getByLabel("Action").selectOption("city.created");
  await filters.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("No records.", { exact: true })).toBeVisible();
  await expectNoViolations(page, "audit log");
});
