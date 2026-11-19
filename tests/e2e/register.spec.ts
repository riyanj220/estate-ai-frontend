import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const STUB = "http://127.0.0.1:4010";
const CANARY_PASSWORD = "canary-Pass-91827";
const CANARY_PHONE = "0300 5550142";

// The stub backend holds module-level state, so these tests must not interleave.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

async function setMode(request: import("@playwright/test").APIRequestContext, value: string) {
  await request.get(`${STUB}/__registration-mode?value=${value}`);
}

async function fill(page: Page) {
  await page.getByLabel("Full name").fill("Ayesha Khan");
  await page.getByLabel("Email address").fill("  ayesha@example.com  ");
  await page.getByLabel("Password", { exact: true }).fill(CANARY_PASSWORD);
  await page.getByLabel("Phone number").fill(CANARY_PHONE);
}

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
}

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];

test("page shows heading, four labelled fields in order, submit button and privacy note", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { level: 1, name: "Create an account" })).toBeVisible();
  const names = await page.locator("form input").evaluateAll((els) => els.map((el) => (el as HTMLInputElement).name));
  expect(names).toEqual(["full_name", "email", "password", "phone"]);
  await expect(page.getByLabel("Full name")).toHaveAttribute("autocomplete", "name");
  await expect(page.getByLabel("Email address")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Email address")).toHaveAttribute("type", "email");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  await expect(page.getByLabel("Phone number")).toHaveAttribute("autocomplete", "tel");
  await expect(page.getByLabel("Phone number")).toHaveAttribute("type", "tel");
  await expect(page.getByText("0300 1234567")).toBeVisible();
  await expect(page.getByText(/phone number stays private/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});

test("home page links to /register", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test("success shows check your email, clears password and phone, sends exactly four fields", async ({ page, request }) => {
  await page.goto("/register");
  await fill(page);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
  await expect(page.getByText("ayesha@example.com")).toBeVisible();
  await expect(page.getByText(/spam/i)).toBeVisible();
  await expect(page.locator("body")).not.toContainText(CANARY_PASSWORD);
  await expect(page.locator("body")).not.toContainText(CANARY_PHONE);
  await expect(page.locator(".error-summary, [data-testid=form-notice]")).toHaveCount(0);

  const { body, count } = await (await request.get(`${STUB}/__last-registration`)).json();
  expect(count).toBe(1);
  expect(Object.keys(body).sort()).toEqual(["email", "full_name", "password", "phone"]);
  expect(body).not.toHaveProperty("role");
  expect(body.email).toBe("ayesha@example.com"); // only the email is trimmed
  expect(body.phone).toBe(CANARY_PHONE);
});

test("field errors: summary focused with links, messages under inputs, aria attributes", async ({ page, request }) => {
  await setMode(request, "fields");
  await page.goto("/register");
  await fill(page);
  await page.getByRole("button", { name: "Create account" }).click();

  const summary = page.locator(".error-summary");
  await expect(summary).toBeFocused();
  await expect(summary.getByRole("link")).toHaveCount(4);
  await expect(summary).toContainText("Enter a valid email address.");
  for (const [id, message] of [
    ["full_name", "Enter your full name using letters only."],
    ["email", "Enter a valid email address."],
    ["password", "Choose a password that is at least 8 characters long."],
    ["phone", "Enter a valid Pakistani mobile or international number."],
  ]) {
    const input = page.locator(`#${id}`);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = await input.getAttribute("aria-describedby");
    expect(describedBy).toContain(`${id}-error`);
    await expect(page.locator(`#${id}-error`)).toContainText(message);
  }
  // Values are kept and the summary links move focus to the field.
  await expect(page.getByLabel("Full name")).toHaveValue("Ayesha Khan");
  await summary.getByRole("link", { name: /Phone number/ }).click();
  await expect(page.locator("#phone")).toBeFocused();
});

test("non-field errors appear in the summary", async ({ page, request }) => {
  await setMode(request, "non_field");
  await page.goto("/register");
  await fill(page);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator(".error-summary")).toBeFocused();
  await expect(page.locator(".error-summary")).toContainText("Unexpected field.");
});

test("rate limited shows the wait time and keeps the values", async ({ page, request }) => {
  await setMode(request, "rate_limited");
  await page.goto("/register");
  await fill(page);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByTestId("form-notice")).toHaveText("Too many attempts. Try again in 30 minutes.");
  await expect(page.getByLabel("Full name")).toHaveValue("Ayesha Khan");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(CANARY_PASSWORD);
  await expect(page.getByLabel("Phone number")).toHaveValue(CANARY_PHONE);
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
});

for (const mode of ["error", "broken"]) {
  test(`server or network failure (${mode}) shows a generic retry message and keeps the values`, async ({ page, request }) => {
    await setMode(request, mode);
    await page.goto("/register");
    await fill(page);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByTestId("form-notice")).toContainText("Please try again");
    await expect(page.locator("body")).not.toContainText(/Internal detail|ECONNRESET|stack/i);
    await expect(page.getByLabel("Phone number")).toHaveValue(CANARY_PHONE);
    await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
  });
}

test("pending state disables the button, announces it and the guard prevents double submit", async ({ page, request }) => {
  await setMode(request, "hang");
  await page.goto("/register");
  await fill(page);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Creating account…" })).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText("Creating your account.");
  await page.evaluate(() => {
    const form = document.querySelector("form")!;
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect
    .poll(async () => (await (await request.get(`${STUB}/__last-registration`)).json()).count)
    .toBe(1);
});

test("a hung request times out into the network error and re-enables the button", async ({ page, request }) => {
  await setMode(request, "hang");
  await page.clock.install();
  await page.goto("/register");
  await fill(page);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Creating account…" })).toBeDisabled();
  await page.clock.runFor(21_000);
  await expect(page.getByTestId("form-notice")).toHaveText(
    "We could not reach the server. Check your connection and try again.",
  );
  await expect(page.getByTestId("form-notice")).toBeFocused();
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
  await expect(page.getByLabel("Phone number")).toHaveValue(CANARY_PHONE);
});

test("empty submit goes to the server and shows its required messages in the focused summary", async ({ page, request }) => {
  await setMode(request, "required");
  await page.goto("/register");
  await page.getByRole("button", { name: "Create account" }).click();
  const summary = page.locator(".error-summary");
  await expect(summary).toBeFocused();
  await expect(summary.getByRole("link")).toHaveCount(4);
  await expect(page.locator("#email-error")).toContainText("This field is required.");
  const { count } = await (await request.get(`${STUB}/__last-registration`)).json();
  expect(count).toBe(1);
});

test("400 with empty fields shows the server message", async ({ page, request }) => {
  await setMode(request, "empty_fields");
  await page.goto("/register");
  await fill(page);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator(".error-summary")).toContainText("The server rejected this request.");
});

test("mixed 400 maps known fields and lists unknown keys in the summary", async ({ page, request }) => {
  await setMode(request, "mixed");
  await page.goto("/register");
  await fill(page);
  await page.getByRole("button", { name: "Create account" }).click();
  const summary = page.locator(".error-summary");
  await expect(summary.getByRole("link")).toHaveCount(1);
  await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
  await expect(summary).toContainText("Unknown field.");
  await expect(summary).toContainText("Unexpected field.");
});

for (const [mode, text] of [
  ["bad_json", "This request could not be submitted. Please try again."],
  ["forbidden", "This request could not be submitted. Please try again."],
  ["bad_gateway", "Something went wrong on our side."],
] as const) {
  test(`${mode} response shows a neutral message, no detail, and focuses the notice`, async ({ page, request }) => {
    await setMode(request, mode);
    await page.goto("/register");
    await fill(page);
    await page.getByRole("button", { name: "Create account" }).click();
    const notice = page.getByTestId("form-notice");
    await expect(notice).toContainText(text);
    await expect(notice).toBeFocused();
    await expect(page.locator("body")).not.toContainText(/Bad gateway|not json|Forbidden/);
    await expect(page.getByLabel("Full name")).toHaveValue("Ayesha Khan");
  });
}

for (const [mode, text] of [
  ["rate_20", "Too many attempts. Try again in 1 minute."],
  ["rate_90", "Too many attempts. Try again in 2 minutes."],
  ["rate_none", "Too many attempts. Try again later."],
  ["rate_abc", "Too many attempts. Try again later."],
] as const) {
  test(`429 with ${mode} shows "${text}"`, async ({ page, request }) => {
    await setMode(request, mode);
    await page.goto("/register");
    await fill(page);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByTestId("form-notice")).toHaveText(text);
    await expect(page.getByTestId("form-notice")).toBeFocused();
  });
}

test("success state offers a different email: name kept, email, password and phone cleared", async ({ page }) => {
  await page.goto("/register");
  await fill(page);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: "Use a different email address" }).click();
  await expect(page.getByLabel("Email address")).toBeFocused();
  await expect(page.getByLabel("Email address")).toHaveValue("");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Full name")).toHaveValue("Ayesha Khan");
  // The spec clears the phone on success, so it is not restored here.
  await expect(page.getByLabel("Phone number")).toHaveValue("");
});

test("password control toggles visibility with aria-pressed", async ({ page }) => {
  await page.goto("/register");
  const password = page.getByLabel("Password", { exact: true });
  const toggle = page.getByRole("button", { name: /password/i });
  await expect(password).toHaveAttribute("type", "password");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("keyboard: tab through the form and submit with Enter", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Full name").focus();
  await page.keyboard.type("Ayesha Khan");
  await page.keyboard.press("Tab");
  await page.keyboard.type("ayesha@example.com");
  await page.keyboard.press("Tab");
  await page.keyboard.type(CANARY_PASSWORD);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /password/i })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Phone number")).toBeFocused();
  await page.keyboard.type(CANARY_PHONE);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
});

test("privacy: nothing entered is stored or logged", async ({ page, context }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  page.on("pageerror", (error) => logs.push(error.message));
  await page.goto("/register");
  await fill(page);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
  const cookies = JSON.stringify(await context.cookies());
  for (const secret of [CANARY_PASSWORD, CANARY_PHONE, "ayesha@example.com", "Ayesha Khan"]) {
    expect(stored).not.toContain(secret);
    expect(cookies).not.toContain(secret);
    expect(logs.join("\n")).not.toContain(secret);
  }
  expect(page.url()).not.toContain(CANARY_PASSWORD);
});

const axeStates: Record<string, (page: Page, request: import("@playwright/test").APIRequestContext) => Promise<void>> = {
  initial: async () => {},
  "password revealed": async (page) => {
    await page.getByLabel("Password", { exact: true }).fill("x");
    await page.getByRole("button", { name: "Show password" }).click();
  },
  errors: async (page, request) => {
    await setMode(request, "fields");
    await fill(page);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator(".error-summary")).toBeFocused();
  },
  "rate limited": async (page, request) => {
    await setMode(request, "rate_limited");
    await fill(page);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByTestId("form-notice")).toBeVisible();
  },
  success: async (page, request) => {
    await setMode(request, "accepted");
    await fill(page);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  },
};

for (const viewport of viewports) {
  for (const [state, arrange] of Object.entries(axeStates)) {
    test(`axe: ${state} state at ${viewport.name} width has no violations`, async ({ page, request }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/register");
      await arrange(page, request);
      await expectNoViolations(page, state);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    });
  }
}
