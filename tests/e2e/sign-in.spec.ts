import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL, APP_ORIGIN_RE } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const STUB = STUB_URL;
const EMAIL = "ayesha@example.com";
const CANARY_PASSWORD = "canary-Pass-91827";
const WRONG_MESSAGE = "The email or password is not correct.";

// The stub backend holds module-level state, so these tests must not interleave.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

async function mode(request: APIRequestContext, kind: "signin" | "me" | "signout", value: string) {
  await request.get(`${STUB}/__${kind}-mode?value=${value}`);
}

async function stats(request: APIRequestContext) {
  return (await request.get(`${STUB}/__session-stats`)).json();
}

async function fill(page: Page, password = CANARY_PASSWORD) {
  await page.getByLabel("Email address").fill(`  ${EMAIL}  `);
  await page.getByLabel("Password", { exact: true }).fill(password);
}

const submit = (page: Page) => page.getByRole("button", { name: "Sign in", exact: true }).and(page.locator("form button"));

async function signIn(page: Page, path = "/sign-in") {
  await page.goto(path);
  await fill(page);
  await submit(page).click();
}

const header = (page: Page) => page.getByRole("banner");

async function setCsrfMode(request: APIRequestContext, value: string) {
  await request.get(`${STUB}/__csrf-mode?value=${value}`);
}

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];

test("Visitor header offers Sign in and Create account, never sign out @smoke", async ({ page }) => {
  await page.goto("/");
  await expect(header(page).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  await expect(header(page).getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/register");
  await expect(header(page).getByRole("link", { name: "EstateAI" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
});

test("home, register success and sign-in link to each other @smoke", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("main").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByRole("main").getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test("page shows two labelled required fields with the right autocomplete @smoke", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  const names = await page.locator("form input").evaluateAll((els) => els.map((el) => (el as HTMLInputElement).name));
  expect(names).toEqual(["email", "password"]);
  await expect(page.getByLabel("Email address")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Email address")).toHaveAttribute("required", "");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("required", "");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
});

test("sign in ok: CSRF token sent, header and dashboard reflect the account, token refetched later @smoke", async ({ page, request }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("dashboard-name")).toHaveText("Ayesha Khan");
  await expect(page.getByTestId("dashboard-state")).toContainText("Active");
  await expect(header(page).getByTestId("account-name")).toHaveText("Ayesha Khan");
  await expect(header(page).getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(header(page).getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await expect(page.getByTestId("state-note")).toHaveCount(0);
  const s = await stats(request);
  expect(s.signInCount).toBe(1);
  expect(s.csrfFetches).toBe(1);
  expect(s.lastSignInToken).toBe("csrf-0");
  expect(s.lastSignIn).toEqual({ email: EMAIL, password: CANARY_PASSWORD }); // only the email is trimmed

  // Sign out afterwards uses the token fetched after sign-in (the backend rotated it), not the old one.
  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  const after = await stats(request);
  expect(after.csrfFetches).toBe(2);
  expect(after.lastSignOutToken).toBe("csrf-1");
});

test("session is restored on reload through me @smoke", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/");
  await expect(header(page).getByTestId("account-name")).toHaveText("Ayesha Khan");
});

test("a valid next target is honoured @smoke", async ({ page }) => {
  await signIn(page, "/sign-in?next=%2Faccount%2Fpassword");
  await expect(page).toHaveURL(/\/account\/password$/);
});

test("an ordinary account following next=/admin is sent to the admin sign-in", async ({ page }) => {
  await signIn(page, "/sign-in?next=%2Fadmin");
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
});

for (const bad of ["/api/v1/me", "/_next/x", "//evil.com", "https://evil.example/x", "/\\evil.com", "/" + "a".repeat(250), "/dash\tboard", "/da\nsh", "evil", ""]) {
  test(`an unsafe next target falls back to /dashboard: ${bad.slice(0, 20).replace(/\s/g, "?")}`, async ({ page }) => {
    await signIn(page, `/sign-in?next=${encodeURIComponent(bad)}`);
    await expect(page).toHaveURL(new RegExp(`${APP_ORIGIN_RE}/dashboard$`));
  });
}

test("signed-in visit to /sign-in?next=/account/password goes there", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/sign-in?next=%2Faccount%2Fpassword");
  await expect(page).toHaveURL(/\/account\/password$/);
});

test("empty submit shows required field errors and sends no request", async ({ page, request }) => {
  await page.goto("/sign-in");
  await submit(page).click();
  await expect(page.getByLabel("Email address")).toBeFocused();
  await expect(page.getByLabel("Email address")).toHaveAccessibleDescription(/Enter your email address/);
  await expect(page.getByLabel("Password", { exact: true })).toHaveAccessibleDescription(/Enter your password/);
  await expect(page.getByRole("group", { name: "There is a problem" })).toHaveCount(0);
  await expect(submit(page)).toBeEnabled();
  expect((await stats(request)).signInCount).toBe(0);
  expect((await stats(request)).csrfFetches).toBe(0);
});

test("show password button switches its label", async ({ page }) => {
  await page.goto("/sign-in");
  const button = page.getByRole("button", { name: "Show password" });
  await expect(button).not.toHaveAttribute("aria-pressed", /.*/);
  await button.click();
  await expect(page.getByRole("button", { name: "Hide password" })).toBeVisible();
});

test("a dropped sign-in request shows exactly the network message, not the server one", async ({ page }) => {
  await page.route("**/api/v1/session", (route) => route.abort());
  await signIn(page);
  await expect(page.getByTestId("form-notice")).toHaveText("We could not reach the server. Check your connection and try again.");
  await expect(submit(page)).toBeEnabled();
});

test("sign-in 429 shows the wait from Retry-After", async ({ page, request }) => {
  await mode(request, "signin", "rate_limited");
  await signIn(page);
  await expect(page.getByTestId("form-notice")).toHaveText("Too many attempts. Try again in 2 minutes.");
});

test("a failing CSRF fetch (5xx) shows the server message", async ({ page, request }) => {
  await setCsrfMode(request, "error");
  await signIn(page);
  await expect(page.getByTestId("form-notice")).toHaveText("Something went wrong on our side. Please try again in a moment.");
  expect((await stats(request)).signInCount).toBe(0);
});

test("a rate-limited CSRF fetch shows the wait message", async ({ page, request }) => {
  await setCsrfMode(request, "rate_limited");
  await signIn(page);
  await expect(page.getByTestId("form-notice")).toHaveText("Too many attempts. Try again in 2 minutes.");
});

test("an account without a name shows the email in the header and on the dashboard", async ({ page, request }) => {
  await mode(request, "signin", "no_name");
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(header(page).getByTestId("account-name")).toHaveText(EMAIL);
  await expect(page.getByTestId("dashboard-name")).toHaveText(EMAIL);
});

test("concurrent callers share one CSRF fetch", async ({ request }) => {
  // The helper is plain browser code: run it in Node with a window pointing at the stub backend.
  (globalThis as unknown as { window: unknown }).window = { location: { origin: STUB } };
  try {
    const { getCsrfToken, clearCsrfToken } = await import("../../src/lib/http/csrf");
    clearCsrfToken();
    const tokens = await Promise.all([getCsrfToken(), getCsrfToken(), getCsrfToken()]);
    expect(new Set(tokens).size).toBe(1);
    expect((await stats(request)).csrfFetches).toBe(1);
    await getCsrfToken(); // cached
    expect((await stats(request)).csrfFetches).toBe(1);
    clearCsrfToken();
    await getCsrfToken();
    expect((await stats(request)).csrfFetches).toBe(2);
  } finally {
    delete (globalThis as unknown as { window?: unknown }).window;
  }
});

test("bad credentials: one generic message, email kept, password cleared, focus on the message", async ({ page, request }) => {
  await mode(request, "signin", "wrong_credentials");
  await signIn(page);
  const notice = page.getByTestId("form-notice");
  await expect(notice).toHaveText(WRONG_MESSAGE);
  await expect(notice).toBeFocused();
  await expect(page.getByLabel("Email address")).toHaveValue(EMAIL);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.locator("body")).not.toContainText("no such account");
  await expect(submit(page)).toBeEnabled();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("server field errors show against their fields, with the first one focused", async ({ page, request }) => {
  await mode(request, "signin", "validation");
  await signIn(page);
  await expect(page.getByLabel("Email address")).toBeFocused();
  await expect(page.getByLabel("Email address")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Email address")).toHaveAccessibleDescription(/Enter a valid email address/);
  await expect(page.getByLabel("Password", { exact: true })).toHaveAccessibleDescription(/This field may not be blank/);
});

test("CSRF self-heal: a first 403 refetches the token and retries once", async ({ page, request }) => {
  await mode(request, "signin", "csrf_once");
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  const s = await stats(request);
  expect(s.signInCount).toBe(2);
  expect(s.csrfFetches).toBe(2);
});

test("a second 403 is a generic failure, not a loop", async ({ page, request }) => {
  await mode(request, "signin", "csrf_always");
  await signIn(page);
  await expect(page.getByTestId("form-notice")).toHaveText("This request could not be submitted. Please try again.");
  expect((await stats(request)).signInCount).toBe(2);
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("5xx shows the server message without detail", async ({ page, request }) => {
  await mode(request, "signin", "error");
  await signIn(page);
  await expect(page.getByTestId("form-notice")).toHaveText("Something went wrong on our side. Please try again in a moment.");
  await expect(page.locator("body")).not.toContainText("Internal detail");
});

test("a dropped connection shows the network message", async ({ page, request }) => {
  await mode(request, "signin", "broken");
  await signIn(page);
  await expect(page.getByTestId("form-notice")).toContainText(/Something went wrong on our side|We could not reach the server/);
  await expect(submit(page)).toBeEnabled();
});

test("a hung sign-in times out into its own message and re-enables the button", async ({ page, request }) => {
  await mode(request, "signin", "hang");
  await page.clock.install();
  await page.goto("/sign-in");
  await fill(page);
  await submit(page).click();
  await expect(page.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  await page.clock.runFor(21_000);
  await expect(page.getByTestId("form-notice")).toHaveText("The server took too long to answer. Please try again.");
  await expect(submit(page)).toBeEnabled();
  await expect(page.getByLabel("Email address")).toHaveValue(EMAIL);
});

test("double submit sends exactly one request", async ({ page, request }) => {
  await mode(request, "signin", "hang");
  await page.goto("/sign-in");
  await fill(page);
  await submit(page).click();
  await expect(page.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  await page.evaluate(() => {
    const form = document.querySelector("form")!;
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect.poll(async () => (await stats(request)).signInCount).toBe(1);
  await page.waitForTimeout(300);
  expect((await stats(request)).signInCount).toBe(1);
});

test("a signed-in visitor opening /sign-in is sent to the dashboard", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("guard: a Visitor opening /dashboard is redirected to sign in and returned afterwards", async ({ page, request }) => {
  const raw = await request.get(`${APP_URL}/dashboard`, { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(raw.status());
  expect(raw.headers().location).toContain("/sign-in?next=%2Fdashboard");
  expect(await raw.text()).not.toContain("Signed in as");

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard$/);
  await expect(page.getByTestId("dashboard-name")).toHaveCount(0);
  await fill(page);
  await submit(page).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("dashboard-name")).toBeVisible();
});

test("guard: ?next keeps the query string through the sign-in round trip", async ({ page }) => {
  await page.goto("/dashboard?x=1");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard%3Fx%3D1$/);
  await fill(page);
  await submit(page).click();
  await expect(page).toHaveURL(/\/dashboard\?x=1$/);
});

test("guard: a spoofed x-requested-path header never decides the target", async ({ request }) => {
  const raw = await request.get(`${APP_URL}/dashboard?x=1`, {
    headers: { "x-requested-path": "//evil.example" },
    maxRedirects: 0,
  });
  expect(raw.headers().location).toContain("next=%2Fdashboard%3Fx%3D1");
  expect(raw.headers().location).not.toContain("evil");
});

test("guard: the admin page is guarded on a direct visit and never leaks content", async ({ request }) => {
  const raw = await request.get(`${APP_URL}/admin`, { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(raw.status());
  expect(raw.headers().location).toContain("/admin/sign-in?next=%2Fadmin");
  expect(await raw.text()).not.toContain("Administration");
});

test("a Back after sign-out never shows protected content, and header and page agree", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(new RegExp(`${APP_ORIGIN_RE}/$`));
  await page.goBack();
  await expect(page.getByTestId("dashboard-name")).toHaveCount(0);
  await expect(header(page).getByTestId("account-name")).toHaveCount(0);
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("a session that ended elsewhere is noticed when the tab regains focus", async ({ page, request }) => {
  await signIn(page);
  await expect(header(page).getByTestId("account-name")).toBeVisible();
  await request.get(`${STUB}/__expire-session`);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(header(page).getByTestId("account-name")).toHaveCount(0);
});

test("register success links to sign-in", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Ayesha Khan");
  await page.getByLabel("Email address").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(CANARY_PASSWORD);
  await page.getByLabel("Phone number").fill("0300 5550142");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
});

test("guard: /admin sends a Visitor to the admin sign-in, not the ordinary one (see admin.spec.ts)", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
});

test("guard: signed-in responses are not cacheable", async ({ page }) => {
  await signIn(page);
  const response = await page.goto("/dashboard");
  expect(response?.headers()["cache-control"]).toContain("no-store");
});

test("guard backend down: neutral unavailable state, no protected content", async ({ page, request }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await mode(request, "me", "error");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Temporarily unavailable" })).toBeVisible();
  await expect(page.getByTestId("dashboard-name")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Ayesha");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("guard backend down for a Visitor: still no content and no redirect claim", async ({ page, request }) => {
  await mode(request, "me", "error");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Temporarily unavailable" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toHaveCount(0);
});

test("session check fails: neutral message with Retry, never a signed-out claim", async ({ page, request }) => {
  await mode(request, "me", "error");
  await page.goto("/");
  await expect(header(page).getByText("Could not check your session")).toBeVisible();
  await expect(header(page).getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await mode(request, "me", "up");
  await header(page).getByRole("button", { name: "Retry" }).click();
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(header(page).getByText("Could not check your session")).toHaveCount(0);
});

test("session check on a dropped connection is also the neutral state", async ({ page, request }) => {
  await mode(request, "me", "broken");
  await page.goto("/");
  await expect(header(page).getByText("Could not check your session")).toBeVisible();
});

test("session check that hangs times out into the neutral state; the header is a stable placeholder meanwhile", async ({ page, request }) => {
  await mode(request, "me", "hang");
  await page.clock.install();
  await page.goto("/");
  await expect(header(page).getByRole("navigation", { name: "Account" })).toHaveAttribute("aria-busy", "true");
  await expect(header(page).getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await page.clock.runFor(21_000);
  await expect(header(page).getByText("Could not check your session")).toBeVisible();
});

test("sign out: DELETE with the token, header returns to Visitor, /dashboard is guarded again", async ({ page, request }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(new RegExp(`${APP_ORIGIN_RE}/$`));
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  const s = await stats(request);
  expect(s.signOutCount).toBe(1);
  expect(s.liveSession).toBe(false);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard$/);
  // Signing in again works with the rotated token.
  await fill(page);
  await submit(page).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect((await stats(request)).signInCount).toBe(2);
});

test("sign out when the session is already gone (401) counts as signed out", async ({ page, request }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await mode(request, "signout", "gone");
  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(new RegExp(`${APP_ORIGIN_RE}/$`));
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("sign out failure: polite error, still signed in, can retry", async ({ page, request }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await mode(request, "signout", "error");
  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByTestId("header-status")).toHaveText("We could not sign you out. Please try again.");
  await expect(header(page).getByRole("button", { name: "Sign out" })).toBeEnabled();
  await expect(header(page).getByTestId("account-name")).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
  await mode(request, "signout", "ok");
  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
});

for (const failing of ["csrf_always", "broken", "error"]) {
  test(`sign out failure (${failing}): polite error, still signed in`, async ({ page, request }) => {
    await signIn(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await mode(request, "signout", failing);
    await header(page).getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByTestId("header-status")).toHaveText("We could not sign you out. Please try again.");
    await expect(header(page).getByTestId("account-name")).toBeVisible();
    await expect(header(page).getByRole("button", { name: "Sign out" })).toBeEnabled();
    if (failing === "csrf_always") expect((await stats(request)).signOutCount).toBe(2);
  });
}

test("a hung sign-out times out into the polite error and stays signed in", async ({ page, request }) => {
  await page.clock.install();
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await mode(request, "signout", "hang");
  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect.poll(async () => (await stats(request)).signOutCount).toBe(1);
  await page.clock.runFor(21_000);
  await expect(page.getByTestId("header-status")).toHaveText("We could not sign you out. Please try again.");
  await expect(header(page).getByTestId("account-name")).toBeVisible();
});

test("sign out self-heals a stale CSRF token once", async ({ page, request }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await mode(request, "signout", "csrf_once");
  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  expect((await stats(request)).signOutCount).toBe(2);
});

test("sign out double click sends one request", async ({ page, request }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await header(page).getByRole("button", { name: "Sign out" }).dblclick();
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  expect((await stats(request)).signOutCount).toBe(1);
});

test("unverified account: signed in with the Email not verified note", async ({ page, request }) => {
  await mode(request, "signin", "unverified");
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(header(page).getByTestId("state-note")).toHaveText("Email not verified");
  await expect(header(page).getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("suspended account: signed in with the Account restricted note", async ({ page, request }) => {
  await mode(request, "signin", "suspended");
  await signIn(page);
  await expect(header(page).getByTestId("state-note")).toHaveText("Account restricted");
});

test("privacy: no password, email or token in storage, console, URL or the page outside the header and form", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(header(page).getByTestId("account-name")).toBeVisible();
  const dump = await page.evaluate(() => ({
    local: JSON.stringify({ ...localStorage }),
    session: JSON.stringify({ ...sessionStorage }),
    cookie: document.cookie,
    html: document.documentElement.outerHTML,
  }));
  for (const [where, text] of Object.entries(dump)) {
    expect(text, where).not.toContain(CANARY_PASSWORD);
    expect(text, where).not.toContain(EMAIL);
    expect(text, where).not.toMatch(/csrf-\d/);
  }
  expect(dump.cookie).not.toContain("estate_session"); // HttpOnly: invisible to script
  expect(dump.local).toBe("{}");
  expect(dump.session).toBe("{}");
  expect(page.url()).not.toContain(CANARY_PASSWORD);
  expect(page.url()).not.toContain(EMAIL);
  expect(logs.join("\n")).not.toContain(CANARY_PASSWORD);
  expect(logs.join("\n")).not.toContain(EMAIL);
});

const axeStates: Record<string, (page: Page, request: APIRequestContext) => Promise<void>> = {
  initial: async () => {},
  "wrong credentials": async (page, request) => {
    await mode(request, "signin", "wrong_credentials");
    await fill(page);
    await submit(page).click();
    await expect(page.getByTestId("form-notice")).toBeVisible();
  },
  "field errors": async (page, request) => {
    await mode(request, "signin", "validation");
    await fill(page);
    await submit(page).click();
    await expect(page.locator("#email-error")).toBeVisible();
  },
  "server error": async (page, request) => {
    await mode(request, "signin", "error");
    await fill(page);
    await submit(page).click();
    await expect(page.getByTestId("form-notice")).toBeVisible();
  },
};

for (const viewport of viewports) {
  for (const [state, arrange] of Object.entries(axeStates)) {
    test(`axe: sign-in ${state} state at ${viewport.name} width has no violations`, async ({ page, request }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/sign-in");
      await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
      await arrange(page, request);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, state).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    });
  }

  test(`axe: signed-in header and dashboard at ${viewport.name} width have no violations`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await signIn(page);
    await expect(page.getByTestId("dashboard-name")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test(`axe: session-check error header at ${viewport.name} width has no violations`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mode(request, "me", "error");
    await page.goto("/sign-in");
    await expect(header(page).getByText("Could not check your session")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
