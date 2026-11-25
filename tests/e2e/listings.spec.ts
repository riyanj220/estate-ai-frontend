import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const STUB = STUB_URL;
const APP = APP_URL;
const LIST = "/account/listings";
const NEW = "/account/listings/new";
const THROTTLED = "Too many attempts. Try again in 2 minutes.";
const SERVER = "Something went wrong on our side. Please try again in a moment.";
const NETWORK = "We could not reach the server. Check your connection and try again.";
const TIMEOUT = "The server took too long to answer. Please try again.";
const REJECTED = "This request could not be submitted. Please try again.";
const GENERIC = "Enter a valid value.";
const FORBIDDEN = "Your account cannot create listings right now.";
const CAP = "You have reached the limit of open drafts. Finish or remove one before starting another.";
const UNAVAILABLE = "Listings are available for individual and agency accounts.";
const NOT_FOUND = "We could not find that listing.";
const LOAD_MORE_FAILED = "We could not load more listings. Try again.";
const MISMATCH = "This subtype does not belong to the chosen category. Choose another subtype.";
// Repetitive digit patterns, like the stub's own ids.
const id = (seq: number) => `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`;

// The stub backend holds module-level state; the config runs one worker, so these tests never interleave.
test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

type Mode = "signin" | "registry" | "listings" | "listing-create" | "listing-detail" | "me" | "csrf";
const setMode = (request: APIRequestContext, kind: Mode, value: string) => request.get(`${STUB}/__${kind}-mode?value=${value}`);
const preset = (request: APIRequestContext, value: string) => request.get(`${STUB}/__listings-preset?value=${value}`);
const taxonomy = (request: APIRequestContext, value: string) => request.get(`${STUB}/__registry-taxonomy?value=${value}`);
const stats = async (request: APIRequestContext) => (await request.get(`${STUB}/__listings-stats`)).json();

const header = (page: Page) => page.getByRole("banner");
const main = (page: Page) => page.getByRole("main");
const purposeRadio = (page: Page, name: string) => page.getByRole("radio", { name, exact: true });
const category = (page: Page) => page.getByLabel("Category", { exact: true });
const subtype = (page: Page) => page.getByLabel("Subtype", { exact: true });
const submit = (page: Page) => page.getByRole("button", { name: /^(Create draft|Creating…|Draft created)$/ });
const summary = (page: Page) => page.getByRole("group", { name: "There is a problem" });
const notice = (page: Page) => page.getByTestId("create-notice");
const items = (page: Page) => page.getByTestId("listing");
const loadMore = (page: Page) => page.getByRole("button", { name: "Load more" });
const listStatus = (page: Page) => page.getByTestId("listings-status");

/** Gives the stub a live session of the given kind and the browser its cookie. */
async function startSession(page: Page, request: APIRequestContext, kind: "user" | "admin" = "user") {
  await request.get(`${STUB}/__force-session${kind === "admin" ? "?kind=admin" : ""}`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP }]);
}

async function openNew(page: Page, request: APIRequestContext) {
  await startSession(page, request);
  await page.goto(NEW);
  await expect(page.getByRole("heading", { level: 1, name: "Create listing" })).toBeVisible();
  await expect(category(page)).toBeVisible();
}

async function openList(page: Page, request: APIRequestContext, kind: "user" | "admin" = "user") {
  await startSession(page, request, kind);
  await page.goto(LIST);
  await expect(page.getByRole("heading", { level: 1, name: "My listings" })).toBeVisible();
  await expect(items(page).first().or(page.getByTestId("listings-empty")).or(page.getByTestId("listings-unavailable")).or(page.getByTestId("listings-nothing-yet"))).toBeVisible();
}

async function choose(page: Page, purpose: string, cat: string, sub: string) {
  await purposeRadio(page, purpose).check();
  await category(page).selectOption(cat);
  await subtype(page).selectOption(sub);
}

async function expectNoViolations(page: Page, label: string) {
  await expect(page).toHaveTitle(/.+/); // the title can stream in after the body on a production server
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];

// ---------------------------------------------------------------- links and guard

test("links: individual and agency see My listings in the header and on the dashboard; administrators and Visitors do not @smoke", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "My listings", exact: true })).toHaveCount(0);
  await startSession(page, request);
  await page.goto("/dashboard");
  await expect(header(page).getByRole("link", { name: "My listings", exact: true })).toHaveAttribute("href", LIST);
  await expect(main(page).getByRole("link", { name: "My listings", exact: true })).toHaveAttribute("href", LIST);
  await header(page).getByRole("link", { name: "My listings", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/listings$/);

  await setMode(request, "me", "agency");
  await page.goto("/dashboard");
  await expect(header(page).getByRole("link", { name: "My listings", exact: true })).toHaveAttribute("href", LIST);
  await expect(main(page).getByRole("link", { name: "My listings", exact: true })).toHaveAttribute("href", LIST);

  await setMode(request, "me", "up");
  await request.get(`${STUB}/__force-session?kind=admin`);
  await page.goto("/dashboard");
  await expect(page.getByTestId("dashboard-type")).toHaveText("Account type: Administrator");
  await expect(page.getByRole("link", { name: "My listings", exact: true })).toHaveCount(0);
});

for (const route of [LIST, NEW, `${LIST}/${id(1)}`]) {
  test(`guard: a Visitor opening ${route.replace(id(1), "[id]")} is redirected to sign in with next and sees no content`, async ({ page, request }) => {
    const raw = await request.get(`${APP}${route}`, { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(raw.status());
    expect(raw.headers().location).toContain(`/sign-in?next=${encodeURIComponent(route)}`);
    const body = await raw.text();
    expect(body).not.toContain("Create draft");
    expect(body).not.toContain("Load more");
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=${encodeURIComponent(route)}$`));
    await expect(page.getByRole("heading", { level: 1, name: /Create listing|My listings|Draft/ })).toHaveCount(0);
  });
}

// In dev mode the headers come from the same config, so this cannot fail on it alone; the production check (`npm run check:prod-listings`) proves the built app.
test("the listing routes are not cacheable @smoke", async ({ page, request }) => {
  await startSession(page, request);
  for (const route of [LIST, NEW, `${LIST}/${id(1)}`]) {
    const response = await page.goto(route);
    expect(response?.headers()["cache-control"], route).toContain("no-store");
  }
});

// ---------------------------------------------------------------- the registry

test("registry: purposes, Categories and the Subtypes of the chosen Category come from it @smoke", async ({ page, request }) => {
  await openNew(page, request);
  await expect(page.getByRole("radio")).toHaveCount(2);
  await expect(purposeRadio(page, "Sale")).not.toBeChecked();
  await expect(purposeRadio(page, "Rent")).not.toBeChecked();
  await expect(category(page).locator("option")).toHaveText(["Select a category", "House", "Apartment", "Plot", "Commercial"]);
  await expect(subtype(page)).toHaveAttribute("aria-disabled", "true");
  await expect(subtype(page).locator("option")).toHaveText(["Select a subtype"]);
  await expect(page.locator("form")).toHaveAttribute("method", "post");
  await expect(page.getByTestId("create-note")).toHaveText("You are starting a listing manually. An AI-assisted way to start will be added later.");
  await expect(main(page).getByRole("button")).toHaveCount(1); // no control for the AI-assisted path
  expect((await stats(request)).registryGets).toBe(1);
});

test("registry: a changed registry changes the choices (nothing is hard-coded) @smoke", async ({ page, request }) => {
  await taxonomy(request, "other");
  await openNew(page, request);
  await expect(page.getByRole("radio")).toHaveCount(3);
  await expect(purposeRadio(page, "Lease out")).toBeVisible();
  await expect(category(page).locator("option")).toHaveText(["Select a category", "Villa", "Plot"]);
  await category(page).selectOption("villa");
  await expect(subtype(page).locator("option")).toHaveText(["Select a subtype", "Farm house", "Beach hut"]);
  await category(page).selectOption("plot");
  await expect(subtype(page).locator("option")).toHaveText(["Select a subtype", "Plot file"]);
});

test("registry: the browser revalidates it with its ETag @smoke", async ({ page, request }) => {
  await openNew(page, request);
  await page.reload();
  await expect(category(page)).toBeVisible();
  const after = await stats(request);
  expect(after.registryGets).toBe(2);
  expect(after.lastRegistryConditional).toMatch(/^"8-[0-9a-f]{8}-7"$/);
  expect(after.registryNotModified).toBe(1);
  await expect(category(page).locator("option")).toHaveCount(5);
});

for (const mode of ["error", "broken", "malformed", "empty_choices", "bad_subtypes"]) {
  test(`registry failure (${mode}): a message with Retry, no form and no crash; Retry loads the form`, async ({ page, request }) => {
    await setMode(request, "registry", mode);
    await startSession(page, request);
    await page.goto(NEW);
    await expect(page.getByTestId("registry-error")).toBeVisible();
    await expect(page.getByRole("heading", { name: "We could not load the listing choices" })).toBeVisible();
    await expect(page.locator("form")).toHaveCount(0);
    await expect(submit(page)).toHaveCount(0);
    await setMode(request, "registry", "ok");
    await main(page).getByRole("button", { name: "Retry" }).click();
    await expect(category(page)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Create listing" })).toBeFocused();
    await expect(page.getByTestId("registry-error")).toHaveCount(0);
  });
}

test("registry failure: a first failure then Retry works; a failing Retry keeps its button @smoke", async ({ page, request }) => {
  await setMode(request, "registry", "flaky");
  await startSession(page, request);
  await page.goto(NEW);
  await expect(page.getByTestId("registry-error")).toBeVisible();
  await main(page).getByRole("button", { name: "Retry" }).click();
  await expect(category(page)).toBeVisible();
  await setMode(request, "registry", "error");
  await page.reload();
  await expect(main(page).getByRole("button", { name: "Retry" })).toBeVisible();
  await main(page).getByRole("button", { name: "Retry" }).click();
  await expect(main(page).getByRole("button", { name: "Retry" })).toBeVisible();
});

test("registry failure: a hung request times out into the retry state", async ({ page, request }) => {
  await setMode(request, "registry", "hang");
  await startSession(page, request);
  await page.clock.install();
  await page.goto(NEW);
  await expect(page.getByTestId("registry-loading")).toBeVisible();
  await page.clock.runFor(21_000);
  await expect(main(page).getByRole("button", { name: "Retry" })).toBeVisible();
});

// ---------------------------------------------------------------- choosing

test("Category: the Subtype enables with only that Category's Subtypes; changing Category clears an incompatible Subtype", async ({ page, request }) => {
  await openNew(page, request);
  await expect(subtype(page)).toHaveAttribute("aria-disabled", "true");
  await category(page).selectOption("plot");
  await expect(subtype(page)).not.toHaveAttribute("aria-disabled");
  await expect(subtype(page).locator("option")).toHaveText(["Select a subtype", "Residential plot", "Commercial plot", "Plot file"]);
  await subtype(page).selectOption("commercial_plot");
  await category(page).selectOption("commercial");
  await expect(subtype(page).locator("option")).toHaveText(["Select a subtype", "Shop", "Office"]);
  await expect(subtype(page)).toHaveValue("");
  await subtype(page).selectOption("shop");
  await category(page).selectOption("house");
  await expect(subtype(page).locator("option")).toHaveText(["Select a subtype", "House"]);
  await expect(subtype(page)).toHaveValue("");
  await category(page).selectOption("");
  await expect(subtype(page)).toHaveAttribute("aria-disabled", "true");
});

test("Plot File: a Plot may be a Plot file, shown as Plot file", async ({ page, request }) => {
  await openNew(page, request);
  await category(page).selectOption("plot");
  await expect(subtype(page).getByRole("option", { name: "Plot file" })).toHaveAttribute("value", "plot_file");
  await purposeRadio(page, "Sale").check();
  await subtype(page).selectOption("plot_file");
  await submit(page).click();
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}$`));
  await expect(page.getByTestId("draft-subtype")).toHaveText("Plot file");
  await expect(page.getByTestId("draft-category")).toHaveText("Plot");
});

// ---------------------------------------------------------------- creating

test("create: sends exactly the three fields through the CSRF token and opens the Draft page, which also lists it", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Rent", "apartment", "apartment");
  await submit(page).click();
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Draft" })).toBeVisible();
  const after = await stats(request);
  expect(after.createCount).toBe(1);
  expect(after.lastCreate).toEqual({ purpose: "rent", category: "apartment", subtype: "apartment" });
  expect(after.lastCreateToken).toBe("csrf-0");
  await expect(page.getByTestId("draft-status")).toHaveText("Draft");
  await expect(page.getByTestId("draft-revision")).toHaveText("1");
  await expect(page.getByTestId("draft-registry-version")).toHaveText("1");
  await expect(page.getByTestId("draft-purpose")).toHaveText("Rent");
  await expect(page.getByTestId("draft-category")).toHaveText("Apartment");
  await expect(page.getByTestId("draft-subtype")).toHaveText("Apartment");
  // The editor (Story 2.2) takes the place of the old read-only note; its own suite is listing-edit.spec.ts.
  await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
  await main(page).getByRole("link", { name: "Back to My listings" }).click();
  await expect(page).toHaveURL(/\/account\/listings\?status=draft$/);
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first().locator("a.listing-link")).toHaveText("Rent · Apartment · Apartment");
  await expect(items(page).first().locator("a.listing-link")).toHaveAttribute("href", `${LIST}/${id(1)}`);
});

test("create: an agency account can start a Draft too", async ({ page, request }) => {
  await setMode(request, "me", "agency");
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await submit(page).click();
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}$`));
});

test("required checks: a missing choice sends nothing and shows errors in a focused summary", async ({ page, request }) => {
  await openNew(page, request);
  await submit(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(summary(page).getByRole("link")).toHaveText(["Purpose: Choose a purpose.", "Category: Choose a category.", "Subtype: Choose a subtype."]);
  await expect(page.locator("#category-error")).toHaveText("Error: Choose a category.");
  await expect(category(page)).toHaveAttribute("aria-invalid", "true");
  expect((await stats(request)).createCount).toBe(0);
  await summary(page).getByRole("link", { name: /^Purpose/ }).click();
  await expect(purposeRadio(page, "Sale")).toBeFocused();
  await summary(page).getByRole("link", { name: /^Category/ }).click();
  await expect(category(page)).toBeFocused();
  // Only what is missing is reported.
  await purposeRadio(page, "Rent").check();
  await category(page).selectOption("house");
  await submit(page).click();
  await expect(summary(page).getByRole("link")).toHaveText(["Subtype: Choose a subtype."]);
  expect((await stats(request)).createCount).toBe(0);
});

test("field errors: server codes map to text, the summary takes focus and the values are kept", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Sale", "plot", "plot_file");
  await setMode(request, "listing-create", "fields");
  await submit(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(summary(page).getByRole("link")).toHaveText([
    "Purpose: Choose a purpose from the list.",
    "Category: Choose a category from the list.",
    "Subtype: Choose a subtype from the list.",
  ]);
  await expect(purposeRadio(page, "Sale")).toBeChecked();
  await expect(category(page)).toHaveValue("plot");
  await expect(subtype(page)).toHaveValue("plot_file");
  await expect(submit(page)).toBeEnabled();
});

test("field errors: the subtype-mismatch code has its own text", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await setMode(request, "listing-create", "subtype_mismatch");
  await submit(page).click();
  await expect(summary(page).getByRole("link")).toHaveText([`Subtype: ${MISMATCH}`]);
  await expect(page.locator("#subtype-error")).toHaveText(`Error: ${MISMATCH}`);
  await expect(subtype(page)).toHaveValue("house");
});

test("field errors: unknown codes and sentences are generic, never the server's text", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await setMode(request, "listing-create", "sentences");
  await submit(page).click();
  await expect(summary(page).getByRole("link")).toHaveText([`Purpose: ${GENERIC}`, `Subtype: ${GENERIC}`]);
  await expect(summary(page).getByRole("listitem").last()).toHaveText(REJECTED);
  await expect(summary(page)).not.toContainText("Some server sentence.");
});

test("field errors: a form-level code shows in the summary", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await setMode(request, "listing-create", "non_field");
  await submit(page).click();
  await expect(summary(page).getByRole("listitem")).toHaveText([REJECTED]);
});

// ---------------------------------------------------------------- refusals and failures

test("an active owner's persistent 403 is the generic message, not the account one", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await setMode(request, "listing-create", "forbidden");
  await submit(page).click();
  await expect(notice(page)).toHaveText(REJECTED);
  await expect(notice(page)).not.toContainText("cannot create");
});

test("Suspended: the permission message, no retry loop, the form is kept", async ({ page, request }) => {
  await setMode(request, "signin", "suspended"); // /me answers state suspended
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await setMode(request, "listing-create", "forbidden");
  await submit(page).click();
  await expect(notice(page)).toHaveText(FORBIDDEN);
  await expect(notice(page).getByRole("link")).toHaveCount(0);
  const first = (await stats(request)).createCount;
  expect(first).toBe(2); // the first answer and the one CSRF retry
  await page.waitForTimeout(600);
  expect((await stats(request)).createCount).toBe(first);
  await expect(submit(page)).toBeEnabled();
  await expect(category(page)).toHaveValue("house");
});

test("administrator: no form on the create page, the polite message instead", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await page.goto(NEW);
  await expect(page.getByRole("heading", { level: 1, name: "Create listing" })).toBeVisible();
  await expect(page.getByTestId("listings-unavailable")).toHaveText(UNAVAILABLE);
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(0);
  expect((await stats(request)).registryGets).toBe(0);
});

test("cap reached: the 20-open-drafts message with a link to My listings", async ({ page, request }) => {
  await preset(request, "capped");
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await submit(page).click();
  await expect(notice(page)).toContainText(CAP);
  await expect(notice(page).getByRole("link", { name: "My listings" })).toHaveAttribute("href", LIST);
  expect((await stats(request)).createCount).toBe(1);
  await expect(submit(page)).toBeEnabled();
});

test("cap reached: any 429 without Retry-After reads as the cap; one with Retry-After shows the wait", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await setMode(request, "listing-create", "rate_none");
  await submit(page).click();
  await expect(notice(page)).toContainText(CAP);
  await setMode(request, "listing-create", "rate_limited");
  await submit(page).click();
  await expect(notice(page)).toHaveText(THROTTLED);
  await expect(notice(page).getByRole("link")).toHaveCount(0);
});

test("session gone (401) signs out and goes to the sign-in with next", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await setMode(request, "listing-create", "session_gone");
  await submit(page).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Flistings%2Fnew$/);
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(header(page).getByRole("link", { name: "My listings" })).toHaveCount(0);
});

test("failure (5xx): its own message and the form is kept; trying again works", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Rent", "commercial", "office");
  await setMode(request, "listing-create", "error");
  await submit(page).click();
  await expect(notice(page)).toHaveText(SERVER);
  await expect(page.locator("body")).not.toContainText("Internal detail");
  await expect(submit(page)).toBeEnabled();
  await expect(purposeRadio(page, "Rent")).toBeChecked();
  await expect(category(page)).toHaveValue("commercial");
  await expect(subtype(page)).toHaveValue("office");
  await setMode(request, "listing-create", "ok");
  await submit(page).click();
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}$`));
});

test("failure (network): its own message and the form is kept", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Rent", "commercial", "office");
  await page.route("**/api/v1/listings", (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
  await submit(page).click();
  await expect(notice(page)).toHaveText(NETWORK);
  await expect(submit(page)).toBeEnabled();
  await expect(category(page)).toHaveValue("commercial");
  await expect(subtype(page)).toHaveValue("office");
  await page.unroute("**/api/v1/listings");
  await submit(page).click();
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}$`));
});

test("failure: a hung request times out with its own message", async ({ page, request }) => {
  await startSession(page, request);
  await page.clock.install();
  await page.goto(NEW);
  await expect(category(page)).toBeVisible();
  await choose(page, "Sale", "house", "house");
  await setMode(request, "listing-create", "hang");
  await submit(page).click();
  await expect(submit(page)).toHaveText("Creating…");
  await page.clock.runFor(21_000);
  await expect(notice(page)).toHaveText(TIMEOUT);
  await expect(submit(page)).toBeEnabled();
});

test("failure: a CSRF token that cannot be fetched is a generic failure", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await setMode(request, "csrf", "error");
  await submit(page).click();
  await expect(notice(page)).toHaveText(SERVER);
  expect((await stats(request)).createCount).toBe(0);
});

test("CSRF self-heal: a first 403 refetches the token and retries once", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await setMode(request, "listing-create", "csrf_once");
  await submit(page).click();
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}$`));
  const after = await stats(request);
  expect(after.createCount).toBe(2);
  expect(after.lastCreateToken).toBe("csrf-1");
  expect(after.mine).toBe(1);
});

test("CSRF self-heal: a second 403 that is not an account refusal is generic, with no further retry", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await setMode(request, "listing-create", "csrf_always");
  await submit(page).click();
  await expect(notice(page)).toHaveText(REJECTED); // a CSRF rejection is not an account-state refusal
  await expect(notice(page)).not.toContainText("cannot create");
  expect((await stats(request)).createCount).toBe(2);
});

test("a created Draft answer without an id does not guess where the Draft is", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await setMode(request, "listing-create", "no_id");
  await submit(page).click();
  await expect(notice(page)).toContainText("Your draft was created, but we could not open it.");
  await expect(notice(page).getByRole("link", { name: "My listings" })).toHaveAttribute("href", LIST);
  await expect(page).toHaveURL(/\/account\/listings\/new$/);
  // Create stays disabled: no second Draft from this form.
  await expect(submit(page)).toHaveAttribute("aria-disabled", "true");
  await submit(page).click({ force: true });
  await page.waitForTimeout(300);
  expect((await stats(request)).createCount).toBe(1);
});

test("double submit: two quick clicks send exactly one request", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await setMode(request, "listing-create", "hang");
  await submit(page).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(submit(page)).toHaveText("Creating…");
  await expect(submit(page)).toBeDisabled();
  await page.waitForTimeout(400);
  expect((await stats(request)).createCount).toBe(1);
  await expect(page.locator("form")).toHaveAttribute("aria-busy", "true");
});

test("double submit: a double click creates one Draft", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await submit(page).dblclick();
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}$`));
  const after = await stats(request);
  expect(after.createCount).toBe(1);
  expect(after.mine).toBe(1);
});

test("live region: one announcement mechanism, announcing once", async ({ page, request }) => {
  await openNew(page, request);
  await expect(page.getByTestId("create-status")).toHaveCount(1);
  await submit(page).click();
  await expect(page.getByTestId("create-status")).toHaveText("The form has errors. Review the list at the top of the page.");
  await expect(page.getByTestId("create-status")).toHaveCount(1);
});

// ---------------------------------------------------------------- My listings

test("My listings: newest first, a summary from the labels, status and a link to each Draft page", async ({ page, request }) => {
  await preset(request, "few");
  await openList(page, request);
  await expect(items(page)).toHaveCount(3);
  await expect(items(page).nth(0).locator("a.listing-link")).toHaveText("Rent · Apartment · Apartment");
  await expect(items(page).nth(1).locator("a.listing-link")).toHaveText("Sale · Plot · Plot file");
  await expect(items(page).nth(2).locator("a.listing-link")).toHaveText("Sale · House · House");
  await expect(items(page).nth(0).locator("a.listing-link")).toHaveAttribute("href", `${LIST}/${id(3)}`);
  await expect(items(page).nth(2).locator("a.listing-link")).toHaveAttribute("href", `${LIST}/${id(1)}`);
  for (let index = 0; index < 3; index += 1) await expect(items(page).nth(index).locator(".status-marker")).toHaveText("Draft");
  await expect(loadMore(page)).toHaveCount(0);
  await expect(main(page).getByRole("link", { name: "Create listing" })).toHaveAttribute("href", NEW);
  expect((await stats(request)).listGets).toBe(1);
  await items(page).nth(1).locator("a.listing-link").click();
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(2)}$`));
  await expect(page.getByTestId("draft-subtype")).toHaveText("Plot file");
});

test("My listings: only the signed-in account's own Drafts are shown", async ({ page, request }) => {
  await preset(request, "foreign");
  await openList(page, request);
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first().locator("a.listing-link")).toHaveAttribute("href", `${LIST}/${id(1)}`);
});

test("empty: a message and a Create listing link", async ({ page, request }) => {
  await openList(page, request);
  const empty = page.getByTestId("listings-empty");
  await expect(empty.getByText("You have no listings yet.", { exact: true })).toBeVisible();
  await expect(empty.getByRole("link", { name: "Create listing" })).toHaveAttribute("href", NEW);
  await expect(items(page)).toHaveCount(0);
  await expect(loadMore(page)).toHaveCount(0);
});

test("unknown values: Not set and a humanised id, never a crash", async ({ page, request }) => {
  await preset(request, "unknown");
  await openList(page, request);
  await expect(items(page).nth(0).locator("a.listing-link")).toHaveText("Not set · Not set · Not set");
  await expect(items(page).nth(1).locator("a.listing-link")).toHaveText("Lease out · Villa · Farm house");
  await items(page).nth(0).locator("a.listing-link").click();
  await expect(page.getByTestId("draft-purpose")).toHaveText("Not set");
  await expect(page.getByTestId("draft-category")).toHaveText("Not set");
  await expect(page.getByTestId("draft-subtype")).toHaveText("Not set");
});

test("load more: appends the next page, never duplicates, and disappears at the end", async ({ page, request }) => {
  await preset(request, "many");
  await openList(page, request);
  await expect(items(page)).toHaveCount(20);
  await loadMore(page).click();
  await expect(items(page)).toHaveCount(25);
  await expect(loadMore(page)).toHaveCount(0);
  await expect(listStatus(page)).toHaveText("5 more listings loaded.");
  await expect(items(page).nth(20)).toBeFocused();
  const hrefs = await items(page).locator("a.listing-link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(new Set(hrefs).size).toBe(25);
  const queries = (await stats(request)).queries as string[];
  // Story 2.17: the first tab (Draft here: the first one that is not empty) and its status ride on every list request.
  expect(queries).toEqual(["?status=draft", "?status=draft&cursor=pos-6"]);
});

test("load more: a repeated item from the server is shown once", async ({ page, request }) => {
  await preset(request, "many");
  await setMode(request, "listings", "dup");
  await openList(page, request);
  await loadMore(page).click();
  await expect(items(page)).toHaveCount(25);
});

test("load more: a failure keeps the list with a retry message; trying again appends", async ({ page, request }) => {
  await preset(request, "many");
  await setMode(request, "listings", "more_fail");
  await openList(page, request);
  await loadMore(page).click();
  await expect(listStatus(page)).toHaveText(LOAD_MORE_FAILED);
  await expect(items(page)).toHaveCount(20);
  await expect(loadMore(page)).toBeVisible();
  await setMode(request, "listings", "ok");
  await loadMore(page).click();
  await expect(items(page)).toHaveCount(25);
  await expect(listStatus(page)).not.toHaveText(LOAD_MORE_FAILED);
});

test("load more: small pages follow the cursor until the end", async ({ page, request }) => {
  await preset(request, "few");
  await setMode(request, "listings", "small_pages");
  await openList(page, request);
  await expect(items(page)).toHaveCount(1);
  await loadMore(page).click();
  await expect(items(page)).toHaveCount(2);
  await loadMore(page).click();
  await expect(items(page)).toHaveCount(3);
  await expect(loadMore(page)).toHaveCount(0);
});

test("load more: a session that ended signs out and goes to the sign-in", async ({ page, request }) => {
  await preset(request, "many");
  await setMode(request, "listings", "more_gone");
  await openList(page, request);
  await loadMore(page).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Flistings$/);
});

test("load failure: a message with Retry kept mounted, no list, Retry loads it", async ({ page, request }) => {
  await preset(request, "few");
  await setMode(request, "listings", "flaky");
  await startSession(page, request);
  await page.goto(LIST);
  await expect(page.getByRole("heading", { name: "We could not load your listings" })).toBeVisible();
  await expect(items(page)).toHaveCount(0);
  await expect(main(page).getByRole("link", { name: "Create listing" })).toHaveCount(0);
  await main(page).getByRole("button", { name: "Retry" }).click();
  await expect(items(page)).toHaveCount(3);
  await expect(page.getByRole("heading", { level: 1, name: "My listings" })).toBeFocused();
});

for (const mode of ["error", "broken", "malformed", "bad_next"]) {
  test(`load failure (${mode}): the error state with Retry, still mounted after a failed Retry`, async ({ page, request }) => {
    await setMode(request, "listings", mode);
    await startSession(page, request);
    await page.goto(LIST);
    await expect(page.getByRole("heading", { name: "We could not load your listings" })).toBeVisible();
    await main(page).getByRole("button", { name: "Retry" }).click();
    await expect(main(page).getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(items(page)).toHaveCount(0);
  });
}

test("load failure: a rate limit shows the wait", async ({ page, request }) => {
  await setMode(request, "listings", "rate_limited");
  await startSession(page, request);
  await page.goto(LIST);
  await expect(page.getByTestId("load-error-message")).toHaveText(THROTTLED);
});

test("load failure: a hung request times out into the retry state", async ({ page, request }) => {
  await setMode(request, "listings", "hang");
  await startSession(page, request);
  await page.clock.install();
  await page.goto(LIST);
  await expect(page.getByTestId("profile-loading")).toBeVisible();
  // The counts are read first (they name the tab to open): the list request starts, and its 20 s timer is set, only after they answered.
  await expect.poll(async () => (await stats(request)).listGets).toBe(1);
  await page.clock.runFor(21_000);
  await expect(main(page).getByRole("button", { name: "Retry" })).toBeVisible();
});

test("malformed items are skipped, the rest is shown", async ({ page, request }) => {
  await preset(request, "few");
  await setMode(request, "listings", "partial");
  await openList(page, request);
  await expect(items(page)).toHaveCount(3);
});

test("session gone on load: signed out and sent to sign in with next; no list flash", async ({ page, request }) => {
  await preset(request, "few");
  await setMode(request, "listings", "session_gone");
  await startSession(page, request);
  await page.goto(LIST);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Flistings$/);
  await expect(items(page)).toHaveCount(0);
});

test("session gone for an administrator goes to the admin sign-in", async ({ page, request }) => {
  await setMode(request, "listings", "session_gone");
  await startSession(page, request, "admin");
  await page.goto(LIST);
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
});

test("administrator: the polite message, no create control, no list", async ({ page, request }) => {
  await preset(request, "few");
  await openList(page, request, "admin");
  await expect(page.getByTestId("listings-unavailable")).toHaveText(UNAVAILABLE);
  await expect(items(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Create listing" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "My listings", exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------- Draft page

test("Draft page: status, revision, registry version, the three fields and a way back", async ({ page, request }) => {
  await preset(request, "few");
  await startSession(page, request);
  await page.goto(`${LIST}/${id(2)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Draft" })).toBeVisible();
  await expect(page.getByTestId("draft-status")).toHaveText("Draft");
  await expect(page.getByTestId("draft-revision")).toHaveText("1");
  await expect(page.getByTestId("draft-registry-version")).toHaveText("1");
  await expect(page.getByTestId("draft-purpose")).toHaveText("Sale");
  await expect(page.getByTestId("draft-category")).toHaveText("Plot");
  await expect(page.getByTestId("draft-subtype")).toHaveText("Plot file");
  // The way back leads to the tab of the listing's status (Story 2.17).
  await expect(main(page).getByRole("link", { name: "Back to My listings" })).toHaveAttribute("href", `${LIST}?status=draft`);
  expect((await stats(request)).lastDetailId).toBe(id(2));
  await expect(page).toHaveTitle("Draft | EstateAI");
});

for (const [name, route] of [
  ["an unknown id", id(777)],
  ["a malformed id", "not-a-valid-id"],
  ["someone else's Draft", id(900)],
] as const) {
  test(`Draft 404 (${name}): the same copy and a link back`, async ({ page, request }) => {
    await preset(request, "foreign");
    await startSession(page, request);
    await page.goto(`${LIST}/${route}`);
    await expect(page.getByTestId("draft-not-found")).toHaveText(NOT_FOUND);
    await expect(main(page).getByRole("link", { name: "Back to My listings" })).toHaveAttribute("href", LIST);
    await expect(page.getByTestId("draft-status")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Listing" })).toBeVisible(); // neutral until a status is known
  });
}

test("Draft 404: an administrator gets the same copy", async ({ page, request }) => {
  await preset(request, "few");
  await startSession(page, request, "admin");
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByTestId("draft-not-found")).toHaveText(NOT_FOUND);
});

test("Draft load failure: Retry kept mounted; Retry loads the Draft", async ({ page, request }) => {
  await preset(request, "few");
  await setMode(request, "listing-detail", "flaky");
  await startSession(page, request);
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByRole("heading", { name: "We could not load your draft" })).toBeVisible();
  await expect(page.getByTestId("draft-status")).toHaveCount(0);
  await main(page).getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("draft-status")).toHaveText("Draft");
  await expect(page.getByRole("heading", { level: 1, name: "Draft" })).toBeFocused();
});

for (const mode of ["error", "broken", "malformed"]) {
  test(`Draft load failure (${mode}): the error state with Retry`, async ({ page, request }) => {
    await preset(request, "few");
    await setMode(request, "listing-detail", mode);
    await startSession(page, request);
    await page.goto(`${LIST}/${id(1)}`);
    await expect(page.getByRole("heading", { name: "We could not load your draft" })).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByTestId("draft-not-found")).toHaveCount(0);
  });
}

test("Draft session gone: signed out and sent to sign in with next", async ({ page, request }) => {
  await preset(request, "few");
  await setMode(request, "listing-detail", "session_gone");
  await startSession(page, request);
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=%2Faccount%2Flistings%2F${id(1)}$`));
});

// ---------------------------------------------------------------- privacy

test("privacy: no listing or registry data in storage, console output, the title or the address bar beyond the Draft id path", async ({ page, request }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  await preset(request, "few");
  await openNew(page, request);
  await choose(page, "Sale", "plot", "plot_file");
  await submit(page).click();
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(4)}$`));
  await expect(page.getByTestId("draft-subtype")).toHaveText("Plot file");
  const created = await stats(request);
  expect(created.createCount).toBe(1);
  for (const [route, title] of [
    [`${LIST}/${id(4)}`, "Draft | EstateAI"],
    [LIST, "My listings | EstateAI"],
    [NEW, "Create listing | EstateAI"],
  ] as const) {
    await page.goto(route);
    await expect(page).toHaveTitle(title);
    await expect(page.locator("main")).toBeVisible();
    expect(new URL(page.url()).search).toBe("");
  }
  // The error states too: a 404, a failed list and a failed create leave nothing behind and put nothing in the URL or hash.
  await page.goto(`${LIST}/${id(777)}`);
  await expect(page.getByTestId("draft-not-found")).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
  await setMode(request, "listings", "error");
  await page.goto(LIST);
  await expect(main(page).getByRole("button", { name: "Retry" })).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
  await page.goto(NEW);
  await choose(page, "Sale", "plot", "plot_file");
  await setMode(request, "listing-create", "error");
  await submit(page).click();
  await expect(notice(page)).toHaveText(SERVER);
  expect(new URL(page.url()).search + new URL(page.url()).hash).toBe("");
  const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
  for (const secret of ["plot_file", "residential_plot", "purpose", id(4), id(1)]) expect(stored).not.toContain(secret);
  expect(await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))).toBe("[{},{}]");
  const logged = logs.join("\n");
  for (const secret of ["plot_file", "residential_plot", id(4), id(1)]) expect(logged).not.toContain(secret);
});

// ---------------------------------------------------------------- accessibility

for (const viewport of viewports) {
  test(`accessibility (${viewport.name}): create form, its errors and the registry error have no axe violations`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openNew(page, request);
    await expectNoViolations(page, "create form");
    await category(page).selectOption("plot");
    await expectNoViolations(page, "create form with a category");
    await submit(page).click();
    await expect(summary(page)).toBeVisible();
    await expectNoViolations(page, "create form with errors");
    await purposeRadio(page, "Sale").check();
    await subtype(page).selectOption("plot_file");
    await setMode(request, "listing-create", "subtype_mismatch");
    await submit(page).click();
    await expect(page.locator("#subtype-error")).toBeVisible();
    await expectNoViolations(page, "create form with a server error");
    await setMode(request, "listing-create", "rate_none");
    await submit(page).click();
    await expect(notice(page)).toContainText(CAP);
    await expectNoViolations(page, "create form with the cap notice");
    await setMode(request, "registry", "error");
    await page.reload();
    await expect(page.getByTestId("registry-error")).toBeVisible();
    await expectNoViolations(page, "registry error");
  });

  test(`accessibility (${viewport.name}): My listings and the Draft page have no axe violations`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preset(request, "many");
    await openList(page, request);
    await expectNoViolations(page, "list");
    await loadMore(page).click();
    await expect(items(page)).toHaveCount(25);
    await expectNoViolations(page, "list after load more");
    await page.goto(`${LIST}/${id(5)}`);
    await expect(page.getByTestId("draft-status")).toBeVisible();
    await expectNoViolations(page, "draft");
    await page.goto(`${LIST}/${id(777)}`);
    await expect(page.getByTestId("draft-not-found")).toBeVisible();
    await expectNoViolations(page, "draft not found");
  });

  test(`accessibility (${viewport.name}): the empty, error and administrator states have no axe violations`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openList(page, request);
    await expect(page.getByTestId("listings-empty")).toBeVisible();
    await expectNoViolations(page, "empty");
    await setMode(request, "listings", "error");
    await page.reload();
    await expect(main(page).getByRole("button", { name: "Retry" })).toBeVisible();
    await expectNoViolations(page, "list error");
    await setMode(request, "listing-detail", "error");
    await page.goto(`${LIST}/${id(1)}`);
    await expect(main(page).getByRole("button", { name: "Retry" })).toBeVisible();
    await expectNoViolations(page, "draft error");
    await request.get(`${STUB}/__force-session?kind=admin`);
    await page.goto(LIST);
    await expect(page.getByTestId("listings-unavailable")).toBeVisible();
    await expectNoViolations(page, "administrator list");
    await page.goto(NEW);
    await expect(page.getByTestId("listings-unavailable")).toBeVisible();
    await expectNoViolations(page, "administrator create");
  });
}

// ================================================================ review additions

/** The live regions inside the page content that currently say something. */
const liveRegions = (page: Page) => main(page).locator('[role="status"], [role="alert"], [aria-live]').filter({ hasText: /\S/ });
const settle = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------- links, with settled anchors

test("links: a Visitor and an administrator see no My listings link once the header has settled", async ({ page, request }) => {
  await page.goto("/");
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "My listings", exact: true })).toHaveCount(0);
  await startSession(page, request, "admin");
  await page.goto("/dashboard");
  await expect(header(page).getByRole("link", { name: "Change password" })).toBeVisible();
  await expect(header(page).getByRole("link", { name: "My listings", exact: true })).toHaveCount(0);
});

test("session gone on create: the header shows Sign in afterwards", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await setMode(request, "listing-create", "session_gone");
  await submit(page).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Flistings%2Fnew$/);
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  expect((await stats(request)).createCount).toBe(1);
});

// ---------------------------------------------------------------- registry

test("registry: ids that are not simple tokens and Categories without Subtypes are skipped", async ({ page, request }) => {
  await setMode(request, "registry", "odd_ids");
  await openNew(page, request);
  await expect(page.getByRole("radio")).toHaveCount(2);
  await expect(category(page).locator("option")).toHaveText(["Select a category", "House"]);
  await category(page).selectOption("house");
  await expect(subtype(page).locator("option")).toHaveText(["Select a subtype", "House"]);
});

test("registry: a 401 ends the session like on the other pages", async ({ page, request }) => {
  await setMode(request, "registry", "gone");
  await startSession(page, request);
  await page.goto(NEW);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Flistings%2Fnew$/);
});

test("registry: a shared Subtype id is kept when the new Category also lists it", async ({ page, request }) => {
  await taxonomy(request, "shared");
  await openNew(page, request);
  await category(page).selectOption("villa");
  await subtype(page).selectOption("only_villa");
  await category(page).selectOption("bungalow");
  await expect(subtype(page)).toHaveValue("");
  await category(page).selectOption("villa");
  await subtype(page).selectOption("shared_unit");
  await category(page).selectOption("bungalow");
  await expect(subtype(page)).toHaveValue("shared_unit");
  await expect(subtype(page).locator("option")).toHaveText(["Select a subtype", "Shared unit", "Only bungalow"]);
});

test("registry: a refused choice re-reads the registry once and keeps the choices that are still valid", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Rent", "house", "house");
  await taxonomy(request, "other");
  await submit(page).click();
  await expect(summary(page)).toBeVisible();
  await expect.poll(async () => (await stats(request)).registryGets).toBe(2);
  await expect(category(page).locator("option")).toHaveText(["Select a category", "Villa", "Plot"]);
  await expect(purposeRadio(page, "Rent")).toBeChecked(); // still offered
  await expect(category(page)).toHaveValue(""); // no longer offered
  await expect(subtype(page)).toHaveValue("");
  await settle();
  expect((await stats(request)).registryGets).toBe(2); // once, not a loop
});

test("registry fetches: one per page load, none on client-side navigation back, focus or visibility events", async ({ page, request }) => {
  await preset(request, "few");
  await openList(page, request);
  await main(page).getByRole("link", { name: "Create listing" }).first().click();
  await expect(category(page)).toBeVisible();
  expect((await stats(request)).registryGets).toBe(1);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await settle();
  expect((await stats(request)).registryGets).toBe(1);
});

test("list and Draft pages do not refetch on focus, visibility or the passing of time", async ({ page, request }) => {
  await preset(request, "few");
  await startSession(page, request);
  await page.clock.install();
  await page.goto(LIST);
  await expect(items(page)).toHaveCount(3);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(120_000);
  await settle();
  expect((await stats(request)).listGets).toBe(1);
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByTestId("draft-status")).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(120_000);
  await settle();
  expect((await stats(request)).detailGets).toBe(1);
});

// ---------------------------------------------------------------- Retry kept mounted while in flight

test("registry Retry stays mounted and aria-disabled while the retry is in flight", async ({ page, request }) => {
  await setMode(request, "registry", "flaky_slow");
  await startSession(page, request);
  await page.goto(NEW);
  const retry = main(page).getByRole("button", { name: "Retry" });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(retry).toHaveAttribute("aria-disabled", "true");
  await retry.click({ force: true }); // a second press while in flight does nothing
  await expect.poll(async () => (await stats(request)).registryGets).toBe(2);
  await expect(retry).toHaveAttribute("aria-disabled", "true");
  await expect(category(page)).toBeVisible();
  expect((await stats(request)).registryGets).toBe(2);
});

test("list Retry stays mounted and aria-disabled while the retry is in flight", async ({ page, request }) => {
  await preset(request, "few");
  await setMode(request, "listings", "flaky_slow");
  await startSession(page, request);
  await page.goto(LIST);
  const retry = main(page).getByRole("button", { name: "Retry" });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(retry).toHaveAttribute("aria-disabled", "true");
  await expect.poll(async () => (await stats(request)).listGets).toBe(2);
  await expect(items(page)).toHaveCount(3);
});

// ---------------------------------------------------------------- live regions

for (const [name, mode, text] of [
  ["403", "forbidden", REJECTED],
  ["429", "rate_limited", THROTTLED],
  ["5xx", "error", SERVER],
] as const) {
  test(`live regions: the ${name} notice is the one non-empty live region`, async ({ page, request }) => {
    await openNew(page, request);
    await choose(page, "Sale", "house", "house");
    await setMode(request, "listing-create", mode);
    await submit(page).click();
    await expect(notice(page)).toHaveText(text);
    await expect(page.getByTestId("create-status")).toHaveText("");
    await expect(liveRegions(page)).toHaveCount(1);
    await expect(liveRegions(page)).toHaveText(text);
    await settle(200);
    await expect(liveRegions(page)).toHaveCount(1);
  });
}

test("live regions: a failed load more has one non-empty live region; list and Draft pages have none at rest", async ({ page, request }) => {
  await preset(request, "many");
  await setMode(request, "listings", "more_fail");
  await openList(page, request);
  await expect(liveRegions(page)).toHaveCount(0);
  await loadMore(page).click();
  await expect(listStatus(page)).toHaveText(LOAD_MORE_FAILED);
  await expect(liveRegions(page)).toHaveCount(1);
  await page.goto(`${LIST}/${id(5)}`);
  await expect(page.getByTestId("draft-status")).toBeVisible();
  await expect(liveRegions(page)).toHaveCount(0);
});

test("live regions: a failed list load has at most one non-empty live region", async ({ page, request }) => {
  await setMode(request, "listings", "error");
  await startSession(page, request);
  await page.goto(LIST);
  await expect(main(page).getByRole("button", { name: "Retry" })).toBeVisible();
  expect(await liveRegions(page).count()).toBeLessThanOrEqual(1);
});

// ---------------------------------------------------------------- the create form

test("server required code: the three Choose messages show", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await setMode(request, "listing-create", "required");
  await submit(page).click();
  await expect(summary(page).getByRole("link")).toHaveText(["Purpose: Choose a purpose.", "Category: Choose a category.", "Subtype: Choose a subtype."]);
  expect((await stats(request)).createCount).toBe(1);
});

test("summary: a Subtype error with no Category chosen points at the Category", async ({ page, request }) => {
  await openNew(page, request);
  await submit(page).click();
  await summary(page).getByRole("link", { name: /^Subtype/ }).click();
  await expect(category(page)).toBeFocused();
});

test("field errors clear for a field when it is edited", async ({ page, request }) => {
  await openNew(page, request);
  await submit(page).click();
  await expect(page.locator("#category-error")).toBeVisible();
  await category(page).selectOption("house");
  await expect(page.locator("#category-error")).toHaveCount(0);
  await expect(page.locator("#subtype-error")).toHaveCount(0); // the Category change clears the Subtype's error too
  await expect(summary(page).getByRole("link")).toHaveText(["Purpose: Choose a purpose."]);
  await purposeRadio(page, "Sale").check();
  await expect(summary(page)).toHaveCount(0);
});

test("create: the form stays locked after a Draft is created and shows Draft created", async ({ page, request }) => {
  await startSession(page, request);
  await page.clock.install();
  await page.goto(NEW);
  await expect(category(page)).toBeVisible();
  await choose(page, "Sale", "house", "house");
  // The Draft page never opens: the navigation request is left hanging.
  await page.route(`**${LIST}/0*`, () => undefined);
  await submit(page).click();
  await expect(page.getByTestId("create-created")).toBeVisible();
  await expect(submit(page)).toHaveText("Draft created");
  await expect(submit(page)).toHaveAttribute("aria-disabled", "true");
  await submit(page).click({ force: true });
  expect((await stats(request)).createCount).toBe(1);
  await page.clock.runFor(9000);
  await expect(notice(page)).toContainText("Your draft was created, but we could not open it.");
  await expect(notice(page).getByRole("link", { name: "My listings" })).toHaveAttribute("href", LIST);
  await expect(submit(page)).toHaveAttribute("aria-disabled", "true");
  await submit(page).click({ force: true });
  await settle();
  expect((await stats(request)).createCount).toBe(1);
});

test("bfcache: a restored page does not stay frozen in the busy state", async ({ page, request }) => {
  await openNew(page, request);
  await choose(page, "Sale", "house", "house");
  await setMode(request, "listing-create", "hang");
  await submit(page).click();
  await expect(submit(page)).toHaveText("Creating…");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(submit(page)).toHaveText("Create draft");
  await expect(submit(page)).not.toHaveAttribute("aria-disabled");
});

test("bfcache: a restored listing page whose session ended goes to the sign-in instead of showing the old content", async ({ page, request }) => {
  await preset(request, "few");
  await openList(page, request);
  await request.get(`${STUB}/__expire-session`);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Flistings$/);
  await expect(items(page)).toHaveCount(0);
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("bfcache: a restored Draft page whose session ended goes to the sign-in", async ({ page, request }) => {
  await preset(request, "few");
  await startSession(page, request);
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByTestId("draft-status")).toBeVisible();
  await request.get(`${STUB}/__expire-session`);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=%2Faccount%2Flistings%2F${id(1)}$`));
});

test("bfcache: a restored listing page whose session is alive reloads its content", async ({ page, request }) => {
  await preset(request, "few");
  await openList(page, request);
  await request.get(`${STUB}/__listings-preset?value=empty`);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page.getByTestId("listings-empty")).toBeVisible();
});

// ---------------------------------------------------------------- My listings details

test("empty state only without a next cursor: an all-malformed first page with a next shows Load more", async ({ page, request }) => {
  await preset(request, "few");
  await setMode(request, "listings", "bad_first");
  await openList(page, request);
  await expect(page.getByTestId("listings-empty")).toHaveCount(0);
  await expect(page.getByTestId("listings-nothing-yet")).toBeVisible();
  await loadMore(page).click();
  await expect(items(page)).toHaveCount(2);
  await expect(loadMore(page)).toHaveCount(0);
});

test("in-page duplicates are shown once", async ({ page, request }) => {
  await preset(request, "few");
  await setMode(request, "listings", "inpage_dup");
  await openList(page, request);
  await expect(items(page)).toHaveCount(3);
  const ids = await items(page).evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(new Set(ids).size).toBe(3);
});

test("load more: a page that only repeats known items but moves the cursor on is followed once more", async ({ page, request }) => {
  await preset(request, "many");
  await setMode(request, "listings", "known_advance");
  await openList(page, request);
  await loadMore(page).click();
  await expect(items(page)).toHaveCount(24);
  await expect(listStatus(page)).toHaveText("4 more listings loaded.");
  await expect(loadMore(page)).toHaveCount(0);
});

test("load more: a repeated cursor ends the list instead of looping", async ({ page, request }) => {
  await preset(request, "many");
  await setMode(request, "listings", "repeat_cursor");
  await openList(page, request);
  await loadMore(page).click();
  await expect(listStatus(page)).toHaveText("No more listings to show.");
  await expect(items(page)).toHaveCount(20);
  await expect(loadMore(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "My listings" })).toBeFocused();
  expect(((await stats(request)).queries as string[]).length).toBe(2);
});

test("load more: a 429 shows the wait; a 403 shows the neutral copy and keeps the list", async ({ page, request }) => {
  await preset(request, "many");
  await setMode(request, "listings", "more_rate_limited");
  await openList(page, request);
  await loadMore(page).click();
  await expect(listStatus(page)).toHaveText(THROTTLED);
  await expect(items(page)).toHaveCount(20);
  await setMode(request, "listings", "more_forbidden");
  await loadMore(page).click();
  await expect(listStatus(page)).toHaveText("Listings are not available for this account right now.");
  await expect(items(page)).toHaveCount(20);
});

test("a refused owner (403 on the list) gets the neutral copy, not the account-type one", async ({ page, request }) => {
  await setMode(request, "listings", "forbidden");
  await openList(page, request);
  await expect(page.getByTestId("listings-unavailable")).toHaveText("Listings are not available for this account right now.");
});

// ---------------------------------------------------------------- Draft page details

test("Draft: a non-canonical id is not found without asking the server", async ({ page, request }) => {
  await preset(request, "few");
  await startSession(page, request);
  for (const route of ["not-a-valid-id", "ABCDEF00-0000-4000-9000-000000000001", `${id(1)}x`]) {
    await page.goto(`${LIST}/${route}`);
    await expect(page.getByTestId("draft-not-found")).toHaveText(NOT_FOUND);
  }
  await settle();
  expect((await stats(request)).detailGets).toBe(0);
});

for (const mode of ["forbidden", "bad_request", "unprocessable"]) {
  test(`Draft (${mode}): the same not-found copy as a 404`, async ({ page, request }) => {
    await preset(request, "few");
    await setMode(request, "listing-detail", mode);
    await startSession(page, request);
    await page.goto(`${LIST}/${id(1)}`);
    await expect(page.getByTestId("draft-not-found")).toHaveText(NOT_FOUND);
    await expect(main(page).getByRole("link", { name: "Back to My listings" })).toHaveAttribute("href", LIST);
  });
}

test("Draft (429): the wait is shown with Retry", async ({ page, request }) => {
  await preset(request, "few");
  await setMode(request, "listing-detail", "rate_limited");
  await startSession(page, request);
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByTestId("load-error-message")).toHaveText(THROTTLED);
  await expect(main(page).getByRole("button", { name: "Retry" })).toBeVisible();
});

test("Draft: an administrator whose session ended goes to the admin sign-in", async ({ page, request }) => {
  await setMode(request, "listing-detail", "session_gone");
  await startSession(page, request, "admin");
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
});

// ---------------------------------------------------------------- accessibility, more states

for (const viewport of viewports) {
  test(`accessibility (${viewport.name}): registry loading, a failed load more and the created state have no axe violations`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setMode(request, "registry", "hang");
    await startSession(page, request);
    await page.goto(NEW);
    await expect(page.getByTestId("registry-loading")).toBeVisible();
    await expectNoViolations(page, "registry loading");
    await setMode(request, "registry", "ok");
    await preset(request, "many");
    await setMode(request, "listings", "more_fail");
    await page.goto(LIST);
    await expect(items(page)).toHaveCount(20);
    await loadMore(page).click();
    await expect(listStatus(page)).toHaveText(LOAD_MORE_FAILED);
    await expectNoViolations(page, "failed load more");
    await preset(request, "few"); // under the open-draft cap again
    await page.goto(NEW);
    await expect(category(page)).toBeVisible();
    await choose(page, "Sale", "house", "house");
    await page.route(`**${LIST}/0*`, () => undefined);
    await submit(page).click();
    await expect(page.getByTestId("create-created")).toBeVisible();
    await expectNoViolations(page, "created state");
  });
}
