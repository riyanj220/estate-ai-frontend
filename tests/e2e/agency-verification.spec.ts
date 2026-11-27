import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Epic 8, frontend: the Agency's Verification request (Story 8.3) and the administrator's review (Story 8.4).
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

async function signInAs(page: Page, request: APIRequestContext, who: "agency" | "admin" | "individual") {
  await request.get(`${STUB_URL}/__me-mode?value=${who === "agency" ? "agency" : "up"}`);
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

async function send(page: Page) {
  const form = page.getByRole("form", { name: "Request verification" });
  await form.getByLabel("Business name").fill("Harbour Homes");
  await form.getByLabel("Registration or licence number").fill("REG/2024-17");
  await form.getByRole("button", { name: "Send request" }).click();
}

test("an Agency requests, is rejected with a reason, resubmits, is verified and then revoked @smoke", async ({ page, request }) => {
  const state = page.getByTestId("verification-state");
  await signInAs(page, request, "agency");
  await page.goto("/account/verification");
  await expect(state).toHaveText("Not verified");
  const form = page.getByRole("form", { name: "Request verification" });
  await form.getByLabel("Registration or licence number").fill("!!");
  await form.getByRole("button", { name: "Send request" }).click();
  await expect(form.getByLabel("Registration or licence number")).toHaveAttribute("aria-invalid", "true");
  await expectNoViolations(page, "agency form");
  await send(page);
  await expect(state).toHaveText("Pending review");
  await expect(form).toHaveCount(0);

  // The administrator: nothing private before a recorded reason.
  await signInAs(page, request, "admin");
  await page.goto("/admin/verification");
  const rows = page.getByTestId("verification-row");
  await expect(rows).toHaveCount(1);
  await expect(page.getByText("REG/2024-17")).toHaveCount(0);
  await page.getByRole("button", { name: "Review Harbour Homes" }).click();
  const review = page.getByTestId("verification-review");
  await review.getByRole("button", { name: "Show details" }).click();
  await expect(review.getByLabel("Reason for opening")).toHaveAttribute("aria-invalid", "true");
  await review.getByLabel("Reason for opening").fill("Reviewing the verification queue");
  await review.getByRole("button", { name: "Show details" }).click();
  await expect(review.getByRole("definition").filter({ hasText: "REG/2024-17" })).toBeVisible();
  await expectNoViolations(page, "admin review");
  await review.getByRole("button", { name: "Reject" }).click();
  await expect(review.getByLabel("Reason for rejecting")).toHaveAttribute("aria-invalid", "true");
  await review.getByLabel("Reason for rejecting").fill("Number does not match");
  await review.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByTestId("verification-announcement")).toHaveText("The request was rejected.");
  await expect(rows).toHaveCount(0);

  await signInAs(page, request, "agency");
  await page.goto("/account/verification");
  await expect(state).toHaveText("Rejected");
  await expect(page.getByTestId("verification-reason")).toHaveText("Number does not match");
  await send(page);
  await expect(state).toHaveText("Pending review");

  await signInAs(page, request, "admin");
  await page.goto("/admin/verification");
  const openRequest = async () => {
    await page.getByRole("button", { name: "Review Harbour Homes" }).click();
    await review.getByLabel("Reason for opening").fill("Reviewing the verification queue");
    await review.getByRole("button", { name: "Show details" }).click();
  };
  await openRequest();
  await review.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByTestId("verification-announcement")).toHaveText("The agency is now verified.");
  await page.getByLabel("Show").selectOption("verified");
  await openRequest();
  await expect(review.getByRole("list", { name: "Decision history" })).toContainText("Approved on");
  await review.getByLabel("Reason for revoking").fill("Licence has lapsed");
  await review.getByRole("button", { name: "Revoke verification" }).click();
  await expect(page.getByTestId("verification-announcement")).toHaveText("The verification was revoked.");

  await signInAs(page, request, "agency");
  await page.goto("/account/verification");
  await expect(state).toHaveText("Revoked");
  await expect(page.getByRole("form", { name: "Request verification" })).toBeVisible();
});

test("a pending request can be withdrawn", async ({ page, request }) => {
  await signInAs(page, request, "agency");
  await page.goto("/account/verification");
  await send(page);
  await page.getByRole("button", { name: "Withdraw request" }).click();
  await expect(page.getByTestId("verification-state")).toHaveText("Withdrawn");
  await expect(page.getByRole("form", { name: "Request verification" })).toBeVisible();
});

test("an Individual has no request form, and non-administrators have no review page", async ({ page, request }) => {
  await signInAs(page, request, "individual");
  await page.goto("/account/verification");
  await expect(page.getByTestId("verification-forbidden")).toBeVisible();
  await expect(page.getByRole("form", { name: "Request verification" })).toHaveCount(0);
  await page.goto("/admin/verification");
  await expect(page.getByRole("heading", { name: "Verification", exact: true })).toHaveCount(0);
});
