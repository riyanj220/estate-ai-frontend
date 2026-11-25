import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const STUB = STUB_URL;
const APP = APP_URL;
// Obviously fake passphrases, built from short words so no scanner mistakes them for keys.
const TOKEN = ["canary", "reset", "token", "one"].join("-");
const NEW_PASSWORD = ["correct", "horse", "battery", "staple"].join(" ");
const OLD_PASSWORD = ["old", "horse", "battery", "staple"].join(" ");
const EMAIL = "ayesha@example.com";
const LINK = `/reset-password?token=${TOKEN}`;
const THROTTLED = "Too many attempts. Try again in 2 minutes.";
const SERVER = "Something went wrong on our side. Please try again in a moment.";
const NETWORK = "We could not reach the server. Check your connection and try again.";
const TIMEOUT = "The server took too long to answer. Please try again.";
const REJECTED = "This request could not be submitted. Please try again.";
const MAYBE_CHANGED = " If this keeps failing, your password may already have changed; try signing in again.";
const SENT = "If that address has an account, we have sent a link. It works once and expires in 1 hour.";

// The stub backend holds module-level state, so these tests must not interleave.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

const setMode = (request: APIRequestContext, kind: "forgot" | "reset" | "change" | "signin" | "csrf", value: string) =>
  request.get(`${STUB}/__${kind}-mode?value=${value}`);
const last = async (request: APIRequestContext, kind: "forgot" | "reset" | "change") =>
  (await request.get(`${STUB}/__last-${kind}`)).json();
const stats = async (request: APIRequestContext) => (await request.get(`${STUB}/__session-stats`)).json();
const header = (page: Page) => page.getByRole("banner");
const summary = (page: Page) => page.getByRole("group", { name: "There is a problem" });
const notice = (page: Page) => page.getByTestId("form-notice");

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}

async function signIn(page: Page, next = "/dashboard") {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(OLD_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).and(page.locator("form button")).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace("/", "\\/")}$`));
}

// ---------------------------------------------------------------- links

test("sign-in links to the forgot-password page @smoke", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/sign-in");
});

test("signed-in header and dashboard link to Change password; a Visitor sees neither @smoke", async ({ page }) => {
  await page.goto("/");
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Change password" })).toHaveCount(0);
  await signIn(page);
  await expect(header(page).getByRole("link", { name: "Change password" })).toHaveAttribute("href", "/account/password");
  await expect(page.getByRole("main").getByRole("link", { name: "Change password" })).toHaveAttribute("href", "/account/password");
  await header(page).getByRole("link", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/account\/password$/);
});

// ---------------------------------------------------------------- forgot password

const sendButton = (page: Page) => page.getByRole("button", { name: /Send reset link|Sending/ });

test("forgot: any address gets the same neutral confirmation; the address is trimmed @smoke", async ({ page, request }) => {
  await page.goto("/forgot-password");
  await expect(page.getByRole("heading", { level: 1, name: "Forgot your password?" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveAttribute("autocomplete", "email");
  await page.getByLabel("Email address").fill(`  ${EMAIL}  `);
  await sendButton(page).click();
  await expect(page.getByTestId("form-sent")).toHaveText(SENT);
  await expect(page.getByTestId("form-sent")).toBeFocused();
  expect(await last(request, "forgot")).toEqual({ count: 1, body: { email: EMAIL } });
  await page.getByLabel("Email address").fill("nobody@example.org");
  await sendButton(page).click();
  await expect(page.getByTestId("form-sent")).toHaveText(SENT);
  await expect(page.locator("body")).not.toContainText(/not registered|no account|does not exist/i);
  expect((await last(request, "forgot")).count).toBe(2);
});

test("forgot: 429 shows the wait and the form stays usable @smoke", async ({ page, request }) => {
  await setMode(request, "forgot", "rate_limited");
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(EMAIL);
  await sendButton(page).click();
  await expect(notice(page)).toHaveText(THROTTLED);
  await expect(notice(page)).toBeFocused();
  await expect(sendButton(page)).toBeEnabled();
  await expect(page.getByTestId("form-sent")).toHaveCount(0);
});

test("forgot: a 400 shows the field error against the email field", async ({ page, request }) => {
  await setMode(request, "forgot", "field");
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("bad");
  await sendButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(summary(page).getByRole("link", { name: /Email address: Enter a valid email address/ })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Email address")).toHaveAccessibleDescription(/Enter a valid email address/);
});

test("forgot: 5xx, dropped connection and timeout each have their own message", async ({ page, request }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(EMAIL);
  await setMode(request, "forgot", "error");
  await sendButton(page).click();
  await expect(notice(page)).toHaveText(SERVER);
  await expect(page.locator("body")).not.toContainText("Internal detail");
  await page.route("**/api/v1/password-reset-requests", (route) => route.abort());
  await sendButton(page).click();
  await expect(notice(page)).toHaveText(NETWORK);
  await page.unroute("**/api/v1/password-reset-requests");
  await expect(sendButton(page)).toBeEnabled();
});

test("forgot: a hung request times out into its own message", async ({ page, request }) => {
  await setMode(request, "forgot", "hang");
  await page.clock.install();
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(EMAIL);
  await sendButton(page).click();
  await expect(page.getByRole("button", { name: "Sending…" })).toBeDisabled();
  await page.clock.runFor(21_000);
  await expect(notice(page)).toHaveText(TIMEOUT);
  await expect(page.getByLabel("Email address")).toHaveValue(EMAIL);
});

test("forgot: double submit sends exactly one request; empty sends none", async ({ page, request }) => {
  await page.goto("/forgot-password");
  await sendButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(summary(page).getByRole("link", { name: /Enter your email address/ })).toBeVisible();
  expect((await last(request, "forgot")).count).toBe(0);
  await setMode(request, "forgot", "hang");
  await page.getByLabel("Email address").fill(EMAIL);
  await sendButton(page).click();
  await expect(page.getByRole("button", { name: "Sending…" })).toBeDisabled();
  await page.evaluate(() => {
    const form = document.querySelector("form")!;
    form.requestSubmit();
    form.requestSubmit();
  });
  await page.waitForTimeout(300);
  expect((await last(request, "forgot")).count).toBe(1);
});

test("forgot: email codes from a 400 are mapped, raw server text never shown", async ({ page, request }) => {
  await setMode(request, "forgot", "codes");
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("bad");
  await sendButton(page).click();
  await expect(summary(page).getByRole("link", { name: "Email address: Enter a valid email address." })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Raw server text");
});

test("forgot privacy: no address in storage, console or URL", async ({ page }) => {
  const address = "privacy.check@example.org";
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(address);
  await sendButton(page).click();
  await expect(page.getByTestId("form-sent")).toBeVisible();
  const dump = await page.evaluate(() => ({
    local: JSON.stringify({ ...localStorage }),
    session: JSON.stringify({ ...sessionStorage }),
    cookie: document.cookie,
    url: location.href,
  }));
  for (const [where, text] of Object.entries(dump)) expect(text, where).not.toContain(address);
  expect(dump.local).toBe("{}");
  expect(dump.session).toBe("{}");
  expect(logs.join("\n")).not.toContain(address);
});

test("forgot: editing the address clears the confirmation", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(EMAIL);
  await sendButton(page).click();
  await expect(page.getByTestId("form-sent")).toBeVisible();
  await page.getByLabel("Email address").fill("other@example.org");
  await expect(page.getByTestId("form-sent")).toHaveCount(0);
});

// ---------------------------------------------------------------- reset password

const newPassword = (page: Page) => page.getByLabel("New password", { exact: true });
const changeButton = (page: Page) => page.getByRole("button", { name: /^(Change password|Saving…)$/ }).and(page.locator("form button"));

test("reset link: the token leaves the address bar, other parameters stay, nothing is sent yet", async ({ page, request }) => {
  await page.goto(`/reset-password?utm=a&token=${TOKEN}`);
  await expect(newPassword(page)).toBeVisible();
  expect(new URL(page.url()).search).toBe("?utm=a");
  expect(page.url()).not.toContain(TOKEN);
  expect((await last(request, "reset")).count).toBe(0);
  await expect(newPassword(page)).toHaveAttribute("autocomplete", "new-password");
  await expect(newPassword(page)).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(newPassword(page)).toHaveAttribute("type", "text");
});

for (const path of ["/reset-password", "/reset-password?token=", "/reset-password?token=%20%20"]) {
  test(`reset without a token (${path}) shows the missing state and sends nothing`, async ({ page, request }) => {
    await page.goto(path);
    const heading = page.getByRole("heading", { name: "This link is not valid" });
    await expect(heading).toBeFocused();
    await expect(page.getByText(/no reset code/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
    await expect(page.locator("form")).toHaveCount(0);
    expect((await last(request, "reset")).count).toBe(0);
  });
}

test("reset ok: the body is exactly token and password, success links to sign-in, header refreshed", async ({ page, request }) => {
  await page.goto(LINK);
  await newPassword(page).fill(NEW_PASSWORD);
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  await page.waitForTimeout(500); // let the page's own session checks settle before counting
  const before = (await stats(request)).meCount;
  await changeButton(page).click();
  const heading = page.getByRole("heading", { name: "Password changed" });
  await expect(heading).toBeFocused();
  await expect(page.getByText("Your password has been changed. Sign in with your new password.")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  expect(await last(request, "reset")).toEqual({ count: 1, body: { token: TOKEN, password: NEW_PASSWORD } });
  await expect(page.locator("form")).toHaveCount(0);
  await expect.poll(async () => (await stats(request)).meCount).toBeGreaterThan(before);
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
});

for (const [mode, title, text] of [
  ["expired", "This link has expired", /1 hour/],
  ["used", "This link was already used or replaced", /newest link/],
  ["invalid", "This link is not valid", /incomplete or mistyped/],
] as const) {
  test(`reset ${mode} link: own state, link to request a new one, form gone`, async ({ page, request }) => {
    await setMode(request, "reset", mode);
    await page.goto(LINK);
    await newPassword(page).fill(NEW_PASSWORD);
    await changeButton(page).click();
    await expect(page.getByRole("heading", { name: title })).toBeFocused();
    await expect(page.getByText(text)).toBeVisible();
    await expect(page.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
    await expect(page.locator("form")).toHaveCount(0);
    expect(page.url()).not.toContain(TOKEN);
  });
}

test("reset weak password: mapped message under the field; the same token then succeeds", async ({ page, request }) => {
  await setMode(request, "reset", "weak_once");
  await page.goto(LINK);
  await newPassword(page).fill("password");
  await changeButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(summary(page).getByRole("link", { name: /New password: This password is too common/ })).toBeVisible();
  await expect(newPassword(page)).toHaveAttribute("aria-invalid", "true");
  await expect(newPassword(page)).toHaveAccessibleDescription(/too common/);
  await expect(changeButton(page)).toBeEnabled();
  await newPassword(page).fill(NEW_PASSWORD);
  await changeButton(page).click();
  await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible();
  const seen = await last(request, "reset");
  expect(seen).toEqual({ count: 2, body: { token: TOKEN, password: NEW_PASSWORD } });
});

test("reset weak password codes map to text; the server's own static sentence passes through", async ({ page, request }) => {
  await setMode(request, "reset", "weak");
  await page.goto(LINK);
  await newPassword(page).fill("short");
  await changeButton(page).click();
  await expect(summary(page)).toContainText("Use at least 8 characters.");
  await setMode(request, "reset", "weak_messages");
  await changeButton(page).click();
  await expect.poll(async () => (await last(request, "reset")).count).toBe(2);
  await expect(summary(page)).toContainText("Pick something harder to guess.");
  await expect(summary(page)).not.toContainText("Use at least 8 characters.");
});

test("reset: an unknown field code and an unknown error code never show raw text", async ({ page, request }) => {
  await setMode(request, "reset", "weak_unknown");
  await page.goto(LINK);
  await newPassword(page).fill(NEW_PASSWORD);
  await changeButton(page).click();
  await expect(summary(page)).toContainText("New password: Enter a valid value.");
  await expect(page.locator("body")).not.toContainText("mystery_code");
  await setMode(request, "reset", "unknown_code");
  await changeButton(page).click();
  await expect.poll(async () => (await last(request, "reset")).count).toBe(2);
  await expect(notice(page)).toHaveText(REJECTED);
  await expect(page.locator("body")).not.toContainText("Raw server text");
  await expect(newPassword(page)).toBeVisible();
});

for (const mode of ["token_field", "no_fields"]) {
  test(`reset: a validation error without a password field (${mode}) ends as an invalid link`, async ({ page, request }) => {
    await setMode(request, "reset", mode);
    await page.goto(LINK);
    await newPassword(page).fill(NEW_PASSWORD);
    await changeButton(page).click();
    await expect(page.getByRole("heading", { name: "This link is not valid" })).toBeFocused();
    await expect(page.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
    await expect(page.locator("form")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Raw server text");
  });
}

test("reset empty password sends nothing", async ({ page, request }) => {
  await page.goto(LINK);
  await changeButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(summary(page).getByRole("link", { name: /New password: Enter a new password/ })).toBeVisible();
  expect((await last(request, "reset")).count).toBe(0);
});

for (const [mode, message] of [
  ["rate_limited", THROTTLED],
  ["error", SERVER],
  ["forbidden", REJECTED],
] as const) {
  test(`reset ${mode}: message, form and token kept, retry works`, async ({ page, request }) => {
    await setMode(request, "reset", mode);
    await page.goto(LINK);
    await newPassword(page).fill(NEW_PASSWORD);
    await changeButton(page).click();
    await expect(notice(page)).toHaveText(message);
    await expect(notice(page)).toBeFocused();
    await expect(page.locator("body")).not.toContainText("Internal detail");
    await expect(newPassword(page)).toHaveValue(NEW_PASSWORD);
    await setMode(request, "reset", "ok");
    await changeButton(page).click();
    await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible();
    expect((await last(request, "reset")).body.token).toBe(TOKEN);
  });
}

test("reset network failure and timeout keep the form", async ({ page, request }) => {
  await page.goto(LINK);
  await newPassword(page).fill(NEW_PASSWORD);
  await page.route("**/api/v1/password-resets/confirm", (route) => route.abort());
  await changeButton(page).click();
  await expect(notice(page)).toHaveText(NETWORK);
  await expect(newPassword(page)).toHaveValue(NEW_PASSWORD);
  await page.unroute("**/api/v1/password-resets/confirm");
  await setMode(request, "reset", "hang");
  await page.clock.install();
  await changeButton(page).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await page.clock.runFor(21_000);
  await expect(notice(page)).toHaveText(TIMEOUT);
  await expect(changeButton(page)).toBeEnabled();
});

test("reset double submit sends exactly one request", async ({ page, request }) => {
  await setMode(request, "reset", "hang");
  await page.goto(LINK);
  await newPassword(page).fill(NEW_PASSWORD);
  await changeButton(page).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await page.evaluate(() => {
    const form = document.querySelector("form")!;
    form.requestSubmit();
    form.requestSubmit();
  });
  await page.waitForTimeout(300);
  expect((await last(request, "reset")).count).toBe(1);
});

test("reset privacy: no token or password in storage, console, URL or page HTML; no-referrer and no-store", async ({ page, request }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  const response = await page.goto(LINK);
  // The dev server already sends no-store, so only the referrer policy proves our rule here; the config test above
  // asserts both, and the production check (README) covers prerendering.
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await newPassword(page).fill(NEW_PASSWORD);
  await changeButton(page).click();
  await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible();
  const dump = await page.evaluate(() => ({
    local: JSON.stringify({ ...localStorage }),
    session: JSON.stringify({ ...sessionStorage }),
    cookie: document.cookie,
    // Rendered markup only: the dev server embeds the requested URL in framework script payloads; the
    // production build is checked separately (README), where the page is prerendered and carries no token.
    html: [...document.body.querySelectorAll("script")].reduce((html, el) => html.replace(el.outerHTML, ""), document.body.outerHTML),
    url: location.href,
  }));
  for (const [where, text] of Object.entries(dump)) {
    expect(text, where).not.toContain(TOKEN);
    expect(text, where).not.toContain(NEW_PASSWORD);
  }
  expect(dump.local).toBe("{}");
  expect(dump.session).toBe("{}");
  expect(logs.join("\n")).not.toContain(TOKEN);
  expect(logs.join("\n")).not.toContain(NEW_PASSWORD);
  expect((await last(request, "reset")).count).toBe(1);
});

// ---------------------------------------------------------------- change password

const current = (page: Page) => page.getByLabel("Current password", { exact: true });
const next = (page: Page) => page.getByLabel("New password", { exact: true });
const changeSubmit = (page: Page) => page.getByRole("button", { name: /^(Change password|Changing…)$/ }).and(page.locator("form button"));

async function openChange(page: Page) {
  await signIn(page, "/account/password");
  await expect(page.getByRole("heading", { level: 1, name: "Change password" })).toBeVisible();
}

async function fillChange(page: Page, from = OLD_PASSWORD, to = NEW_PASSWORD) {
  await current(page).fill(from);
  await next(page).fill(to);
}

test("change guard: a Visitor is redirected to sign in with next and sees no content", async ({ page, request }) => {
  const raw = await request.get(`${APP}/account/password`, { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(raw.status());
  expect(raw.headers().location).toContain("/sign-in?next=%2Faccount%2Fpassword");
  expect(await raw.text()).not.toContain("Current password");
  await page.goto("/account/password");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fpassword$/);
  await expect(page.getByLabel("Current password")).toHaveCount(0);
});

test("change ok: CSRF token sent, success text, fields cleared, session kept", async ({ page, request }) => {
  await openChange(page);
  await expect(current(page)).toHaveAttribute("autocomplete", "current-password");
  await expect(next(page)).toHaveAttribute("autocomplete", "new-password");
  await page.getByRole("button", { name: "Show current password" }).click();
  await expect(current(page)).toHaveAttribute("type", "text");
  await fillChange(page);
  await expect(header(page).getByTestId("account-name")).toBeVisible();
  await page.waitForTimeout(500); // let the page's own session checks settle before counting
  const meBefore = (await stats(request)).meCount;
  await changeSubmit(page).click();
  const success = page.getByTestId("form-success");
  await expect(success).toHaveText("Your password was changed. Your other devices were signed out.");
  await expect(success).toBeFocused();
  await expect(current(page)).toHaveValue("");
  await expect(next(page)).toHaveValue("");
  await expect(current(page)).toHaveAttribute("type", "password");
  const seen = await last(request, "change");
  expect(seen.body).toEqual({ current_password: OLD_PASSWORD, new_password: NEW_PASSWORD });
  expect(seen.token).toMatch(/^csrf-\d$/);
  await expect.poll(async () => (await stats(request)).meCount).toBeGreaterThan(meBefore);
  await expect(header(page).getByTestId("account-name")).toHaveText("Ayesha Khan");
  expect(page.url()).not.toContain("sign-in");
});

test("change wrong current password: message on that field, focused summary", async ({ page, request }) => {
  await openChange(page);
  await setMode(request, "change", "wrong_current");
  await fillChange(page);
  await changeSubmit(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(summary(page).getByRole("link", { name: /Current password: The current password is not correct\./ })).toBeVisible();
  await expect(current(page)).toHaveAttribute("aria-invalid", "true");
  await expect(current(page)).toHaveAccessibleDescription("Error: The current password is not correct.");
  await summary(page).getByRole("link", { name: /^Current password/ }).click();
  await expect(current(page)).toBeFocused();
});

test("change policy errors: new-password codes and same-as-current map to text", async ({ page, request }) => {
  await openChange(page);
  await setMode(request, "change", "same");
  await fillChange(page, OLD_PASSWORD, OLD_PASSWORD);
  await changeSubmit(page).click();
  await expect(summary(page).getByRole("link", { name: /New password: Choose a password different from your current one\./ })).toBeVisible();
  await setMode(request, "change", "weak");
  await changeSubmit(page).click();
  await expect(next(page)).toHaveAccessibleDescription(/Use at least 8 characters\. This password is too common/);
  await setMode(request, "change", "server_messages");
  await changeSubmit(page).click();
  // The backend's own sentence is a known one: it reads as its code and the page shows its own text for it.
  await expect(summary(page)).toContainText("Current password: The current password is not correct.");
  await expect(summary(page)).toContainText("New password: Choose a password different from your current one.");
});

test("change CSRF self-heal: a first 403 refetches the token and retries once", async ({ page, request }) => {
  await openChange(page);
  await setMode(request, "change", "csrf_once");
  await fillChange(page);
  await changeSubmit(page).click();
  await expect(page.getByTestId("form-success")).toBeVisible();
  expect((await last(request, "change")).count).toBe(2);
});

test("change second 403 is a generic failure, not a loop", async ({ page, request }) => {
  await openChange(page);
  await setMode(request, "change", "csrf_always");
  await fillChange(page);
  await changeSubmit(page).click();
  await expect(notice(page)).toHaveText(REJECTED);
  expect((await last(request, "change")).count).toBe(2);
  await expect(current(page)).toHaveValue(OLD_PASSWORD);
});

test("change session gone (401): signed out, sent to sign-in with next", async ({ page, request }) => {
  await openChange(page);
  await setMode(request, "change", "session_gone");
  await fillChange(page);
  await changeSubmit(page).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fpassword$/);
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(header(page).getByTestId("account-name")).toHaveCount(0);
});

test("change failures: 5xx, dropped connection, timeout; fields kept", async ({ page, request }) => {
  await openChange(page);
  await fillChange(page);
  await setMode(request, "change", "error");
  await changeSubmit(page).click();
  await expect(notice(page)).toHaveText(SERVER);
  await expect(page.locator("body")).not.toContainText("Internal detail");
  await expect(next(page)).toHaveValue(NEW_PASSWORD);
  await page.route("**/api/v1/me/password", (route) => route.abort());
  await changeSubmit(page).click();
  await expect(notice(page)).toHaveText(NETWORK + MAYBE_CHANGED);
  await page.unroute("**/api/v1/me/password");
  await setMode(request, "change", "hang");
  await page.clock.install();
  await changeSubmit(page).click();
  await expect(page.getByRole("button", { name: "Changing…" })).toBeDisabled();
  await page.clock.runFor(21_000);
  await expect(notice(page)).toHaveText(TIMEOUT + MAYBE_CHANGED);
  await expect(changeSubmit(page)).toBeEnabled();
});

test("change: POST 429 shows the wait; an unknown field code is generic", async ({ page, request }) => {
  await openChange(page);
  await fillChange(page);
  await setMode(request, "change", "rate_limited");
  await changeSubmit(page).click();
  await expect(notice(page)).toHaveText(THROTTLED);
  await setMode(request, "change", "unknown_code");
  await changeSubmit(page).click();
  await expect(summary(page)).toContainText("New password: Enter a valid value.");
  await expect(page.locator("body")).not.toContainText("mystery_code");
});

for (const [csrf, message] of [
  ["rate_limited", THROTTLED],
  ["error", SERVER],
] as const) {
  test(`change: a failing CSRF fetch (${csrf}) shows its own message and sends nothing`, async ({ page, request }) => {
    await openChange(page);
    await fillChange(page);
    await setMode(request, "csrf", csrf);
    await changeSubmit(page).click();
    await expect(notice(page)).toHaveText(message);
    expect((await last(request, "change")).count).toBe(0);
    await expect(current(page)).toHaveValue(OLD_PASSWORD);
  });
}

test("change: editing a field clears the success message", async ({ page }) => {
  await openChange(page);
  await fillChange(page);
  await changeSubmit(page).click();
  await expect(page.getByTestId("form-success")).toBeVisible();
  await current(page).fill("x");
  await expect(page.getByTestId("form-success")).toHaveCount(0);
});

test("policy codes map to exact text for the new-password, reset and current-password maps", async () => {
  const { NEW_PASSWORD_MESSAGES, RESET_PASSWORD_MESSAGES, CURRENT_PASSWORD_MESSAGES, EMAIL_MESSAGES, mapFieldMessages } = await import(
    "../../src/lib/password-messages"
  );
  const policy: Record<string, string> = {
    required: "Enter a new password.",
    password_too_short: "Use at least 8 characters.",
    password_too_long: "Use at most 1024 characters.",
    password_matches_email: "The password must not be the same as your email address.",
    password_too_common: "This password is too common. Choose a less guessable one.",
    invalid: "Enter a valid password.",
  };
  for (const [code, text] of Object.entries(policy)) {
    expect(mapFieldMessages([code], NEW_PASSWORD_MESSAGES), `new ${code}`).toEqual([text]);
    expect(mapFieldMessages([code], RESET_PASSWORD_MESSAGES), `reset ${code}`).toEqual([text]);
  }
  expect(mapFieldMessages(["password_same_as_current"], NEW_PASSWORD_MESSAGES)).toEqual([
    "Choose a password different from your current one.",
  ]);
  const currentTexts: Record<string, string> = {
    required: "Enter your current password.",
    incorrect: "The current password is not correct.",
    invalid: "Enter your current password.",
  };
  for (const [code, text] of Object.entries(currentTexts)) expect(mapFieldMessages([code], CURRENT_PASSWORD_MESSAGES), code).toEqual([text]);
  // Policy codes are not meaningful for the current password: they fall back, never raw.
  expect(mapFieldMessages(["password_too_short"], CURRENT_PASSWORD_MESSAGES)).toEqual(["Enter a valid value."]);
  expect(mapFieldMessages(["required"], EMAIL_MESSAGES)).toEqual(["Enter your email address."]);
  expect(mapFieldMessages(["invalid"], EMAIL_MESSAGES)).toEqual(["Enter a valid email address."]);
  expect(mapFieldMessages(["mystery_code"], NEW_PASSWORD_MESSAGES)).toEqual(["Enter a valid value."]);
});

test("next.config headers: reset-password is no-referrer and no-store; account pages are no-store", async () => {
  const mod = await import("../../next.config");
  // Playwright's loader can wrap a default export once more.
  const config = (typeof mod.default.headers === "function" ? mod.default : (mod.default as unknown as typeof mod).default);
  const rules = await config.headers!();
  const find = (source: string) => Object.fromEntries((rules.find((rule) => rule.source === source)?.headers ?? []).map((h) => [h.key, h.value]));
  expect(find("/reset-password")).toEqual({ "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" });
  expect(find("/account/:path*")).toEqual({ "Cache-Control": "no-store" });
});

test("change empty fields send nothing; double submit sends one request", async ({ page, request }) => {
  await openChange(page);
  await changeSubmit(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(summary(page).getByRole("link", { name: /Current password: Enter your current password/ })).toBeVisible();
  await expect(summary(page).getByRole("link", { name: /New password: Enter a new password/ })).toBeVisible();
  expect((await last(request, "change")).count).toBe(0);
  await setMode(request, "change", "hang");
  await fillChange(page);
  await changeSubmit(page).click();
  await expect(page.getByRole("button", { name: "Changing…" })).toBeDisabled();
  await page.evaluate(() => {
    const form = document.querySelector("form")!;
    form.requestSubmit();
    form.requestSubmit();
  });
  await page.waitForTimeout(300);
  expect((await last(request, "change")).count).toBe(1);
});

test("change privacy: no password in storage, console or URL after success", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  await openChange(page);
  await fillChange(page);
  await changeSubmit(page).click();
  await expect(page.getByTestId("form-success")).toBeVisible();
  const dump = await page.evaluate(() => ({
    local: JSON.stringify({ ...localStorage }),
    session: JSON.stringify({ ...sessionStorage }),
    html: document.documentElement.outerHTML,
    url: location.href,
  }));
  for (const [where, text] of Object.entries(dump)) {
    expect(text, where).not.toContain(NEW_PASSWORD);
    expect(text, where).not.toContain(OLD_PASSWORD);
  }
  expect(logs.join("\n")).not.toContain(NEW_PASSWORD);
  expect(logs.join("\n")).not.toContain(OLD_PASSWORD);
});

test("change page responses are not cacheable", async ({ page }) => {
  await openChange(page);
  const response = await page.goto("/account/password");
  expect(response?.headers()["cache-control"]).toContain("no-store");
});

// ---------------------------------------------------------------- accessibility

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];

for (const viewport of viewports) {
  const states: Record<string, (page: Page, request: APIRequestContext) => Promise<void>> = {
    "forgot initial": async (page) => {
      await page.goto("/forgot-password");
      await expect(sendButton(page)).toBeVisible();
    },
    "forgot confirmation": async (page) => {
      await page.goto("/forgot-password");
      await page.getByLabel("Email address").fill(EMAIL);
      await sendButton(page).click();
      await expect(page.getByTestId("form-sent")).toBeVisible();
    },
    "forgot field error": async (page, request) => {
      await setMode(request, "forgot", "field");
      await page.goto("/forgot-password");
      await page.getByLabel("Email address").fill("bad");
      await sendButton(page).click();
      await expect(summary(page)).toBeVisible();
    },
    "forgot throttled": async (page, request) => {
      await setMode(request, "forgot", "rate_limited");
      await page.goto("/forgot-password");
      await page.getByLabel("Email address").fill(EMAIL);
      await sendButton(page).click();
      await expect(notice(page)).toBeVisible();
    },
    "reset form": async (page) => {
      await page.goto(LINK);
      await expect(newPassword(page)).toBeVisible();
    },
    "reset weak password": async (page, request) => {
      await setMode(request, "reset", "weak");
      await page.goto(LINK);
      await newPassword(page).fill("short");
      await changeButton(page).click();
      await expect(summary(page)).toBeVisible();
    },
    "reset missing": async (page) => {
      await page.goto("/reset-password");
      await expect(page.getByRole("link", { name: "Request a new link" })).toBeVisible();
    },
    "reset expired": async (page, request) => {
      await setMode(request, "reset", "expired");
      await page.goto(LINK);
      await newPassword(page).fill(NEW_PASSWORD);
      await changeButton(page).click();
      await expect(page.getByRole("link", { name: "Request a new link" })).toBeVisible();
    },
    "reset success": async (page) => {
      await page.goto(LINK);
      await newPassword(page).fill(NEW_PASSWORD);
      await changeButton(page).click();
      await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible();
    },
    "change form": async (page) => {
      await openChange(page);
    },
    "change errors": async (page, request) => {
      await openChange(page);
      await setMode(request, "change", "wrong_current");
      await fillChange(page);
      await changeSubmit(page).click();
      await expect(summary(page)).toBeVisible();
    },
    "change success": async (page) => {
      await openChange(page);
      await fillChange(page);
      await changeSubmit(page).click();
      await expect(page.getByTestId("form-success")).toBeVisible();
    },
  };
  for (const [state, arrange] of Object.entries(states)) {
    test(`axe: ${state} at ${viewport.name} width has no violations`, async ({ page, request }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await arrange(page, request);
      await expectNoViolations(page, state);
    });
  }
}

test("Back and Forward never bring the token back: not in the URL, not in history.state", async ({ page }) => {
  await page.goto(LINK);
  await expect(page.getByRole("heading", { name: "Request a new link" })).toHaveCount(0);
  await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: /^(Change password|Saving…)$/ }).click();
  await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  expect(page.url()).not.toContain(TOKEN);
  await page.goBack();
  await expect(page).toHaveURL(/reset-password/);
  await page.waitForTimeout(400);
  expect(page.url()).not.toContain(TOKEN);
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain(TOKEN);
  await page.goForward();
  await page.goBack();
  await page.waitForTimeout(300);
  expect(page.url()).not.toContain(TOKEN);
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain(TOKEN);
});
