import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Stories 10.1 and 10.2, frontend: the closure request (Suspended accounts included) and the administrator's queue.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

async function signInAs(page: Page, request: APIRequestContext, who: "individual" | "suspended" | "admin") {
  await request.get(`${STUB_URL}/__me-mode?value=up`);
  await request.get(`${STUB_URL}/__signin-mode?value=${who === "suspended" ? "suspended" : "ok"}`);
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
  const form = page.getByRole("form", { name: "Request account closure" });
  await form.getByLabel("Delete my account").check();
  await form.getByRole("button", { name: "Send request" }).click();
}

async function decide(page: Page, button: "Reject" | "Approve and close account", reason: string) {
  await page.getByRole("button", { name: "Decide a***@example.com" }).click();
  const decision = page.getByTestId("closure-decision");
  await decision.getByRole("button", { name: button }).click();
  await expect(decision.getByLabel("Reason")).toHaveAttribute("aria-invalid", "true");
  await decision.getByLabel("Reason").fill(reason);
  await decision.getByRole("button", { name: button }).click();
}

test("a Suspended account requests closure, is rejected with a reason, asks again and is approved @smoke", async ({ page, request }) => {
  const state = page.getByTestId("closure-state");
  const form = page.getByRole("form", { name: "Request account closure" });
  await signInAs(page, request, "suspended");
  await page.goto("/account/profile");
  await page.getByRole("link", { name: "Close account" }).click();
  await expect(state).toHaveText("No request");
  await expectNoViolations(page, "closure form");
  await send(page);
  await expect(state).toHaveText("Pending");
  await expect(form).toHaveCount(0);

  await signInAs(page, request, "admin");
  await page.goto("/admin/closure-requests");
  await expect(page.getByTestId("closure-row")).toHaveCount(1);
  await expectNoViolations(page, "admin queue");
  await decide(page, "Reject", "Please wait for the open report");
  await expect(page.getByTestId("closure-announcement")).toHaveText("The request was rejected.");
  await expect(page.getByTestId("closure-row")).toHaveCount(0);

  await signInAs(page, request, "individual");
  await page.goto("/account/closure");
  await expect(state).toHaveText("Rejected");
  await expect(page.getByTestId("closure-reason")).toHaveText("Please wait for the open report");
  await send(page);
  await expect(state).toHaveText("Pending");

  await signInAs(page, request, "admin");
  await page.goto("/admin/closure-requests");
  await decide(page, "Approve and close account", "Requested by the holder");
  await expect(page.getByTestId("closure-announcement")).toHaveText("The account was closed.");
  await page.getByLabel("Show").selectOption("approved");
  await expect(page.getByTestId("closure-row")).toContainText("Closed account");
});

test("a non-administrator has no closure queue", async ({ page, request }) => {
  await signInAs(page, request, "individual");
  await page.goto("/admin/closure-requests");
  await expect(page.getByRole("heading", { name: "Closure requests" })).toHaveCount(0);
});
