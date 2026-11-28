import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const STUB = STUB_URL;
const PASSPHRASE = "correct horse battery staple";
const PHONE = "0300 5550142";
const ADDRESS = "Office 12, Blue Plaza, Main Boulevard";
const EMAIL = "office@sunrise.example.com";
const KARACHI = "11111111-1111-4111-8111-111111111111";
const LAHORE = "22222222-2222-4222-8222-222222222222";

// The stub backend holds module-level state, so these tests must not interleave.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

const setAgency = (request: APIRequestContext, value: string) => request.get(`${STUB}/__agency-mode?value=${value}`);
const setCities = (request: APIRequestContext, value: string) => request.get(`${STUB}/__cities-mode?value=${value}`);
const lastAgency = async (request: APIRequestContext) => (await request.get(`${STUB}/__last-agency`)).json();
const submit = (page: Page) => page.getByRole("button", { name: /Create agency account|Creating account/ });

async function open(page: Page) {
  await page.goto("/register/agency");
  await expect(page.getByLabel("City")).toBeEnabled();
}

async function fill(page: Page) {
  await page.getByLabel("Agency name").fill("Sunrise Estates");
  await page.getByLabel("Business email").fill(`  ${EMAIL}  `);
  await page.getByLabel("Business phone").fill(PHONE);
  await page.getByLabel("Office address").fill(ADDRESS);
  await page.getByLabel("City").selectOption(KARACHI);
  await page.getByLabel("Password", { exact: true }).fill(PASSPHRASE);
}

async function expectNoViolations(page: Page, label: string) {
  await expect(page).toHaveTitle(/.+/); // the title can stream in after the body on a production server
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
}

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];

test("page: agency heading, six labelled fields with autocomplete hints, link to the Individual form @smoke", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { level: 1, name: "Register an agency" })).toBeVisible();
  const names = await page.locator("form input, form select, form textarea").evaluateAll((els) => els.map((el) => (el as HTMLInputElement).name));
  expect(names).toEqual(["agency_name", "email", "phone", "office_address", "city_id", "password"]);
  await expect(page.getByLabel("Agency name")).toHaveAttribute("autocomplete", "organization");
  await expect(page.getByLabel("Business email")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Business phone")).toHaveAttribute("autocomplete", "tel");
  await expect(page.getByLabel("Office address")).toHaveAttribute("autocomplete", "street-address");
  expect(await page.getByLabel("Office address").evaluate((el) => el.tagName)).toBe("TEXTAREA");
  await expect(page.getByLabel("Office address")).toHaveAttribute("maxlength", "300");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  await page.getByRole("navigation", { name: "Account type" }).getByRole("link", { name: "Individual" }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test("links: the Individual page and the home page link to the Agency page @smoke", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("navigation", { name: "Account type" }).getByRole("link", { name: "Agency" }).click();
  await expect(page).toHaveURL(/\/register\/agency$/);
  await page.goto("/");
  await expect(page.getByRole("main").getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register");
  await page.getByRole("link", { name: "Register an agency" }).click();
  await expect(page).toHaveURL(/\/register\/agency$/);
});

test("cities ok: the select lists the cities by name with the placeholder first @smoke", async ({ page }) => {
  await open(page);
  const options = await page.getByLabel("City").locator("option").evaluateAll((els) =>
    els.map((el) => ({ text: el.textContent, value: (el as HTMLOptionElement).value, disabled: (el as HTMLOptionElement).disabled })),
  );
  expect(options[0]).toEqual({ text: "Select a city", value: "", disabled: true });
  expect(options.slice(1).map((o) => o.text)).toEqual(["Karachi", "Lahore", "Islamabad"]);
  await expect(page.getByLabel("City")).toHaveValue("");
});

test("cities loading: the select is disabled with a Loading cities option @smoke", async ({ page, request }) => {
  await setCities(request, "slow");
  await page.goto("/register/agency");
  await expect(page.getByLabel("City")).toBeDisabled();
  await expect(page.getByLabel("City").locator("option")).toHaveText("Loading cities");
  await expect(page.getByLabel("City")).toBeEnabled();
});

test("cities empty: a message shows and submit is blocked with no request", async ({ page, request }) => {
  await setCities(request, "empty");
  await page.goto("/register/agency");
  await expect(page.locator("#city-status")).toHaveText("No cities are available right now.");
  await expect(page.getByLabel("City").locator("option")).toHaveText(["Select a city"]);
  await page.getByLabel("Agency name").fill("Sunrise Estates");
  await page.getByLabel("Business email").fill(EMAIL);
  await page.getByLabel("Business phone").fill(PHONE);
  await page.getByLabel("Office address").fill(ADDRESS);
  await page.getByLabel("Password", { exact: true }).fill(PASSPHRASE);
  await submit(page).click();
  await expect(page.locator("#city_id-error")).toContainText("No cities are available right now.");
  expect((await lastAgency(request)).count).toBe(0);
});

for (const mode of ["error", "hang"]) {
  test(`cities fail (${mode}): inline message with Retry, the form stays usable, Retry reloads`, async ({ page, request }) => {
    await setCities(request, mode);
    if (mode === "hang") await page.clock.install();
    await page.goto("/register/agency");
    if (mode === "hang") {
      // The timer exists only once the page has hydrated and asked for the list.
      await expect.poll(async () => (await (await request.get(`${STUB}/__last-cities`)).json()).count).toBeGreaterThan(0);
      await page.clock.runFor(21_000);
    }
    await expect(page.locator("#city-status")).toContainText("We could not load the list of cities.");
    await expect(page.locator("body")).not.toContainText("Internal detail");
    await expect(page.getByLabel("Agency name")).toBeEnabled();
    await submit(page).click();
    await expect(page.locator("#city_id-error")).toContainText("Cities could not be loaded. Retry above.");
    await expect(page.locator("[role=status]")).toHaveCount(1); // the form's one live region
    await expect(page.locator("#agency_name")).toBeFocused(); // the first empty field of this submit
    expect((await lastAgency(request)).count).toBe(0);
    await setCities(request, "ok");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByLabel("City").locator("option")).toHaveText(["Select a city", "Karachi", "Lahore", "Islamabad"]);
    await expect(page.getByLabel("City")).toBeFocused(); // the Retry button is gone, focus moves to the select
    await expect(page.locator("#city-status")).toBeEmpty();
  });
}

test("cities network failure shows the same inline message", async ({ page, request }) => {
  await request.get(`${STUB}/__cities-mode?value=error`);
  await page.route("**/api/v1/reference/cities", (route) => route.abort());
  await page.goto("/register/agency");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("required checks: empty submit shows field errors, focuses the first and sends nothing", async ({ page, request }) => {
  await open(page);
  await submit(page).click();
  await expect(page.locator("#agency_name")).toBeFocused();
  await expect(page.locator(".field-error")).toHaveCount(6);
  await expect(page.locator("#agency_name-error")).toContainText("Enter the agency name.");
  await expect(page.locator("#city_id-error")).toContainText("Select a city.");
  await expect(page.getByLabel("City")).toHaveAttribute("aria-invalid", "true");
  expect((await lastAgency(request)).count).toBe(0);
});

test("submit ok: body is exactly the six fields with city_id, generic check-your-email state", async ({ page, request }) => {
  await open(page);
  await fill(page);
  await submit(page).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
  await expect(page.getByText(EMAIL)).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" }).last()).toHaveAttribute("href", "/sign-in");
  for (const secret of [PASSPHRASE, PHONE, ADDRESS]) await expect(page.locator("body")).not.toContainText(secret);
  const { body, count } = await lastAgency(request);
  expect(count).toBe(1);
  expect(Object.keys(body).sort()).toEqual(["agency_name", "city_id", "email", "office_address", "password", "phone"]);
  expect(body).toEqual({
    agency_name: "Sunrise Estates",
    email: EMAIL,
    phone: PHONE,
    office_address: ADDRESS,
    city_id: KARACHI,
    password: PASSPHRASE,
  });
});

test("existing email: the server answers the same 202 and the page is identical", async ({ page, request }) => {
  await open(page);
  await fill(page);
  await submit(page).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const fresh = await page.locator("main section").innerText();
  await request.get(`${STUB}/__reset`);
  await setAgency(request, "existing");
  await open(page);
  await fill(page);
  await submit(page).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  expect(await page.locator("main section").innerText()).toBe(fresh);
});

test("field errors: mapped text under each field, first field focused, values kept, password cleared", async ({ page, request }) => {
  await setAgency(request, "fields");
  await open(page);
  await fill(page);
  await submit(page).click();
  await expect(page.locator("#agency_name")).toBeFocused();
  await expect(page.locator(".field-error")).toHaveCount(6);
  for (const [id, message] of [
    ["agency_name", "Enter a valid agency name."],
    ["email", "Enter a valid email address."],
    ["phone", "Enter a valid Pakistani mobile or international number."],
    ["office_address", "Enter a valid office address."],
    ["city_id", "Select a city."],
    ["password", "Use at least 8 characters."],
  ]) {
    const input = page.locator(`#${id}`);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    expect(await input.getAttribute("aria-describedby")).toContain(`${id}-error`);
    await expect(page.locator(`#${id}-error`)).toContainText(message);
  }
  await expect(page.locator("#password-error")).toContainText("too common");
  await expect(page.locator("body")).not.toContainText(/invalid_name|password_too_short/);
  await expect(page.getByLabel("Agency name")).toHaveValue("Sunrise Estates");
  await expect(page.getByLabel("Business phone")).toHaveValue(PHONE);
  await expect(page.getByLabel("Office address")).toHaveValue(ADDRESS);
  await expect(page.getByLabel("City")).toHaveValue(KARACHI);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
});

test("required codes from the server map to human text", async ({ page, request }) => {
  await setAgency(request, "required");
  await open(page);
  await fill(page);
  await submit(page).click();
  await expect(page.locator("#phone-error")).toContainText("Enter the business phone number.");
  await expect(page.locator("#password-error")).toContainText("Enter a password.");
});

test("server sentences are shown as sent, unknown codes become the generic message", async ({ page, request }) => {
  await setAgency(request, "sentences");
  await open(page);
  await fill(page);
  await submit(page).click();
  await expect(page.locator("#agency_name-error")).toContainText("Enter a valid agency name.");
  await expect(page.locator("#phone-error")).toContainText("Enter a valid value.");
  await expect(page.locator("body")).not.toContainText("mystery_code");
});

test("mixed and non-field errors: known fields mapped, the rest above the form", async ({ page, request }) => {
  await setAgency(request, "mixed");
  await open(page);
  await fill(page);
  await submit(page).click();
  const summary = page.getByTestId("form-errors");
  await expect(page.locator(".field-error")).toHaveCount(1);
  await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
  await expect(summary).toContainText("Unknown field.");
  await expect(summary).toContainText("Reload the page and try again.");
  await setAgency(request, "non_field");
  await fill(page);
  await submit(page).click();
  await expect(summary).toContainText("Unexpected field.");
});

test("400 without fields shows the server message", async ({ page, request }) => {
  await setAgency(request, "empty_fields");
  await open(page);
  await fill(page);
  await submit(page).click();
  await expect(page.getByTestId("form-errors")).toContainText("The server rejected this request.");
});

test("invalid city: the selection is cleared, the list is re-fetched, the error is shown", async ({ page, request }) => {
  await setAgency(request, "invalid_city");
  await open(page);
  await fill(page);
  const citiesCount = async () => (await (await request.get(`${STUB}/__last-cities`)).json()).count as number;
  const before = await citiesCount(); // dev mode may mount twice, so compare against the count before submitting
  await submit(page).click();
  await expect(page.locator("#city_id-error")).toContainText("no longer available");
  await expect.poll(citiesCount).toBe(before + 1);
  await expect(page.getByLabel("City")).toBeEnabled();
  await expect(page.getByLabel("City")).toBeFocused(); // focus follows the refreshed list
  await expect(page.getByLabel("City")).toHaveValue("");
  expect(await page.getByLabel("City").evaluate((el) => (el as HTMLSelectElement).selectedOptions[0].textContent)).toBe("Select a city");
  // Nothing is sent until a city is chosen again.
  const sent = (await lastAgency(request)).count;
  await page.getByLabel("Password", { exact: true }).fill(PASSPHRASE);
  await submit(page).click();
  await expect(page.locator("#city_id-error")).toContainText("Select a city.");
  expect((await lastAgency(request)).count).toBe(sent);
  await page.getByLabel("City").selectOption(LAHORE);
  await expect(page.getByLabel("City")).toHaveValue(LAHORE);
});

test("the options come from the server, not from the page", async ({ page, request }) => {
  await setCities(request, "other");
  await page.goto("/register/agency");
  await expect(page.getByLabel("City").locator("option")).toHaveText(["Select a city", "Multan", "Peshawar"]);
});

test("malformed city items are filtered; an entirely malformed list is a failed load", async ({ page, request }) => {
  await setCities(request, "partial");
  await page.goto("/register/agency");
  await expect(page.getByLabel("City").locator("option")).toHaveText(["Select a city", "Karachi", "Lahore"]);
  await setCities(request, "malformed");
  await page.goto("/register/agency");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByLabel("City").locator("option")).toHaveText(["Select a city"]);
});

test("a stale city response never overwrites a newer one", async ({ page }) => {
  const held: import("@playwright/test").Route[] = [];
  await page.route("**/api/v1/reference/cities", (route) => void held.push(route));
  await page.goto("/register/agency");
  await expect.poll(() => held.length).toBeGreaterThan(0);
  await page.waitForTimeout(300); // dev mode asks twice on mount; the last request is the current one
  const answer = (items: { id: string; name: string }[]) => ({ status: 200, contentType: "application/json", body: JSON.stringify({ items }) });
  const stale = [{ id: KARACHI, name: "Stale City" }];
  const fresh = [{ id: LAHORE, name: "Fresh City" }];
  await held[held.length - 1].fulfill(answer(fresh));
  await expect(page.getByLabel("City").locator("option")).toHaveText(["Select a city", "Fresh City"]);
  for (const route of held.slice(0, -1)) await route.fulfill(answer(stale));
  await page.waitForTimeout(300);
  await expect(page.getByLabel("City").locator("option")).toHaveText(["Select a city", "Fresh City"]);
});

for (const [mode, text] of [
  ["rate_limited", "Too many attempts. Try again in 30 minutes."],
  ["rate_20", "Too many attempts. Try again in 1 minute."],
  ["rate_90", "Too many attempts. Try again in 2 minutes."],
  ["rate_none", "Too many attempts. Try again later."],
  ["rate_abc", "Too many attempts. Try again later."],
] as const) {
  test(`throttled (${mode}): "${text}", form usable`, async ({ page, request }) => {
    await setAgency(request, mode);
    await open(page);
    await fill(page);
    await submit(page).click();
    await expect(page.getByTestId("form-notice")).toHaveText(text);
    await expect(page.getByTestId("form-notice")).toBeFocused();
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue(PASSPHRASE);
    await expect(submit(page)).toBeEnabled();
  });
}

test("signed in (403): already signed in message", async ({ page, request }) => {
  await setAgency(request, "signed_in");
  await open(page);
  await fill(page);
  await submit(page).click();
  await expect(page.getByTestId("form-notice")).toHaveText("You are already signed in. Sign out to register another account.");
  await expect(page.getByTestId("form-notice")).toBeFocused();
  await expect(page.getByLabel("Agency name")).toHaveValue("Sunrise Estates");
});

for (const [mode, text] of [
  ["error", "Something went wrong on our side."],
  ["bad_gateway", "Something went wrong on our side."],
  ["broken", "Please try again"],
  ["bad_json", "This request could not be submitted. Please try again."],
] as const) {
  test(`failure (${mode}): generic message, no detail, form kept`, async ({ page, request }) => {
    await setAgency(request, mode);
    await open(page);
    await fill(page);
    await submit(page).click();
    await expect(page.getByTestId("form-notice")).toContainText(text);
    await expect(page.getByTestId("form-notice")).toBeFocused();
    await expect(page.locator("body")).not.toContainText(/Internal detail|Bad gateway|not json|ECONNRESET/);
    await expect(page.getByLabel("Office address")).toHaveValue(ADDRESS);
    await expect(submit(page)).toBeEnabled();
  });
}

test("timeout: its own message, button re-enabled, values kept", async ({ page, request }) => {
  await setAgency(request, "hang");
  await page.clock.install();
  await open(page);
  await fill(page);
  await submit(page).click();
  await expect(page.getByRole("button", { name: "Creating account…" })).toBeDisabled();
  await page.clock.runFor(21_000);
  await expect(page.getByTestId("form-notice")).toHaveText("The server took too long to answer. Please try again.");
  await expect(submit(page)).toBeEnabled();
  await expect(page.getByLabel("Business phone")).toHaveValue(PHONE);
});

test("double submit sends exactly one request and announces the busy state", async ({ page, request }) => {
  await setAgency(request, "hang");
  await open(page);
  await fill(page);
  await submit(page).click();
  await expect(page.getByRole("button", { name: "Creating account…" })).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText("Creating your agency account.");
  await page.evaluate(() => {
    const form = document.querySelector("form")!;
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect.poll(async () => (await lastAgency(request)).count).toBe(1);
  await page.waitForTimeout(500); // the count must stay at one, not just pass through it
  expect((await lastAgency(request)).count).toBe(1);
});

test("success state offers a different email: only email and password are cleared", async ({ page }) => {
  await open(page);
  await fill(page);
  await submit(page).click();
  await page.getByRole("button", { name: "Use a different email address" }).click();
  await expect(page.getByLabel("Business email")).toBeFocused();
  await expect(page.getByLabel("Business email")).toHaveValue("");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Agency name")).toHaveValue("Sunrise Estates");
  await expect(page.getByLabel("Business phone")).toHaveValue(PHONE);
  await expect(page.getByLabel("Office address")).toHaveValue(ADDRESS);
  await expect(page.getByLabel("City")).toHaveValue(KARACHI);
});

test("a multi-line address is sent as a single line", async ({ page, request }) => {
  await open(page);
  await fill(page);
  await page.getByLabel("Office address").fill("Office 12\r\nBlue Plaza,\n\tMain Boulevard");
  await expect(page.getByLabel("Office address")).toHaveValue("Office 12 Blue Plaza, Main Boulevard");
  await submit(page).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  expect((await lastAgency(request)).body.office_address).toBe("Office 12 Blue Plaza, Main Boulevard");
});

test("a 2xx other than 202 is not a success on either registration form", async ({ page, request }) => {
  await setAgency(request, "ok_200");
  await open(page);
  await fill(page);
  await submit(page).click();
  await expect(page.getByTestId("form-notice")).toContainText("This request could not be submitted.");
  await expect(page.getByRole("heading", { name: "Check your email" })).toHaveCount(0);
  await request.get(`${STUB}/__registration-mode?value=ok_200`);
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Ayesha Khan");
  await page.getByLabel("Email address").fill("ayesha@example.com");
  await page.getByLabel("Password", { exact: true }).fill(PASSPHRASE);
  await page.getByLabel("Phone number").fill(PHONE);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByTestId("form-notice")).toContainText("This request could not be submitted.");
  await expect(page.getByRole("heading", { name: "Check your email" })).toHaveCount(0);
});

test("the email field never shows an arbitrary server sentence", async ({ page, request }) => {
  await setAgency(request, "email_sentence");
  await open(page);
  await fill(page);
  await submit(page).click();
  await expect(page.locator("#email-error")).toContainText("Enter a valid email address.");
  await expect(page.locator("body")).not.toContainText("already registered");
});

test("forms that hold private values post natively, so nothing reaches a GET query before hydration", async ({ page, request }) => {
  for (const path of ["/register", "/register/agency", "/sign-in", "/forgot-password", "/reset-password?token=abc"]) {
    await page.goto(path);
    await expect(page.locator("form").first()).toHaveAttribute("method", /post/i);
  }
  await request.get(`${STUB}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
  await page.goto("/account/password");
  await expect(page.locator("form").first()).toHaveAttribute("method", /post/i);
});

test("password control toggles visibility with aria-pressed", async ({ page }) => {
  await open(page);
  const password = page.getByLabel("Password", { exact: true });
  const toggle = page.getByRole("button", { name: "Show password" });
  await expect(password).toHaveAttribute("type", "password");
  await toggle.click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(password).toHaveAttribute("type", "password");
});

async function scanPrivacy(page: Page, context: import("@playwright/test").BrowserContext, logs: string[]) {
  const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
  const cookies = JSON.stringify(await context.cookies());
  for (const secret of [PASSPHRASE, PHONE, EMAIL, ADDRESS, "Sunrise Estates"]) {
    expect(stored).not.toContain(secret);
    expect(cookies).not.toContain(secret);
    expect(logs.join("\n")).not.toContain(secret);
    expect(decodeURIComponent(page.url())).not.toContain(secret);
  }
}

for (const [mode, ready] of [
  ["accepted", (page: Page) => expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()],
  ["fields", (page: Page) => expect(page.locator("#agency_name")).toBeFocused()],
  ["rate_limited", (page: Page) => expect(page.getByTestId("form-notice")).toBeVisible()],
  ["error", (page: Page) => expect(page.getByTestId("form-notice")).toBeVisible()],
] as const) {
  test(`privacy (${mode}): no password, email, phone or address in storage, cookies, console or the URL`, async ({ page, context, request }) => {
    const logs: string[] = [];
    page.on("console", (message) => logs.push(message.text()));
    page.on("pageerror", (error) => logs.push(error.message));
    await setAgency(request, mode);
    await open(page);
    await fill(page);
    await submit(page).click();
    await ready(page);
    await scanPrivacy(page, context, logs);
  });
}

test("display name: a signed-in agency shows its agency name in the header and the dashboard", async ({ page, request }) => {
  await request.get(`${STUB}/__me-mode?value=agency`);
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("office@sunrise.example.com");
  await page.getByLabel("Password", { exact: true }).fill(PASSPHRASE);
  await page.getByRole("button", { name: "Sign in", exact: true }).and(page.locator("form button")).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("banner").getByTestId("account-name")).toHaveText("Sunrise Estates");
  await expect(page.getByTestId("dashboard-name")).toHaveText("Sunrise Estates");
  await expect(page.getByTestId("dashboard-type")).toHaveText("Account type: Agency");
});

async function signInAs(page: Page, request: APIRequestContext, meMode: string) {
  await request.get(`${STUB}/__me-mode?value=${meMode}`);
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("ayesha@example.com");
  await page.getByLabel("Password", { exact: true }).fill(PASSPHRASE);
  await page.getByRole("button", { name: "Sign in", exact: true }).and(page.locator("form button")).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

for (const [meMode, name, type] of [
  ["up", "Ayesha Khan", "Individual"],
  ["agency_no_name", "Ayesha Khan", "Agency"], // an agency with an empty agency_name falls back to the full name
  ["agency_bare", "ayesha@example.com", "Agency"], // then to the email
  ["admin", "Ayesha Khan", "Administrator"],
] as const) {
  test(`display name and type (${meMode}): ${name}, ${type}`, async ({ page, request }) => {
    await signInAs(page, request, meMode);
    await expect(page.getByRole("banner").getByTestId("account-name")).toHaveText(name);
    await expect(page.getByTestId("dashboard-name")).toHaveText(name);
    await expect(page.getByTestId("dashboard-type")).toHaveText(`Account type: ${type}`);
  });
}

const axeStates: Record<string, (page: Page, request: APIRequestContext) => Promise<void>> = {
  initial: async () => {},
  "cities unavailable": async (page, request) => {
    await setCities(request, "error");
    await page.reload();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  },
  "cities empty": async (page, request) => {
    await setCities(request, "empty");
    await page.reload();
    await expect(page.locator("#city-status")).toHaveText("No cities are available right now.");
  },
  "required errors": async (page) => {
    await submit(page).click();
    await expect(page.locator("#agency_name")).toBeFocused();
  },
  "server errors": async (page, request) => {
    await setAgency(request, "fields");
    await fill(page);
    await submit(page).click();
    await expect(page.locator("#agency_name")).toBeFocused();
  },
  "rate limited": async (page, request) => {
    await setAgency(request, "rate_limited");
    await fill(page);
    await submit(page).click();
    await expect(page.getByTestId("form-notice")).toBeVisible();
  },
  success: async (page) => {
    await fill(page);
    await submit(page).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  },
};

for (const viewport of viewports) {
  for (const [state, arrange] of Object.entries(axeStates)) {
    test(`axe: ${state} state at ${viewport.name} width has no violations`, async ({ page, request }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/register/agency");
      await expect(page.getByLabel("City")).toBeEnabled();
      await arrange(page, request);
      await expectNoViolations(page, state);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    });
  }
}
