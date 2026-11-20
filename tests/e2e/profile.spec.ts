import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const STUB = "http://127.0.0.1:4010";
const APP = "http://127.0.0.1:3100";
// Obviously fake values, built from short words and repetitive digits so no scanner mistakes them for keys.
const PASSWORD = ["correct", "horse", "battery", "staple"].join(" ");
const TOKEN = ["canary", "email", "change", "token"].join("-");
const EMAIL = "ayesha@example.com";
const NEW_EMAIL = "ayesha.new@example.com";
const TAKEN_EMAIL = "taken@example.com";
const PHONE = "+923001234567";
const NEW_PHONE = "+923111111111";
const NAME = "Ayesha Khan";
const NEW_NAME = "Ayesha Raza";
const PROFILE = "/account/profile";
const CONFIRM = `/confirm-email-change?token=${TOKEN}`;
const THROTTLED = "Too many attempts. Try again in 2 minutes.";
const SERVER = "Something went wrong on our side. Please try again in a moment.";
const NETWORK = "We could not reach the server. Check your connection and try again.";
const TIMEOUT = "The server took too long to answer. Please try again.";
const REJECTED = "This request could not be submitted. Please try again.";
const SAVED = "Your profile was saved.";
const SENT =
  "If that address can be used, we have sent it a confirmation link. Your sign-in address does not change until you open it.";
const pendingNote = (address: string) =>
  `We received a request to change to ${address}. If that address can be used, we sent it a confirmation link. Your sign-in address stays ${EMAIL} until you open the link.`;
const GENERIC = "Enter a valid value.";
const CHANGED = "Your sign-in email address was changed. Use the new address to sign in next time.";

// The stub backend holds module-level state, so these tests must not interleave.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

type Kind = "profile" | "profile-patch" | "email-change" | "email-confirm" | "signin" | "csrf" | "me";
const setMode = (request: APIRequestContext, kind: Kind, value: string) => request.get(`${STUB}/__${kind}-mode?value=${value}`);
const last = async (request: APIRequestContext, kind: "profile" | "profile-patch" | "email-change" | "email-confirm") =>
  (await request.get(`${STUB}/__last-${kind}`)).json();
const stats = async (request: APIRequestContext) => (await request.get(`${STUB}/__session-stats`)).json();
const header = (page: Page) => page.getByRole("banner");
const details = (page: Page) => page.getByRole("region", { name: "Your details" });
const emailSection = (page: Page) => page.getByRole("region", { name: "Sign-in email address" });
const summary = (section: ReturnType<typeof details>) => section.getByRole("group", { name: "There is a problem" });
const fullName = (page: Page) => page.getByLabel("Full name", { exact: true });
const phone = (page: Page) => page.getByLabel("Phone number", { exact: true });
const newEmail = (page: Page) => page.getByLabel("New email address", { exact: true });
const password = (page: Page) => page.getByLabel("Current password", { exact: true });
const saveButton = (page: Page) => page.getByRole("button", { name: /^(Save changes|Saving…)$/ });
const requestButton = (page: Page) => page.getByRole("button", { name: /^(Change email address|Requesting…)$/ });
const confirmButton = (page: Page) => page.getByRole("button", { name: /^(Confirm the change|Confirming…)$/ });

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}

async function signIn(page: Page, next = "/dashboard") {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).and(page.locator("form button")).click();
  await expect(page).toHaveURL(new RegExp(`${next.replaceAll("/", "\\/")}$`));
}

async function openProfile(page: Page) {
  await signIn(page, PROFILE);
  await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
  await expect(fullName(page)).toBeVisible();
}

// ---------------------------------------------------------------- links and guard

test("header and dashboard link to Profile; a Visitor sees neither", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Profile", exact: true })).toHaveCount(0);
  await signIn(page);
  await expect(header(page).getByRole("link", { name: "Profile", exact: true })).toHaveAttribute("href", PROFILE);
  await expect(page.getByRole("main").getByRole("link", { name: "Profile", exact: true })).toHaveAttribute("href", PROFILE);
  await header(page).getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/profile$/);
});

test("guard: a Visitor is redirected to sign in with next and sees no content", async ({ page, request }) => {
  const raw = await request.get(`${APP}${PROFILE}`, { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(raw.status());
  expect(raw.headers().location).toContain("/sign-in?next=%2Faccount%2Fprofile");
  const body = await raw.text();
  expect(body).not.toContain("Phone number");
  expect(body).not.toContain(PHONE);
  await page.goto(PROFILE);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fprofile$/);
  await expect(page.getByLabel("Phone number")).toHaveCount(0);
});

test("the profile route is not cacheable", async ({ page }) => {
  await signIn(page);
  const response = await page.goto(PROFILE);
  expect(response?.headers()["cache-control"]).toContain("no-store");
});

// ---------------------------------------------------------------- load

test("load: form prefilled, current email shown, no pending note, phone only in the input", async ({ page, request }) => {
  await openProfile(page);
  await expect(fullName(page)).toHaveValue(NAME);
  await expect(fullName(page)).toHaveAttribute("autocomplete", "name");
  await expect(phone(page)).toHaveValue(PHONE);
  await expect(phone(page)).toHaveAttribute("autocomplete", "tel");
  await expect(page.getByTestId("current-email")).toHaveText(EMAIL);
  await expect(page.getByTestId("pending-email")).toHaveCount(0);
  await expect(newEmail(page)).toHaveAttribute("autocomplete", "off");
  await expect(password(page)).toHaveAttribute("autocomplete", "current-password");
  await expect(header(page)).not.toContainText(PHONE);
  const text = await page.locator("body").innerText();
  expect(text.split(PHONE).length - 1).toBe(0); // inputs hold it, no text node does
  expect((await last(request, "profile")).gets).toBe(1);
  await page.goto("/dashboard");
  await expect(page.locator("body")).not.toContainText(PHONE);
});

test("load: a pending address shows the plain note", async ({ page, request }) => {
  await openProfile(page);
  await newEmail(page).fill(NEW_EMAIL);
  await password(page).fill(PASSWORD);
  await requestButton(page).click();
  await expect(page.getByTestId("email-sent")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("pending-email")).toHaveText(
    pendingNote(NEW_EMAIL),
  );
  expect((await last(request, "email-change")).count).toBe(1);
});

test("load failure: a message with Retry, nothing editable, Retry loads the form", async ({ page, request }) => {
  await setMode(request, "profile", "flaky");
  await signIn(page, PROFILE);
  await expect(page.getByRole("heading", { name: "We could not load your profile" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Internal detail");
  await expect(fullName(page)).toHaveCount(0);
  await expect(newEmail(page)).toHaveCount(0);
  await page.getByRole("main").getByRole("button", { name: "Retry" }).click();
  await expect(fullName(page)).toHaveValue(NAME);
});

for (const mode of ["error", "broken", "malformed"]) {
  test(`load failure (${mode}) shows the retry state`, async ({ page, request }) => {
    await setMode(request, "profile", mode);
    await signIn(page, PROFILE);
    await expect(page.getByRole("main").getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(fullName(page)).toHaveCount(0);
  });
}

test("load failure: a hung request times out into the retry state", async ({ page, request }) => {
  await setMode(request, "profile", "hang");
  await signIn(page, "/dashboard");
  await page.clock.install();
  await page.goto(PROFILE);
  await expect(page.getByTestId("profile-loading")).toBeVisible();
  await page.clock.runFor(21_000);
  await expect(page.getByRole("main").getByRole("button", { name: "Retry" })).toBeVisible();
});

test("wrong account type: polite message and no form", async ({ page, request }) => {
  await setMode(request, "profile", "forbidden");
  await signIn(page, PROFILE);
  await expect(page.getByTestId("profile-forbidden")).toHaveText("Profile editing is available for individual accounts.");
  await expect(page.locator("form")).toHaveCount(0);
});

test("session gone on load: signed out and sent to sign in with next", async ({ page, request }) => {
  await signIn(page, "/dashboard");
  await setMode(request, "profile", "session_gone");
  await page.goto(PROFILE);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fprofile$/);
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
});

// ---------------------------------------------------------------- details form

test("save: only the changed field is sent, CSRF token sent, success, form and header refreshed", async ({ page, request }) => {
  await openProfile(page);
  await fullName(page).fill(`  ${NEW_NAME}  `);
  await saveButton(page).click();
  await expect(page.getByTestId("details-success")).toHaveText(SAVED);
  expect(await last(request, "profile-patch")).toMatchObject({ count: 1, body: { full_name: NEW_NAME } });
  expect((await last(request, "profile-patch")).token).toMatch(/^csrf-\d$/);
  await expect(fullName(page)).toHaveValue(NEW_NAME);
  await expect(header(page).getByTestId("account-name")).toHaveText(NEW_NAME);
  // The baseline moved: saving the same values again sends nothing.
  await saveButton(page).click();
  await expect(page.getByTestId("details-unchanged")).toHaveText("No changes to save.");
  expect((await last(request, "profile-patch")).count).toBe(1);
});

test("save: only the phone, then both", async ({ page, request }) => {
  await openProfile(page);
  await phone(page).fill(NEW_PHONE);
  await saveButton(page).click();
  await expect(page.getByTestId("details-success")).toBeVisible();
  expect((await last(request, "profile-patch")).body).toEqual({ phone: NEW_PHONE });
  await fullName(page).fill(NEW_NAME);
  await phone(page).fill(PHONE);
  await saveButton(page).click();
  await expect.poll(async () => (await last(request, "profile-patch")).count).toBe(2);
  expect((await last(request, "profile-patch")).body).toEqual({ full_name: NEW_NAME, phone: PHONE });
});

test("nothing changed: no request and a polite note", async ({ page, request }) => {
  await openProfile(page);
  await saveButton(page).click();
  await expect(page.getByTestId("details-unchanged")).toHaveText("No changes to save.");
  expect((await last(request, "profile-patch")).count).toBe(0);
  // Whitespace around an unchanged value is not a change either.
  await fullName(page).fill(`  ${NAME} `);
  await saveButton(page).click();
  expect((await last(request, "profile-patch")).count).toBe(0);
});

test("edit after save clears the success note", async ({ page }) => {
  await openProfile(page);
  await fullName(page).fill(NEW_NAME);
  await saveButton(page).click();
  await expect(page.getByTestId("details-success")).toBeVisible();
  await phone(page).fill(NEW_PHONE);
  await expect(page.getByTestId("details-success")).toHaveCount(0);
});

test("blank phone or name: client required error, summary focused, no request", async ({ page, request }) => {
  await openProfile(page);
  await phone(page).fill("   ");
  await saveButton(page).click();
  const box = summary(details(page));
  await expect(box).toBeFocused();
  await expect(box.getByRole("link", { name: /Phone number: Enter your phone number\./ })).toBeVisible();
  await expect(phone(page)).toHaveAttribute("aria-invalid", "true");
  await fullName(page).fill("");
  await saveButton(page).click();
  await expect(box.getByRole("link", { name: /Full name: Enter your full name\./ })).toBeVisible();
  expect((await last(request, "profile-patch")).count).toBe(0);
  await box.getByRole("link", { name: /^Phone number/ }).click();
  await expect(phone(page)).toBeFocused();
});

test("server field errors map to text against the fields; values are kept", async ({ page, request }) => {
  await openProfile(page);
  await setMode(request, "profile-patch", "fields");
  await fullName(page).fill("A1");
  await phone(page).fill("123");
  await saveButton(page).click();
  const box = summary(details(page));
  await expect(box).toBeFocused();
  await expect(box).toContainText("Full name: Enter your full name using letters only (2 to 80 characters).");
  await expect(box).toContainText("Phone number: Enter a valid Pakistani mobile or international number.");
  await expect(fullName(page)).toHaveAccessibleDescription(/letters only/);
  await expect(fullName(page)).toHaveValue("A1");
  await expect(phone(page)).toHaveValue("123");
  await expect(page.locator("body")).not.toContainText("invalid_name");
  await setMode(request, "profile-patch", "required");
  await saveButton(page).click();
  await expect(box).toContainText("Full name: Enter your full name.");
  await expect(box).toContainText("Phone number: Enter your phone number.");
});

test("server sentences and unknown keys are never shown; unknown codes and prototype keys are generic; form-level codes are mapped", async ({ page, request }) => {
  await openProfile(page);
  await fullName(page).fill(NEW_NAME);
  await setMode(request, "profile-patch", "sentences");
  await saveButton(page).click();
  const box = summary(details(page));
  await expect(box).toContainText(`Full name: ${GENERIC}`);
  await expect(box).toContainText(`Phone number: ${GENERIC}`);
  await expect(box).toContainText(REJECTED); // the unknown key
  await expect(page.locator("body")).not.toContainText("Enter a valid name.");
  await expect(page.locator("body")).not.toContainText("Some server sentence.");
  await expect(page.locator("body")).not.toContainText("mystery_code");
  await setMode(request, "profile-patch", "proto");
  await saveButton(page).click();
  await expect(box).toContainText(`Full name: ${GENERIC}`);
  await expect(box).toContainText(`Phone number: ${GENERIC}`);
  await expect(page.locator("body")).not.toContainText(/constructor|__proto__|toString|\[object|function/);
  await setMode(request, "profile-patch", "non_field");
  await saveButton(page).click();
  await expect(box).toContainText("The form sent something unexpected. Reload the page and try again.");
  await expect(page.locator("body")).not.toContainText("unknown_field");
  await setMode(request, "profile-patch", "empty_fields");
  await saveButton(page).click();
  await expect(box).toContainText(REJECTED);
});

test("save failures: 429, 5xx, network, second 403 each have their own message and keep the values", async ({ page, request }) => {
  await openProfile(page);
  await fullName(page).fill(NEW_NAME);
  const notice = page.getByTestId("details-notice");
  await setMode(request, "profile-patch", "rate_limited");
  await saveButton(page).click();
  await expect(notice).toHaveText(THROTTLED);
  await expect(notice).toBeFocused();
  await setMode(request, "profile-patch", "error");
  await saveButton(page).click();
  await expect(notice).toHaveText(SERVER);
  await expect(page.locator("body")).not.toContainText("Internal detail");
  await setMode(request, "profile-patch", "csrf_always");
  await saveButton(page).click();
  await expect(notice).toHaveText(REJECTED);
  await setMode(request, "profile-patch", "ok");
  await page.route("**/api/v1/me/profile", (route) => (route.request().method() === "PATCH" ? route.abort() : route.continue()));
  await saveButton(page).click();
  await expect(notice).toHaveText(NETWORK);
  await page.unroute("**/api/v1/me/profile");
  await expect(fullName(page)).toHaveValue(NEW_NAME);
  await expect(saveButton(page)).toBeEnabled();
  await saveButton(page).click();
  await expect(page.getByTestId("details-success")).toBeVisible();
});

test("save: a hung request times out into its own message", async ({ page, request }) => {
  await openProfile(page);
  await fullName(page).fill(NEW_NAME);
  await setMode(request, "profile-patch", "hang");
  await page.clock.install();
  await saveButton(page).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await page.clock.runFor(21_000);
  await expect(page.getByTestId("details-notice")).toHaveText(TIMEOUT);
});

test("save: CSRF self-heal refetches the token and retries once", async ({ page, request }) => {
  await openProfile(page);
  await fullName(page).fill(NEW_NAME);
  await setMode(request, "profile-patch", "csrf_once");
  await saveButton(page).click();
  await expect(page.getByTestId("details-success")).toBeVisible();
  expect((await last(request, "profile-patch")).count).toBe(2);
  expect((await stats(request)).csrfFetches).toBeGreaterThanOrEqual(2);
});

test("save: a failing CSRF fetch sends nothing", async ({ page, request }) => {
  await openProfile(page);
  await fullName(page).fill(NEW_NAME);
  await setMode(request, "csrf", "rate_limited");
  await saveButton(page).click();
  await expect(page.getByTestId("details-notice")).toHaveText(THROTTLED);
  expect((await last(request, "profile-patch")).count).toBe(0);
});

test("save: 401 signs out and goes to sign in with next", async ({ page, request }) => {
  await openProfile(page);
  await fullName(page).fill(NEW_NAME);
  await setMode(request, "profile-patch", "session_gone");
  await saveButton(page).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fprofile$/);
});

test("save: double submit sends exactly one request", async ({ page, request }) => {
  await openProfile(page);
  await fullName(page).fill(NEW_NAME);
  await setMode(request, "profile-patch", "hang");
  await saveButton(page).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await page.evaluate(() => {
    const form = document.querySelectorAll("form")[0];
    form.requestSubmit();
    form.requestSubmit();
  });
  await page.waitForTimeout(300);
  expect((await last(request, "profile-patch")).count).toBe(1);
});

// ---------------------------------------------------------------- email change

async function requestChange(page: Page, address = NEW_EMAIL) {
  await newEmail(page).fill(address);
  await password(page).fill(PASSWORD);
  await requestButton(page).click();
}

test("email request: exact body, one neutral confirmation, password cleared, pending note after the re-read", async ({ page, request }) => {
  await openProfile(page);
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password(page)).toHaveAttribute("type", "text");
  await requestChange(page, `  ${NEW_EMAIL}  `);
  await expect(page.getByTestId("email-sent")).toHaveText(SENT);
  const seen = await last(request, "email-change");
  expect(seen.body).toEqual({ new_email: NEW_EMAIL, current_password: PASSWORD });
  expect(seen.token).toMatch(/^csrf-\d$/);
  await expect(password(page)).toHaveValue("");
  await expect(page.getByTestId("pending-email")).toHaveText(
    pendingNote(NEW_EMAIL),
  );
  await expect(page.getByTestId("current-email")).toHaveText(EMAIL);
  // The details form kept its own state through the re-read.
  await expect(fullName(page)).toHaveValue(NAME);
});

test("email request: a taken, an unchanged and a free address get the identical confirmation", async ({ page }) => {
  await openProfile(page);
  const texts: string[] = [];
  for (const address of [NEW_EMAIL, TAKEN_EMAIL, EMAIL]) {
    await requestChange(page, address);
    await expect(page.getByTestId("email-sent")).toBeVisible();
    texts.push(await page.getByTestId("email-sent").innerText());
    await expect(password(page)).toHaveValue("");
  }
  expect(new Set(texts).size).toBe(1);
  expect(texts[0]).toBe(SENT);
  await expect(page.locator("body")).not.toContainText(/already|registered|taken|in use/i);
});

test("email request errors: incorrect password and invalid address map to text; the password is cleared", async ({ page, request }) => {
  await openProfile(page);
  const box = summary(emailSection(page));
  await setMode(request, "email-change", "wrong_password");
  await requestChange(page);
  await expect(box).toBeFocused();
  await expect(box).toContainText("Current password: The current password is not correct.");
  await expect(password(page)).toHaveAttribute("aria-invalid", "true");
  await expect(password(page)).toHaveValue("");
  await expect(newEmail(page)).toHaveValue(NEW_EMAIL);
  await setMode(request, "email-change", "invalid_email");
  await requestChange(page, "not-an-address");
  await expect(box).toContainText("New email address: Enter a valid email address.");
  await expect(newEmail(page)).toHaveAccessibleDescription(/Enter a valid email address/);
  await expect(password(page)).toHaveValue("");
  await box.getByRole("link", { name: /^New email address/ }).click();
  await expect(newEmail(page)).toBeFocused();
  await expect(page.getByTestId("email-sent")).toHaveCount(0);
});

test("email request: server sentences are never shown; unknown codes, unknown keys and prototype keys are generic", async ({ page, request }) => {
  await openProfile(page);
  const box = summary(emailSection(page));
  await setMode(request, "email-change", "sentences");
  await requestChange(page, TAKEN_EMAIL);
  await expect(box).toContainText("New email address: Enter a valid email address.");
  await expect(box).toContainText(`Current password: ${GENERIC}`);
  await expect(box).toContainText(REJECTED); // the unknown key
  await expect(page.locator("body")).not.toContainText("already registered");
  await expect(page.locator("body")).not.toContainText("Some server sentence.");
  await expect(page.locator("body")).not.toContainText("The current password is incorrect.");
  await setMode(request, "email-change", "proto");
  await requestChange(page);
  await expect(box).toContainText("New email address: Enter a valid email address.");
  await expect(box).toContainText(`Current password: ${GENERIC}`);
  await expect(page.locator("body")).not.toContainText(/constructor|__proto__|\[object|function/);
  await setMode(request, "email-change", "unknown_code");
  await requestChange(page);
  await expect(box).toContainText(`Current password: ${GENERIC}`);
  await expect(page.locator("body")).not.toContainText("mystery_code");
  await setMode(request, "email-change", "non_field");
  await requestChange(page);
  await expect(box).toContainText("The form sent something unexpected. Reload the page and try again.");
});

test("email request: required fields are checked on the client and server codes are mapped too", async ({ page, request }) => {
  await openProfile(page);
  await requestButton(page).click();
  const box = summary(emailSection(page));
  await expect(box).toBeFocused();
  await expect(box).toContainText("New email address: Enter the new email address.");
  await expect(box).toContainText("Current password: Enter your current password.");
  expect((await last(request, "email-change")).count).toBe(0);
  await setMode(request, "email-change", "required");
  await requestChange(page);
  await expect(box).toContainText("New email address: Enter the new email address.");
});

test("email request failures: 429 with the wait, 5xx, network, second 403 each have their own message", async ({ page, request }) => {
  await openProfile(page);
  const notice = page.getByTestId("email-notice");
  await setMode(request, "email-change", "rate_limited");
  await requestChange(page);
  await expect(notice).toHaveText(THROTTLED);
  await expect(notice).toBeFocused();
  await expect(password(page)).toHaveValue(PASSWORD);
  await setMode(request, "email-change", "rate_none");
  await requestButton(page).click();
  await expect(notice).toHaveText("Too many attempts. Try again later.");
  await setMode(request, "email-change", "error");
  await requestButton(page).click();
  await expect(notice).toHaveText(SERVER);
  await expect(page.locator("body")).not.toContainText("Internal detail");
  await setMode(request, "email-change", "csrf_always");
  await requestButton(page).click();
  await expect(notice).toHaveText(REJECTED);
  await setMode(request, "email-change", "ok");
  await page.route("**/api/v1/me/email-change", (route) => route.abort());
  await requestButton(page).click();
  await expect(notice).toHaveText(NETWORK);
  await page.unroute("**/api/v1/me/email-change");
  await expect(requestButton(page)).toBeEnabled();
  await expect(page.getByTestId("email-sent")).toHaveCount(0);
});

test("email request: a hung request times out; CSRF self-heal; 401 goes to sign in", async ({ page, request }) => {
  await openProfile(page);
  await setMode(request, "email-change", "csrf_once");
  await requestChange(page);
  await expect(page.getByTestId("email-sent")).toBeVisible();
  expect((await last(request, "email-change")).count).toBe(2);
  await setMode(request, "email-change", "hang");
  await page.clock.install();
  await password(page).fill(PASSWORD);
  await requestButton(page).click();
  await expect(page.getByRole("button", { name: "Requesting…" })).toBeDisabled();
  await page.clock.runFor(21_000);
  await expect(page.getByTestId("email-notice")).toHaveText(TIMEOUT);
  await setMode(request, "email-change", "session_gone");
  await requestButton(page).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fprofile$/);
});

test("email request: double submit sends exactly one request", async ({ page, request }) => {
  await openProfile(page);
  await setMode(request, "email-change", "hang");
  await requestChange(page);
  await expect(page.getByRole("button", { name: "Requesting…" })).toBeDisabled();
  await page.evaluate(() => {
    const form = document.querySelectorAll("form")[1];
    form.requestSubmit();
    form.requestSubmit();
  });
  await page.waitForTimeout(300);
  expect((await last(request, "email-change")).count).toBe(1);
});

test("the two forms are independent: each has its own summary, live region and ids", async ({ page, request }) => {
  await openProfile(page);
  await phone(page).fill("");
  await saveButton(page).click();
  await requestButton(page).click();
  await expect(summary(details(page))).toBeVisible();
  await expect(summary(emailSection(page))).toBeVisible();
  const ids = await page.evaluate(() => [...document.querySelectorAll("[id]")].map((node) => node.id));
  expect(new Set(ids).size).toBe(ids.length);
  expect((await last(request, "profile-patch")).count).toBe(0);
  expect((await last(request, "email-change")).count).toBe(0);
});

// ---------------------------------------------------------------- privacy (profile)

test("privacy: no phone, email, password in storage, console output or the address bar", async ({ page, context }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  page.on("pageerror", (error) => logs.push(error.message));
  await openProfile(page);
  await fullName(page).fill(NEW_NAME);
  await phone(page).fill(NEW_PHONE);
  await saveButton(page).click();
  await expect(page.getByTestId("details-success")).toBeVisible();
  await requestChange(page);
  await expect(page.getByTestId("email-sent")).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
  const secrets = [PHONE, NEW_PHONE, NEW_EMAIL, PASSWORD];
  const text = await page.locator("body").innerText();
  for (const secret of secrets) {
    expect(stored).not.toContain(secret);
    expect(JSON.stringify(await context.cookies())).not.toContain(secret);
    expect(logs.join("\n")).not.toContain(secret);
    expect(page.url()).not.toContain(secret);
    // The owner's own pending address is shown in text on purpose; nothing else is.
    if (secret !== NEW_EMAIL) expect(text).not.toContain(secret);
  }
  expect(text.split(NEW_EMAIL).length - 1).toBe(1);
  expect(page.url()).not.toContain("@");
  expect(await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))).toBe("[{},{}]");
  await expect(header(page)).not.toContainText(NEW_PHONE);
});

// ---------------------------------------------------------------- confirm page

const confirmHeading = (page: Page, name: string) => page.getByRole("heading", { name });

test("confirm arrives: token leaves the address bar, other parameters stay, nothing is sent until the button is pressed", async ({ page, request }) => {
  await page.goto(`/confirm-email-change?token=${TOKEN}&utm=a`);
  await expect(confirmButton(page)).toBeVisible();
  expect(new URL(page.url()).search).toBe("?utm=a");
  expect(page.url()).not.toContain(TOKEN);
  await page.waitForTimeout(400);
  expect((await last(request, "email-confirm")).count).toBe(0);
  await confirmButton(page).click();
  await expect(confirmHeading(page, "Email address changed")).toBeFocused();
  expect(await last(request, "email-confirm")).toEqual({ count: 1, body: { token: TOKEN } });
});

test("confirm ok: success text, sign-in and profile links, button gone, header shows the new address", async ({ page, request }) => {
  // With no name on the account the header shows the email, so the refreshed session is visible, not just counted.
  await setMode(request, "signin", "no_name");
  await signIn(page);
  await expect(header(page).getByTestId("account-name")).toHaveText(EMAIL);
  await page.goto(CONFIRM);
  await expect(confirmButton(page)).toBeVisible();
  await expect(header(page).getByTestId("account-name")).toHaveText(EMAIL);
  await page.waitForTimeout(500); // let the page's own session checks settle before counting
  const before = (await stats(request)).meCount;
  await confirmButton(page).click();
  await expect(page.getByText(CHANGED)).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  await expect(page.getByRole("main").getByRole("link", { name: "Go to your profile" })).toHaveAttribute("href", PROFILE);
  await expect(confirmButton(page)).toHaveCount(0);
  await expect.poll(async () => (await stats(request)).meCount).toBeGreaterThan(before);
  await expect(header(page).getByTestId("account-name")).toHaveText("ayesha.new@example.com");
  expect((await last(request, "email-confirm")).count).toBe(1);
});

test("confirm: the token never returns to the address bar after navigating away and Back", async ({ page }) => {
  await page.goto(CONFIRM);
  await confirmButton(page).click();
  await expect(page.getByText(CHANGED)).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Go to your profile" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  expect(page.url()).not.toContain(TOKEN);
  await page.goBack();
  await expect(page).toHaveURL(/\/confirm-email-change/);
  expect(page.url()).not.toContain(TOKEN);
  await page.waitForTimeout(500);
  expect(page.url()).not.toContain(TOKEN);
  await page.goForward();
  await page.goBack();
  await page.waitForTimeout(300);
  expect(page.url()).not.toContain(TOKEN);
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain(TOKEN);
});

for (const missing of ["/confirm-email-change", "/confirm-email-change?token=", "/confirm-email-change?token=%20%20"]) {
  test(`confirm missing token (${missing}): invalid-link state with a link to the profile page, no request`, async ({ page, request }) => {
    await page.goto(missing);
    await expect(confirmHeading(page, "This link is not valid")).toBeFocused();
    await expect(page.getByRole("link", { name: "Request the change again" })).toHaveAttribute("href", PROFILE);
    await expect(confirmButton(page)).toHaveCount(0);
    expect((await last(request, "email-confirm")).count).toBe(0);
  });
}

for (const [mode, title, text] of [
  ["expired", "This link has expired", /24 hours/],
  ["used", "This link was already used or replaced", /works once/],
  ["invalid", "This link is not valid", /mistyped/],
  ["other_400", "This link is not valid", /mistyped/],
] as const) {
  test(`confirm answer ${mode} shows its own state, drops the button and links to the profile page`, async ({ page, request }) => {
    await setMode(request, "email-confirm", mode);
    await page.goto(CONFIRM);
    await confirmButton(page).click();
    await expect(confirmHeading(page, title)).toBeFocused();
    await expect(page.locator("main")).toContainText(text);
    await expect(page.getByRole("link", { name: "Request the change again" })).toHaveAttribute("href", PROFILE);
    await expect(confirmButton(page)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Raw server text");
    expect(page.url()).not.toContain(TOKEN);
  });
}

test("confirm: expired, used and invalid have distinct wording", async ({ page, request }) => {
  const seen = new Set<string>();
  for (const mode of ["expired", "used", "invalid"]) {
    await request.get(`${STUB}/__reset`);
    await setMode(request, "email-confirm", mode);
    await page.goto(CONFIRM);
    await confirmButton(page).click();
    await expect(page.locator("#result-title")).toBeFocused();
    seen.add((await page.locator("main section").first().innerText()).trim());
  }
  expect(seen.size).toBe(3);
});

test("confirm failures: 429, 5xx and network keep the button and the token; Retry-style press works", async ({ page, request }) => {
  await setMode(request, "email-confirm", "rate_limited");
  await page.goto(CONFIRM);
  await confirmButton(page).click();
  const notice = page.getByTestId("form-notice");
  await expect(notice).toHaveText(THROTTLED);
  await expect(notice).toBeFocused();
  await expect(confirmButton(page)).toBeEnabled();
  await setMode(request, "email-confirm", "error");
  await confirmButton(page).click();
  await expect(notice).toHaveText(SERVER);
  await expect(page.locator("body")).not.toContainText("Internal detail");
  await page.route("**/api/v1/email-changes/confirm", (route) => route.abort());
  await confirmButton(page).click();
  await expect(notice).toHaveText(NETWORK);
  await page.unroute("**/api/v1/email-changes/confirm");
  await setMode(request, "email-confirm", "ok");
  await confirmButton(page).click();
  await expect(confirmHeading(page, "Email address changed")).toBeVisible();
  // Every attempt that reached the server carried the same token from memory.
  expect((await last(request, "email-confirm")).body).toEqual({ token: TOKEN });
});

test("confirm: a flaky server then a retry succeeds with the same token", async ({ page, request }) => {
  await setMode(request, "email-confirm", "flaky");
  await page.goto(CONFIRM);
  await confirmButton(page).click();
  await expect(page.getByTestId("form-notice")).toHaveText(SERVER);
  await confirmButton(page).click();
  await expect(confirmHeading(page, "Email address changed")).toBeVisible();
  expect(await last(request, "email-confirm")).toEqual({ count: 2, body: { token: TOKEN } });
});

test("confirm: a hung request times out into a retry message and keeps the button", async ({ page, request }) => {
  await setMode(request, "email-confirm", "hang");
  await page.goto(CONFIRM);
  await page.clock.install();
  await confirmButton(page).click();
  await expect(page.getByRole("button", { name: "Confirming…" })).toBeDisabled();
  await page.clock.runFor(21_000);
  await expect(page.getByTestId("form-notice")).toHaveText(TIMEOUT);
  await expect(confirmButton(page)).toBeEnabled();
});

test("confirm: an unknown error code is generic, never raw server text, and keeps the button", async ({ page, request }) => {
  await setMode(request, "email-confirm", "unknown_code");
  await page.goto(CONFIRM);
  await confirmButton(page).click();
  await expect(page.getByTestId("form-notice")).toHaveText(REJECTED);
  await expect(page.locator("body")).not.toContainText("Raw server text");
  await expect(confirmButton(page)).toBeEnabled();
});

test("confirm: double press sends exactly one request", async ({ page, request }) => {
  await setMode(request, "email-confirm", "hang");
  await page.goto(CONFIRM);
  await confirmButton(page).click();
  await expect(page.getByRole("button", { name: "Confirming…" })).toBeDisabled();
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>("main button")!;
    button.click();
    button.click();
  });
  await page.waitForTimeout(300);
  expect((await last(request, "email-confirm")).count).toBe(1);
});

test("confirm privacy: the token is not in storage, console, rendered markup or the address bar in any state", async ({ page, context, request }) => {
  for (const mode of ["ok", "expired", "error"]) {
    await request.get(`${STUB}/__reset`);
    await setMode(request, "email-confirm", mode);
    const logs: string[] = [];
    const listener = (message: { text(): string }) => logs.push(message.text());
    page.on("console", listener);
    await page.goto(CONFIRM);
    await confirmButton(page).click();
    await expect(page.getByRole("button", { name: "Confirming…" })).toHaveCount(0);
    await page.waitForTimeout(200);
    page.off("console", listener);
    expect(logs.join("\n")).not.toContain(TOKEN);
    // Dev-mode framework scripts echo the request URL; the rendered markup must not carry the token.
    const markup = await page.evaluate(() => {
      const copy = document.body.cloneNode(true) as HTMLElement;
      copy.querySelectorAll("script").forEach((node) => node.remove());
      return copy.innerHTML;
    });
    expect(markup).not.toContain(TOKEN);
    expect(await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]))).not.toContain(TOKEN);
    expect(JSON.stringify(await context.cookies())).not.toContain(TOKEN);
    expect(page.url()).not.toContain(TOKEN);
  }
});

test("the token is gone from the address bar while the request is still pending", async ({ page, request }) => {
  await setMode(request, "email-confirm", "hang");
  await page.goto(CONFIRM);
  await confirmButton(page).click();
  await expect(page.getByRole("button", { name: "Confirming…" })).toBeVisible();
  await expect(page).not.toHaveURL(new RegExp(TOKEN));
});

test("confirm headers: no-referrer and no-store, served by the route", async ({ request }) => {
  const response = await request.get(CONFIRM);
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response.headers()["cache-control"]).toContain("no-store");
  // Dev mode embeds the URL in framework scripts, so only the markup is checked here; the production build is checked
  // by hand (README).
  const markup = (await response.text()).replace(/<script[\s\S]*?<\/script>/g, "");
  expect(markup).not.toContain(TOKEN);
});

test("next.config headers: confirm-email-change is no-referrer and no-store; account pages are no-store", async () => {
  const mod = await import("../../next.config");
  // Playwright's loader can wrap a default export once more.
  const config = typeof mod.default.headers === "function" ? mod.default : (mod.default as unknown as typeof mod).default;
  const rules = await config.headers!();
  const find = (source: string) => Object.fromEntries((rules.find((rule) => rule.source === source)?.headers ?? []).map((h) => [h.key, h.value]));
  expect(find("/confirm-email-change")).toEqual({ "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" });
  expect(find("/account/:path*")).toEqual({ "Cache-Control": "no-store" });
});

test("PROFILE_MESSAGES maps the profile codes", async () => {
  const { PROFILE_MESSAGES } = await import("../../src/lib/registration-messages");
  expect(PROFILE_MESSAGES.phone.invalid_phone).toBe("Enter a valid Pakistani mobile or international number.");
  expect(PROFILE_MESSAGES.new_email.invalid_email).toBe("Enter a valid email address.");
});

// ---------------------------------------------------------------- review follow-ups

const gate = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => (release = resolve));
  return { promise, release };
};

test("an unsaved name and phone survive a successful email request", async ({ page }) => {
  await openProfile(page);
  await fullName(page).fill(NEW_NAME);
  await phone(page).fill(NEW_PHONE);
  await requestChange(page);
  await expect(page.getByTestId("email-sent")).toBeVisible();
  await expect(page.getByTestId("pending-email")).toBeVisible();
  await expect(fullName(page)).toHaveValue(NEW_NAME);
  await expect(phone(page)).toHaveValue(NEW_PHONE);
});

test("the pending note is neutral: it does not claim a link definitely went out", async ({ page }) => {
  await openProfile(page);
  await requestChange(page, TAKEN_EMAIL);
  const note = page.getByTestId("pending-email");
  await expect(note).toHaveText(pendingNote(TAKEN_EMAIL));
  await expect(note).not.toContainText(/We sent a confirmation link to/);
});

test("a failed quiet re-read after a 202 keeps the form and shows the typed address", async ({ page, request }) => {
  await openProfile(page);
  await setMode(request, "profile", "error");
  await fullName(page).fill(NEW_NAME);
  await requestChange(page);
  await expect(page.getByTestId("email-sent")).toHaveText(SENT);
  await expect(page.getByTestId("pending-email")).toHaveText(pendingNote(NEW_EMAIL));
  await expect(fullName(page)).toHaveValue(NEW_NAME);
  await expect(page.getByRole("main").getByRole("button", { name: "Retry" })).toHaveCount(0);
});

test("editing either email field after a 202 clears the sent text", async ({ page }) => {
  await openProfile(page);
  await requestChange(page);
  await expect(page.getByTestId("email-sent")).toBeVisible();
  await newEmail(page).fill(TAKEN_EMAIL);
  await expect(page.getByTestId("email-sent")).toHaveCount(0);
  await requestChange(page, TAKEN_EMAIL);
  await expect(page.getByTestId("email-sent")).toBeVisible();
  await password(page).fill("x");
  await expect(page.getByTestId("email-sent")).toHaveCount(0);
});

test("a 400 that only concerns the new address keeps the typed address and clears the password", async ({ page, request }) => {
  await openProfile(page);
  await setMode(request, "email-change", "invalid_email");
  await requestChange(page, "not-an-address");
  await expect(summary(emailSection(page))).toBeVisible();
  await expect(newEmail(page)).toHaveValue("not-an-address");
  await expect(password(page)).toHaveValue("");
});

test("typing while a save is in flight is not overwritten by the answer", async ({ page }) => {
  await openProfile(page);
  const held = gate();
  await page.route("**/api/v1/me/profile", async (route) => {
    if (route.request().method() === "PATCH") await held.promise;
    await route.continue();
  });
  await fullName(page).fill(NEW_NAME);
  await saveButton(page).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await phone(page).fill(NEW_PHONE);
  held.release();
  await expect(page.getByTestId("details-success")).toBeVisible();
  await expect(phone(page)).toHaveValue(NEW_PHONE);
  await expect(fullName(page)).toHaveValue(NEW_NAME);
});

test("a trim-only change sends nothing and leaves the trimmed value in the field", async ({ page, request }) => {
  await openProfile(page);
  await fullName(page).fill(`${NAME}   `);
  await saveButton(page).click();
  await expect(page.getByTestId("details-unchanged")).toHaveText("No changes to save.");
  await expect(fullName(page)).toHaveValue(NAME);
  expect((await last(request, "profile-patch")).count).toBe(0);
});

test("a 2xx with an unreadable body is a polite saved-reload note, not an error, and the profile is re-read", async ({ page, request }) => {
  await openProfile(page);
  await setMode(request, "profile-patch", "empty_ok");
  await fullName(page).fill(NEW_NAME);
  await saveButton(page).click();
  await expect(page.getByTestId("details-success")).toHaveText(
    "Your profile was saved. We could not read the updated values back; reload the page to see them.",
  );
  await expect(page.getByTestId("details-notice")).toHaveCount(0);
  await expect(summary(details(page))).toHaveCount(0);
  await expect(fullName(page)).toHaveValue(NEW_NAME);
  await expect.poll(async () => (await last(request, "profile")).gets).toBeGreaterThanOrEqual(2);
  await expect(header(page).getByTestId("account-name")).toHaveText(NEW_NAME);
  // The baseline moved: the same values are now "no changes".
  await saveButton(page).click();
  await expect(page.getByTestId("details-unchanged")).toBeVisible();
});

test("Retry keeps the heading and button mounted (aria-disabled) while reloading, then focuses the form heading", async ({ page, request }) => {
  await setMode(request, "profile", "flaky");
  await signIn(page, PROFILE);
  const retry = page.getByRole("main").getByRole("button", { name: "Retry" });
  await expect(retry).toBeVisible();
  const held = gate();
  await page.route("**/api/v1/me/profile", async (route) => {
    await held.promise;
    await route.continue();
  });
  await retry.click();
  await expect(retry).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("heading", { name: "We could not load your profile" })).toBeVisible();
  held.release();
  await expect(fullName(page)).toHaveValue(NAME);
  await expect(page.getByRole("heading", { name: "Your details" })).toBeFocused();
});

test("the profile re-reads silently on window focus and when the tab becomes visible; a failure keeps the form", async ({ page, request }) => {
  await openProfile(page);
  const gets = async () => (await last(request, "profile")).gets;
  const base = await gets();
  await fullName(page).fill(NEW_NAME);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(gets).toBeGreaterThan(base);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(gets).toBeGreaterThan(base + 1);
  await expect(page.getByTestId("profile-loading")).toHaveCount(0);
  await expect(fullName(page)).toHaveValue(NEW_NAME); // typing is kept
  await setMode(request, "profile", "error");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(gets).toBeGreaterThan(0);
  await expect(fullName(page)).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Retry" })).toHaveCount(0);
});

for (const mode of ["agency", "admin"]) {
  test(`the Profile link is hidden for ${mode} accounts in the header and on the dashboard`, async ({ page, request }) => {
    await setMode(request, "me", mode);
    await signIn(page);
    await expect(header(page).getByTestId("account-name")).toBeVisible();
    await expect(page.getByRole("link", { name: "Profile", exact: true })).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("link", { name: "Change password" })).toBeVisible();
  });
}

for (const [label, arrange] of [
  ["a 400", (request: APIRequestContext) => setMode(request, "profile-patch", "fields")],
  ["a 5xx", (request: APIRequestContext) => setMode(request, "profile-patch", "error")],
  ["a wrong password", (request: APIRequestContext) => setMode(request, "email-change", "wrong_password")],
] as const) {
  test(`privacy holds after ${label} on the profile page`, async ({ page, context, request }) => {
    const logs: string[] = [];
    page.on("console", (message) => logs.push(message.text()));
    page.on("pageerror", (error) => logs.push(error.message));
    await openProfile(page);
    await arrange(request);
    await fullName(page).fill("A1");
    await phone(page).fill(NEW_PHONE);
    await saveButton(page).click();
    await requestChange(page);
    await expect(page.getByRole("group", { name: "There is a problem" }).or(page.getByTestId("details-notice")).first()).toBeVisible();
    const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
    for (const secret of [PHONE, NEW_PHONE, NEW_EMAIL, PASSWORD]) {
      expect(stored).not.toContain(secret);
      expect(JSON.stringify(await context.cookies())).not.toContain(secret);
      expect(logs.join("\n")).not.toContain(secret);
      expect(page.url()).not.toContain(secret);
      // The owner's own pending address is shown in text on purpose.
      if (secret !== NEW_EMAIL) expect(await page.locator("body").innerText()).not.toContain(secret);
    }
  });
}

test("privacy holds on the profile load failure", async ({ page, request }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  await setMode(request, "profile", "error");
  await signIn(page, PROFILE);
  await expect(page.getByRole("main").getByRole("button", { name: "Retry" })).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
  for (const secret of [PHONE, EMAIL.split("@")[0] + "@", PASSWORD]) {
    expect(stored).not.toContain(secret);
    expect(logs.join("\n")).not.toContain(secret);
    expect(await page.locator("main").innerText()).not.toContain(secret);
  }
});

// ---------------------------------------------------------------- accessibility

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];

for (const viewport of viewports) {
  const states: Record<string, (page: Page, request: APIRequestContext) => Promise<void>> = {
    "profile ready": async (page) => {
      await openProfile(page);
    },
    "profile details errors": async (page, request) => {
      await openProfile(page);
      await setMode(request, "profile-patch", "fields");
      await fullName(page).fill("A1");
      await saveButton(page).click();
      await expect(summary(details(page))).toBeVisible();
    },
    "profile saved": async (page) => {
      await openProfile(page);
      await fullName(page).fill(NEW_NAME);
      await saveButton(page).click();
      await expect(page.getByTestId("details-success")).toBeVisible();
    },
    "profile email errors": async (page, request) => {
      await openProfile(page);
      await setMode(request, "email-change", "wrong_password");
      await requestChange(page);
      await expect(summary(emailSection(page))).toBeVisible();
    },
    "profile email sent with pending note": async (page) => {
      await openProfile(page);
      await requestChange(page);
      await expect(page.getByTestId("pending-email")).toBeVisible();
    },
    "profile notice": async (page, request) => {
      await openProfile(page);
      await fullName(page).fill(NEW_NAME);
      await setMode(request, "profile-patch", "rate_limited");
      await saveButton(page).click();
      await expect(page.getByTestId("details-notice")).toBeVisible();
    },
    "profile load error": async (page, request) => {
      await setMode(request, "profile", "error");
      await signIn(page, PROFILE);
      await expect(page.getByRole("main").getByRole("button", { name: "Retry" })).toBeVisible();
    },
    "profile forbidden": async (page, request) => {
      await setMode(request, "profile", "forbidden");
      await signIn(page, PROFILE);
      await expect(page.getByTestId("profile-forbidden")).toBeVisible();
    },
    "confirm ready": async (page) => {
      await page.goto(CONFIRM);
      await expect(confirmButton(page)).toBeVisible();
    },
    "confirm success": async (page) => {
      await page.goto(CONFIRM);
      await confirmButton(page).click();
      await expect(confirmHeading(page, "Email address changed")).toBeVisible();
    },
    "confirm expired": async (page, request) => {
      await setMode(request, "email-confirm", "expired");
      await page.goto(CONFIRM);
      await confirmButton(page).click();
      await expect(confirmHeading(page, "This link has expired")).toBeVisible();
    },
    "confirm missing": async (page) => {
      await page.goto("/confirm-email-change");
      await expect(page.getByRole("link", { name: "Request the change again" })).toBeVisible();
    },
    "confirm notice": async (page, request) => {
      await setMode(request, "email-confirm", "rate_limited");
      await page.goto(CONFIRM);
      await confirmButton(page).click();
      await expect(page.getByTestId("form-notice")).toBeVisible();
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
