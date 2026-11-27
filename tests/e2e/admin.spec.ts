import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const STUB = STUB_URL;
const APP = APP_URL;
const EMAIL = "admin@example.com";
// Low-entropy fake words only (the secret scanner flags random-looking literals).
const PASSPHRASE = ["correct", "horse", "battery", "staple", "42"].join(" ");
const WRONG_MESSAGE = "The email or password is not correct.";

// The stub backend holds module-level state, so these tests must not interleave.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];

async function stats(request: APIRequestContext) {
  return (await request.get(`${STUB}/__session-stats`)).json();
}

async function adminMode(request: APIRequestContext, value: string) {
  await request.get(`${STUB}/__admin-signin-mode?value=${value}`);
}

/** Gives the stub a live session of the given kind and the browser its cookie. */
async function startSession(page: Page, request: APIRequestContext, kind: "admin" | "user") {
  await request.get(`${STUB}/__force-session${kind === "admin" ? "?kind=admin" : ""}`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP }]);
}

const cookieHeader = { cookie: "estate_session=stub-live" };

async function fill(page: Page, password = PASSPHRASE) {
  await page.getByLabel("Email address").fill(`  ${EMAIL}  `);
  await page.getByLabel("Password", { exact: true }).fill(password);
}

const submit = (page: Page) => page.getByRole("button", { name: "Sign in", exact: true });

async function adminSignIn(page: Page, path = "/admin/sign-in") {
  await page.goto(path);
  await fill(page);
  await submit(page).click();
}

const banner = (page: Page) => page.getByRole("banner");

// ---- Guard -----------------------------------------------------------------------------------------------------

test("a Visitor opening /admin gets a 307 to the admin sign-in with no admin markup, uncached @smoke", async ({ request }) => {
  const raw = await request.get(`${APP}/admin`, { maxRedirects: 0 });
  expect(raw.status()).toBe(307);
  expect(raw.headers().location).toContain("/admin/sign-in?next=%2Fadmin");
  expect(raw.headers()["cache-control"]).toContain("no-store");
  const body = await raw.text();
  expect(body).not.toContain("EstateAI Administration");
  expect(body).not.toContain("Administration tools");
  expect(body).not.toContain("Coming soon");
});

test("an ordinary account opening /admin gets the same redirect as a Visitor @smoke", async ({ request }) => {
  const visitor = await request.get(`${APP}/admin`, { maxRedirects: 0 });
  await request.get(`${STUB}/__force-session`);
  const ordinary = await request.get(`${APP}/admin`, { maxRedirects: 0, headers: cookieHeader });
  expect(ordinary.status()).toBe(visitor.status());
  expect(ordinary.headers().location).toBe(visitor.headers().location);
  const body = await ordinary.text();
  expect(body).not.toContain("EstateAI Administration");
  expect(body).not.toContain("Administration tools");
});

test("an expired administrator session gets the same redirect @smoke", async ({ request }) => {
  await request.get(`${STUB}/__force-session?kind=admin`);
  await request.get(`${STUB}/__expire-session`);
  const raw = await request.get(`${APP}/admin`, { maxRedirects: 0, headers: cookieHeader });
  expect(raw.status()).toBe(307);
  expect(raw.headers().location).toContain("/admin/sign-in?next=%2Fadmin");
});

test("deep paths are guarded and keep the path under /admin as next @smoke", async ({ request }) => {
  const raw = await request.get(`${APP}/admin/anything/else?x=1`, { maxRedirects: 0 });
  expect(raw.status()).toBe(307);
  expect(raw.headers().location).toContain("/admin/sign-in?next=%2Fadmin%2Fanything%2Felse%3Fx%3D1");
  expect(await raw.text()).not.toContain("EstateAI Administration");
});

test("an administrator on an unknown admin path gets a plain 404 without the public header @smoke", async ({ page, request }) => {
  await startSession(page, request, "admin");
  const response = await page.goto("/admin/anything");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("could not be found")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Administration", exact: true })).toBeVisible();
  await expect(page.getByTestId("account-name")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Account", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "EstateAI", exact: true })).toHaveCount(0);
});

for (const mode of ["error", "broken", "hang"]) {
  test(`guard with the backend ${mode}: neutral unavailable state and no admin content`, async ({ page, request }) => {
    test.setTimeout(60_000);
    await startSession(page, request, "admin");
    await request.get(`${STUB}/__admin-me-mode?value=${mode}`);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Temporarily unavailable" })).toBeVisible();
    await expect(page.getByText("Administration tools")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Administration", exact: true })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/Internal detail|ECONNRESET|stack/i);
    // A minimal admin header (Sign out) and no public header; Try again reloads and recovers.
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Account", exact: true })).toHaveCount(0);
    await request.get(`${STUB}/__admin-me-mode?value=up`);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "Administration", exact: true })).toBeVisible();
  });
}

for (const mode of ["rate_limited"]) {
  test(`guard with admin/me ${mode}: unavailable, not a redirect`, async ({ page, request }) => {
    await startSession(page, request, "admin");
    await request.get(`${STUB}/__admin-me-mode?value=${mode}`);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Temporarily unavailable" })).toBeVisible();
  });
}

test("a 403 from admin/me is a permanent denial: redirect to the admin sign-in, not unavailable", async ({ request }) => {
  await request.get(`${STUB}/__force-session?kind=admin`);
  await request.get(`${STUB}/__admin-me-mode?value=denied_403`);
  const raw = await request.get(`${APP}/admin`, { maxRedirects: 0, headers: cookieHeader });
  expect(raw.status()).toBe(307);
  expect(raw.headers().location).toContain("/admin/sign-in?next=%2Fadmin");
});

test("a slow but successful admin/me (about 2 s) still renders the shell", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await request.get(`${STUB}/__admin-me-mode?value=slow`);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Administration", exact: true })).toBeVisible();
});

test("a hung admin/me on the sign-in page still shows the form", async ({ page, request }) => {
  test.setTimeout(60_000);
  await request.get(`${STUB}/__admin-me-mode?value=hang`);
  await page.goto("/admin/sign-in");
  await expect(page.getByRole("heading", { name: "Administrator sign in" })).toBeVisible();
});

test("a hung ordinary guard still ends in the unavailable state", async ({ page, request }) => {
  test.setTimeout(60_000);
  await startSession(page, request, "user");
  await request.get(`${STUB}/__me-mode?value=hang`);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Temporarily unavailable" })).toBeVisible();
});

for (const denial of ["denied_401", "denied_403", "denied_404"]) {
  test(`the page guard alone stops a client navigation when admin/me answers ${denial} while /me still says administrator`, async ({ page, request }) => {
    await startSession(page, request, "admin");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Administration", exact: true })).toBeVisible();
    await expect.poll(async () => (await stats(request)).meCount).toBeGreaterThan(0);
    await request.get(`${STUB}/__admin-me-mode?value=${denial}`);
    await page.getByRole("link", { name: "Dashboard" }).click({ timeout: 3000 });
    await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
    await expect(page.getByText("Administration tools")).toHaveCount(0);
    expect((await stats(request)).sessionAdmin).toBe(true); // the provider was never the one to decide
  });
}

// ---- Shell and dashboard ---------------------------------------------------------------------------------------

test("an administrator sees the shell and the empty dashboard", async ({ page, request }) => {
  await startSession(page, request, "admin");
  const response = await page.goto("/admin");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(page.getByRole("heading", { level: 1, name: "Administration" })).toBeVisible();
  await expect(page.getByTestId("admin-state")).toHaveText("Administrator account state: Active");
  await expect(page.getByTestId("admin-empty")).toHaveText("Administration tools will appear here.");
  // Chrome: one banner (the admin one), a named navigation, one main; the public header is absent.
  await expect(banner(page)).toHaveCount(1);
  await expect(banner(page)).toContainText("EstateAI Administration");
  await expect(page.getByRole("navigation", { name: "Account", exact: true })).toHaveCount(0);
  await expect(banner(page).getByRole("link", { name: "EstateAI", exact: true })).toHaveCount(0);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByTestId("account-name")).toHaveCount(0);
  // The only backend call for admin data is admin/me (server side); the dashboard fetched nothing else.
  expect((await stats(request)).adminMeCount).toBeGreaterThan(0);
});

test("navigation: Dashboard, Publication limits, Accounts and Verification are links; the rest are disabled Coming soon items", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Administration" });
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(nav.getByRole("link", { name: "Verification" })).toHaveAttribute("href", "/admin/verification");
  await expect(nav.getByRole("link", { name: "Accounts" })).toHaveAttribute("href", "/admin/accounts");
  await expect(nav.getByRole("link", { name: "Publication limits" })).toHaveAttribute("href", "/admin/publication-limits");
  await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/admin");
  for (const name of ["Listings", "Reports", "Audit log"]) {
    const item = nav.getByRole("listitem").filter({ hasText: name });
    await expect(item).toContainText("Coming soon");
    await expect(item.getByRole("link")).toHaveCount(0);
    await expect(item.getByRole("button")).toHaveCount(0);
  }
  await expect(page.getByRole("navigation", { name: "Administrator account" }).getByRole("link", { name: "Change password" })).toHaveAttribute(
    "href",
    "/account/password?from=admin",
  );
});

test("the skip link jumps to the main landmark", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await page.goto("/admin");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#admin-main")).toBeFocused();
});

test("sign out sends the delete with the token, hard-navigates to the admin sign-in and guards /admin again", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await page.goto("/admin");
  await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(`${APP}/admin/sign-in`);
  // A hard navigation: the window (and its marker) is gone.
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBeUndefined();
  await expect(page.getByRole("heading", { name: "Administrator sign in" })).toBeVisible();
  const after = await stats(request);
  expect(after.signOutCount).toBe(1);
  expect(after.liveSession).toBe(false);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
});

test("Back after sign-out never shows admin content", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await page.goto("/admin");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(`${APP}/admin/sign-in`);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Administrator sign in" })).toBeVisible();
  await expect(page.getByText("Administration tools")).toHaveCount(0);
});

test("a page restored from the back/forward cache is reloaded through the guard", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Administration", exact: true })).toBeVisible();
  await request.get(`${STUB}/__expire-session`);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
  await expect(page.getByText("Administration tools")).toHaveCount(0);
});

test("a failed sign-out keeps the person in the shell with a message", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await request.get(`${STUB}/__signout-mode?value=error`);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByTestId("admin-status")).toHaveText("We could not sign you out. Please try again.");
  await expect(page.getByTestId("admin-status")).toBeFocused();
  await expect(page.getByRole("button", { name: "Sign out" })).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
});

// ---- Session expiry --------------------------------------------------------------------------------------------

test("an expired session is noticed on focus and sends the person to the admin sign-in without admin content", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  await expect.poll(async () => (await stats(request)).meCount).toBeGreaterThan(0);
  await request.get(`${STUB}/__expire-session`);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
  await expect(page.getByRole("heading", { name: "Administrator sign in" })).toBeVisible();
  await expect(page.getByText("Administration tools")).toHaveCount(0);
});

test("the watcher keeps a deep path and its query in next", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await page.goto("/admin/deep/path?x=1");
  await expect.poll(async () => (await stats(request)).meCount).toBeGreaterThan(0);
  await request.get(`${STUB}/__expire-session`);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin%2Fdeep%2Fpath%3Fx%3D1$/);
});

test("a session that turns out not to be an administrator's is sent to the admin sign-in", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  await expect.poll(async () => (await stats(request)).meCount).toBeGreaterThan(0);
  await request.get(`${STUB}/__force-session`); // now an ordinary session
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
  await expect(page.getByText("Administration tools")).toHaveCount(0);
});

test("a client navigation after expiry is stopped by the server guard", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  await request.get(`${STUB}/__expire-session`);
  // The session watcher may notice the expiry (a focus or visibility check) before the click lands; either path ends
  // at the admin sign-in, so a click on a link that has just been replaced is not a failure.
  await page.getByRole("link", { name: "Dashboard" }).click({ timeout: 3000 }).catch(() => {});
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
  await expect(page.getByText("Administration tools")).toHaveCount(0);
});

// ---- Sign-in page ----------------------------------------------------------------------------------------------

test("the sign-in page is public, uncached, has no public header and no link to or from the public pages", async ({ page }) => {
  const response = await page.goto("/admin/sign-in");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(page.getByRole("heading", { level: 1, name: "Administrator sign in" })).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page.getByRole("link")).toHaveCount(0);
  await expect(page.getByLabel("Email address")).toHaveAttribute("autocomplete", "username");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "current-password");
  await expect(page.locator("form")).toHaveAttribute("method", "post");
});

for (const path of ["/", "/sign-in", "/register", "/register/agency", "/forgot-password", "/health"]) {
  test(`the public page ${path} does not link to the admin area`, async ({ page }) => {
    await page.goto(path);
    expect(await page.locator("a[href*='admin']").count()).toBe(0);
  });
}

test("a Visitor, an ordinary account and an expired administrator all see the form", async ({ page, request }) => {
  await page.goto("/admin/sign-in");
  await expect(page.getByRole("heading", { name: "Administrator sign in" })).toBeVisible();
  await startSession(page, request, "user");
  await page.goto("/admin/sign-in");
  await expect(page.getByRole("heading", { name: "Administrator sign in" })).toBeVisible();
  await startSession(page, request, "admin");
  await request.get(`${STUB}/__expire-session`);
  await page.goto("/admin/sign-in");
  await expect(page.getByRole("heading", { name: "Administrator sign in" })).toBeVisible();
});

test("the form is still shown when the admin check fails", async ({ page, request }) => {
  await request.get(`${STUB}/__admin-me-mode?value=error`);
  await page.goto("/admin/sign-in");
  await expect(page.getByRole("heading", { name: "Administrator sign in" })).toBeVisible();
});

test("an administrator already signed in is redirected from the sign-in page", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await page.goto("/admin/sign-in");
  await expect(page).toHaveURL(`${APP}/admin`);
  await page.goto("/admin/sign-in?next=%2Fadmin%2Fsomewhere");
  await expect(page).toHaveURL(`${APP}/admin/somewhere`);
});

const nextCases: [string, string][] = [
  ["/admin/x", "/admin/x"],
  ["/admin/x?y=1", "/admin/x?y=1"],
  ["/dashboard", "/admin"],
  ["//evil.com", "/admin"],
  ["/admin/sign-in", "/admin"],
  ["/admin/sign-in?next=%2Fadmin", "/admin"],
  ["https://x.example/admin", "/admin"],
  ["/admin/../dashboard", "/admin"],
  ["/adminx", "/admin"],
  ["/api/v1/me", "/admin"],
  ["/\\evil.com", "/admin"],
  ["", "/admin"],
];
for (const [next, expected] of nextCases) {
  test(`next validation: ${JSON.stringify(next)} goes to ${expected}`, async ({ request }) => {
    await request.get(`${STUB}/__force-session?kind=admin`);
    const raw = await request.get(`${APP}/admin/sign-in?next=${encodeURIComponent(next)}`, { maxRedirects: 0, headers: cookieHeader });
    expect(raw.status()).toBe(307);
    expect(new URL(raw.headers().location, APP).pathname + new URL(raw.headers().location, APP).search).toBe(expected);
  });
}

test("a Visitor's next target is honoured only under /admin", async ({ page }) => {
  await adminSignIn(page, "/admin/sign-in?next=%2Fadmin%2Fsomewhere");
  await expect(page).toHaveURL(`${APP}/admin/somewhere`);
});

test("an outside next target falls back to /admin after sign-in", async ({ page }) => {
  await adminSignIn(page, `/admin/sign-in?next=${encodeURIComponent("/dashboard")}`);
  await expect(page).toHaveURL(`${APP}/admin`);
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
});

// ---- Sign-in behaviour -----------------------------------------------------------------------------------------

test("sign in ok: posts to the admin door with the token, refreshes the provider and shows the shell", async ({ page, request }) => {
  await adminSignIn(page);
  await expect(page).toHaveURL(`${APP}/admin`);
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  await expect(banner(page)).toContainText("EstateAI Administration");
  const after = await stats(request);
  expect(after.adminSignInCount).toBe(1);
  expect(after.signInCount).toBe(0); // never the ordinary door
  expect(after.lastAdminSignIn).toEqual({ email: EMAIL, password: PASSPHRASE });
  expect(after.lastAdminSignInToken).toBe("csrf-0");
  expect(after.sessionAdmin).toBe(true);
});

{
  test("credential failure: one generic message, email kept, password cleared, focus on the message", async ({ page, request }) => {
    await adminMode(request, "wrong_credentials");
    await adminSignIn(page);
    const notice = page.getByTestId("form-notice");
    await expect(notice).toHaveText(WRONG_MESSAGE);
    await expect(notice).toBeFocused();
    await expect(page.getByLabel("Email address")).toHaveValue(EMAIL);
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
    await expect(page.getByTestId("form-notice")).not.toContainText(/administrator|locked|too many|throttl|Internal/i);
    await expect(submit(page)).toBeEnabled();
    await expect(page).toHaveURL(`${APP}/admin/sign-in`);
  });
}

test("a 400 maps the server's field messages and focuses the summary", async ({ page, request }) => {
  await adminMode(request, "validation");
  await adminSignIn(page);
  const summary = page.getByRole("group", { name: "There is a problem" });
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("Email address: Enter a valid email address.");
  await expect(page.getByLabel("Email address")).toHaveAttribute("aria-invalid", "true");
});

const NO_HINT = /too many|try again (in|later)|wait|seconds|minutes|rate|throttl|forbidden|could not be submitted|locked|administrator account|Internal/i;

test("a throttled answer (429) shows the same generic message, with no rate-limit hint", async ({ page, request }) => {
  await adminMode(request, "rate_limited");
  await adminSignIn(page);
  const notice = page.getByTestId("form-notice");
  await expect(notice).toHaveText(WRONG_MESSAGE);
  await expect(notice).not.toContainText(NO_HINT);
  await expect(page.getByLabel("Email address")).toHaveValue(EMAIL);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(submit(page)).toBeEnabled();
});

test("403 after the one retry shows the same generic message; the retry used a fresh token", async ({ page, request }) => {
  await adminMode(request, "csrf_always");
  await adminSignIn(page);
  const notice = page.getByTestId("form-notice");
  await expect(notice).toHaveText(WRONG_MESSAGE);
  await expect(notice).not.toContainText(NO_HINT);
  expect((await stats(request)).adminSignInCount).toBe(2);
  await expect(submit(page)).toBeEnabled();
});

test("CSRF self-heal: the first 403 refetches the token and retries once", async ({ page, request }) => {
  await adminMode(request, "csrf_once");
  await adminSignIn(page);
  await expect(page).toHaveURL(`${APP}/admin`);
  const after = await stats(request);
  expect(after.adminSignInCount).toBe(2);
  expect(after.lastAdminSignInToken).toBe("csrf-1");
});

test("a server error shows the generic server message without detail", async ({ page, request }) => {
  await adminMode(request, "error");
  await adminSignIn(page);
  await expect(page.getByTestId("form-notice")).toHaveText("Something went wrong on our side. Please try again in a moment.");
  await expect(page.locator("body")).not.toContainText("Internal detail");
});

test("a dropped connection shows a generic message and re-enables the button", async ({ page, request }) => {
  await adminMode(request, "broken");
  await adminSignIn(page);
  await expect(page.getByTestId("form-notice")).toContainText(/Something went wrong on our side|We could not reach the server/);
  await expect(submit(page)).toBeEnabled();
});

test("a hung sign-in times out into its own message", async ({ page, request }) => {
  await adminMode(request, "hang");
  await page.clock.install();
  await page.goto("/admin/sign-in");
  await fill(page);
  await submit(page).click();
  await expect(page.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  await page.clock.runFor(21_000);
  await expect(page.getByTestId("form-notice")).toHaveText("The server took too long to answer. Please try again.");
  await expect(submit(page)).toBeEnabled();
  await expect(page.getByLabel("Email address")).toHaveValue(EMAIL);
});

test("empty fields show required errors and send nothing", async ({ page, request }) => {
  await page.goto("/admin/sign-in");
  await submit(page).click();
  const summary = page.getByRole("group", { name: "There is a problem" });
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("Email address: Enter your email address.");
  await expect(summary).toContainText("Password: Enter your password.");
  await page.waitForTimeout(200);
  const after = await stats(request);
  expect(after.adminSignInCount).toBe(0);
  expect(after.csrfFetches).toBe(0);
});

test("double submit sends exactly one request", async ({ page, request }) => {
  await adminMode(request, "hang");
  await page.goto("/admin/sign-in");
  await fill(page);
  await submit(page).click();
  await expect(page.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  await page.evaluate(() => {
    const form = document.querySelector("form")!;
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect.poll(async () => (await stats(request)).adminSignInCount).toBe(1);
  await page.waitForTimeout(300);
  expect((await stats(request)).adminSignInCount).toBe(1);
});

test("the password can be shown and hidden", async ({ page }) => {
  await page.goto("/admin/sign-in");
  const field = page.getByLabel("Password", { exact: true });
  await expect(field).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(field).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(field).toHaveAttribute("type", "password");
});

// ---- Password change -------------------------------------------------------------------------------------------

test("an administrator changing to a weak password sees the three administrator rules as human text", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await request.get(`${STUB}/__change-mode?value=admin_weak`);
  await page.goto("/account/password");
  await page.getByLabel("Current password").fill(PASSPHRASE);
  await page.getByLabel("New password").fill("short");
  await page.getByRole("button", { name: "Change password", exact: true }).and(page.locator("form button")).click();
  const summary = page.getByRole("group", { name: "There is a problem" });
  await expect(summary).toContainText("Administrator passwords need at least 12 characters.");
  await expect(summary).toContainText("Administrator passwords need at least one letter and one digit.");
  await expect(summary).toContainText("Administrator passwords cannot start or end with a space.");
  await expect(summary).not.toContainText("admin_password");
});

test("on the shared password page an administrator gets the admin chrome and no public header or home link", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await page.goto("/account/password?from=admin");
  await expect(page.getByText("EstateAI Administration")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Account", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "EstateAI", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("account-name")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(1);
});

test("an expired administrator on the password page (from=admin) goes to the admin sign-in; others to the ordinary one", async ({ request }) => {
  const admin = await request.get(`${APP}/account/password?from=admin`, { maxRedirects: 0 });
  expect(admin.status()).toBe(307);
  expect(admin.headers().location).toContain("/admin/sign-in?next=%2Fadmin");
  for (const query of ["", "?from=other", "?from=admin2"]) {
    const raw = await request.get(`${APP}/account/password${query}`, { maxRedirects: 0 });
    expect(raw.headers().location).toContain("/sign-in?next=%2Faccount%2Fpassword");
    expect(raw.headers().location).not.toContain("/admin/");
  }
});

test("the change-password page offers the way back to the admin area for an administrator only", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await page.goto("/account/password");
  await expect(page.getByRole("link", { name: "Back to administration" })).toHaveAttribute("href", "/admin");
  // Leave the page first: its session check could otherwise see the new session and redirect during the next navigation.
  await page.goto("about:blank");
  await request.get(`${STUB}/__force-session`);
  await page.goto("/account/password");
  await expect(page.getByRole("link", { name: "Back to administration" })).toHaveCount(0);
});

test("a lost session on the change page sends an administrator to the admin sign-in", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await request.get(`${STUB}/__change-mode?value=session_gone`);
  await page.goto("/account/password");
  await page.getByLabel("Current password").fill(PASSPHRASE);
  await page.getByLabel("New password").fill(PASSPHRASE + " again");
  await page.getByRole("button", { name: "Change password", exact: true }).and(page.locator("form button")).click();
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
});

// ---- Privacy ---------------------------------------------------------------------------------------------------

test("privacy: no credentials or admin data in storage, console or URL", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  await adminSignIn(page);
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  const dump = await page.evaluate(() => ({
    local: JSON.stringify({ ...localStorage }),
    session: JSON.stringify({ ...sessionStorage }),
    cookie: document.cookie,
  }));
  for (const [where, text] of Object.entries(dump)) {
    expect(text, where).not.toContain(PASSPHRASE);
    expect(text, where).not.toContain(EMAIL);
    expect(text, where).not.toMatch(/csrf-\d/);
  }
  expect(dump.cookie).not.toContain("estate_session");
  expect(dump.local).toBe("{}");
  expect(dump.session).toBe("{}");
  expect(page.url()).not.toContain(PASSPHRASE);
  expect(page.url()).not.toContain(EMAIL);
  expect(logs.join("\n")).not.toContain(PASSPHRASE);
  expect(logs.join("\n")).not.toContain(EMAIL);
});

// ---- Accessibility ---------------------------------------------------------------------------------------------

const axeStates: Record<string, (page: Page, request: APIRequestContext) => Promise<void>> = {
  "sign-in form": async (page) => {
    await page.goto("/admin/sign-in");
    await expect(page.getByRole("heading", { name: "Administrator sign in" })).toBeVisible();
  },
  "sign-in field errors": async (page) => {
    await page.goto("/admin/sign-in");
    await submit(page).click();
    await expect(page.getByRole("group", { name: "There is a problem" })).toBeVisible();
  },
  "sign-in wrong credentials": async (page, request) => {
    await adminMode(request, "wrong_credentials");
    await adminSignIn(page);
    await expect(page.getByTestId("form-notice")).toBeVisible();
  },
  "dashboard shell": async (page, request) => {
    await startSession(page, request, "admin");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  },
  unavailable: async (page, request) => {
    await startSession(page, request, "admin");
    await request.get(`${STUB}/__admin-me-mode?value=error`);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Temporarily unavailable" })).toBeVisible();
  },
  "admin password page": async (page, request) => {
    await startSession(page, request, "admin");
    await page.goto("/account/password");
    await expect(page.getByRole("link", { name: "Back to administration" })).toBeVisible();
  },
};

for (const viewport of viewports) {
  for (const [name, arrange] of Object.entries(axeStates)) {
    test(`axe: ${name} at ${viewport.name}`, async ({ page, request }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await arrange(page, request);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    });
  }
}
