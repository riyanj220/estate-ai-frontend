import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Story 2.6, frontend half: the sale and rent terms in the Draft editor (a "Terms" fieldset built from the registry's `section` marker,
// the date control, the labels, the errors, the conflicts), against the stub backend, which mirrors the backend's rules.
const STUB = "http://127.0.0.1:4010";
const APP = "http://127.0.0.1:3100";
const LIST = "/account/listings";
const CONFLICT =
  "This draft was changed in another session. We loaded the latest version; your unsaved changes are still in the form. Review them and save again.";
const ALREADY_SAVED = "Your changes are already saved.";
const GENERIC = "Enter a valid value.";
const REJECTED = "This request could not be submitted. Please try again.";
const ERRORS_ANNOUNCED = "The form has errors. Review the list at the top of the page.";
const SELLER_DECLARED = "Seller-declared";
const SELLER_HELP = "You are stating this. EstateAI has not checked it.";
const MONEY_INVALID = "Enter digits only, with an optional decimal point. Do not use commas or currency signs, for example 2500 or 2500.50.";
const MONEY_RANGE = "Enter an amount within the allowed range, with at most two decimal places.";
const PRICE_RANGE = "Enter an amount within the limits shown above, with at most two decimal places.";
const INTEGER_INVALID = "Enter a whole number, digits only, for example 3.";
const INTEGER_RANGE = "Enter a whole number within the allowed range.";
const BOOLEAN_INVALID = "Choose Yes, No or Not answered.";
const CHOICE_INVALID = "Choose an option from the list.";
const DATE_INVALID = "Enter a real date written year-month-day, for example 2027-03-01.";
const DATE_RANGE = "Enter a date within the allowed range shown above.";
const NOT_APPLICABLE = "This detail does not apply to this listing.";
const NOT_EDITABLE = "This detail cannot be changed here.";
// Repetitive digit patterns, like the stub's own ids.
const id = (seq: number) => `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`;

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

type Mode = "listing-patch";
const setMode = (request: APIRequestContext, kind: Mode, value: string) => request.get(`${STUB}/__${kind}-mode?value=${value}`);
const preset = (request: APIRequestContext, value: string) => request.get(`${STUB}/__listings-preset?value=${value}`);
const registryFields = (request: APIRequestContext, value: string) => request.get(`${STUB}/__registry-fields?value=${value}`);
const patches = async (request: APIRequestContext) => (await request.get(`${STUB}/__listing-patch-stats`)).json();
const stats = async (request: APIRequestContext) => (await request.get(`${STUB}/__listings-stats`)).json();
const storedFields = async (request: APIRequestContext) => (await stats(request)).listings[0].fields;
const otherSession = (request: APIRequestContext, listing: string, changes: Record<string, string>) =>
  request.get(`${STUB}/__other-session?${new URLSearchParams({ id: listing, ...changes }).toString()}`);

const main = (page: Page) => page.getByRole("main");
const detail = (page: Page, name: string) => page.getByLabel(name, { exact: true });
const saveButton = (page: Page) => page.getByRole("button", { name: /^(Save changes|Saving…)$/ });
const live = (page: Page) => page.getByTestId("draft-live");
const conflictBanner = (page: Page) => page.getByTestId("draft-conflict");
const summary = (page: Page) => page.getByRole("group", { name: "There is a problem" });
const revision = (page: Page) => page.getByTestId("draft-revision");
const summaryItem = (page: Page, field: string) => page.getByTestId(`draft-detail-${field}`);
const termsBlock = (page: Page) => page.getByTestId("terms-block");
const termsLabels = (page: Page, key: "required" | "recommended" | "more") => page.getByTestId(`terms-${key}`).locator("label");
const detailsLabels = (page: Page, key: "required" | "recommended" | "more") => page.getByTestId(`details-${key}`).locator("label");
const inTerms = (page: Page, name: string) => termsBlock(page).getByLabel(name, { exact: true });
const liveRegions = (page: Page) => main(page).locator('[role="status"], [role="alert"], [aria-live]').filter({ hasText: /\S/ });
/**
 * A browser with no date control shows a plain text input. Chromium cannot be made to, so the same input appears as text the way the
 * form itself decides it: the saved value is text that is not a real date ("junk"), so it stays a text input until it is saved.
 */
async function openTextDate(page: Page, request: APIRequestContext) {
  await openDraft(page, request, "rent_terms_blank");
  await otherSession(request, id(1), { availability_date: "junk" });
  await page.reload();
  await expect(detail(page, "Available from")).toHaveAttribute("type", "text");
}

async function startSession(page: Page, request: APIRequestContext) {
  await request.get(`${STUB}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP }]);
}

async function openDraft(page: Page, request: APIRequestContext, which: string) {
  await preset(request, which);
  await startSession(page, request);
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Draft" })).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
}

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];

const SALE_RECOMMENDED = ["Possession availability"];
const SALE_MORE = ["Price negotiable"];
const RENT_RECOMMENDED = ["Security deposit (PKR)", "Available from"];
const RENT_MORE = [
  "Price negotiable",
  "Advance rent (PKR)",
  "Minimum lease (months)",
  "Notice period (days)",
  "Electricity included",
  "Gas included",
  "Water included",
  "Internet included",
  "Pets allowed",
  "Occupant restrictions",
];
const RENT_ONLY = ["Security deposit (PKR)", "Available from", "Advance rent (PKR)", "Minimum lease (months)", "Notice period (days)", "Electricity included", "Gas included", "Water included", "Internet included", "Pets allowed", "Occupant restrictions"];
const DEFERRED = /payment type|down payment|installment|title document|approval information|ownership document/i;

/** No platform badge or verification wording next to a seller's own claim (the same scan as the plot claims use). */
async function expectNoPlatformBadge(page: Page) {
  await expect(main(page).locator('svg, img, [class*="badge"], [data-testid*="badge"], [data-testid*="verified"]')).toHaveCount(0);
  const found = await page.evaluate((help) => {
    const root = document.body.cloneNode(true) as HTMLElement;
    root.querySelectorAll("header, nav, footer, script, style").forEach((element) => element.remove());
    return (root.textContent ?? "").replaceAll(help, "");
  }, SELLER_HELP);
  expect(found).not.toMatch(/verified|estateai|checked by|approved by|trusted|✓|✔/i);
}

// ---------------------------------------------------------------- the Terms fieldset

test("terms: a sale shows the sale terms only, in a Terms for sale fieldset after the Area and before the Details", async ({ page, request }) => {
  await openDraft(page, request, "sale_terms_blank");
  await expect(termsBlock(page)).toBeVisible();
  expect(await termsBlock(page).evaluate((element) => element.tagName)).toBe("FIELDSET");
  await expect(page.getByRole("group", { name: "Terms for sale", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Terms for sale" })).toBeVisible(); // like Details: found by heading navigation
  await expect(page.getByRole("group", { name: "Terms for rent" })).toHaveCount(0);
  await expect(page.getByTestId("terms-required")).toHaveCount(0);
  await expect(termsLabels(page, "recommended")).toHaveText(SALE_RECOMMENDED);
  await expect(termsLabels(page, "more")).toHaveText(SALE_MORE);
  await expect(termsBlock(page).locator("label")).toHaveCount(2);
  for (const rentOnly of RENT_ONLY) await expect(detail(page, rentOnly)).toHaveCount(0);
  await expect(detail(page, "Rental period")).toHaveCount(0);
  // The hand-built price fields stay where they were, outside the Terms fieldset.
  await expect(detail(page, "Asking price")).toBeVisible();
  await expect(termsBlock(page).getByLabel("Asking price")).toHaveCount(0);
  await expect(termsBlock(page).getByLabel("Price basis")).toHaveCount(0);
  const order = await page.evaluate(() => {
    const terms = document.querySelector('[data-testid="terms-block"]')!;
    const details = document.querySelector('[data-testid="details-block"]')!;
    const area = document.querySelector('[data-testid="area-block"]')!;
    const after = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { areaThenTerms: after(area, terms), termsThenDetails: after(terms, details), detailsInsideTerms: terms.contains(details) };
  });
  expect(order).toEqual({ areaThenTerms: true, termsThenDetails: true, detailsInsideTerms: false });
  // The property details are not terms: they stay in the Details block.
  await expect(page.getByTestId("details-block").getByLabel("Furnishing", { exact: true })).toBeVisible();
  await expect(termsBlock(page).getByLabel("Furnishing", { exact: true })).toHaveCount(0);
  await expect(main(page)).not.toContainText(DEFERRED);
  // Nothing is preselected.
  await expect(detail(page, "Possession availability")).toHaveValue("");
  await expect(detail(page, "Price negotiable")).toHaveValue("");
});

test("terms: a rent shows the rent terms only, grouped by requirement, with the rental period where it was", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms_blank");
  await expect(page.getByRole("group", { name: "Terms for rent", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Terms for sale" })).toHaveCount(0);
  await expect(page.getByTestId("terms-required")).toHaveCount(0); // the one required term, the rental period, is built by hand
  await expect(termsLabels(page, "recommended")).toHaveText(RENT_RECOMMENDED);
  await expect(termsLabels(page, "more")).toHaveText(RENT_MORE);
  await expect(termsBlock(page).locator("fieldset.terms-group")).toHaveCount(2);
  await expect(detail(page, "Possession availability")).toHaveCount(0);
  await expect(detail(page, "Rental period")).toBeVisible();
  await expect(termsBlock(page).getByLabel("Rental period")).toHaveCount(0);
  await expect(detail(page, "Rental period")).toHaveValue(""); // never assumed: not monthly, not anything
  // The property details stay in the Details block, and a term never appears there.
  await expect(page.getByTestId("details-block").getByLabel("Maintenance charges (PKR per month)", { exact: true })).toBeVisible();
  await expect(page.getByTestId("details-block").getByLabel("Security deposit (PKR)", { exact: true })).toHaveCount(0);
  await expect(main(page)).not.toContainText(DEFERRED);
  for (const label of RENT_ONLY) await expect(detail(page, label)).toHaveValue("");
  await expect(page.locator('[data-testid^="draft-detail-"]')).toHaveCount(0); // nothing answered, nothing listed
});

test("terms: a rent House shows the rent terms but no apartment charges, and a Shop and a Plot show them too", async ({ page, request }) => {
  await openDraft(page, request, "house_rent_terms_blank");
  await expect(page.getByRole("heading", { level: 3, name: "Terms for rent" })).toBeVisible();
  await expect(termsLabels(page, "recommended")).toHaveText(RENT_RECOMMENDED);
  await expect(termsLabels(page, "more")).toHaveText(RENT_MORE);
  await expect(detail(page, "Maintenance charges (PKR per month)")).toHaveCount(0);
  await expect(detail(page, "Bedrooms")).toBeVisible();
  await expect(detail(page, "Possession availability")).toHaveCount(0);
  await openDraft(page, request, "shop_rent_blank");
  await expect(termsLabels(page, "recommended")).toHaveText(RENT_RECOMMENDED);
  await expect(page.getByTestId("details-block").getByLabel("Maintenance charges (PKR per month)", { exact: true })).toBeVisible();
  await openDraft(page, request, "plot_rent_blank");
  await expect(termsLabels(page, "recommended")).toHaveText(RENT_RECOMMENDED);
  await expect(termsLabels(page, "more")).toHaveText(RENT_MORE);
  await expect(detail(page, "Maintenance charges (PKR per month)")).toHaveCount(0);
});

test("summary: the answered terms are listed before the answered details, as in the form", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms");
  await otherSession(request, id(1), { bedrooms: "2", furnishing: "furnished" });
  await page.reload();
  await expect(summaryItem(page, "furnishing")).toBeVisible();
  const ids = await page.locator('[data-testid="draft-details"] [data-testid^="draft-detail-"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")));
  expect(ids).toEqual(
    [
      "price_negotiable",
      "security_deposit",
      "availability_date",
      "advance_rent",
      "minimum_lease_months",
      "notice_period_days",
      "utility_electricity_included",
      "utility_gas_included",
      "pets_allowed",
      "occupant_restrictions",
      "bedrooms",
      "furnishing",
    ].map((field) => `draft-detail-${field}`),
  );
});

test("terms: the control follows the registry type, with Not answered first, readable choices and the registry's limits as hints", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms_blank");
  // money: text input with the currency prefix
  await expect(detail(page, "Security deposit (PKR)")).toHaveAttribute("type", "text");
  await expect(detail(page, "Security deposit (PKR)")).toHaveAttribute("inputmode", "decimal");
  await expect(page.locator("#security_deposit-hint")).toHaveText("Security deposit in PKR. Amount in PKR. Between 0 and 999999999999.99.");
  await expect(page.locator("#advance_rent-hint")).toHaveText("Rent paid in advance in PKR. Amount in PKR. Between 0 and 999999999999.99.");
  await expect(termsBlock(page).locator(".money-prefix")).toHaveText(["PKR", "PKR"]);
  // integers: digits, with their ranges
  await expect(detail(page, "Minimum lease (months)")).toHaveAttribute("inputmode", "numeric");
  await expect(page.locator("#minimum_lease_months-hint")).toHaveText("Shortest lease in months. Whole number from 1 to 120.");
  await expect(page.locator("#notice_period_days-hint")).toHaveText("Notice period in days. Whole number from 0 to 365.");
  // booleans
  for (const yesNo of ["Price negotiable", "Electricity included", "Gas included", "Water included", "Internet included", "Pets allowed"]) {
    await expect(detail(page, yesNo).locator("option")).toHaveText(["Not answered", "Yes", "No"]);
  }
  await expect(page.locator("#utility_gas_included-hint")).toHaveText("Gas is included in the rent.");
  // enum
  await expect(detail(page, "Occupant restrictions").locator("option")).toHaveText(["Not answered", "No restriction", "Families only", "Bachelors only"]);
  // date: a native date input holding the ISO text, with the registry's date bounds as plain text
  await expect(detail(page, "Available from")).toHaveAttribute("type", "date");
  await expect(detail(page, "Available from")).toHaveAttribute("min", "2000-01-01");
  await expect(detail(page, "Available from")).toHaveAttribute("max", "2100-12-31");
  await expect(page.locator("#availability_date-hint")).toHaveText("The date the property is available from, as a calendar date (YYYY-MM-DD). Between 2000-01-01 and 2100-12-31.");
  await expect(detail(page, "Available from")).toHaveAttribute("aria-describedby", "availability_date-hint");
  await openDraft(page, request, "sale_terms_blank");
  await expect(detail(page, "Possession availability").locator("option")).toHaveText(["Not answered", "Available now", "Within one month", "Within three months", "After three months"]);
});

test("terms: a purpose the client does not know gets a plain Terms fieldset with the terms that apply to every purpose", async ({ page, request }) => {
  await openDraft(page, request, "terms_unknown_purpose");
  await expect(page.getByRole("group", { name: "Terms", exact: true })).toBeVisible();
  await expect(termsBlock(page).locator("label")).toHaveText(["Price negotiable"]);
});

// ---------------------------------------------------------------- saving

test("sale terms: the answers are sent as a boolean and text, only the changed fields, and saved as the server answers", async ({ page, request }) => {
  await openDraft(page, request, "sale_terms_blank");
  await detail(page, "Price negotiable").selectOption("true");
  await detail(page, "Possession availability").selectOption("within_three_months");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({ base_revision: 1, fields: { price_negotiable: true, possession_availability: "within_three_months" } });
  expect(await storedFields(request)).toMatchObject({ price_negotiable: true, possession_availability: "within_three_months", security_deposit: null, availability_date: null });
  await expect(summaryItem(page, "price_negotiable")).toHaveText("Yes");
  await expect(summaryItem(page, "possession_availability")).toHaveText("Within three months. Seller-declared");
  // Changing one sends that one only.
  await detail(page, "Possession availability").selectOption("available_now");
  await saveButton(page).click();
  await expect(revision(page)).toHaveText("3");
  expect((await patches(request)).bodies[1]).toEqual({ base_revision: 2, fields: { possession_availability: "available_now" } });
});

test("rent terms: money, integers, booleans, a choice and a date are sent in their own types, and zero and No are answers", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms_blank");
  await detail(page, "Security deposit (PKR)").fill("170000");
  await detail(page, "Available from").fill("2027-03-01");
  await detail(page, "Advance rent (PKR)").fill("0");
  await detail(page, "Minimum lease (months)").fill("12");
  await detail(page, "Notice period (days)").fill("0");
  await detail(page, "Electricity included").selectOption("true");
  await detail(page, "Gas included").selectOption("false");
  await detail(page, "Pets allowed").selectOption("false");
  await detail(page, "Price negotiable").selectOption("false");
  await detail(page, "Occupant restrictions").selectOption("families_only");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({
    base_revision: 1,
    fields: {
      security_deposit: "170000",
      availability_date: "2027-03-01",
      advance_rent: "0",
      minimum_lease_months: 12,
      notice_period_days: 0,
      utility_electricity_included: true,
      utility_gas_included: false,
      pets_allowed: false,
      price_negotiable: false,
      occupant_restrictions: "families_only",
    },
  });
  expect(await storedFields(request)).toMatchObject({
    security_deposit: "170000.00",
    availability_date: "2027-03-01",
    advance_rent: "0.00",
    minimum_lease_months: 12,
    notice_period_days: 0,
    utility_electricity_included: true,
    utility_gas_included: false,
    utility_water_included: null,
    utility_internet_included: null,
    pets_allowed: false,
    price_negotiable: false,
    occupant_restrictions: "families_only",
    rental_period: null, // never assumed
    possession_availability: null,
  });
  // The form shows what the server holds; zero and No stay answers, the unanswered stays unanswered.
  await expect(detail(page, "Security deposit (PKR)")).toHaveValue("170000.00");
  await expect(detail(page, "Advance rent (PKR)")).toHaveValue("0.00");
  await expect(detail(page, "Notice period (days)")).toHaveValue("0");
  await expect(detail(page, "Pets allowed")).toHaveValue("false");
  await expect(detail(page, "Water included")).toHaveValue("");
  await expect(detail(page, "Available from")).toHaveValue("2027-03-01");
  // The summary lists the answered terms: No and 0 are shown, an unanswered term is not.
  await expect(summaryItem(page, "security_deposit")).toHaveText("PKR 170,000.00");
  await expect(summaryItem(page, "availability_date")).toHaveText("2027-03-01");
  await expect(summaryItem(page, "advance_rent")).toHaveText("PKR 0.00");
  await expect(summaryItem(page, "minimum_lease_months")).toHaveText("12");
  await expect(summaryItem(page, "notice_period_days")).toHaveText("0");
  await expect(summaryItem(page, "utility_electricity_included")).toHaveText("Yes");
  await expect(summaryItem(page, "utility_gas_included")).toHaveText("No");
  await expect(summaryItem(page, "pets_allowed")).toHaveText("No");
  await expect(summaryItem(page, "price_negotiable")).toHaveText("No");
  await expect(summaryItem(page, "occupant_restrictions")).toHaveText("Families only");
  await expect(summaryItem(page, "utility_water_included")).toHaveCount(0);
  await expect(summaryItem(page, "possession_availability")).toHaveCount(0);
  await expect(page.getByTestId("draft-details").getByText("Security deposit (PKR)", { exact: true })).toBeVisible();
  await expect(detail(page, "Rental period")).toHaveValue(""); // still no period: nothing assumed one
});

test("rent terms: a saved Draft fills the controls, and untouched or equivalent text sends nothing", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms");
  await expect(detail(page, "Security deposit (PKR)")).toHaveValue("170000.00");
  await expect(detail(page, "Available from")).toHaveValue("2027-03-01");
  await expect(detail(page, "Advance rent (PKR)")).toHaveValue("0.00");
  await expect(detail(page, "Minimum lease (months)")).toHaveValue("12");
  await expect(detail(page, "Notice period (days)")).toHaveValue("0");
  await expect(detail(page, "Electricity included")).toHaveValue("true");
  await expect(detail(page, "Gas included")).toHaveValue("false");
  await expect(detail(page, "Pets allowed")).toHaveValue("false");
  await expect(detail(page, "Price negotiable")).toHaveValue("false");
  await expect(detail(page, "Occupant restrictions")).toHaveValue("families_only");
  await expect(detail(page, "Rental period")).toHaveValue("month");
  await expect(summaryItem(page, "advance_rent")).toHaveText("PKR 0.00");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  await detail(page, "Security deposit (PKR)").fill("170000"); // the same amount
  await detail(page, "Advance rent (PKR)").fill(" 0 ");
  await detail(page, "Available from").fill("2027-03-01");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(0);
  await expect(revision(page)).toHaveText("2");
});

test("rent terms: clearing an answer sends null and never a zero, and the summary drops it", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms");
  await detail(page, "Security deposit (PKR)").fill("");
  await detail(page, "Available from").fill("");
  await detail(page, "Pets allowed").selectOption("");
  await detail(page, "Minimum lease (months)").fill("");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({
    base_revision: 2,
    fields: { security_deposit: null, availability_date: null, pets_allowed: null, minimum_lease_months: null },
  });
  expect(await storedFields(request)).toMatchObject({ security_deposit: null, availability_date: null, pets_allowed: null, minimum_lease_months: null, advance_rent: "0.00", notice_period_days: 0 });
  await expect(summaryItem(page, "security_deposit")).toHaveCount(0);
  await expect(summaryItem(page, "pets_allowed")).toHaveCount(0);
  await expect(summaryItem(page, "advance_rent")).toHaveText("PKR 0.00");
});

test("no rental period is assumed: a rent saved with only a deposit still has none, and the term never offers a default", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms_blank");
  await expect(detail(page, "Rental period").locator("option")).toHaveText(["Not set", "Day", "Week", "Month", "Year"]);
  await detail(page, "Security deposit (PKR)").fill("5000");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({ base_revision: 1, fields: { security_deposit: "5000" } });
  expect((await storedFields(request)).rental_period).toBeNull();
  await expect(detail(page, "Rental period")).toHaveValue("");
});

// ---------------------------------------------------------------- the date control

test("date: a date is sent as the ISO text the input holds, trimmed, and shown back the same", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms_blank");
  await detail(page, "Available from").fill("2028-02-29"); // a leap day
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0].fields).toEqual({ availability_date: "2028-02-29" });
  await expect(detail(page, "Available from")).toHaveValue("2028-02-29");
  await detail(page, "Available from").fill("2000-01-01"); // the window's own edges are accepted
  await saveButton(page).click();
  await expect(revision(page)).toHaveText("3");
  await detail(page, "Available from").fill("2100-12-31");
  await saveButton(page).click();
  await expect(revision(page)).toHaveText("4");
  expect((await patches(request)).bodies.map((body: { fields: Record<string, unknown> }) => body.fields.availability_date)).toEqual(["2028-02-29", "2000-01-01", "2100-12-31"]);
  await page.reload();
  await expect(detail(page, "Available from")).toHaveValue("2100-12-31");
});

for (const timezone of ["Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
  test.describe(`date in ${timezone}`, () => {
    test.use({ timezoneId: timezone });
    test("the date is never shifted by the time zone: sent, stored, shown and summarised as the same text", async ({ page, request }) => {
      await openDraft(page, request, "rent_terms_blank");
      await detail(page, "Available from").fill("2027-03-01");
      await saveButton(page).click();
      await expect(live(page)).toHaveText("Saved");
      expect((await patches(request)).bodies[0].fields).toEqual({ availability_date: "2027-03-01" });
      expect((await storedFields(request)).availability_date).toBe("2027-03-01");
      await expect(detail(page, "Available from")).toHaveValue("2027-03-01");
      await expect(summaryItem(page, "availability_date")).toHaveText("2027-03-01");
      await page.reload();
      await expect(detail(page, "Available from")).toHaveValue("2027-03-01");
      await otherSession(request, id(1), { availability_date: "2027-12-31" });
      await detail(page, "Available from").fill("2027-01-01");
      await saveButton(page).click();
      await expect(page.getByTestId("conflict-availability_date")).toContainText("Latest saved: 2027-12-31");
    });
  });
}

test("date: a real date outside the registry window is invalid_date under its control, the input keeps what was typed", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms_blank");
  await detail(page, "Available from").fill("1999-12-31");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  expect((await patches(request)).bodies[0].fields).toEqual({ availability_date: "1999-12-31" });
  await expect(page.locator("#availability_date-error")).toHaveText(`Error: ${DATE_RANGE}`);
  await expect(detail(page, "Available from")).toHaveValue("1999-12-31");
  await expect(detail(page, "Available from")).toHaveAttribute("aria-invalid", "true");
  await expect(detail(page, "Available from")).toHaveAttribute("aria-describedby", /availability_date-hint availability_date-error/);
  await expect(summary(page).getByRole("link", { name: "Available from" })).toHaveAttribute("href", "#availability_date");
  await expect(live(page)).toHaveText(ERRORS_ANNOUNCED);
  await detail(page, "Available from").fill("2101-01-01");
  await expect(page.locator("#availability_date-error")).toHaveCount(0); // editing clears the error of that field
  await saveButton(page).click();
  await expect(page.locator("#availability_date-error")).toHaveText(`Error: ${DATE_RANGE}`);
  expect((await patches(request)).bodies[1].fields).toEqual({ availability_date: "2101-01-01" });
  await detail(page, "Available from").fill("2027-03-01");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
});

test("date: text that is not a real date (a browser without a date control) is sent as typed, trimmed, and the server judges it", async ({ page, request }) => {
  await openTextDate(page, request);
  const sentOf = async (index: number) => (await patches(request)).bodies[index].fields.availability_date;
  const typed = ["2027-02-30", "2027-3-1", "  2027-03-01T00:00:00 ", "20270301", "next month"];
  for (const [index, text] of typed.entries()) {
    await detail(page, "Available from").fill(text);
    await expect(detail(page, "Available from")).toHaveValue(text); // the text stays, the browser does not blank it
    await saveButton(page).click();
    await expect(page.locator("#availability_date-error")).toHaveText(`Error: ${DATE_INVALID}`);
    expect(await sentOf(index)).toBe(text.trim());
    await expect(detail(page, "Available from")).toHaveValue(text);
  }
  expect((await storedFields(request)).availability_date).toBe("junk"); // nothing was written
  await expect(revision(page)).toHaveText("2");
  // A valid date typed afterwards is accepted.
  await detail(page, "Available from").fill("2027-03-01");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await storedFields(request)).availability_date).toBe("2027-03-01");
});

test("date: a stored text that is not a real date is shown as text, not blanked, and stays text until it is saved", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms_blank");
  await otherSession(request, id(1), { availability_date: "2027-02-30" }); // text no real server holds, but the form must not hide it
  await page.reload();
  const input = detail(page, "Available from");
  await expect(input).toHaveValue("2027-02-30");
  await expect(input).toHaveAttribute("type", "text");
  await expect(input).toHaveAttribute("placeholder", "YYYY-MM-DD");
  await expect(summaryItem(page, "availability_date")).toHaveText("2027-02-30");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(0);
  // Typing character by character never changes the type or the focus, even while the text passes through a real date.
  await input.focus();
  await input.press("End");
  await input.pressSequentially("-5");
  await expect(input).toHaveValue("2027-02-30-5");
  await input.fill("2027-03-01");
  await expect(input).toHaveAttribute("type", "text");
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("availability_date");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await expect(input).toHaveAttribute("type", "date"); // the saved value is a real date now
  await expect(input).toHaveValue("2027-03-01");
});

test("date: the input type follows the saved value, so editing never flips it under the person's fingers", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms_blank");
  const input = detail(page, "Available from");
  await expect(input).toHaveAttribute("type", "date");
  await input.focus();
  for (const typed of ["03", "01", "2027"]) {
    await page.keyboard.type(typed);
    await expect(input).toHaveAttribute("type", "date");
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("availability_date");
  }
  await expect(input).toHaveValue("2027-03-01");
  await input.fill("");
  await expect(input).toHaveAttribute("type", "date");
});

test("date: a partly typed date is not a clear: Save is blocked with the summary, nothing is sent, and the flag goes when it is finished or emptied", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms");
  const input = detail(page, "Available from");
  // A saved date with one segment deleted by keyboard reads "" in the browser, but it is not a clear.
  await input.focus();
  await page.keyboard.press("Backspace");
  await expect(input).toHaveValue("");
  await detail(page, "Pets allowed").selectOption("true"); // another change in the same save must not be sent either
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(page.locator("#availability_date-error")).toHaveText("Error: Finish the date or clear it.");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(summary(page).getByRole("link", { name: "Available from" })).toHaveAttribute("href", "#availability_date");
  await expect(live(page)).toHaveText(ERRORS_ANNOUNCED);
  expect((await patches(request)).count).toBe(0);
  expect((await storedFields(request)).availability_date).toBe("2027-03-01");
  // Finishing the date clears the error; Save then sends the date and the other change.
  await input.focus();
  await page.keyboard.type("04152027");
  await expect(input).toHaveValue("2027-04-15");
  await expect(page.locator("#availability_date-error")).toHaveCount(0);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0].fields).toEqual({ availability_date: "2027-04-15", pets_allowed: true });
  // Emptying every segment is a clear: the error goes and Save sends null.
  await input.focus();
  await page.keyboard.press("Backspace");
  await saveButton(page).click();
  await expect(page.locator("#availability_date-error")).toHaveText("Error: Finish the date or clear it.");
  expect((await patches(request)).count).toBe(1);
  await input.fill("");
  await expect(page.locator("#availability_date-error")).toHaveCount(0);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[1].fields).toEqual({ availability_date: null });
  expect((await storedFields(request)).availability_date).toBeNull();
});

test("date: a date typed only as far as the year on an empty field blocks Save, and completing it saves", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms_blank");
  const input = detail(page, "Available from");
  await input.focus();
  await page.keyboard.type("03");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(page.locator("#availability_date-error")).toHaveText("Error: Finish the date or clear it.");
  expect((await patches(request)).count).toBe(0);
  await input.focus();
  await page.keyboard.type("03012027");
  await expect(page.locator("#availability_date-error")).toHaveCount(0);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0].fields).toEqual({ availability_date: "2027-03-01" });
});

test("registry date bounds fail closed: a bound that is not a real date, junk, a missing bound or a window that ends before it starts gives no min, max or Between", async ({ page, request }) => {
  await registryFields(request, "baddates");
  await openDraft(page, request, "rent_terms_blank");
  for (const label of ["Bad date", "Junk date", "Open date", "Swapped date"]) {
    const input = detail(page, label);
    await expect(input).toHaveAttribute("type", "date");
    await expect(input).not.toHaveAttribute("min");
    await expect(input).not.toHaveAttribute("max");
  }
  for (const field of ["bad_date", "junk_date", "open_date", "swapped_date"]) await expect(page.locator(`#${field}-hint`)).toHaveText("A date.");
  // The real window of the usual field is unaffected.
  await expect(detail(page, "Available from")).toHaveAttribute("min", "2000-01-01");
  await expect(page.locator("#availability_date-hint")).toContainText("Between 2000-01-01 and 2100-12-31.");
});

// ---------------------------------------------------------------- errors

test("terms errors from the real rules: money, integers, booleans, choices and dates map to text under their own controls, the input stays", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms_blank");
  await detail(page, "Security deposit (PKR)").fill("-5");
  await detail(page, "Advance rent (PKR)").fill("1,000");
  await detail(page, "Minimum lease (months)").fill("121");
  await detail(page, "Notice period (days)").fill("3.5");
  await detail(page, "Available from").fill("2027-03-01");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(page.locator("#security_deposit-error")).toHaveText(`Error: ${MONEY_RANGE}`);
  await expect(page.locator("#advance_rent-error")).toHaveText(`Error: ${MONEY_INVALID}`);
  await expect(page.locator("#minimum_lease_months-error")).toHaveText(`Error: ${INTEGER_RANGE}`);
  await expect(page.locator("#notice_period_days-error")).toHaveText(`Error: ${INTEGER_INVALID}`);
  await expect(page.locator("#availability_date-error")).toHaveCount(0);
  await expect(summary(page).getByRole("link")).toHaveCount(4);
  await expect(detail(page, "Security deposit (PKR)")).toHaveValue("-5");
  await expect(detail(page, "Advance rent (PKR)")).toHaveValue("1,000");
  await expect(detail(page, "Notice period (days)")).toHaveValue("3.5");
  // The zero-allowed money fields never say "above zero" (a deposit and the advance rent may be zero).
  await expect(page.locator("#security_deposit-error")).not.toContainText("above zero");
  await detail(page, "Security deposit (PKR)").fill("0");
  await detail(page, "Advance rent (PKR)").fill("1.239");
  await detail(page, "Minimum lease (months)").fill("0");
  await detail(page, "Notice period (days)").fill("366");
  await saveButton(page).click();
  await expect(page.locator("#security_deposit-error")).toHaveCount(0); // zero is accepted
  await expect(page.locator("#advance_rent-error")).toHaveText(`Error: ${MONEY_RANGE}`);
  await expect(page.locator("#minimum_lease_months-error")).toHaveText(`Error: ${INTEGER_RANGE}`);
  await expect(page.locator("#notice_period_days-error")).toHaveText(`Error: ${INTEGER_RANGE}`);
  expect((await patches(request)).bodies[1].fields).toMatchObject({ security_deposit: "0", advance_rent: "1.239", minimum_lease_months: 0, notice_period_days: 366 });
  expect((await storedFields(request)).security_deposit).toBeNull(); // nothing is written when any value is refused
  await expect(revision(page)).toHaveText("1");
});

test("terms errors: the asking price still reads as a limit, not as 'above zero', and the same wording is neutral for every money error", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms_blank");
  await detail(page, "Asking price").fill("0");
  await saveButton(page).click();
  await expect(page.locator("#asking_price-error")).toHaveText(`Error: ${PRICE_RANGE}`);
});

test("terms errors: every code the server can report for a term maps to text, the summary is focused and the values are kept", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms_blank");
  await setMode(request, "listing-patch", "term_codes");
  await detail(page, "Security deposit (PKR)").fill("5");
  await detail(page, "Available from").fill("2027-03-01");
  await detail(page, "Minimum lease (months)").fill("5");
  await detail(page, "Occupant restrictions").selectOption("bachelors_only");
  await detail(page, "Pets allowed").selectOption("true");
  await detail(page, "Advance rent (PKR)").fill("5");
  await detail(page, "Notice period (days)").fill("5");
  await detail(page, "Gas included").selectOption("true");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(page.locator("#security_deposit-error")).toHaveText(`Error: ${MONEY_RANGE}`);
  await expect(page.locator("#availability_date-error")).toHaveText(`Error: ${DATE_RANGE}`);
  await expect(page.locator("#minimum_lease_months-error")).toHaveText(`Error: ${INTEGER_RANGE}`);
  await expect(page.locator("#occupant_restrictions-error")).toHaveText(`Error: ${CHOICE_INVALID}`);
  await expect(page.locator("#pets_allowed-error")).toHaveText(`Error: ${BOOLEAN_INVALID}`);
  await expect(page.locator("#advance_rent-error")).toHaveText(`Error: ${NOT_EDITABLE}`);
  await expect(page.locator("#notice_period_days-error")).toHaveText(`Error: ${GENERIC}`); // an unknown code is generic, never the server's word
  await expect(page.locator("#utility_gas_included-error")).toHaveText(`Error: ${NOT_APPLICABLE}`);
  await expect(summary(page).getByRole("link")).toHaveCount(8);
  await expect(page.locator("body")).not.toContainText("mystery");
  await expect(detail(page, "Security deposit (PKR)")).toHaveValue("5");
  await expect(detail(page, "Available from")).toHaveValue("2027-03-01");
  await expect(detail(page, "Pets allowed")).toHaveAttribute("aria-invalid", "true");
  await expect(live(page)).toHaveText(ERRORS_ANNOUNCED);
  await expect(revision(page)).toHaveText("1");
  await detail(page, "Occupant restrictions").selectOption("families_only");
  await expect(page.locator("#occupant_restrictions-error")).toHaveCount(0);
  await expect(page.locator("#pets_allowed-error")).toBeVisible();
});

test("terms errors: a code for a term with no control goes to the list, never to a link, and an unknown field is generic", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms_blank"); // a rent has no possession availability
  await setMode(request, "listing-patch", "term_hidden");
  await detail(page, "Security deposit (PKR)").fill("5");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(summary(page).getByRole("link")).toHaveCount(0);
  await expect(summary(page).getByRole("listitem")).toHaveText([NOT_APPLICABLE, REJECTED]);
  await expect(detail(page, "Possession availability")).toHaveCount(0);
  await expect(detail(page, "Security deposit (PKR)")).toHaveValue("5");
  await expect(page.locator("body")).not.toContainText("payment_type");
});

test("terms: a value typed after the request went out is not judged by the answer, and the error of an edited field goes", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms_blank");
  await setMode(request, "listing-patch", "term_codes");
  await detail(page, "Security deposit (PKR)").fill("5");
  await detail(page, "Pets allowed").selectOption("true");
  await saveButton(page).click();
  await expect(page.locator("#security_deposit-error")).toBeVisible();
  await detail(page, "Security deposit (PKR)").fill("6");
  await expect(page.locator("#security_deposit-error")).toHaveCount(0);
  await expect(page.locator("#pets_allowed-error")).toBeVisible();
});

// ---------------------------------------------------------------- conflicts

test("terms conflict: the latest values are formatted per type (money, a date as ISO text, Yes or No, a choice), Use latest and Keep mine apply per field and the banner clears", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms");
  await otherSession(request, id(1), {
    security_deposit: "250000.00",
    availability_date: "2027-04-15",
    pets_allowed: "true",
    occupant_restrictions: "bachelors_only",
    minimum_lease_months: "24",
    notice_period_days: "",
    advance_rent: "5000.00",
  });
  await detail(page, "Security deposit (PKR)").fill("200000");
  await detail(page, "Available from").fill("2027-05-01");
  await detail(page, "Pets allowed").selectOption("");
  await detail(page, "Occupant restrictions").selectOption("no_restriction");
  await detail(page, "Minimum lease (months)").fill("6");
  await detail(page, "Notice period (days)").fill("15");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(conflictBanner(page)).toBeFocused();
  await expect(revision(page)).toHaveText("3");
  await expect(page.getByTestId("conflict-security_deposit")).toContainText("Latest saved: PKR 250,000.00");
  await expect(page.getByTestId("conflict-availability_date")).toContainText("Latest saved: 2027-04-15");
  await expect(page.getByTestId("conflict-pets_allowed")).toContainText("Latest saved: Yes");
  await expect(page.getByTestId("conflict-occupant_restrictions")).toContainText("Latest saved: Bachelors only");
  await expect(page.getByTestId("conflict-minimum_lease_months")).toContainText("Latest saved: 24");
  await expect(page.getByTestId("conflict-notice_period_days")).toContainText("Latest saved: Not answered");
  await expect(page.getByTestId("conflict-advance_rent")).toHaveCount(0); // not edited by the owner: it takes the latest, with no row
  await expect(detail(page, "Advance rent (PKR)")).toHaveValue("5000.00");
  await expect(page.locator('[data-testid^="conflict-"]')).toHaveCount(6);
  await expect(liveRegions(page)).toHaveCount(1);
  // The owner's input stays as typed.
  await expect(detail(page, "Security deposit (PKR)")).toHaveValue("200000");
  await expect(detail(page, "Available from")).toHaveValue("2027-05-01");
  await expect(detail(page, "Available from")).toHaveAttribute("aria-describedby", /availability_date-hint availability_date-latest/);
  await page.getByRole("button", { name: "Use latest for Available from" }).click();
  await expect(detail(page, "Available from")).toHaveValue("2027-04-15");
  await expect(detail(page, "Available from")).toBeFocused();
  await page.getByRole("button", { name: "Keep mine for Security deposit (PKR)" }).click();
  await page.getByRole("button", { name: "Use latest for Pets allowed" }).click();
  await expect(detail(page, "Pets allowed")).toHaveValue("true");
  await page.getByRole("button", { name: "Keep mine for Occupant restrictions" }).click();
  await page.getByRole("button", { name: "Keep mine for Minimum lease (months)" }).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT); // one row is still open
  await page.getByRole("button", { name: "Use latest for Notice period (days)" }).click();
  await expect(detail(page, "Notice period (days)")).toHaveValue("");
  await expect(conflictBanner(page)).toHaveCount(0);
  await expect(live(page)).toHaveText("Your choices are applied. Save to keep them.");
  await expect(page.locator('[data-testid^="conflict-"]')).toHaveCount(0);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[1]).toEqual({
    base_revision: 3,
    fields: { security_deposit: "200000", occupant_restrictions: "no_restriction", minimum_lease_months: 6 },
  });
  expect(await storedFields(request)).toMatchObject({
    security_deposit: "200000.00",
    availability_date: "2027-04-15",
    pets_allowed: true,
    occupant_restrictions: "no_restriction",
    minimum_lease_months: 6,
    notice_period_days: null,
    advance_rent: "5000.00",
  });
});

test("terms conflict: typing the latest date by hand ends the banner, and a date another session left equal to the owner's is already saved", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms");
  await otherSession(request, id(1), { availability_date: "2027-06-06" });
  await detail(page, "Available from").fill("2027-07-07");
  await saveButton(page).click();
  await expect(page.getByTestId("conflict-availability_date")).toContainText("Latest saved: 2027-06-06");
  await detail(page, "Available from").fill("2027-06-06");
  await expect(conflictBanner(page)).toHaveCount(0);
  await expect(live(page)).toHaveText("Your choices are applied. Save to keep them.");
  await openDraft(page, request, "rent_terms");
  await otherSession(request, id(1), { availability_date: "2027-08-08", pets_allowed: "true" });
  await detail(page, "Available from").fill("2027-08-08");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toBeVisible(); // the pets answer moved elsewhere: a normal conflict
  await expect(page.getByTestId("conflict-availability_date")).toHaveCount(0); // the same date: no row
  await expect(detail(page, "Pets allowed")).toHaveValue("true");
  await openDraft(page, request, "rent_terms");
  await otherSession(request, id(1), { availability_date: "2027-09-09" });
  await detail(page, "Available from").fill("2027-09-09");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(ALREADY_SAVED);
});

test("terms conflict: a sale's terms conflict the same way (a choice and a yes or no), and the possession row says seller-declared", async ({ page, request }) => {
  await openDraft(page, request, "sale_terms");
  await otherSession(request, id(1), { possession_availability: "after_three_months", price_negotiable: "false" });
  await detail(page, "Possession availability").selectOption("available_now");
  await detail(page, "Price negotiable").selectOption("");
  await saveButton(page).click();
  await expect(page.getByTestId("conflict-possession_availability")).toContainText("Latest saved (seller-declared): After three months");
  await expect(page.getByTestId("conflict-price_negotiable")).toContainText("Latest saved: No");
  await expect(page.getByTestId("conflict-price_negotiable")).not.toContainText("seller-declared");
});

// ---------------------------------------------------------------- seller-declared

test("seller-declared: the possession availability carries the tag and the helper line, tied to the control, and no other term does", async ({ page, request }) => {
  await openDraft(page, request, "sale_terms_blank");
  await expect(page.getByTestId("possession_availability-seller-declared")).toHaveText(SELLER_DECLARED);
  await expect(page.getByTestId("possession_availability-declared-help")).toHaveText(SELLER_HELP);
  await expect(page.locator("#possession_availability")).toHaveAttribute("aria-describedby", /possession_availability-declared-tag possession_availability-declared/);
  await expect(page.locator("#possession_availability-hint")).toHaveText("When the buyer can take possession, as the seller states it.");
  await expect(detail(page, "Possession availability")).toHaveCount(1); // the label stays the control's own name
  await expect(page.locator('[data-testid$="-seller-declared"]')).toHaveCount(1);
  await expect(page.getByTestId("price_negotiable-seller-declared")).toHaveCount(0);
  await expectNoPlatformBadge(page);
  await openDraft(page, request, "rent_terms_blank");
  await expect(page.locator('[data-testid$="-seller-declared"]')).toHaveCount(0); // the rent terms are the owner's, but none is flagged as a claim
  await expectNoPlatformBadge(page);
});

test("seller-declared: the Draft summary marks the possession answer and only that, with no platform badge", async ({ page, request }) => {
  await openDraft(page, request, "sale_terms");
  await expect(summaryItem(page, "possession_availability")).toHaveText("Within one month. Seller-declared");
  await expect(page.getByTestId("draft-detail-possession_availability-seller-declared")).toHaveText(SELLER_DECLARED);
  await expect(summaryItem(page, "price_negotiable")).toHaveText("Yes");
  await expect(page.locator('[data-testid="draft-details"] [data-testid$="-seller-declared"]')).toHaveCount(1);
  await expectNoPlatformBadge(page);
  await otherSession(request, id(1), { possession_availability: "after_three_months" });
  await detail(page, "Price negotiable").selectOption("false");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toBeVisible();
  await expectNoPlatformBadge(page);
});

// ---------------------------------------------------------------- the registry decides

test("registry-driven: another date window, requirement, range, section and choice list change the Terms with no code", async ({ page, request }) => {
  await registryFields(request, "termsother");
  await openDraft(page, request, "rent_terms_blank");
  // The date window and the requirement come from the registry; the bounds stay plain text.
  await expect(detail(page, "Available from")).toHaveAttribute("min", "2026-01-01");
  await expect(detail(page, "Available from")).toHaveAttribute("max", "2027-12-31");
  await expect(page.locator("#availability_date-hint")).toHaveText("The date the property is available from, as a calendar date (YYYY-MM-DD). Between 2026-01-01 and 2027-12-31.");
  await expect(termsLabels(page, "required")).toHaveText(["Available from"]);
  await expect(termsLabels(page, "recommended")).toHaveText(["Security deposit (PKR)"]);
  await expect(page.locator("#notice_period_days-hint")).toHaveText("Notice period in days. Whole number from 0 to 90.");
  // A term the registry moved to the details sits there, and one of a type with no control gets none.
  await expect(termsBlock(page).getByLabel("Advance rent (PKR)")).toHaveCount(0);
  await expect(termsBlock(page).getByLabel("Price negotiable")).toHaveCount(0);
  await expect(page.getByTestId("details-block").getByLabel("Advance rent (PKR)", { exact: true })).toBeVisible();
  await expect(page.getByTestId("details-block").getByLabel("Price negotiable", { exact: true })).toBeVisible();
  await expect(detailsLabels(page, "more")).toContainText(["Price negotiable", "Advance rent (PKR)"]);
  await expect(page.locator("#deposit_scheme")).toHaveCount(0);
  await expect(page.getByText("Deposit scheme")).toHaveCount(0);
  // The server judges the window: a date the first registry accepts is outside this one.
  await detail(page, "Available from").fill("2028-01-01");
  await saveButton(page).click();
  await expect(page.locator("#availability_date-error")).toHaveText(`Error: ${DATE_RANGE}`);
  await detail(page, "Available from").fill("2027-12-31");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await openDraft(page, request, "sale_terms_blank");
  await expect(detail(page, "Possession availability").locator("option")).toHaveText(["Not answered", "Available now", "After three months"]);
});

test("registry-driven: a registry without the section marker keeps every detail in the Details, and an unknown marker counts as details", async ({ page, request }) => {
  await registryFields(request, "nosection");
  await openDraft(page, request, "rent_terms_blank");
  await expect(termsBlock(page)).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Terms for rent" })).toHaveCount(0);
  for (const label of RENT_ONLY) await expect(page.getByTestId("details-block").getByLabel(label, { exact: true })).toBeVisible();
  await expect(detail(page, "Rental period")).toBeVisible(); // still the hand-built control
  await registryFields(request, "oddsection");
  await page.reload();
  await expect(detail(page, "Security deposit (PKR)")).toBeVisible();
  await expect(inTerms(page, "Security deposit (PKR)")).toBeVisible();
  await expect(inTerms(page, "Pets allowed")).toHaveCount(0);
  await expect(page.getByTestId("details-block").getByLabel("Pets allowed", { exact: true })).toBeVisible();
});

test("registry-driven: a registry with no terms shows no Terms fieldset, and one with no fields at all shows nothing to edit", async ({ page, request }) => {
  await registryFields(request, "other"); // defines no terms
  await openDraft(page, request, "rent_terms_blank");
  await expect(termsBlock(page)).toHaveCount(0);
  await expect(page.locator("fieldset.terms-block, fieldset.terms-group")).toHaveCount(0);
  await registryFields(request, "none");
  await page.reload();
  await expect(page.getByTestId("draft-nothing-editable")).toBeVisible();
  await expect(termsBlock(page)).toHaveCount(0);
});

// ---------------------------------------------------------------- the stub mirrors the backend

test("the stub's rules: a rent term on a sale Draft is not applicable and a null is a no-op before that is judged", async ({ request }) => {
  await preset(request, "sale_terms_blank");
  await request.get(`${STUB}/__force-session`);
  const csrf = (await (await request.get(`${STUB}/api/v1/csrf`)).json()) as { csrf_token?: string; token?: string };
  const token = csrf.csrf_token ?? csrf.token ?? "";
  const patch = (fields: Record<string, unknown>, base = 1) =>
    request.patch(`${STUB}/api/v1/listings/${id(1)}`, { data: { base_revision: base, fields }, headers: { "X-CSRFToken": token, cookie: "estate_session=stub-live" } });
  const wrong = await patch({ security_deposit: "5" });
  expect(wrong.status()).toBe(400);
  expect((await wrong.json()).error.fields).toEqual({ security_deposit: ["not_applicable"] });
  const nothing = await patch({ security_deposit: null, availability_date: null });
  expect(nothing.status()).toBe(200);
  expect((await nothing.json()).revision).toBe(1);
  for (const [fields, code] of [
    [{ availability_date: "2027-03-01" }, "not_applicable"],
    [{ price_negotiable: "yes" }, "invalid"],
    [{ possession_availability: "soon" }, "invalid_choice"],
    [{ possession_availability: 3 }, "invalid"],
  ] as const) {
    const response = await patch(fields);
    expect((await response.json()).error.fields, JSON.stringify(fields)).toEqual({ [Object.keys(fields)[0]]: [code] });
  }
  for (const stored of [{ deferred: 1 }, { payment_type: "cash" }, { installment_available: true }, { payment_type: null }, { down_payment: null }, { installment_available: null }]) {
    const response = await patch(stored);
    expect((await response.json()).error.fields).toEqual({ non_field_errors: ["unknown_field"] });
  }
});

test("the stub's rules: dates and money are judged like the backend's (shape and window, zero allowed for the deposit and the advance)", async ({ request }) => {
  await preset(request, "rent_terms_blank");
  await request.get(`${STUB}/__force-session`);
  const csrf = (await (await request.get(`${STUB}/api/v1/csrf`)).json()) as { csrf_token?: string; token?: string };
  const token = csrf.csrf_token ?? csrf.token ?? "";
  const patch = (fields: Record<string, unknown>) =>
    request.patch(`${STUB}/api/v1/listings/${id(1)}`, { data: { base_revision: 1, fields }, headers: { "X-CSRFToken": token, cookie: "estate_session=stub-live" } });
  const codeOf = async (field: string, value: unknown) => {
    const response = await patch({ [field]: value });
    return response.status() === 200 ? "ok" : (await response.json()).error.fields[field][0];
  };
  for (const value of ["2027-02-30", "2027-3-1", "2027-03-01T00:00:00", 20270301, "٢٠٢٧-٠٣-٠١", "2027-13-01", "2027-00-10", true, ""]) expect(await codeOf("availability_date", value), String(value)).toBe("invalid");
  for (const value of ["1999-12-31", "2101-01-01", "0001-01-01"]) expect(await codeOf("availability_date", value), value).toBe("invalid_date");
  for (const value of ["-1", "1.234", "99999999999999.00"]) expect(await codeOf("security_deposit", value), value).toBe("invalid_price");
  for (const value of ["abc", "1,5", 5.5, true, ""]) expect(await codeOf("advance_rent", value), String(value)).toBe("invalid");
  expect(await codeOf("minimum_lease_months", 0)).toBe("invalid_range");
  expect(await codeOf("minimum_lease_months", 121)).toBe("invalid_range");
  expect(await codeOf("minimum_lease_months", "12")).toBe("invalid");
  expect(await codeOf("minimum_lease_months", 12.5)).toBe("invalid");
  expect(await codeOf("notice_period_days", -1)).toBe("invalid_range");
  expect(await codeOf("notice_period_days", 366)).toBe("invalid_range");
  expect(await codeOf("occupant_restrictions", "any")).toBe("invalid_choice");
  expect(await codeOf("pets_allowed", "yes")).toBe("invalid");
  expect(await codeOf("security_deposit", "0")).toBe("ok");
  // Like check_money: a bare JSON integer and text with surrounding spaces are accepted (each save moves the revision, so start again).
  await preset(request, "rent_terms_blank");
  expect(await codeOf("advance_rent", 5)).toBe("ok");
  expect((await storedFields(request)).advance_rent).toBe("5.00");
  await preset(request, "rent_terms_blank");
  expect(await codeOf("advance_rent", "  7 ")).toBe("ok");
  expect((await storedFields(request)).advance_rent).toBe("7.00");
});

// ---------------------------------------------------------------- privacy

test("terms: the answers carry no listing data into storage, the console, the title or the address bar", async ({ page, request }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  page.on("dialog", (dialog) => void dialog.accept());
  await openDraft(page, request, "rent_terms_blank");
  await detail(page, "Security deposit (PKR)").fill("7777");
  await detail(page, "Advance rent (PKR)").fill("3333");
  await detail(page, "Available from").fill("2033-03-03");
  await detail(page, "Pets allowed").selectOption("true");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await setMode(request, "listing-patch", "term_codes");
  await detail(page, "Security deposit (PKR)").fill("7778");
  await saveButton(page).click();
  await expect(summary(page)).toBeVisible();
  await expect(page).toHaveTitle("Draft | EstateAI");
  expect(new URL(page.url()).search + new URL(page.url()).hash).toBe("");
  const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
  for (const secret of ["7777", "3333", "2033-03-03", id(1)]) expect(stored).not.toContain(secret);
  expect(await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))).toBe("[{},{}]");
  for (const secret of ["7777", "3333", "2033-03-03", id(1)]) expect(logs.join("\n")).not.toContain(secret);
});

test("terms: Save stays aria-disabled while saving and a double click sends one request", async ({ page, request }) => {
  await openDraft(page, request, "rent_terms_blank");
  await setMode(request, "listing-patch", "slow");
  await detail(page, "Security deposit (PKR)").fill("4444");
  await saveButton(page).click();
  await expect(saveButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(saveButton(page)).not.toHaveAttribute("disabled");
  await saveButton(page).click({ force: true });
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).count).toBe(1);
});

// ---------------------------------------------------------------- accessibility

for (const viewport of viewports) {
  test(`accessibility (${viewport.name}): the Terms in their states have no axe violations`, async ({ page, request }) => {
    page.on("dialog", (dialog) => void dialog.accept()); // the page is left with unsaved changes on purpose
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openDraft(page, request, "sale_terms_blank");
    await expectNoViolations(page, "empty sale terms");
    await openDraft(page, request, "sale_terms");
    await expectNoViolations(page, "sale terms with answers and the seller-declared claim");
    await openDraft(page, request, "rent_terms_blank");
    await expectNoViolations(page, "empty rent terms");
    await openDraft(page, request, "rent_terms");
    await expectNoViolations(page, "rent terms with answers");
    await setMode(request, "listing-patch", "term_codes");
    await detail(page, "Security deposit (PKR)").fill("5");
    await detail(page, "Available from").fill("2027-03-01");
    await detail(page, "Minimum lease (months)").fill("5");
    await detail(page, "Occupant restrictions").selectOption("bachelors_only");
    await detail(page, "Pets allowed").selectOption("true");
    await saveButton(page).click();
    await expect(summary(page)).toBeVisible();
    await expect(page.locator("#availability_date-error")).toBeVisible();
    await expectNoViolations(page, "rent terms with errors");
    await setMode(request, "listing-patch", "ok");
    await openDraft(page, request, "rent_terms");
    await otherSession(request, id(1), { availability_date: "2027-04-15", security_deposit: "250000.00", pets_allowed: "true" });
    await detail(page, "Available from").fill("2027-05-01");
    await detail(page, "Security deposit (PKR)").fill("200000");
    await detail(page, "Pets allowed").selectOption("");
    await saveButton(page).click();
    await expect(conflictBanner(page)).toBeVisible();
    await expect(page.getByTestId("conflict-availability_date")).toBeVisible();
    await expectNoViolations(page, "rent terms conflict with a date row");
    await openTextDate(page, request);
    await detail(page, "Available from").fill("2027-02-30");
    await saveButton(page).click();
    await expect(page.locator("#availability_date-error")).toBeVisible();
    await expectNoViolations(page, "an invalid date typed as text");
  });
}
