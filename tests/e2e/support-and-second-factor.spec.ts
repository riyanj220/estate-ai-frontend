import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Stories 10.9 and 10.10, frontend: support requests (Suspended accounts included) and the administrator's second factor.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

async function signInAs(page: Page, request: APIRequestContext, who: "suspended" | "admin") {
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

test("a Suspended account writes to support; the administrator reads it with a reason and closes it @smoke", async ({ page, request }) => {
  const message = "Please explain why my account was suspended.";
  await signInAs(page, request, "suspended");
  await page.goto("/account/profile");
  await page.getByRole("link", { name: "Contact support" }).click();
  const form = page.getByRole("form", { name: "Contact support" });
  await form.getByRole("button", { name: "Send message" }).click();
  await expect(form.getByLabel("Message")).toHaveAttribute("aria-invalid", "true");
  await form.getByLabel("Topic").selectOption("decision");
  await form.getByLabel("Message").fill(message);
  await form.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByTestId("support-announcement")).toHaveText("Your request was recorded.");
  await expect(page.getByTestId("support-row")).toContainText("Contest a decision · Open");
  await expectNoViolations(page, "support form");

  await signInAs(page, request, "admin");
  await page.goto("/admin/support");
  await expect(page.getByTestId("support-row")).toHaveCount(1);
  await expect(page.getByRole("main")).not.toContainText(message);
  await page.getByRole("button", { name: "Open request from a***@example.com" }).click();
  const selected = page.getByTestId("support-selected");
  await selected.getByRole("button", { name: "Show message" }).click();
  await expect(selected.getByLabel("Reason for reading")).toHaveAttribute("aria-invalid", "true");
  await selected.getByLabel("Reason for reading").fill("Answering the request");
  await selected.getByRole("button", { name: "Show message" }).click();
  await expect(selected.getByTestId("private-data")).toHaveText(message);
  await expectNoViolations(page, "support queue");
  await selected.getByRole("button", { name: "Close request" }).click();
  await expect(page.getByTestId("support-announcement")).toHaveText("The request was closed.");
  await expect(page.getByTestId("support-row")).toHaveCount(0);
});

test("an administrator sets up a second factor and then needs the code to sign in", async ({ page, request }) => {
  await signInAs(page, request, "admin");
  await page.goto("/admin/second-factor");
  await expect(page.getByTestId("second-factor-state")).toHaveText("Your second factor is off.");
  const setUp = page.getByRole("form", { name: "Set up a second factor" });
  await setUp.getByLabel("Current password", { exact: true }).fill("wrong password");
  await setUp.getByRole("button", { name: "Set up" }).click();
  await expect(setUp.getByLabel("Current password", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await setUp.getByLabel("Current password", { exact: true }).fill("stub password");
  await setUp.getByRole("button", { name: "Set up" }).click();
  await expect(page.getByTestId("second-factor-secret")).toHaveText("STUBSTUBSTUB");
  await expectNoViolations(page, "second factor setup");
  const confirm = page.getByRole("form", { name: "Confirm the second factor" });
  await confirm.getByLabel("Code").fill("000000");
  await confirm.getByRole("button", { name: "Turn on" }).click();
  await expect(confirm.getByLabel("Code")).toHaveAttribute("aria-invalid", "true");
  await confirm.getByLabel("Code").fill("123456");
  await confirm.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByTestId("second-factor-state")).toContainText("Your second factor is on.");
  await expect(page.getByTestId("second-factor-secret")).toHaveCount(0);

  await request.get(`${STUB_URL}/__expire-session`);
  await page.context().clearCookies();
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email address").fill("root.admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("stub password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("form-notice")).toHaveText("The email or password is not correct.");
  await page.getByLabel("Password", { exact: true }).fill("stub password");
  await page.getByLabel("Authenticator code (if you set one up)").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
});
