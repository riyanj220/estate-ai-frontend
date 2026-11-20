import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const STUB = "http://127.0.0.1:4010";
const TOKEN = "Tk9-AbCdEf_canaryTOKEN-Zq81xY";
const EMAIL = "Ayesha@Example.com";
const LINK = `/verify-email?token=${TOKEN}`;

// The stub backend holds module-level state, so these tests must not interleave.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

const confirmMode = (request: APIRequestContext, value: string) => request.get(`${STUB}/__confirm-mode?value=${value}`);
const resendMode = (request: APIRequestContext, value: string) => request.get(`${STUB}/__resend-mode?value=${value}`);
const lastConfirm = async (request: APIRequestContext) => (await request.get(`${STUB}/__last-confirm`)).json();
const lastResend = async (request: APIRequestContext) => (await request.get(`${STUB}/__last-resend`)).json();

const sendButton = (page: Page) => page.getByRole("button", { name: "Send a new link" });

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
}

test("valid link: token leaves the address bar, one confirm request, success state", async ({ page, request }) => {
  await page.goto(LINK);
  const heading = page.getByRole("heading", { name: "Email verified" });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.getByText(/account is ready/)).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  expect(page.url()).not.toContain(TOKEN);
  expect(page.url()).not.toContain("token");
  expect(await lastConfirm(request)).toEqual({ count: 1, body: { token: TOKEN } });
  await expect(page.getByRole("button", { name: "Send a new link" })).toHaveCount(0);
});

test("other query parameters survive the token removal", async ({ page }) => {
  await page.goto(`/verify-email?utm=a&token=${TOKEN}`);
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  expect(new URL(page.url()).search).toBe("?utm=a");
});

for (const [mode, title, text] of [
  ["expired", "This link has expired", /expire/],
  ["used", "This link was already used or replaced", /already verified/],
  ["invalid", "This link is not valid", /new link/],
  ["expired_status_unknown_code", "We could not confirm your email address", /Try again/],
  ["invalid_status_no_code", "We could not confirm your email address", /Try again/],
  ["unknown_code", "We could not confirm your email address", /Try again/],
] as const) {
  test(`confirm answer ${mode} shows its own state`, async ({ page, request }) => {
    await confirmMode(request, mode);
    await page.goto(LINK);
    const heading = page.getByRole("heading", { name: title });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.locator("main")).toContainText(text);
    if (mode.includes("unknown_code") || mode.includes("no_code")) await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    else await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
    expect(page.url()).not.toContain(TOKEN);
  });
}

test("distinct wording for expired, used and invalid", async ({ page, request }) => {
  const seen = new Set<string>();
  for (const mode of ["expired", "used", "invalid"]) {
    await request.get(`${STUB}/__reset`);
    await confirmMode(request, mode);
    await page.goto(LINK);
    await expect(page.locator("#result-title")).toBeFocused();
    seen.add((await page.locator("main section").first().innerText()).trim());
  }
  expect(seen.size).toBe(3);
});

test("missing token: no confirm request, invalid message and the form", async ({ page, request }) => {
  await page.goto("/verify-email");
  await expect(page.getByRole("heading", { name: "This link is not valid" })).toBeFocused();
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  expect((await lastConfirm(request)).count).toBe(0);
});

test("empty token value counts as missing", async ({ page, request }) => {
  await page.goto("/verify-email?token=");
  await expect(page.getByRole("heading", { name: "This link is not valid" })).toBeVisible();
  expect((await lastConfirm(request)).count).toBe(0);
});

for (const mode of ["error", "broken"]) {
  test(`server or network failure (${mode}) gives a retry state without detail`, async ({ page, request }) => {
    await confirmMode(request, mode);
    await page.goto(LINK);
    await expect(page.getByRole("heading", { name: "We could not confirm your email address" })).toBeFocused();
    await expect(page.locator("body")).not.toContainText(/Internal detail|ECONNRESET|stack/i);
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
}

test("Try again repeats the request with the token held in memory", async ({ page, request }) => {
  await confirmMode(request, "flaky");
  await page.goto(LINK);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  expect(page.url()).not.toContain(TOKEN);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  expect(await lastConfirm(request)).toEqual({ count: 2, body: { token: TOKEN } });
});

test("a hung confirm request times out into the retry state", async ({ page, request }) => {
  await confirmMode(request, "hang");
  await page.clock.install();
  await page.goto(LINK);
  await expect(page.getByRole("heading", { name: "Confirming your email address" })).toBeVisible();
  await page.clock.runFor(21_000);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("page load and re-renders send exactly one confirm request", async ({ page, request }) => {
  await page.goto(LINK);
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  await page.waitForTimeout(500);
  expect((await lastConfirm(request)).count).toBe(1);
});

test("token privacy: not in storage, console output, rendered text or the address bar", async ({ page, context }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  page.on("pageerror", (error) => logs.push(error.message));
  await page.goto(LINK);
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
  expect(stored).not.toContain(TOKEN);
  expect(JSON.stringify(await context.cookies())).not.toContain(TOKEN);
  expect(logs.join("\n")).not.toContain(TOKEN);
  expect(await page.locator("body").innerText()).not.toContain(TOKEN);
  expect(page.url()).not.toContain(TOKEN);
});

for (const mode of ["error", "broken", "expired"]) {
  test(`token privacy also holds in the ${mode} state`, async ({ page, request }) => {
    const logs: string[] = [];
    page.on("console", (message) => logs.push(message.text()));
    page.on("pageerror", (error) => logs.push(error.message));
    await confirmMode(request, mode);
    await page.goto(LINK);
    await expect(page.locator("#result-title")).not.toHaveText("Confirming your email address");
    expect(logs.join("\n")).not.toContain(TOKEN);
    // Dev-mode framework scripts echo the request URL; the rendered markup must not carry the token.
    const markup = await page.evaluate(() => {
      const copy = document.body.cloneNode(true) as HTMLElement;
      copy.querySelectorAll("script").forEach((node) => node.remove());
      return copy.innerHTML;
    });
    expect(markup).not.toContain(TOKEN);
    expect(await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))).not.toContain(TOKEN);
  });
}

test("the token is gone from the address bar while the request is still pending", async ({ page, request }) => {
  await confirmMode(request, "hang");
  await page.goto(LINK);
  await expect(page.getByRole("heading", { name: "Confirming your email address" })).toBeVisible();
  await expect(page).not.toHaveURL(new RegExp(TOKEN));
  const entries = await page.evaluate(() => history.length);
  await page.goBack().catch(() => undefined);
  expect(page.url()).not.toContain(TOKEN);
  expect(entries).toBeGreaterThan(0);
});

test("the page sends no referrer and is not cacheable", async ({ request }) => {
  const response = await request.get(LINK);
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response.headers()["cache-control"]).toBe("no-store");
});

test("resend success shows the generic confirmation and sends the trimmed email", async ({ page, request }) => {
  await confirmMode(request, "expired");
  await page.goto(LINK);
  await page.getByLabel("Email address", { exact: true }).fill(`  ${EMAIL}  `);
  await sendButton(page).click();
  const sent = page.getByTestId("form-sent");
  await expect(sent).toHaveText(
    "If that address needs verification, we have sent a new link. Check your inbox and spam folder.",
  );
  await expect(sent).toBeFocused();
  expect(await lastResend(request)).toEqual({ count: 1, body: { email: EMAIL } });
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(EMAIL);
});

for (const [mode, text] of [
  ["rate_20", "Too many attempts. Try again in 1 minute."],
  ["rate_90", "Too many attempts. Try again in 2 minutes."],
  ["rate_none", "Too many attempts. Try again later."],
  ["rate_abc", "Too many attempts. Try again later."],
] as const) {
  test(`resend limited (${mode}) shows the wait and keeps the value`, async ({ page, request }) => {
    await confirmMode(request, "used");
    await resendMode(request, mode);
    await page.goto(LINK);
    await page.getByLabel("Email address", { exact: true }).fill(EMAIL);
    await sendButton(page).click();
    await expect(page.getByTestId("form-notice")).toHaveText(text);
    await expect(page.getByTestId("form-notice")).toBeFocused();
    await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(EMAIL);
    await expect(sendButton(page)).toBeEnabled();
  });
}

test("resend field error shows under the input and in the focused summary", async ({ page, request }) => {
  await resendMode(request, "field");
  await page.goto("/verify-email");
  await page.getByLabel("Email address", { exact: true }).fill("nope");
  await sendButton(page).click();
  const summary = page.locator(".error-summary");
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("Enter a valid email address.");
  await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#email")).toHaveAttribute("aria-describedby", "email-error");
  await expect(page.locator("#email-error")).toContainText("Enter a valid email address.");
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue("nope");
  await summary.getByRole("link").click();
  await expect(page.locator("#email")).toBeFocused();
});

test("the resend form is a labelled email field with the right attributes", async ({ page }) => {
  await page.goto("/verify-email");
  const input = page.getByLabel("Email address", { exact: true });
  await expect(input).toHaveAttribute("type", "email");
  await expect(input).toHaveAttribute("autocomplete", "email");
  await expect(page.locator("form")).toHaveAttribute("novalidate", "");
});

for (const mode of ["error", "broken"]) {
  test(`resend failure (${mode}) shows a generic retry message and keeps the value`, async ({ page, request }) => {
    await resendMode(request, mode);
    await page.goto("/verify-email");
    await page.getByLabel("Email address", { exact: true }).fill(EMAIL);
    await sendButton(page).click();
    await expect(page.getByTestId("form-notice")).toContainText("try again", { ignoreCase: true });
    await expect(page.locator("body")).not.toContainText(/Internal detail|ECONNRESET/i);
    await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(EMAIL);
    await expect(sendButton(page)).toBeEnabled();
  });
}

test("a hung resend times out and re-enables the button", async ({ page, request }) => {
  await resendMode(request, "hang");
  await page.clock.install();
  await page.goto("/verify-email");
  await page.getByLabel("Email address", { exact: true }).fill(EMAIL);
  await sendButton(page).click();
  await expect(page.getByRole("button", { name: "Sending…" })).toBeDisabled();
  await page.clock.runFor(21_000);
  await expect(page.getByTestId("form-notice")).toContainText("could not reach the server");
  await expect(sendButton(page)).toBeEnabled();
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(EMAIL);
});

test("pending resend disables the button, announces it and does not double submit", async ({ page, request }) => {
  await resendMode(request, "hang");
  await page.goto("/verify-email");
  await page.getByLabel("Email address", { exact: true }).fill(EMAIL);
  await sendButton(page).click();
  await expect(page.getByRole("button", { name: "Sending…" })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Sending a new link." })).toBeAttached();
  await page.evaluate(() => {
    const form = document.querySelector("form")!;
    form.requestSubmit();
    form.requestSubmit();
  });
  await page.waitForTimeout(300);
  expect((await lastResend(request)).count).toBe(1);
});

test("pending confirm state is announced politely", async ({ page, request }) => {
  await confirmMode(request, "hang");
  await page.goto(LINK);
  await expect(page.getByRole("heading", { name: "Confirming your email address" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveAttribute("aria-live", "polite");
});

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];

const axeStates: Record<string, (page: Page, request: APIRequestContext) => Promise<void>> = {
  pending: async (page, request) => {
    await confirmMode(request, "hang");
    await page.goto(LINK);
    await expect(page.getByRole("heading", { name: "Confirming your email address" })).toBeVisible();
  },
  success: async (page) => {
    await page.goto(LINK);
    await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  },
  expired: async (page, request) => {
    await confirmMode(request, "expired");
    await page.goto(LINK);
    await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
  },
  used: async (page, request) => {
    await confirmMode(request, "used");
    await page.goto(LINK);
    await expect(page.getByRole("heading", { name: /already used/ })).toBeVisible();
  },
  invalid: async (page, request) => {
    await confirmMode(request, "invalid");
    await page.goto(LINK);
    await expect(page.getByRole("heading", { name: "This link is not valid" })).toBeVisible();
  },
  missing: async (page) => {
    await page.goto("/verify-email");
    await expect(page.getByRole("heading", { name: "This link is not valid" })).toBeVisible();
  },
  "retry": async (page, request) => {
    await confirmMode(request, "error");
    await page.goto(LINK);
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  },
  "resend sent": async (page) => {
    await page.goto("/verify-email");
    await page.getByLabel("Email address", { exact: true }).fill(EMAIL);
    await sendButton(page).click();
    await expect(page.getByTestId("form-sent")).toBeVisible();
  },
  "resend limited": async (page, request) => {
    await resendMode(request, "rate_90");
    await page.goto("/verify-email");
    await page.getByLabel("Email address", { exact: true }).fill(EMAIL);
    await sendButton(page).click();
    await expect(page.getByTestId("form-notice")).toBeVisible();
  },
  "resend field error": async (page, request) => {
    await resendMode(request, "field");
    await page.goto("/verify-email");
    await page.getByLabel("Email address", { exact: true }).fill("nope");
    await sendButton(page).click();
    await expect(page.locator(".error-summary")).toBeVisible();
  },
  "resend failure": async (page, request) => {
    await resendMode(request, "error");
    await page.goto("/verify-email");
    await page.getByLabel("Email address", { exact: true }).fill(EMAIL);
    await sendButton(page).click();
    await expect(page.getByTestId("form-notice")).toBeVisible();
  },
};

for (const viewport of viewports) {
  for (const [state, arrange] of Object.entries(axeStates)) {
    test(`axe: ${state} state at ${viewport.name} width has no violations`, async ({ page, request }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await arrange(page, request);
      await expectNoViolations(page, `${state} (${viewport.name})`);
    });
  }
}

test("Back and Forward never bring the token back: not in the URL, not in history.state", async ({ page }) => {
  await page.goto(LINK);
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  expect(page.url()).not.toContain(TOKEN);
  await page.goBack();
  await expect(page).toHaveURL(/verify-email/);
  await page.waitForTimeout(400);
  expect(page.url()).not.toContain(TOKEN);
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain(TOKEN);
  await page.goForward();
  await page.goBack();
  await page.waitForTimeout(300);
  expect(page.url()).not.toContain(TOKEN);
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain(TOKEN);
});
