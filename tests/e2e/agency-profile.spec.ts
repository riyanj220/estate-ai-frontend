import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const STUB = STUB_URL;
const APP = APP_URL;
// Obviously fake values, built from short words and repetitive digits so no scanner mistakes them for keys.
const PASSWORD = ["correct", "horse", "battery", "staple"].join(" ");
const EMAIL = "ayesha@example.com";
const NEW_EMAIL = "ayesha.new@example.com";
const NAME = "Sunrise Estates";
const NEW_NAME = "Sunset Estates";
const DESCRIPTION = "Residential sales and rentals.";
const PHONE = "+923211234567";
const NEW_PHONE = "+923001111111";
const ADDRESS = "Office 12, Blue Plaza, Main Boulevard";
const NEW_ADDRESS = "Shop 4, Green Market, Station Road";
const KARACHI = "11111111-1111-4111-8111-111111111111";
const LAHORE = "22222222-2222-4222-8222-222222222222";
const INACTIVE = "77777777-7777-4777-8777-777777777777";
const PROFILE = "/account/profile";
const THROTTLED = "Too many attempts. Try again in 2 minutes.";
const SERVER = "Something went wrong on our side. Please try again in a moment.";
const NETWORK = "We could not reach the server. Check your connection and try again.";
const TIMEOUT = "The server took too long to answer. Please try again.";
const REJECTED = "This request could not be submitted. Please try again.";
const GENERIC = "Enter a valid value.";
const SAVED = "Your business profile was saved.";
const PRIVACY =
  "Your business phone and office address are private. Only your agency name, description and city are shown publicly.";
const CONTACT_TEXT = "Descriptions cannot contain phone numbers, email addresses or street addresses.";
const pendingNote = (address: string) =>
  `We received a request to change to ${address}. If that address can be used, we sent it a confirmation link. Your sign-in address stays ${EMAIL} until you open the link.`;

// The stub backend holds module-level state: the config runs one worker (so tests never interleave) and every test
// starts from a reset stub, so the tests are independent and one failure does not skip the rest of the file.
test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

const setMode = (request: APIRequestContext, kind: string, value: string) => request.get(`${STUB}/__${kind}-mode?value=${value}`);
const last = async (request: APIRequestContext, kind: string) => (await request.get(`${STUB}/__last-${kind}`)).json();
const patches = async (request: APIRequestContext) => last(request, "agency-profile-patch");
const gets = async (request: APIRequestContext) => (await last(request, "agency-profile")).gets;
const header = (page: Page) => page.getByRole("banner");
const details = (page: Page) => page.getByRole("region", { name: "Business details" });
const emailSection = (page: Page) => page.getByRole("region", { name: "Sign-in email address" });
const summary = (section: ReturnType<typeof details>) => section.getByRole("group", { name: "There is a problem" });
const agencyName = (page: Page) => page.getByLabel("Agency name", { exact: true });
const description = (page: Page) => page.getByLabel("Description (optional)", { exact: true });
// The cities message. Scoped to its own element: the same words are also announced in the sr-only live region
// (set 50 ms after the load), so a page-wide getByText matches one element before that and two after it.
const cityStatus = (page: Page) => page.locator("#city-status");
const city = (page: Page) => page.getByLabel("City", { exact: true });
const phone = (page: Page) => page.getByLabel("Business phone", { exact: true });
const address = (page: Page) => page.getByLabel("Office address", { exact: true });
const newEmail = (page: Page) => page.getByLabel("New email address", { exact: true });
const password = (page: Page) => page.getByLabel("Current password", { exact: true });
const saveButton = (page: Page) => page.getByRole("button", { name: /^(Save changes|Saving…)$/ });
const requestButton = (page: Page) => page.getByRole("button", { name: /^(Change email address|Requesting…)$/ });
const success = (page: Page) => page.getByTestId("details-success");
const notice = (page: Page) => page.getByTestId("details-notice");

const gate = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => (release = resolve));
  return { promise, release };
};

async function expectNoViolations(page: Page, label: string) {
  await expect(page).toHaveTitle(/.+/); // the title can stream in after the body on a production server
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

/** Signs in as an Agency and opens the business profile with the form loaded. */
async function openProfile(page: Page, request: APIRequestContext) {
  await setMode(request, "me", "agency");
  await signIn(page, PROFILE);
  await expect(page.getByRole("heading", { level: 1, name: "Business profile" })).toBeVisible();
  await expect(agencyName(page)).toBeVisible();
  await expect(city(page)).toBeEnabled();
}

/** The text of the page outside form controls (input, textarea and select values are the private place). */
const textOutsideControls = (page: Page) =>
  page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("input, textarea, select, script").forEach((node) => node.remove());
    return clone.textContent ?? "";
  });

// ---------------------------------------------------------------- one route, two bodies, links and guard

test("an Agency sees the business profile: prefilled form, email section, verification status and privacy note @smoke", async ({ page, request }) => {
  await openProfile(page, request);
  await expect(agencyName(page)).toHaveValue(NAME);
  await expect(agencyName(page)).toHaveAttribute("autocomplete", "organization");
  await expect(description(page)).toHaveValue(DESCRIPTION);
  await expect(description(page)).not.toHaveAttribute("maxlength"); // a long paste is not truncated; the server limits
  await expect(city(page)).toHaveValue(KARACHI);
  await expect(phone(page)).toHaveValue(PHONE);
  await expect(phone(page)).toHaveAttribute("autocomplete", "tel");
  await expect(address(page)).toHaveValue(ADDRESS);
  await expect(address(page)).toHaveAttribute("maxlength", "300");
  await expect(page.getByTestId("privacy-note")).toHaveText(PRIVACY);
  await expect(page.getByTestId("verification-status")).toHaveText("Agency verification: Unverified");
  await expect(page.getByTestId("current-email")).toHaveText(EMAIL);
  await expect(page.getByTestId("pending-email")).toHaveCount(0);
  await expect(newEmail(page)).toBeVisible();
  // Nothing about the email or the verification status is editable on the details form.
  await expect(page.getByLabel(/verification/i)).toHaveCount(0);
  await expect(details(page).getByLabel(/email/i)).toHaveCount(0);
  expect(await gets(request)).toBe(1);
});

test("the Individual page is unchanged and never reads the agency profile @smoke", async ({ page, request }) => {
  await signIn(page, PROFILE);
  await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("Ayesha Khan");
  await expect(page.getByLabel("Agency name")).toHaveCount(0);
  expect(await gets(request)).toBe(0);
});

test("an Admin gets the polite message, no form and no Profile link @smoke", async ({ page, request }) => {
  await setMode(request, "me", "admin");
  await signIn(page, PROFILE);
  await expect(page.getByTestId("profile-unavailable")).toHaveText("Profile editing is available for individual and agency accounts.");
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^(Business profile|Profile)$/ })).toHaveCount(0);
  expect(await gets(request)).toBe(0);
  expect((await last(request, "profile")).gets).toBe(0);
});

test("the header and dashboard link an Agency to the Business profile @smoke", async ({ page, request }) => {
  await setMode(request, "me", "agency");
  await signIn(page);
  await expect(header(page).getByRole("link", { name: "Business profile", exact: true })).toHaveAttribute("href", PROFILE);
  await expect(page.getByRole("banner").getByRole("link", { name: "Business profile", exact: true })).toHaveAttribute("href", PROFILE);
  await expect(page.getByRole("link", { name: "Profile", exact: true })).toHaveCount(0);
  await header(page).getByRole("link", { name: "Business profile", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/profile$/);
  await expect(page.getByRole("heading", { level: 1, name: "Business profile" })).toBeVisible();
});

test("guard: a Visitor is redirected to sign in with next and sees no content", async ({ page, request }) => {
  const raw = await request.get(`${APP}${PROFILE}`, { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(raw.status());
  expect(raw.headers().location).toContain("/sign-in?next=%2Faccount%2Fprofile");
  const body = await raw.text();
  expect(body).not.toContain("Business phone");
  expect(body).not.toContain(PHONE);
  await page.goto(PROFILE);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fprofile$/);
  await expect(page.getByLabel("Business phone")).toHaveCount(0);
});

test("the route is not cacheable for an Agency", async ({ page, request }) => {
  await setMode(request, "me", "agency");
  await signIn(page);
  const response = await page.goto(PROFILE);
  expect(response?.headers()["cache-control"]).toContain("no-store");
});

// ---------------------------------------------------------------- load

test("verification status is driven by the server value only", async ({ page, request }) => {
  await setMode(request, "agency-profile", "verified");
  await setMode(request, "me", "agency");
  await signIn(page, PROFILE);
  await expect(page.getByTestId("verification-status")).toHaveText("Agency verification: Verified");
  await setMode(request, "agency-profile", "odd_status");
  await page.reload();
  await expect(page.getByTestId("verification-status")).toHaveText("Agency verification: Unknown");
  await expect(page.locator("body")).not.toContainText("Odd Status");
});

test("a pending address shows the plain note after the email request", async ({ page, request }) => {
  await openProfile(page, request);
  await newEmail(page).fill(NEW_EMAIL);
  await password(page).fill(PASSWORD);
  await requestButton(page).click();
  await expect(page.getByTestId("email-sent")).toHaveText(
    "If that address can be used, we have sent it a confirmation link. Your sign-in address does not change until you open it.",
  );
  expect((await last(request, "email-change")).body).toEqual({ new_email: NEW_EMAIL, current_password: PASSWORD });
  await expect(page.getByTestId("pending-email")).toHaveText(pendingNote(NEW_EMAIL));
  await expect.poll(() => gets(request)).toBeGreaterThanOrEqual(2); // re-read after the accepted request
  await page.reload();
  await expect(page.getByTestId("pending-email")).toHaveText(pendingNote(NEW_EMAIL));
});

test("email request errors map to text in the email section and clear the password", async ({ page, request }) => {
  await openProfile(page, request);
  await setMode(request, "email-change", "wrong_password");
  await newEmail(page).fill(NEW_EMAIL);
  await password(page).fill(PASSWORD);
  await requestButton(page).click();
  await expect(summary(emailSection(page))).toContainText("Current password: The current password is not correct.");
  await expect(password(page)).toHaveValue("");
  await expect(summary(details(page))).toHaveCount(0);
});

test("load failure: a message with Retry, nothing editable, Retry loads the form and focuses the heading", async ({ page, request }) => {
  await setMode(request, "agency-profile", "flaky");
  await setMode(request, "me", "agency");
  await signIn(page, PROFILE);
  await expect(page.getByRole("heading", { name: "We could not load your business profile" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Internal detail");
  await expect(agencyName(page)).toHaveCount(0);
  await expect(newEmail(page)).toHaveCount(0);
  const retry = page.getByRole("main").getByRole("button", { name: "Retry" });
  const held = gate();
  await page.route("**/api/v1/me/agency-profile", async (route) => {
    await held.promise;
    await route.continue();
  });
  await retry.click();
  await expect(retry).toHaveAttribute("aria-disabled", "true"); // stays mounted while reloading
  held.release();
  await expect(agencyName(page)).toHaveValue(NAME);
  await expect(page.getByRole("heading", { name: "Business details" })).toBeFocused();
});

for (const mode of ["error", "broken", "malformed"]) {
  test(`load failure (${mode}) shows the retry state`, async ({ page, request }) => {
    await setMode(request, "agency-profile", mode);
    await setMode(request, "me", "agency");
    await signIn(page, PROFILE);
    await expect(page.getByRole("main").getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(agencyName(page)).toHaveCount(0);
  });
}

test("load failure: a hung request times out into the retry state", async ({ page, request }) => {
  await setMode(request, "agency-profile", "hang");
  await setMode(request, "me", "agency");
  await signIn(page, "/dashboard");
  await page.clock.install();
  await page.goto(PROFILE);
  await expect(page.getByTestId("profile-loading")).toBeVisible();
  await page.clock.runFor(21_000);
  await expect(page.getByRole("main").getByRole("button", { name: "Retry" })).toBeVisible();
});

test("wrong account type: polite message and no form", async ({ page, request }) => {
  await setMode(request, "agency-profile", "forbidden");
  await setMode(request, "me", "agency");
  await signIn(page, PROFILE);
  await expect(page.getByTestId("profile-forbidden")).toHaveText("Business profile editing is available for agency accounts.");
  await expect(page.locator("form")).toHaveCount(0);
});

test("session gone on load: signed out and sent to sign in with next", async ({ page, request }) => {
  await setMode(request, "me", "agency");
  await signIn(page, "/dashboard");
  await setMode(request, "agency-profile", "session_gone");
  await page.goto(PROFILE);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fprofile$/);
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("the profile re-reads silently on focus and visibility; a failure keeps the form and typing", async ({ page, request }) => {
  await openProfile(page, request);
  const base = await gets(request);
  await agencyName(page).fill(NEW_NAME);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => gets(request)).toBeGreaterThan(base);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => gets(request)).toBeGreaterThan(base + 1);
  await expect(page.getByTestId("profile-loading")).toHaveCount(0);
  await expect(agencyName(page)).toHaveValue(NEW_NAME);
  await setMode(request, "agency-profile", "error"); // also resets the read count
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => gets(request)).toBeGreaterThan(0); // the failing read really happened
  await expect(agencyName(page)).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Retry" })).toHaveCount(0);
});

// ---------------------------------------------------------------- cities

test("cities: the select lists the server cities and preselects the stored one", async ({ page, request }) => {
  await openProfile(page, request);
  await expect(city(page).locator("option")).toHaveText(["Select a city", "Karachi", "Lahore", "Islamabad"]);
  await expect(city(page)).toHaveValue(KARACHI);
});

test("cities: a failed load shows a message with Retry, keeps the stored city and the other edits saveable, Retry fills the list", async ({ page, request }) => {
  await setMode(request, "cities", "error");
  await openProfile(page, request);
  await expect(cityStatus(page)).toContainText("We could not load the list of cities.");
  await expect(city(page).locator("option:checked")).toHaveText("Current city");
  await agencyName(page).fill(NEW_NAME);
  await saveButton(page).click();
  await expect(success(page)).toHaveText(SAVED);
  expect((await patches(request)).body).toEqual({ agency_name: NEW_NAME }); // the city is not sent
  await setMode(request, "cities", "ok");
  await page.locator("#city-retry").click();
  await expect(city(page).locator("option")).toHaveText(["Select a city", "Karachi", "Lahore", "Islamabad"]);
  await expect(city(page)).toHaveValue(KARACHI);
  await expect(city(page)).toBeFocused();
  await expect(cityStatus(page)).not.toContainText("We could not load the list of cities.");
});

test("cities: an empty list says so and the stored city stays as the current one", async ({ page, request }) => {
  await setMode(request, "cities", "empty");
  await openProfile(page, request);
  await expect(cityStatus(page)).toHaveText("No cities are available right now.");
  await expect(city(page)).toHaveValue(KARACHI);
  await expect(city(page).locator("option:checked")).toHaveText("Current city (no longer available)");
});

test("stored city inactive: shown as a disabled current option, other edits save, the city is only sent when changed", async ({ page, request }) => {
  await setMode(request, "agency-profile", "inactive_city");
  await openProfile(page, request);
  await expect(city(page)).toHaveValue(INACTIVE);
  const current = city(page).locator("option", { hasText: "Current city (no longer available)" });
  await expect(current).toBeDisabled();
  await expect(city(page).locator("option:checked")).toHaveText("Current city (no longer available)");
  await agencyName(page).fill(NEW_NAME);
  await saveButton(page).click();
  await expect(success(page)).toBeVisible();
  expect((await patches(request)).body).toEqual({ agency_name: NEW_NAME });
  await expect(city(page)).toHaveValue(INACTIVE);
  await city(page).selectOption(LAHORE);
  await saveButton(page).click();
  await expect.poll(async () => (await patches(request)).count).toBe(2);
  expect((await patches(request)).body).toEqual({ city_id: LAHORE });
  await expect(success(page)).toBeVisible();
  await expect(city(page).locator("option", { hasText: "Current city" })).toHaveCount(0);
});

test("stored city missing from another list is shown as the current city", async ({ page, request }) => {
  await setMode(request, "cities", "other");
  await openProfile(page, request);
  await expect(city(page).locator("option")).toHaveText(["Select a city", "Current city (no longer available)", "Multan", "Peshawar"]);
  await expect(city(page)).toHaveValue(KARACHI);
});

// ---------------------------------------------------------------- saving

test("save: only the changed field is sent with the CSRF token; success; baseline and header refreshed", async ({ page, request }) => {
  await openProfile(page, request);
  await agencyName(page).fill(`  ${NEW_NAME}  `);
  await saveButton(page).click();
  await expect(success(page)).toHaveText(SAVED);
  expect(await patches(request)).toMatchObject({ count: 1, body: { agency_name: NEW_NAME } });
  expect((await patches(request)).token).toMatch(/^csrf-\d$/);
  await expect(agencyName(page)).toHaveValue(NEW_NAME);
  await expect(header(page).getByTestId("account-name")).toHaveText(NEW_NAME);
  // The baseline moved: saving the same values again sends nothing.
  await saveButton(page).click();
  await expect(page.getByTestId("details-unchanged")).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(1);
});

test("save: every field changed sends exactly those fields; the answer refreshes the form", async ({ page, request }) => {
  await openProfile(page, request);
  await agencyName(page).fill(NEW_NAME);
  await description(page).fill("Line one\nLine two");
  await city(page).selectOption(LAHORE);
  await phone(page).fill(NEW_PHONE);
  await address(page).fill(NEW_ADDRESS);
  await saveButton(page).click();
  await expect(success(page)).toBeVisible();
  expect((await patches(request)).body).toEqual({
    agency_name: NEW_NAME,
    description: "Line one\nLine two",
    city_id: LAHORE,
    business_phone: NEW_PHONE,
    office_address: NEW_ADDRESS,
  });
  await expect(description(page)).toHaveValue("Line one Line two"); // the server collapses whitespace
  await expect(city(page)).toHaveValue(LAHORE);
  await expect(phone(page)).toHaveValue(NEW_PHONE);
  await page.reload();
  await expect(description(page)).toHaveValue("Line one Line two");
  await expect(address(page)).toHaveValue(NEW_ADDRESS);
});

test("clear description: an empty string is sent and saved", async ({ page, request }) => {
  await openProfile(page, request);
  await description(page).fill("");
  await saveButton(page).click();
  await expect(success(page)).toBeVisible();
  expect((await patches(request)).body).toEqual({ description: "" });
  await page.reload();
  await expect(description(page)).toHaveValue("");
  await expect(page.getByTestId("description-count")).toHaveText("0 of 1000 characters");
});

test("nothing changed: no request and a polite note; whitespace around a value is not a change", async ({ page, request }) => {
  await openProfile(page, request);
  await saveButton(page).click();
  await expect(page.getByTestId("details-unchanged")).toHaveText("No changes to save.");
  await agencyName(page).fill(`  ${NAME} `);
  await saveButton(page).click();
  await expect(agencyName(page)).toHaveValue(NAME);
  expect((await patches(request)).count).toBe(0);
});

test("description counter is plain text, not a live region, and the address collapses newlines", async ({ page, request }) => {
  await openProfile(page, request);
  const count = page.getByTestId("description-count");
  await description(page).fill("abc");
  await expect(count).toHaveText("3 of 1000 characters");
  expect(await count.evaluate((node) => node.closest("[aria-live], [role=status], [role=alert]") === null)).toBe(true);
  await expect(description(page)).toHaveAccessibleDescription(/3 of 1000 characters/);
  await address(page).fill("Line one\nLine two");
  await expect(address(page)).toHaveValue("Line one Line two");
});

test("edit after save clears the success note", async ({ page, request }) => {
  await openProfile(page, request);
  await agencyName(page).fill(NEW_NAME);
  await saveButton(page).click();
  await expect(success(page)).toBeVisible();
  await phone(page).fill(NEW_PHONE);
  await expect(success(page)).toHaveCount(0);
});

test("typing while a save is in flight is not overwritten by the answer", async ({ page, request }) => {
  await openProfile(page, request);
  const held = gate();
  await page.route("**/api/v1/me/agency-profile", async (route) => {
    if (route.request().method() === "PATCH") await held.promise;
    await route.continue();
  });
  await agencyName(page).fill(NEW_NAME);
  await saveButton(page).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await phone(page).fill(NEW_PHONE);
  held.release();
  await expect(success(page)).toBeVisible();
  await expect(phone(page)).toHaveValue(NEW_PHONE);
  await expect(agencyName(page)).toHaveValue(NEW_NAME);
  // The typed phone is still a change against the saved baseline.
  await saveButton(page).click();
  await expect.poll(async () => (await patches(request)).count).toBe(2);
  expect((await patches(request)).body).toEqual({ business_phone: NEW_PHONE });
});

test("a 2xx with an unreadable body is a polite saved-reload note and the profile is re-read", async ({ page, request }) => {
  await openProfile(page, request);
  await setMode(request, "agency-profile-patch", "empty_ok");
  await agencyName(page).fill(NEW_NAME);
  await saveButton(page).click();
  await expect(success(page)).toHaveText(`${SAVED} We could not read the updated values back; reload the page to see them.`);
  await expect(notice(page)).toHaveCount(0);
  await expect(summary(details(page))).toHaveCount(0);
  await expect(agencyName(page)).toHaveValue(NEW_NAME);
  await expect.poll(() => gets(request)).toBeGreaterThanOrEqual(2);
  await expect(header(page).getByTestId("account-name")).toHaveText(NEW_NAME);
  await saveButton(page).click();
  await expect(page.getByTestId("details-unchanged")).toBeVisible();
});

// ---------------------------------------------------------------- validation

test("blank name, phone, address: client required errors, summary focused, no request", async ({ page, request }) => {
  await openProfile(page, request);
  await agencyName(page).fill("   ");
  await phone(page).fill("");
  await address(page).fill("");
  await saveButton(page).click();
  const box = summary(details(page));
  await expect(box).toBeFocused();
  await expect(box.getByRole("link", { name: /Agency name: Enter the agency name\./ })).toBeVisible();
  await expect(box.getByRole("link", { name: /Business phone: Enter the business phone number\./ })).toBeVisible();
  await expect(box.getByRole("link", { name: /Office address: Enter the office address\./ })).toBeVisible();
  await expect(phone(page)).toHaveAttribute("aria-invalid", "true");
  expect((await patches(request)).count).toBe(0);
  await box.getByRole("link", { name: /^Business phone/ }).click();
  await expect(phone(page)).toBeFocused();
  // The description is the one optional field.
  await expect(description(page)).not.toHaveAttribute("aria-invalid", "true");
});

test("server required codes are mapped too", async ({ page, request }) => {
  await openProfile(page, request);
  await setMode(request, "agency-profile-patch", "required");
  await agencyName(page).fill(NEW_NAME);
  await saveButton(page).click();
  const box = summary(details(page));
  await expect(box).toContainText("Agency name: Enter the agency name.");
  await expect(box).toContainText("City: Select a city.");
  await expect(box).toContainText("Business phone: Enter the business phone number.");
  await expect(box).toContainText("Office address: Enter the office address.");
});

test("contact details in the description: the explanation shows under the field and the text is kept", async ({ page, request }) => {
  await openProfile(page, request);
  await setMode(request, "agency-profile-patch", "contact");
  await description(page).fill("Call us on 0300 1234567");
  await saveButton(page).click();
  const box = summary(details(page));
  await expect(box).toBeFocused();
  await expect(box).toContainText(CONTACT_TEXT);
  await expect(box).toContainText("kept private");
  await expect(description(page)).toHaveAccessibleDescription(new RegExp(CONTACT_TEXT.replaceAll(".", "\\.")));
  await expect(description(page)).toHaveAttribute("aria-invalid", "true");
  await expect(description(page)).toHaveValue("Call us on 0300 1234567");
  await expect(page.locator("body")).not.toContainText("contains_contact_details");
});

test("other 400 codes map to text against their fields; values are kept", async ({ page, request }) => {
  await openProfile(page, request);
  await setMode(request, "agency-profile-patch", "fields");
  await agencyName(page).fill("A1");
  await phone(page).fill("123");
  await address(page).fill("x");
  await saveButton(page).click();
  const box = summary(details(page));
  await expect(box).toBeFocused();
  await expect(box).toContainText("Agency name: Enter a valid agency name. It is shown publicly, so it cannot contain contact details.");
  await expect(box).toContainText("Business phone: Enter a valid Pakistani mobile or international number.");
  await expect(box).toContainText("Office address: Enter a valid office address.");
  await expect(box).toContainText("City: Select a city.");
  await expect(agencyName(page)).toHaveAccessibleDescription(/cannot contain contact details/);
  await expect(agencyName(page)).toHaveValue("A1");
  await expect(phone(page)).toHaveValue("123");
  await expect(page.locator("body")).not.toContainText("invalid_name");
  await setMode(request, "agency-profile-patch", "description_codes");
  await saveButton(page).click();
  await expect(box).toContainText("Description: Enter a valid description (up to 1000 characters");
  await expect(box).toContainText("Enter a valid description.");
});

test("invalid_city clears the selection, re-fetches the cities and shows the error; a blank city then needs a choice", async ({ page, request }) => {
  await openProfile(page, request);
  await city(page).selectOption(LAHORE);
  await setMode(request, "agency-profile-patch", "invalid_city");
  const before = (await last(request, "cities")).count;
  await saveButton(page).click();
  const box = summary(details(page));
  await expect(box).toContainText("City: That city is no longer available. Select another city.");
  await expect(city(page)).toHaveValue("");
  await expect.poll(async () => (await last(request, "cities")).count).toBeGreaterThan(before);
  await expect(city(page)).toBeFocused();
  // Saving with the city still blank is a client error and sends nothing more.
  await setMode(request, "agency-profile-patch", "ok");
  await agencyName(page).fill(NEW_NAME);
  await saveButton(page).click();
  await expect(box).toContainText("City: Select a city.");
  expect((await patches(request)).count).toBe(1);
  await city(page).selectOption(KARACHI);
  await saveButton(page).click();
  await expect(success(page)).toBeVisible();
  expect((await patches(request)).body).toEqual({ agency_name: NEW_NAME });
});

test("server sentences, unknown codes, prototype keys and unknown field keys are never shown raw", async ({ page, request }) => {
  await openProfile(page, request);
  await agencyName(page).fill(NEW_NAME);
  await setMode(request, "agency-profile-patch", "sentences");
  await saveButton(page).click();
  const box = summary(details(page));
  await expect(box).toContainText(`Agency name: ${GENERIC}`);
  await expect(box).toContainText(`Description: ${GENERIC}`);
  await expect(box).toContainText(REJECTED); // the unknown key
  for (const raw of ["Enter a valid name.", "Some server sentence.", "mystery_code"]) {
    await expect(page.locator("body")).not.toContainText(raw);
  }
  await setMode(request, "agency-profile-patch", "proto");
  await saveButton(page).click();
  await expect(box).toContainText(`Agency name: ${GENERIC}`);
  await expect(box).toContainText(`Description: ${GENERIC}`);
  await expect(page.locator("body")).not.toContainText(/constructor|__proto__|toString|\[object|function/);
  await setMode(request, "agency-profile-patch", "unknown_code");
  await saveButton(page).click();
  await expect(box).toContainText(`Business phone: ${GENERIC}`);
  await setMode(request, "agency-profile-patch", "non_field");
  await saveButton(page).click();
  await expect(box).toContainText("The form sent something unexpected. Reload the page and try again.");
  await expect(page.locator("body")).not.toContainText("unknown_field");
  await setMode(request, "agency-profile-patch", "empty_fields");
  await saveButton(page).click();
  await expect(box).toContainText(REJECTED);
});

// ---------------------------------------------------------------- failures

test("save failures: 429, 5xx, network, second 403 each have their own message and keep the values", async ({ page, request }) => {
  await openProfile(page, request);
  await agencyName(page).fill(NEW_NAME);
  await setMode(request, "agency-profile-patch", "rate_limited");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(THROTTLED);
  await expect(notice(page)).toBeFocused();
  await setMode(request, "agency-profile-patch", "error");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(SERVER);
  await expect(page.locator("body")).not.toContainText("Internal detail");
  await setMode(request, "agency-profile-patch", "csrf_always");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(REJECTED);
  await setMode(request, "agency-profile-patch", "forbidden");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(REJECTED);
  await setMode(request, "agency-profile-patch", "ok");
  await page.route("**/api/v1/me/agency-profile", (route) => (route.request().method() === "PATCH" ? route.abort() : route.continue()));
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(NETWORK);
  await page.unroute("**/api/v1/me/agency-profile");
  await expect(agencyName(page)).toHaveValue(NEW_NAME);
  await expect(saveButton(page)).toBeEnabled();
  await saveButton(page).click();
  await expect(success(page)).toBeVisible();
});

test("save: a hung request times out into its own message", async ({ page, request }) => {
  await openProfile(page, request);
  await agencyName(page).fill(NEW_NAME);
  await setMode(request, "agency-profile-patch", "hang");
  await page.clock.install();
  await saveButton(page).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await page.clock.runFor(21_000);
  await expect(notice(page)).toHaveText(TIMEOUT);
});

test("save: CSRF self-heal refetches the token and retries once", async ({ page, request }) => {
  await openProfile(page, request);
  await agencyName(page).fill(NEW_NAME);
  await setMode(request, "agency-profile-patch", "csrf_once");
  await saveButton(page).click();
  await expect(success(page)).toBeVisible();
  expect((await patches(request)).count).toBe(2);
});

test("save: a failing CSRF fetch sends nothing", async ({ page, request }) => {
  await openProfile(page, request);
  await agencyName(page).fill(NEW_NAME);
  await setMode(request, "csrf", "rate_limited");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(THROTTLED);
  expect((await patches(request)).count).toBe(0);
});

test("save: 401 signs out and goes to sign in with next", async ({ page, request }) => {
  await openProfile(page, request);
  await agencyName(page).fill(NEW_NAME);
  await setMode(request, "agency-profile-patch", "session_gone");
  await saveButton(page).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fprofile$/);
});

test("save: double submit sends exactly one request", async ({ page, request }) => {
  await openProfile(page, request);
  await agencyName(page).fill(NEW_NAME);
  await setMode(request, "agency-profile-patch", "hang");
  await saveButton(page).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await page.evaluate(() => {
    const form = document.querySelectorAll("form")[0];
    form.requestSubmit();
    form.requestSubmit();
  });
  await page.waitForTimeout(300);
  expect((await patches(request)).count).toBe(1);
});

test("the two forms are independent: each has its own summary and unique ids", async ({ page, request }) => {
  await openProfile(page, request);
  await phone(page).fill("");
  await saveButton(page).click();
  await requestButton(page).click();
  await expect(summary(details(page))).toBeVisible();
  await expect(summary(emailSection(page))).toBeVisible();
  const ids = await page.evaluate(() => [...document.querySelectorAll("[id]")].map((node) => node.id));
  expect(new Set(ids).size).toBe(ids.length);
  expect((await patches(request)).count).toBe(0);
  expect((await last(request, "email-change")).count).toBe(0);
});

test("an unsaved edit survives a successful email request", async ({ page, request }) => {
  await openProfile(page, request);
  await agencyName(page).fill(NEW_NAME);
  await newEmail(page).fill(NEW_EMAIL);
  await password(page).fill(PASSWORD);
  await requestButton(page).click();
  await expect(page.getByTestId("email-sent")).toBeVisible();
  await expect(page.getByTestId("pending-email")).toBeVisible();
  await expect(agencyName(page)).toHaveValue(NEW_NAME);
});


// ---------------------------------------------------------------- re-reads, baseline and announcements

const setServer = (request: APIRequestContext, query: string) => request.get(`${STUB}/__agency-profile-set?${query}`);
const focusEvent = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("focus")));

test("a focus re-read after the server changed updates untouched fields and keeps edited ones; a retyped old value is then sent", async ({ page, request }) => {
  await openProfile(page, request);
  await agencyName(page).fill(NEW_NAME); // edited: must survive
  await setServer(request, `business_phone=${encodeURIComponent(NEW_PHONE)}&description=${encodeURIComponent("Updated elsewhere.")}`);
  const base = await gets(request);
  await focusEvent(page);
  await expect.poll(() => gets(request)).toBeGreaterThan(base);
  await expect(phone(page)).toHaveValue(NEW_PHONE);
  await expect(description(page)).toHaveValue("Updated elsewhere.");
  await expect(agencyName(page)).toHaveValue(NEW_NAME);
  // The baseline moved too: putting the old phone back is a change and is sent.
  await phone(page).fill(PHONE);
  await saveButton(page).click();
  await expect(success(page)).toBeVisible();
  expect((await patches(request)).body).toEqual({ agency_name: NEW_NAME, business_phone: PHONE });
});

test("an unreadable 2xx: the re-read brings the server's normalised values and nothing is assumed from what was sent", async ({ page, request }) => {
  await openProfile(page, request);
  await setMode(request, "agency-profile-patch", "empty_ok");
  await description(page).fill("Two  spaces here");
  await saveButton(page).click();
  await expect(success(page)).toContainText("reload the page to see them");
  await expect(description(page)).toHaveValue("Two spaces here"); // collapsed by the server, shown after the re-read
  await saveButton(page).click();
  await expect(page.getByTestId("details-unchanged")).toBeVisible();
  expect((await patches(request)).count).toBe(1);
});

test("an inactive stored city survives a Retry, a reload and invalid_city; other edits still save", async ({ page, request }) => {
  await setMode(request, "agency-profile", "inactive_city");
  await setMode(request, "cities", "error");
  await openProfile(page, request);
  await setMode(request, "cities", "ok");
  await page.locator("#city-retry").click();
  const current = city(page).locator("option", { hasText: "Current city (no longer available)" });
  await expect(current).toBeDisabled();
  await expect(city(page)).toHaveValue(INACTIVE);
  await agencyName(page).fill(NEW_NAME);
  await saveButton(page).click();
  await expect(success(page)).toBeVisible();
  expect((await patches(request)).body).toEqual({ agency_name: NEW_NAME });
  await page.reload();
  await expect(city(page)).toHaveValue(INACTIVE);
  await expect(city(page).locator("option", { hasText: "Current city (no longer available)" })).toBeDisabled();
  // invalid_city after picking another city: the pick is cleared, the current city stays listed, edits still save.
  await city(page).selectOption(LAHORE);
  await setMode(request, "agency-profile-patch", "invalid_city");
  await saveButton(page).click();
  await expect(summary(details(page))).toContainText("That city is no longer available");
  await expect(city(page)).toHaveValue("");
  await expect(city(page).locator("option", { hasText: "Current city (no longer available)" })).toHaveCount(1);
  await setMode(request, "agency-profile-patch", "ok");
  await city(page).selectOption(KARACHI);
  await saveButton(page).click();
  await expect(success(page)).toBeVisible();
  expect((await patches(request)).body).toEqual({ city_id: KARACHI });
});

test("saving with no changes twice re-announces the note each time", async ({ page, request }) => {
  await openProfile(page, request);
  const status = details(page).locator("p[role=status]").first();
  await status.evaluate((node) => {
    const w = window as unknown as { __mutations: number };
    w.__mutations = 0;
    new MutationObserver((list) => (w.__mutations += list.length)).observe(node, { childList: true, characterData: true, subtree: true });
  });
  const mutations = () => page.evaluate(() => (window as unknown as { __mutations: number }).__mutations);
  await saveButton(page).click();
  await expect(status).toHaveText("No changes to save.");
  const first = await mutations();
  await saveButton(page).click();
  await expect.poll(mutations).toBeGreaterThan(first + 1); // cleared, then set again
  await expect(status).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(0);
});

test("a selected city dropped by a reloaded list is announced", async ({ page, request }) => {
  const ISLAMABAD = "33333333-3333-4333-8333-333333333333";
  await openProfile(page, request);
  await city(page).selectOption(LAHORE);
  await setMode(request, "agency-profile-patch", "invalid_city");
  const held = gate();
  await page.route("**/api/v1/reference/cities", async (route) => {
    await held.promise;
    // The reloaded list no longer has Islamabad.
    await route.fulfill({ json: { items: [{ id: KARACHI, name: "Karachi" }, { id: LAHORE, name: "Lahore" }] } });
  });
  await saveButton(page).click();
  await expect(city(page)).toHaveValue(""); // invalid_city cleared the choice; the list is being re-fetched
  await city(page).selectOption(ISLAMABAD); // picked from the old list while the reload is in flight
  held.release();
  await expect(city(page).locator("option")).toHaveText(["Select a city", "Karachi", "Lahore"]);
  await expect(city(page)).toHaveValue("");
  await expect(details(page).locator("p[role=status]").first()).toHaveText("Your selected city is no longer available. Select a city.");
});

test("editing a field clears its own error only", async ({ page, request }) => {
  await openProfile(page, request);
  await setMode(request, "agency-profile-patch", "fields");
  await agencyName(page).fill("A1");
  await phone(page).fill("123");
  await saveButton(page).click();
  const box = summary(details(page));
  await expect(box).toContainText("Agency name:");
  await expect(box).toContainText("Business phone:");
  await agencyName(page).fill("A12");
  await expect(box).not.toContainText("Agency name:");
  await expect(agencyName(page)).not.toHaveAttribute("aria-invalid", "true");
  await expect(box).toContainText("Business phone:");
  await expect(phone(page)).toHaveAttribute("aria-invalid", "true");
});

test("the description counter counts code points after whitespace collapse, and a long paste is kept with an over-limit hint", async ({ page, request }) => {
  await openProfile(page, request);
  const count = page.getByTestId("description-count");
  await description(page).fill("a  b\n\nc");
  await expect(count).toHaveText("5 of 1000 characters");
  await description(page).fill("😀😀😀"); // three code points, six UTF-16 units
  await expect(count).toHaveText("3 of 1000 characters");
  const long = "a".repeat(1005);
  await description(page).fill(long);
  await expect(description(page)).toHaveValue(long);
  await expect(count).toHaveText("1005 of 1000 characters That is over the limit. Shorten it before saving.");
});

test("privacy: SPA navigation never puts the phone or address in the header or page markup", async ({ page, request }) => {
  await openProfile(page, request);
  const markup = () =>
    page.evaluate(() => {
      const clone = document.documentElement.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("input, textarea, select, script").forEach((node) => node.remove());
      return clone.outerHTML;
    });
  const check = async () => {
    const html = await markup();
    for (const secret of [PHONE, ADDRESS]) expect(html).not.toContain(secret);
  };
  await check();
  await header(page).getByRole("link", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/account\/password$/);
  await check();
  await header(page).getByRole("link", { name: "EstateAI" }).click();
  await check();
  await header(page).getByRole("link", { name: "Business profile", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Business profile" })).toBeVisible();
  await expect(phone(page)).toHaveValue(PHONE);
  await check();
});

// ---------------------------------------------------------------- privacy

test("privacy: the phone and address are only in the form inputs, never in the header or the dashboard", async ({ page, request }) => {
  await openProfile(page, request);
  const outside = await textOutsideControls(page);
  for (const secret of [PHONE, ADDRESS]) expect(outside).not.toContain(secret);
  await expect(header(page)).not.toContainText(PHONE);
  await expect(header(page)).not.toContainText(ADDRESS);
  await page.goto("/dashboard");
  await expect(page.getByTestId("dashboard-name")).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain(PHONE);
  expect(await page.locator("body").innerText()).not.toContain(ADDRESS);
  expect(await textOutsideControls(page)).not.toContain(ADDRESS);
});

for (const [label, arrange] of [
  ["a contact-details error", (request: APIRequestContext) => setMode(request, "agency-profile-patch", "contact")],
  ["a field error", (request: APIRequestContext) => setMode(request, "agency-profile-patch", "fields")],
  ["a 5xx", (request: APIRequestContext) => setMode(request, "agency-profile-patch", "error")],
  ["a wrong password", (request: APIRequestContext) => setMode(request, "email-change", "wrong_password")],
] as const) {
  test(`privacy holds after ${label}: nothing in storage, console, cookies or the address bar`, async ({ page, context, request }) => {
    const logs: string[] = [];
    page.on("console", (message) => logs.push(message.text()));
    page.on("pageerror", (error) => logs.push(error.message));
    await openProfile(page, request);
    await arrange(request);
    await phone(page).fill(NEW_PHONE);
    await address(page).fill(NEW_ADDRESS);
    await description(page).fill("Call us on 0300 1234567");
    await saveButton(page).click();
    await newEmail(page).fill(NEW_EMAIL);
    await password(page).fill(PASSWORD);
    await requestButton(page).click();
    // Wait for both results before scanning: the details answer and the email answer.
    await expect(success(page).or(summary(details(page))).or(notice(page))).toBeVisible();
    await expect(page.getByTestId("email-sent").or(summary(emailSection(page))).or(page.getByTestId("email-notice"))).toBeVisible();
    const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
    const cookies = JSON.stringify(await context.cookies());
    const outside = await textOutsideControls(page);
    for (const secret of [PHONE, NEW_PHONE, ADDRESS, NEW_ADDRESS, PASSWORD]) {
      expect(stored).not.toContain(secret);
      expect(cookies).not.toContain(secret);
      expect(logs.join("\n")).not.toContain(secret);
      expect(page.url()).not.toContain(secret);
      expect(outside).not.toContain(secret);
    }
  });
}

test("privacy holds on the load failure", async ({ page, request }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  await setMode(request, "agency-profile", "error");
  await setMode(request, "me", "agency");
  await signIn(page, PROFILE);
  await expect(page.getByRole("main").getByRole("button", { name: "Retry" })).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
  for (const secret of [PHONE, ADDRESS, PASSWORD]) {
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
    "business profile ready": async (page, request) => {
      await openProfile(page, request);
    },
    "business profile field errors": async (page, request) => {
      await openProfile(page, request);
      await setMode(request, "agency-profile-patch", "fields");
      await agencyName(page).fill("A1");
      await saveButton(page).click();
      await expect(summary(details(page))).toBeVisible();
    },
    "business profile contact-details error": async (page, request) => {
      await openProfile(page, request);
      await setMode(request, "agency-profile-patch", "contact");
      await description(page).fill("Call us on 0300 1234567");
      await saveButton(page).click();
      await expect(summary(details(page))).toBeVisible();
    },
    "business profile saved": async (page, request) => {
      await openProfile(page, request);
      await agencyName(page).fill(NEW_NAME);
      await saveButton(page).click();
      await expect(success(page)).toBeVisible();
    },
    "business profile notice": async (page, request) => {
      await openProfile(page, request);
      await agencyName(page).fill(NEW_NAME);
      await setMode(request, "agency-profile-patch", "rate_limited");
      await saveButton(page).click();
      await expect(notice(page)).toBeVisible();
    },
    "business profile email errors": async (page, request) => {
      await openProfile(page, request);
      await setMode(request, "email-change", "wrong_password");
      await newEmail(page).fill(NEW_EMAIL);
      await password(page).fill(PASSWORD);
      await requestButton(page).click();
      await expect(summary(emailSection(page))).toBeVisible();
    },
    "business profile pending email note": async (page, request) => {
      await openProfile(page, request);
      await newEmail(page).fill(NEW_EMAIL);
      await password(page).fill(PASSWORD);
      await requestButton(page).click();
      await expect(page.getByTestId("pending-email")).toBeVisible();
    },
    "business profile stored city inactive": async (page, request) => {
      await setMode(request, "agency-profile", "inactive_city");
      await openProfile(page, request);
      await expect(city(page)).toHaveValue(INACTIVE);
    },
    "business profile cities failed": async (page, request) => {
      await setMode(request, "cities", "error");
      await openProfile(page, request);
      await expect(page.locator("#city-retry")).toBeVisible();
    },
    "business profile load error": async (page, request) => {
      await setMode(request, "agency-profile", "error");
      await setMode(request, "me", "agency");
      await signIn(page, PROFILE);
      await expect(page.getByRole("main").getByRole("button", { name: "Retry" })).toBeVisible();
    },
    "business profile forbidden": async (page, request) => {
      await setMode(request, "agency-profile", "forbidden");
      await setMode(request, "me", "agency");
      await signIn(page, PROFILE);
      await expect(page.getByTestId("profile-forbidden")).toBeVisible();
    },
    "profile admin message": async (page, request) => {
      await setMode(request, "me", "admin");
      await signIn(page, PROFILE);
      await expect(page.getByTestId("profile-unavailable")).toBeVisible();
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
