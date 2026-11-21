import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Story 2.2 and 2.3, frontend half: the Draft editor, its validation, the conflict flow and the other answers, against the stub backend.
const STUB = "http://127.0.0.1:4010";
const APP = "http://127.0.0.1:3100";
const LIST = "/account/listings";
const THROTTLED = "Too many attempts. Try again in 2 minutes.";
const SERVER = "Something went wrong on our side. Please try again in a moment.";
const NETWORK = "We could not reach the server. Check your connection and try again.";
const TIMEOUT = "The server took too long to answer. Please try again.";
const REJECTED = "This request could not be submitted. Please try again.";
const GENERIC = "Enter a valid value.";
const EDIT_FORBIDDEN = "Your account cannot edit listings right now.";
const NOT_FOUND = "We could not find that listing.";
const CONFLICT =
  "This draft was changed in another session. We loaded the latest version; your unsaved changes are still in the form. Review them and save again.";
const ALREADY_SAVED = "Your changes are already saved.";
const PRICE_INVALID =
  "Enter digits only, with an optional decimal point. Do not use commas or currency signs, for example 1500000 or 1500000.50.";
const CONTACT = "Titles and descriptions cannot contain phone numbers, email addresses or street addresses.";
const ERRORS_ANNOUNCED = "The form has errors. Review the list at the top of the page.";
// Repetitive digit patterns, like the stub's own ids; fake-word text only.
const id = (seq: number) => `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`;

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

type Mode = "signin" | "listing-detail" | "listing-patch" | "csrf" | "registry";
const setMode = (request: APIRequestContext, kind: Mode, value: string) => request.get(`${STUB}/__${kind}-mode?value=${value}`);
const preset = (request: APIRequestContext, value: string) => request.get(`${STUB}/__listings-preset?value=${value}`);
const registryFields = (request: APIRequestContext, value: string) => request.get(`${STUB}/__registry-fields?value=${value}`);
const patches = async (request: APIRequestContext) => (await request.get(`${STUB}/__listing-patch-stats`)).json();
const stats = async (request: APIRequestContext) => (await request.get(`${STUB}/__listings-stats`)).json();
/** Another session changes fields of a Draft and bumps its revision. */
const otherSession = (request: APIRequestContext, listing: string, changes: Record<string, string>) =>
  request.get(`${STUB}/__other-session?${new URLSearchParams({ id: listing, ...changes }).toString()}`);
const settle = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

const main = (page: Page) => page.getByRole("main");
const titleInput = (page: Page) => page.getByLabel("Title", { exact: true });
const descriptionInput = (page: Page) => page.getByLabel("Description", { exact: true });
const priceInput = (page: Page) => page.getByLabel("Asking price", { exact: true });
const basisSelect = (page: Page) => page.getByLabel("Price basis", { exact: true });
const periodSelect = (page: Page) => page.getByLabel("Rental period", { exact: true });
const areaInput = (page: Page) => page.getByLabel("Area value", { exact: true });
const unitSelect = (page: Page) => page.getByLabel("Unit", { exact: true });
const marlaSelect = (page: Page) => page.getByLabel("Marla basis", { exact: true });
const derived = (page: Page) => page.getByTestId("area-derived");
const areaSummary = (page: Page) => page.getByTestId("draft-area");
const UNSAVED = " (saved figure, updates after you save)";
const UNKNOWN_BASIS = "Not available until the marla size is known";
const EXPLANATION =
  "A marla is not the same size everywhere. Tell us how many square feet your marla is. If you leave it unknown you can still publish, but your listing will not appear when buyers filter by area and it will have no price estimate.";
const AREA_INVALID = "Enter digits only, with an optional decimal point. Do not use commas, signs or units, for example 1200 or 10.5.";
const AREA_LIMITS = "Enter an area above zero within the limits shown above, with no more decimal places than allowed.";
const saveButton = (page: Page) => page.getByRole("button", { name: /^(Save changes|Saving…)$/ });
const live = (page: Page) => page.getByTestId("draft-live");
const conflictBanner = (page: Page) => page.getByTestId("draft-conflict");
const notice = (page: Page) => page.getByTestId("draft-notice");
const summary = (page: Page) => page.getByRole("group", { name: "There is a problem" });
const revision = (page: Page) => page.getByTestId("draft-revision");
/** The live regions inside the page content that currently say something. */
const liveRegions = (page: Page) => main(page).locator('[role="status"], [role="alert"], [aria-live]').filter({ hasText: /\S/ });

async function startSession(page: Page, request: APIRequestContext) {
  await request.get(`${STUB}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP }]);
}

/** Opens Draft 1 of a preset (`titled` by default) and waits for the editor. */
async function openDraft(page: Page, request: APIRequestContext, which = "titled") {
  await preset(request, which);
  await startSession(page, request);
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Draft" })).toBeVisible();
  await expect(titleInput(page)).toBeVisible();
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

const TITLE0 = "Corner house with garden";
const DESCRIPTION0 = "Three bedrooms near the park.";

// ---------------------------------------------------------------- the form

test("editor: prefilled from the Draft, with the limits, hints and choices of the registry", async ({ page, request }) => {
  await openDraft(page, request);
  await expect(titleInput(page)).toHaveValue(TITLE0);
  await expect(descriptionInput(page)).toHaveValue(DESCRIPTION0);
  await expect(priceInput(page)).toHaveValue("1500000.00");
  await expect(basisSelect(page)).toHaveValue("total");
  await expect(periodSelect(page)).toHaveCount(0); // a sale has no rental period
  await expect(page.locator("#title-hint")).toHaveText("Required before you publish. 10 to 100 characters.");
  await expect(page.locator("#description-hint")).toHaveText("Recommended. Up to 5000 characters.");
  await expect(page.locator("#asking_price-hint")).toHaveText("Required before you publish. Amount in PKR. Between 0.01 and 999999999999.99.");
  await expect(page.locator("#price_basis-hint")).toHaveText("Required before you publish.");
  await expect(basisSelect(page).locator("option")).toHaveText(["Not set", "Total", "Per unit"]);
  await expect(page.locator(".money-prefix")).toHaveText("PKR");
  await expect(priceInput(page)).toHaveAttribute("inputmode", "decimal");
  // The summary keeps what it showed, and the price is formatted from the server's text.
  await expect(page.getByTestId("draft-status")).toHaveText("Draft");
  await expect(revision(page)).toHaveText("3");
  await expect(page.getByTestId("draft-registry-version")).toHaveText("1");
  await expect(page.getByTestId("draft-price")).toHaveText("PKR 1,500,000.00");
  for (const input of [titleInput(page), descriptionInput(page)]) await expect(input).not.toHaveAttribute("maxlength");
  await expect(page.locator("form")).toHaveAttribute("method", "post");
  await expect(live(page)).toHaveText("");
});

test("rent and sale: the rental period only for a rent, and the price basis choices follow the purpose", async ({ page, request }) => {
  await openDraft(page, request, "rent");
  await expect(periodSelect(page)).toBeVisible();
  await expect(basisSelect(page).locator("option")).toHaveText(["Not set", "Rental period"]);
  await expect(periodSelect(page).locator("option")).toHaveText(["Not set", "Day", "Week", "Month", "Year"]);
  await expect(page.locator("#rental_period-hint")).toHaveText("Required before you publish.");
  await expect(page.getByTestId("draft-price")).toHaveText("Not set");
  await expect(titleInput(page)).toHaveValue("");
  await openDraft(page, request, "rent_filled");
  await expect(periodSelect(page)).toHaveValue("month");
  await expect(basisSelect(page)).toHaveValue("rental_period");
  await expect(page.getByTestId("draft-price")).toHaveText("PKR 85,000.00");
  await openDraft(page, request, "titled");
  await expect(periodSelect(page)).toHaveCount(0);
});

test("registry drives the form: other limits and values change the hints, counters and choices", async ({ page, request }) => {
  await registryFields(request, "other");
  await openDraft(page, request);
  await expect(page.locator("#title-hint")).toHaveText("Recommended. 5 to 20 characters.");
  await expect(page.getByTestId("title-count")).toHaveText("24 of 20 characters. 4 too many: shorten the text.");
  await expect(page.locator("#description-hint")).toHaveText("Up to 50 characters.");
  await expect(page.getByTestId("description-count")).toHaveText("29 of 50 characters");
  await expect(page.locator("#asking_price-hint")).toHaveText("Recommended. Amount in PKR. Between 1.00 and 9999.00.");
  await expect(page.locator("#price_basis-hint")).toHaveCount(0); // optional: no requirement hint
  await expect(basisSelect(page).locator("option")).toHaveText(["Not set", "Total"]);
  await openDraft(page, request, "rent");
  await expect(periodSelect(page).locator("option")).toHaveText(["Not set", "Day", "Week"]);
  await expect(page.locator("#rental_period-hint")).toHaveText("Recommended.");
});

test("registry without editable fields: the Draft shows what exists and says nothing can be edited", async ({ page, request }) => {
  await registryFields(request, "none");
  await preset(request, "titled");
  await startSession(page, request);
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByTestId("draft-nothing-editable")).toBeVisible();
  await expect(page.getByTestId("draft-price")).toHaveText("PKR 1,500,000.00");
  await expect(main(page).getByRole("textbox")).toHaveCount(0);
  await expect(saveButton(page)).toHaveCount(0);
});

test("registry failure: the summary stays, Retry loads the form", async ({ page, request }) => {
  await setMode(request, "registry", "flaky");
  await preset(request, "titled");
  await startSession(page, request);
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByTestId("registry-error")).toBeVisible();
  await expect(page.getByTestId("draft-status")).toHaveText("Draft");
  await expect(titleInput(page)).toHaveCount(0);
  await main(page).getByRole("button", { name: "Retry" }).click();
  await expect(titleInput(page)).toHaveValue(TITLE0);
});

test("counters: plain text in code points after whitespace collapse, never a live region, and a long paste is not truncated", async ({ page, request }) => {
  await openDraft(page, request);
  await titleInput(page).fill("a   b");
  await expect(page.getByTestId("title-count")).toHaveText("3 of 100 characters");
  await titleInput(page).fill("😀😀 ok");
  await expect(page.getByTestId("title-count")).toHaveText("5 of 100 characters");
  await descriptionInput(page).fill("one\n\n\n\ntwo   words");
  await expect(page.getByTestId("description-count")).toHaveText("14 of 5000 characters");
  const long = "x".repeat(120);
  await titleInput(page).fill(long);
  await expect(page.getByTestId("title-count")).toHaveText("120 of 100 characters. 20 too many: shorten the text.");
  expect(await titleInput(page).inputValue()).toHaveLength(120); // nothing silently truncated
  await expect(page.locator('[aria-live] [data-testid="title-count"], [role="status"] [data-testid="title-count"]')).toHaveCount(0);
  await expect(titleInput(page)).toHaveAttribute("aria-describedby", /title-hint title-count/);
});

// ---------------------------------------------------------------- saving

test("save: only the changed field is sent with the base revision; the revision updates, Saved is announced and focus stays", async ({ page, request }) => {
  await openDraft(page, request);
  await titleInput(page).fill("  Corner house with a big garden ");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await expect(revision(page)).toHaveText("4");
  await expect(page.getByTestId("draft-registry-version")).toHaveText("3");
  const sent = await patches(request);
  expect(sent.count).toBe(1);
  expect(sent.bodies[0]).toEqual({ base_revision: 3, fields: { title: "Corner house with a big garden" } });
  expect(sent.tokens[0]).toBe("csrf-0");
  await expect(titleInput(page)).toHaveValue("Corner house with a big garden"); // the server's normalised value
  await expect(saveButton(page)).toBeFocused();
  expect(await page.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; })).toBe(false);
  await expect(conflictBanner(page)).toHaveCount(0);
});

test("save: the next save carries the new revision", async ({ page, request }) => {
  await openDraft(page, request);
  await titleInput(page).fill("A second title for the house");
  await saveButton(page).click();
  await expect(revision(page)).toHaveText("4");
  await descriptionInput(page).fill("A new description of the house.");
  await saveButton(page).click();
  await expect(revision(page)).toHaveText("5");
  const sent = await patches(request);
  expect(sent.bodies.map((body: { base_revision: number }) => body.base_revision)).toEqual([3, 4]);
  expect(sent.bodies[1]).toEqual({ base_revision: 4, fields: { description: "A new description of the house." } });
});

test("nothing changed: no request and a polite message", async ({ page, request }) => {
  await openDraft(page, request);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  await titleInput(page).fill(`  ${TITLE0}  `); // a trim-only difference is not a change
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  await priceInput(page).fill("1500000"); // the same amount written another way
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  await settle();
  expect((await patches(request)).count).toBe(0);
});

test("clear a field: an emptied description is sent as null", async ({ page, request }) => {
  await openDraft(page, request);
  await descriptionInput(page).fill("");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({ base_revision: 3, fields: { description: null } });
  await expect(descriptionInput(page)).toHaveValue("");
  await expect(revision(page)).toHaveText("4");
});

test("price text: sent as typed (trimmed) and shown formatted from the server's string, never as a float", async ({ page, request }) => {
  await openDraft(page, request);
  await priceInput(page).fill("2500000");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await expect(page.getByTestId("draft-price")).toHaveText("PKR 2,500,000.00");
  await priceInput(page).fill(" 1500000.50 ");
  await saveButton(page).click();
  await expect(revision(page)).toHaveText("5");
  await expect(page.getByTestId("draft-price")).toHaveText("PKR 1,500,000.50");
  await priceInput(page).fill("999999999999.10");
  await saveButton(page).click();
  await expect(revision(page)).toHaveText("6");
  // A float would print 999999999999.1: the digits are kept as the server wrote them.
  await expect(page.getByTestId("draft-price")).toHaveText("PKR 999,999,999,999.10");
  await expect(priceInput(page)).toHaveValue("999999999999.10");
  const sent = await patches(request);
  expect(sent.bodies.map((body: { fields: { asking_price: string } }) => body.fields.asking_price)).toEqual(["2500000", "1500000.50", "999999999999.10"]);
});

test("rent: the price basis and the rental period are saved", async ({ page, request }) => {
  await openDraft(page, request, "rent");
  await basisSelect(page).selectOption("rental_period");
  await periodSelect(page).selectOption("month");
  await priceInput(page).fill("85000");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({ base_revision: 1, fields: { asking_price: "85000", price_basis: "rental_period", rental_period: "month" } });
  await expect(basisSelect(page)).toHaveValue("rental_period");
  await expect(periodSelect(page)).toHaveValue("month");
  await periodSelect(page).selectOption("");
  await saveButton(page).click();
  await expect(revision(page)).toHaveText("3");
  expect((await patches(request)).bodies[1]).toEqual({ base_revision: 2, fields: { rental_period: null } });
});

test("Saved goes away on the next edit and typing during a save is not overwritten", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "slow");
  await titleInput(page).fill("A title typed before saving");
  await saveButton(page).click();
  await expect(saveButton(page)).toHaveAttribute("aria-disabled", "true");
  await descriptionInput(page).fill("Typed while the save was running.");
  await expect(live(page)).toHaveText("Saved");
  await expect(descriptionInput(page)).toHaveValue("Typed while the save was running.");
  await expect(titleInput(page)).toHaveValue("A title typed before saving");
  await titleInput(page).fill("Another edit after the save");
  await expect(live(page)).toHaveText("");
});

// ---------------------------------------------------------------- validation

test("field errors: each code maps to text under its control, the summary takes focus and the values are kept", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "codes");
  await titleInput(page).fill("Short");
  await descriptionInput(page).fill("Reach me on a number");
  await priceInput(page).fill("0");
  await basisSelect(page).selectOption("per_unit");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(page.locator("#title-error")).toHaveText("Error: The title is too short. Check the length shown above.");
  await expect(page.locator("#description-error")).toHaveText(`Error: ${CONTACT}`);
  await expect(page.locator("#asking_price-error")).toHaveText("Error: Enter an amount above zero within the limits shown above, with at most two decimal places.");
  await expect(page.locator("#price_basis-error")).toHaveText("Error: Choose a price basis from the list.");
  await expect(summary(page).getByRole("link")).toHaveCount(4);
  await expect(live(page)).toHaveText(ERRORS_ANNOUNCED);
  await expect(titleInput(page)).toHaveAttribute("aria-invalid", "true");
  await expect(titleInput(page)).toHaveValue("Short");
  await expect(descriptionInput(page)).toHaveValue("Reach me on a number");
  await expect(priceInput(page)).toHaveValue("0");
  await expect(basisSelect(page)).toHaveValue("per_unit");
  await expect(saveButton(page)).not.toHaveAttribute("aria-disabled");
  await expect(revision(page)).toHaveText("3");
  // The summary links to the control; an error clears when its field is edited.
  await summary(page).getByRole("link", { name: /^Asking price:/ }).click();
  await expect(priceInput(page)).toBeFocused();
  await priceInput(page).fill("10");
  await expect(page.locator("#asking_price-error")).toHaveCount(0);
  await expect(page.locator("#title-error")).toBeVisible();
  await expect(summary(page).getByRole("link", { name: /^Asking price:/ })).toHaveCount(0);
});

test("field errors from the real rules: too short, contact details, a price with three decimals and one that is not a number", async ({ page, request }) => {
  await openDraft(page, request);
  await titleInput(page).fill("Short");
  await descriptionInput(page).fill("Write to me at someone@example.test please");
  await priceInput(page).fill("12.345");
  await saveButton(page).click();
  await expect(page.locator("#title-error")).toContainText("too short");
  await expect(page.locator("#description-error")).toHaveText(`Error: ${CONTACT}`);
  await expect(page.locator("#asking_price-error")).toContainText("at most two decimal places");
  await priceInput(page).fill("abc");
  await titleInput(page).fill(TITLE0);
  await descriptionInput(page).fill(DESCRIPTION0);
  await saveButton(page).click();
  await expect(page.locator("#asking_price-error")).toHaveText(`Error: ${PRICE_INVALID}`);
  await expect(page.locator("#title-error")).toHaveCount(0);
  await titleInput(page).fill("t".repeat(101));
  await priceInput(page).fill("1500000");
  await saveButton(page).click();
  await expect(page.locator("#title-error")).toContainText("too long");
  expect(await titleInput(page).inputValue()).toHaveLength(101);
  expect((await patches(request)).count).toBe(3);
});

test("field errors: a choice the registry no longer offers is invalid_choice on its control", async ({ page, request }) => {
  await openDraft(page, request, "rent");
  await periodSelect(page).selectOption("month");
  await registryFields(request, "other"); // month is no longer allowed on the server
  await saveButton(page).click();
  await expect(page.locator("#rental_period-error")).toHaveText("Error: Choose a rental period from the list.");
  await expect(periodSelect(page)).toHaveValue("month");
});

test("field errors: a field with no control on this form goes to the list, never to a link", async ({ page, request }) => {
  await openDraft(page, request); // a sale: no rental period control
  await setMode(request, "listing-patch", "hidden");
  await titleInput(page).fill("A different title for the house");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(summary(page).getByRole("link")).toHaveCount(0);
  await expect(summary(page).getByRole("listitem")).toHaveText(["A rental period applies only to rentals."]);
  await expect(periodSelect(page)).toHaveCount(0);
});

test("field errors: unknown codes, sentences and prototype keys are generic, never the server's text", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "unknown");
  await titleInput(page).fill("A different title for the house");
  await saveButton(page).click();
  await expect(page.locator("#title-error")).toHaveText(`Error: ${GENERIC}`);
  await expect(page.locator("#description-error")).toHaveText(`Error: ${GENERIC}`);
  await expect(page.locator("#asking_price-error")).toHaveText(`Error: ${GENERIC}`);
  await expect(summary(page).getByRole("listitem").last()).toHaveText(REJECTED);
  await expect(main(page)).not.toContainText("Some server sentence");
  await expect(main(page)).not.toContainText("Some other sentence");
  await expect(main(page)).not.toContainText("mystery_code");
});

test("field errors: unknown_field and not_editable are generic; an answer with no fields is the rejected message", async ({ page, request }) => {
  await openDraft(page, request);
  await titleInput(page).fill("A different title for the house");
  await setMode(request, "listing-patch", "non_field");
  await saveButton(page).click();
  await expect(summary(page).getByRole("listitem")).toHaveText([REJECTED]);
  await setMode(request, "listing-patch", "not_editable");
  await saveButton(page).click();
  await expect(page.locator("#title-error")).toHaveText("Error: This detail cannot be changed here.");
  await setMode(request, "listing-patch", "empty_fields");
  await saveButton(page).click();
  await expect(summary(page).getByRole("listitem")).toHaveText([REJECTED]);
  await expect(page.locator("#title-error")).toHaveCount(0);
  await expect(titleInput(page)).toHaveValue("A different title for the house");
});

// ---------------------------------------------------------------- the conflict flow

test("conflict: the latest data is loaded, what was typed stays, and the owner chooses per field before saving again", async ({ page, request }) => {
  await openDraft(page, request);
  await otherSession(request, id(1), { title: "Other title from phone", description: "Description from phone", asking_price: "2500000.50" });
  await titleInput(page).fill("My own title for the house");
  await descriptionInput(page).fill("My own description text");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(conflictBanner(page)).toBeFocused();
  await expect(revision(page)).toHaveText("4");
  // Nothing was overwritten: typed values stay as typed; a field the owner did not touch shows the latest value.
  await expect(titleInput(page)).toHaveValue("My own title for the house");
  await expect(descriptionInput(page)).toHaveValue("My own description text");
  await expect(priceInput(page)).toHaveValue("2500000.50");
  await expect(page.getByTestId("draft-price")).toHaveText("PKR 2,500,000.50");
  await expect(page.getByTestId("conflict-title")).toContainText("Latest saved: Other title from phone");
  await expect(page.getByTestId("conflict-description")).toContainText("Latest saved: Description from phone");
  await expect(page.getByTestId("conflict-asking_price")).toHaveCount(0);
  // One alert announces the conflict; the polite region stays empty.
  await expect(liveRegions(page)).toHaveCount(1);
  await expect(live(page)).toHaveText("");
  // Use latest replaces the input; Keep mine leaves it. The choice moves focus to the field.
  await page.getByRole("button", { name: "Use latest for Title" }).click();
  await expect(titleInput(page)).toHaveValue("Other title from phone");
  await expect(titleInput(page)).toBeFocused();
  await expect(page.getByTestId("conflict-title")).toHaveCount(0);
  await page.getByRole("button", { name: "Keep mine for Description" }).click();
  await expect(descriptionInput(page)).toHaveValue("My own description text");
  await expect(descriptionInput(page)).toBeFocused();
  await expect(page.getByTestId("conflict-description")).toHaveCount(0);
  // The next save uses the new revision and sends only what now differs from the latest data.
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await expect(revision(page)).toHaveText("5");
  const sent = await patches(request);
  expect(sent.bodies).toEqual([
    { base_revision: 3, fields: { title: "My own title for the house", description: "My own description text" } },
    { base_revision: 4, fields: { description: "My own description text" } },
  ]);
  await expect(conflictBanner(page)).toHaveCount(0);
  await expect(titleInput(page)).toHaveValue("Other title from phone");
});

test("conflict: a second conflict repeats the flow without losing the input", async ({ page, request }) => {
  await openDraft(page, request);
  await otherSession(request, id(1), { title: "First other title text" });
  await descriptionInput(page).fill("Owner description one");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(revision(page)).toHaveText("4");
  await expect(titleInput(page)).toHaveValue("First other title text");
  await page.getByRole("button", { name: "Keep mine for Description" }).click();
  await otherSession(request, id(1), { description: "Description from phone" });
  await saveButton(page).click();
  await expect(revision(page)).toHaveText("5");
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(conflictBanner(page)).toBeFocused();
  await expect(descriptionInput(page)).toHaveValue("Owner description one");
  await expect(page.getByTestId("conflict-description")).toContainText("Latest saved: Description from phone"); // asked again
  await page.getByRole("button", { name: "Keep mine for Description" }).click();
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await expect(revision(page)).toHaveText("6");
  const sent = await patches(request);
  expect(sent.bodies.map((body: { base_revision: number }) => body.base_revision)).toEqual([3, 4, 5]);
  expect(sent.bodies[2]).toEqual({ base_revision: 5, fields: { description: "Owner description one" } });
});

test("conflict: a retry after a lost response is already saved (every typed value equals the latest)", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "lost_once");
  await titleInput(page).fill("Updated title for the house");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(SERVER); // the proxy answers 5xx when the backend drops the connection
  await expect(titleInput(page)).toHaveValue("Updated title for the house");
  await expect(saveButton(page)).not.toHaveAttribute("aria-disabled");
  await saveButton(page).click(); // the first save landed: this one is stale and its current already holds the value
  await expect(conflictBanner(page)).toHaveText(ALREADY_SAVED);
  await expect(revision(page)).toHaveText("4");
  await expect(page.locator('[data-testid^="conflict-"]:not([data-testid="draft-conflict"])')).toHaveCount(0);
  await expect(titleInput(page)).toHaveValue("Updated title for the house");
  const sent = await patches(request);
  expect(sent.count).toBe(2);
  expect(sent.bodies.map((body: { base_revision: number }) => body.base_revision)).toEqual([3, 3]);
  expect(await page.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; })).toBe(false);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
});

for (const mode of ["conflict_no_current", "conflict_bad_current"]) {
  test(`conflict (${mode}): an answer without usable data reloads the Draft through GET and keeps the typed input`, async ({ page, request }) => {
    await openDraft(page, request);
    await otherSession(request, id(1), { title: "Latest title from elsewhere" });
    await setMode(request, "listing-patch", mode);
    await descriptionInput(page).fill("My description of the house");
    await saveButton(page).click();
    await expect(conflictBanner(page)).toHaveText(CONFLICT);
    expect((await stats(request)).detailGets).toBe(2);
    await expect(revision(page)).toHaveText("4");
    await expect(descriptionInput(page)).toHaveValue("My description of the house");
    await expect(titleInput(page)).toHaveValue("Latest title from elsewhere");
    await setMode(request, "listing-patch", "ok");
    await saveButton(page).click();
    await expect(live(page)).toHaveText("Saved");
    expect((await patches(request)).bodies[1]).toEqual({ base_revision: 4, fields: { description: "My description of the house" } });
  });
}

test("conflict: when the Draft cannot be read back either, the typed input is kept with a message", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "conflict_no_current");
  await setMode(request, "listing-detail", "error");
  await descriptionInput(page).fill("My description of the house");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText("We could not load the latest version. Your changes are still in the form. Try saving again.");
  await expect(descriptionInput(page)).toHaveValue("My description of the house");
  await expect(saveButton(page)).not.toHaveAttribute("aria-disabled");
});

test("a saved answer that is not this Draft with a revision is a server error and keeps the input", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "unreadable");
  await titleInput(page).fill("A different title for the house");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(SERVER);
  await expect(titleInput(page)).toHaveValue("A different title for the house");
  await expect(revision(page)).toHaveText("3");
  await expect(saveButton(page)).not.toHaveAttribute("aria-disabled");
  expect((await stats(request)).detailGets).toBe(1);
});

test("price with a comma: the server's refusal is explained, the typed value is kept", async ({ page, request }) => {
  await openDraft(page, request);
  await priceInput(page).fill("1,500,000.50");
  await saveButton(page).click();
  await expect(page.locator("#asking_price-error")).toHaveText(`Error: ${PRICE_INVALID}`);
  await expect(priceInput(page)).toHaveValue("1,500,000.50");
  expect((await patches(request)).bodies[0]).toEqual({ base_revision: 3, fields: { asking_price: "1,500,000.50" } });
  await expect(revision(page)).toHaveText("3");
});

test("conflict: a price the owner typed shows the latest formatted; Use latest applies it once", async ({ page, request }) => {
  await openDraft(page, request);
  await otherSession(request, id(1), { asking_price: "2500000.50" });
  await priceInput(page).fill("3000000");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(page.getByTestId("conflict-asking_price")).toContainText("Latest saved: PKR 2,500,000.50");
  await expect(priceInput(page)).toHaveValue("3000000");
  await page.getByRole("button", { name: "Use latest for Asking price" }).click();
  await expect(priceInput(page)).toHaveValue("2500000.50");
  await expect(page.getByTestId("conflict-asking_price")).toHaveCount(0);
  await expect(conflictBanner(page)).toHaveCount(0);
  await expect(live(page)).toHaveText("Your choices are applied. Save to keep them.");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(1);
});

test("conflict: a rental period the owner chose shows the latest label next to it", async ({ page, request }) => {
  await openDraft(page, request, "rent_filled");
  await otherSession(request, id(1), { rental_period: "year" });
  await periodSelect(page).selectOption("week");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(page.getByTestId("conflict-rental_period")).toContainText("Latest saved: Year");
  await page.getByRole("button", { name: "Use latest for Rental period" }).click();
  await expect(periodSelect(page)).toHaveValue("year");
  await expect(page.getByTestId("conflict-rental_period")).toHaveCount(0);
});

test("conflict: after a lost response, one value equal to the latest and another different is a normal conflict with one row", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "lost_once");
  await titleInput(page).fill("Updated title for the house");
  await descriptionInput(page).fill("Owner description text");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(SERVER);
  await otherSession(request, id(1), { description: "Description from phone" });
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(page.getByTestId("conflict-description")).toContainText("Latest saved: Description from phone");
  await expect(page.getByTestId("conflict-title")).toHaveCount(0);
});

test("conflict: a change elsewhere to a field the owner did not touch is a normal conflict, not already saved", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "lost_once");
  await titleInput(page).fill("Updated title for the house");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(SERVER);
  await otherSession(request, id(1), { asking_price: "2500000.50" });
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(priceInput(page)).toHaveValue("2500000.50");
});

test("conflict: typing during an in-flight save is kept when the answer is a conflict", async ({ page, request }) => {
  await openDraft(page, request);
  await otherSession(request, id(1), { description: "Description from phone" });
  await setMode(request, "listing-patch", "slow");
  await titleInput(page).fill("My own title for the house");
  await saveButton(page).click();
  await expect(saveButton(page)).toHaveAttribute("aria-disabled", "true");
  await descriptionInput(page).fill("Typed during the save");
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(descriptionInput(page)).toHaveValue("Typed during the save");
  await expect(titleInput(page)).toHaveValue("My own title for the house");
  await expect(page.getByTestId("conflict-description")).toContainText("Latest saved: Description from phone");
  await expect(revision(page)).toHaveText("4");
});

test("conflict: whitespace the server collapses is not a difference (retry after a lost response is already saved)", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "lost_once");
  await titleInput(page).fill("Nice  house with garden");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(SERVER);
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(ALREADY_SAVED);
  await expect(titleInput(page)).toHaveValue("Nice  house with garden");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
});

// ---------------------------------------------------------------- the other answers

test("Suspended: the permission message only when the session says so; no retry loop and the input is kept", async ({ page, request }) => {
  await setMode(request, "signin", "suspended"); // /me answers state suspended
  await openDraft(page, request);
  await setMode(request, "listing-patch", "forbidden");
  await titleInput(page).fill("A different title for the house");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(EDIT_FORBIDDEN);
  const count = (await patches(request)).count;
  expect(count).toBe(2); // the answer and the one CSRF retry
  await settle();
  expect((await patches(request)).count).toBe(count);
  await expect(titleInput(page)).toHaveValue("A different title for the house");
  await expect(saveButton(page)).not.toHaveAttribute("aria-disabled");
});

test("an active owner's 403 (what a CSRF failure looks like) is the generic message, not the account one", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "forbidden");
  await titleInput(page).fill("A different title for the house");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(REJECTED);
  await expect(notice(page)).not.toContainText("cannot edit");
});

test("CSRF self-heal: a first 403 refetches the token and retries once; a second is generic", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "csrf_once");
  await titleInput(page).fill("A different title for the house");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  const sent = await patches(request);
  expect(sent.count).toBe(2);
  expect(sent.tokens).toEqual(["csrf-0", "csrf-1"]);
  await setMode(request, "listing-patch", "csrf_always");
  await titleInput(page).fill("Yet another title for the house");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(REJECTED);
  expect((await patches(request)).count).toBe(4);
  await expect(titleInput(page)).toHaveValue("Yet another title for the house");
});

test("404 on save: the Draft not-found state, with the same copy", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "not_found");
  await titleInput(page).fill("A different title for the house");
  await saveButton(page).click();
  await expect(page.getByTestId("draft-not-found")).toHaveText(NOT_FOUND);
  await expect(main(page).getByRole("link", { name: "Back to My listings" })).toHaveAttribute("href", LIST);
  await expect(titleInput(page)).toHaveCount(0);
  await expect(page.getByTestId("draft-status")).toHaveCount(0);
});

test("401 on save: signed out and sent to the sign-in with next", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "session_gone");
  await titleInput(page).fill("A different title for the house");
  await saveButton(page).click();
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=%2Faccount%2Flistings%2F${id(1)}$`));
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
});

for (const [name, mode, text] of [
  ["429", "rate_limited", THROTTLED],
  ["5xx", "error", SERVER],
] as const) {
  test(`failure (${name}): its own message, the typed input is kept and trying again works`, async ({ page, request }) => {
    await openDraft(page, request);
    await setMode(request, "listing-patch", mode);
    await titleInput(page).fill("A different title for the house");
    await descriptionInput(page).fill("");
    await saveButton(page).click();
    await expect(notice(page)).toHaveText(text);
    await expect(notice(page)).toBeFocused();
    await expect(main(page)).not.toContainText("Internal detail");
    await expect(titleInput(page)).toHaveValue("A different title for the house");
    await expect(descriptionInput(page)).toHaveValue("");
    await expect(saveButton(page)).not.toHaveAttribute("aria-disabled");
    await expect(liveRegions(page)).toHaveCount(1); // the notice only
    await setMode(request, "listing-patch", "ok");
    await saveButton(page).click();
    await expect(live(page)).toHaveText("Saved");
    await expect(notice(page)).toHaveCount(0);
    expect((await patches(request)).bodies[1]).toEqual({ base_revision: 3, fields: { title: "A different title for the house", description: null } });
  });
}

test("failure (network): its own message and the typed input is kept", async ({ page, request }) => {
  await openDraft(page, request);
  await page.route("**/api/v1/listings/*", (route) => (route.request().method() === "PATCH" ? route.abort() : route.continue()));
  await titleInput(page).fill("A different title for the house");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(NETWORK);
  await expect(titleInput(page)).toHaveValue("A different title for the house");
  await page.unroute("**/api/v1/listings/*");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
});

test("failure: a hung request times out with its own message and keeps the input", async ({ page, request }) => {
  await preset(request, "titled");
  await startSession(page, request);
  await page.clock.install();
  await page.goto(`${LIST}/${id(1)}`);
  await expect(titleInput(page)).toBeVisible();
  await setMode(request, "listing-patch", "hang");
  await titleInput(page).fill("A different title for the house");
  await saveButton(page).click();
  await expect(saveButton(page)).toHaveText("Saving…");
  await page.clock.runFor(21_000);
  await expect(notice(page)).toHaveText(TIMEOUT);
  await expect(titleInput(page)).toHaveValue("A different title for the house");
  await expect(saveButton(page)).toHaveText("Save changes");
});

test("failure: a CSRF token that cannot be fetched is a generic failure", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "csrf", "error");
  await titleInput(page).fill("A different title for the house");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(SERVER);
  expect((await patches(request)).count).toBe(0);
});

// ---------------------------------------------------------------- saving state

test("double save: two quick clicks and a double click send exactly one request; the button is aria-disabled, not disabled", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "slow");
  await titleInput(page).fill("A different title for the house");
  await saveButton(page).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(saveButton(page)).toHaveText("Saving…");
  await expect(saveButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(saveButton(page)).not.toHaveAttribute("disabled");
  await expect(page.locator("form")).toHaveAttribute("aria-busy", "true");
  await expect(live(page)).toHaveText("Saving your changes.");
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).count).toBe(1);
  await titleInput(page).fill("One more title for the house");
  await saveButton(page).dblclick();
  await expect(live(page)).toHaveText("Saved");
  await settle();
  expect((await patches(request)).count).toBe(2);
});

test("unsaved guard: a beforeunload guard while the form has unsaved changes, removed after a save", async ({ page, request }) => {
  await openDraft(page, request);
  const guarded = () => page.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  expect(await guarded()).toBe(false);
  await titleInput(page).fill("A different title for the house");
  expect(await guarded()).toBe(true);
  await titleInput(page).fill(TITLE0);
  expect(await guarded()).toBe(false);
  await titleInput(page).fill("A different title for the house");
  expect(await guarded()).toBe(true);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect(await guarded()).toBe(false);
});

test("live region: one announcement mechanism, announcing once (saved, errors, notice, conflict)", async ({ page, request }) => {
  await openDraft(page, request);
  await expect(page.getByTestId("draft-live")).toHaveCount(1);
  await titleInput(page).fill("A different title for the house");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await expect(liveRegions(page)).toHaveCount(1);
  await settle(200);
  await expect(liveRegions(page)).toHaveCount(1);
  await setMode(request, "listing-patch", "codes");
  await titleInput(page).fill("Short");
  await saveButton(page).click();
  await expect(live(page)).toHaveText(ERRORS_ANNOUNCED);
  await expect(liveRegions(page)).toHaveCount(1);
  await setMode(request, "listing-patch", "error");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(SERVER);
  await expect(live(page)).toHaveText("");
  await expect(liveRegions(page)).toHaveCount(1);
  await settle(200);
  await expect(liveRegions(page)).toHaveCount(1);
  await setMode(request, "listing-patch", "ok");
  await otherSession(request, id(1), { description: "Description from phone" });
  await titleInput(page).fill("A title that is fine again");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(liveRegions(page)).toHaveCount(1);
  await settle(200);
  await expect(liveRegions(page)).toHaveCount(1);
  await expect(notice(page)).toHaveCount(0);
});

// ---------------------------------------------------------------- sessions and privacy

test("bfcache: a restored Draft page whose session ended goes to the sign-in and shows no draft text", async ({ page, request }) => {
  await openDraft(page, request);
  await titleInput(page).fill("Typed text that must not remain");
  await request.get(`${STUB}/__expire-session`);
  page.on("dialog", (dialog) => void dialog.accept());
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=%2Faccount%2Flistings%2F${id(1)}$`));
  await expect(titleInput(page)).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(TITLE0);
  await expect(page.locator("body")).not.toContainText("Typed text that must not remain");
});

test("bfcache: a restored Draft page whose session is alive reloads the Draft and resets a frozen save", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "hang");
  await titleInput(page).fill("A different title for the house");
  await saveButton(page).click();
  await expect(saveButton(page)).toHaveText("Saving…");
  await expect.poll(async () => (await patches(request)).count).toBe(1); // the frozen request has reached the stub
  await setMode(request, "listing-patch", "ok");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(titleInput(page)).toHaveValue(TITLE0);
  await expect(saveButton(page)).toHaveText("Save changes");
  await expect(saveButton(page)).not.toHaveAttribute("aria-disabled");
});

test("privacy: no listing text, price or revision in storage, console output, the title or the address bar", async ({ page, request }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  page.on("dialog", (dialog) => void dialog.accept());
  await openDraft(page, request);
  await otherSession(request, id(1), { title: "Other title from phone" });
  await titleInput(page).fill("Private title of the house");
  await priceInput(page).fill("7777777.70");
  await saveButton(page).click(); // a conflict
  await expect(conflictBanner(page)).toBeVisible();
  await page.getByRole("button", { name: "Keep mine for Title" }).click();
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await setMode(request, "listing-patch", "codes");
  await titleInput(page).fill("Short");
  await saveButton(page).click();
  await expect(summary(page)).toBeVisible();
  await expect(page).toHaveTitle("Draft | EstateAI");
  expect(new URL(page.url()).search + new URL(page.url()).hash).toBe("");
  expect(new URL(page.url()).pathname).toBe(`${LIST}/${id(1)}`);
  const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
  for (const secret of ["Private title", "Other title", "7777777", "Corner house", "Three bedrooms", id(1)]) expect(stored).not.toContain(secret);
  expect(await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))).toBe("[{},{}]");
  const logged = logs.join("\n");
  for (const secret of ["Private title", "Other title", "7777777", "Corner house", id(1)]) expect(logged).not.toContain(secret);
});

test("the request carries only base_revision and the changed fields, never an origin, status or anything the form does not own", async ({ page, request }) => {
  await openDraft(page, request, "rent");
  await titleInput(page).fill("Bright apartment near the market");
  await basisSelect(page).selectOption("rental_period");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  const body = (await patches(request)).bodies[0];
  expect(Object.keys(body).sort()).toEqual(["base_revision", "fields"]);
  expect(Object.keys(body.fields).sort()).toEqual(["price_basis", "title"]);
});

// ---------------------------------------------------------------- area and units (Story 2.3)

test("area: the block is built from the registry, with the hint, the unit choices and no basis for a unit that needs none", async ({ page, request }) => {
  await openDraft(page, request);
  await expect(page.getByTestId("area-block").getByRole("heading", { level: 3, name: "Area" })).toBeVisible();
  await expect(areaInput(page)).toHaveValue("");
  await expect(areaInput(page)).toHaveAttribute("inputmode", "decimal");
  await expect(areaInput(page)).toHaveAttribute("type", "text");
  await expect(page.locator("#area_value-hint")).toHaveText(
    "Required before you publish. Digits with an optional decimal point, up to 4 decimal places. Between 0.0001 and 9999999999.9999.",
  );
  await expect(page.locator("#area_unit-hint")).toHaveText("Required before you publish.");
  await expect(unitSelect(page)).toHaveValue("");
  await expect(unitSelect(page).locator("option")).toHaveText(["Not set", "Square feet", "Square yards", "Marla", "Kanal", "Acre"]);
  await expect(marlaSelect(page)).toHaveCount(0);
  await expect(page.getByTestId("area-block").getByText(EXPLANATION)).toHaveCount(0);
  await expect(derived(page)).toHaveCount(0); // nothing saved: nothing derived
  await expect(areaSummary(page)).toHaveText("Not set");
  // The derived square feet are not an input: the form's controls are exactly the existing ones plus the area controls.
  const controlIds = () => page.locator("form").locator("input, select, textarea").evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(await controlIds()).toEqual(["title", "description", "asking_price", "price_basis", "area_value", "area_unit"]);
  await unitSelect(page).selectOption("marla");
  expect(await controlIds()).toEqual(["title", "description", "asking_price", "price_basis", "area_value", "area_unit", "marla_basis"]);
  await expect(page.getByLabel(/square feet|sqft/i)).toHaveCount(0);
});

test("area: choosing marla or kanal shows the basis choices and the explanation; any other unit hides them again", async ({ page, request }) => {
  await openDraft(page, request);
  await unitSelect(page).selectOption("marla");
  await expect(marlaSelect(page)).toBeVisible();
  await expect(marlaSelect(page)).toHaveValue("");
  await expect(marlaSelect(page).locator("option")).toHaveText(["I don't know yet", "225 sq ft", "250 sq ft", "272.25 sq ft"]);
  await expect(page.locator("#marla_basis-hint")).toHaveText(EXPLANATION);
  await expect(marlaSelect(page)).toHaveAttribute("aria-describedby", "marla_basis-hint");
  await unitSelect(page).selectOption("kanal");
  await expect(marlaSelect(page)).toBeVisible();
  await expect(page.locator("#marla_basis-hint")).toHaveText(EXPLANATION);
  await unitSelect(page).selectOption("acre");
  await expect(marlaSelect(page)).toHaveCount(0);
  await expect(page.locator("#marla_basis-hint")).toHaveCount(0);
  await unitSelect(page).selectOption("marla");
  await expect(marlaSelect(page)).toBeVisible();
  await unitSelect(page).selectOption("");
  await expect(marlaSelect(page)).toHaveCount(0);
});

test("registry drives the Area block: other bounds, units and basis choices change the form", async ({ page, request }) => {
  await registryFields(request, "other");
  await openDraft(page, request);
  await expect(page.locator("#area_value-hint")).toHaveText("Recommended. Digits with an optional decimal point, up to 2 decimal places. Between 1 and 9999.");
  await expect(page.locator("#area_unit-hint")).toHaveCount(0);
  await expect(unitSelect(page).locator("option")).toHaveText(["Not set", "Square feet", "Marla", "Kanal"]);
  await unitSelect(page).selectOption("kanal");
  await expect(marlaSelect(page).locator("option")).toHaveText(["I don't know yet", "225 sq ft", "250 sq ft"]);
  await registryFields(request, "none");
  await preset(request, "titled");
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByTestId("draft-nothing-editable")).toBeVisible();
  await expect(page.getByTestId("area-block")).toHaveCount(0);
});

test("area: a registry that gives the value another type, or marks the unit derived, gets no control for them", async ({ page, request }) => {
  await page.route("**/api/v1/registry", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const field of body.fields) {
      if (field.id === "area_value") field.type = "money";
      if (field.id === "area_unit") field.derived = true;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await openDraft(page, request);
  await expect(page.locator("#asking_price")).toBeVisible();
  await expect(areaInput(page)).toHaveCount(0);
  await expect(unitSelect(page)).toHaveCount(0);
  await expect(page.getByTestId("area-block")).toHaveCount(0);
  expect(await page.locator("form").locator("input, select, textarea").evaluateAll((nodes) => nodes.map((node) => node.id))).toEqual(["title", "description", "asking_price", "price_basis"]);
});

test("area: square feet are saved as typed text; only the changed fields are sent and the derived figure is shown from the server's text", async ({ page, request }) => {
  await openDraft(page, request);
  await areaInput(page).fill(" 1200 ");
  await unitSelect(page).selectOption("sqft");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await expect(revision(page)).toHaveText("4");
  await expect(areaInput(page)).toHaveValue("1200.0000"); // as the server stored it
  await expect(derived(page)).toHaveText("About 1,200.00 sq ft");
  await expect(areaSummary(page)).toHaveText("1,200 Square feet");
  await expect(marlaSelect(page)).toHaveCount(0);
  const sent = await patches(request);
  expect(sent.bodies).toEqual([{ base_revision: 3, fields: { area_value: "1200", area_unit: "sqft" } }]);
  // The server's text for the same amount is not a change.
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(1);
  await areaInput(page).fill("1200.00");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  await expect(areaInput(page)).toHaveValue("1200.00");
  expect((await patches(request)).count).toBe(1);
});

for (const [name, value, unit, basis, about, summaryText] of [
  ["square yards", "12.3456", "sqyd", "", "About 111.1104 sq ft", "12.3456 Square yards"],
  ["acre", "2", "acre", "", "About 87,120.00 sq ft", "2 Acre"],
  ["marla with a basis", "5", "marla", "225", "About 1,125.00 sq ft", "5 Marla, 225 sq ft per marla"],
  ["kanal with a basis", "1", "kanal", "272.25", "About 5,445.00 sq ft", "1 Kanal, 272.25 sq ft per marla"],
  ["a kanal with fractions (never rounded early)", "3.3333", "kanal", "272.25", "About 18,149.8185 sq ft", "3.3333 Kanal, 272.25 sq ft per marla"],
  ["the largest value (a float would round it)", "9999999999.9999", "sqft", "", "About 9,999,999,999.9999 sq ft", "9,999,999,999.9999 Square feet"],
  ["the smallest value", "0.0001", "sqft", "", "About 0.0001 sq ft", "0.0001 Square feet"],
]) {
  test(`area saved: ${name} shows the server's derived square feet, grouped from text`, async ({ page, request }) => {
    await openDraft(page, request);
    await areaInput(page).fill(value);
    await unitSelect(page).selectOption(unit);
    if (basis) await marlaSelect(page).selectOption(basis);
    await saveButton(page).click();
    await expect(live(page)).toHaveText("Saved");
    await expect(derived(page)).toHaveText(about);
    await expect(areaSummary(page)).toHaveText(summaryText);
    const sent = (await patches(request)).bodies[0];
    expect(sent.fields).toEqual({ area_value: value, area_unit: unit, ...(basis ? { marla_basis: basis } : {}) });
  });
}

test("area: a marla with an unknown basis saves, says the figure is not available, and a later basis completes it", async ({ page, request }) => {
  await openDraft(page, request);
  await areaInput(page).fill("5");
  await unitSelect(page).selectOption("marla");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await expect(derived(page)).toHaveText(UNKNOWN_BASIS);
  await expect(derived(page)).not.toContainText("About");
  await expect(areaSummary(page)).toHaveText("5 Marla");
  await expect(marlaSelect(page)).toHaveValue("");
  await marlaSelect(page).selectOption("250");
  await saveButton(page).click();
  await expect(revision(page)).toHaveText("5");
  await expect(derived(page)).toHaveText("About 1,250.00 sq ft");
  await expect(areaSummary(page)).toHaveText("5 Marla, 250 sq ft per marla");
  const sent = await patches(request);
  expect(sent.bodies).toEqual([
    { base_revision: 3, fields: { area_value: "5", area_unit: "marla" } },
    { base_revision: 4, fields: { marla_basis: "250" } },
  ]);
  // "I don't know yet" clears the basis again: null is sent and the figure goes away.
  await marlaSelect(page).selectOption("");
  await saveButton(page).click();
  await expect(derived(page)).toHaveText(UNKNOWN_BASIS);
  expect((await patches(request)).bodies[2]).toEqual({ base_revision: 5, fields: { marla_basis: null } });
});

test("area: the Draft summary and the derived line reflect each saved state", async ({ page, request }) => {
  await openDraft(page, request, "area_marla");
  await expect(areaSummary(page)).toHaveText("10 Marla, 272.25 sq ft per marla");
  await expect(derived(page)).toHaveText("About 2,722.50 sq ft");
  await expect(areaInput(page)).toHaveValue("10.0000");
  await expect(unitSelect(page)).toHaveValue("marla");
  await expect(marlaSelect(page)).toHaveValue("272.25");
  await openDraft(page, request, "area_unknown");
  await expect(areaSummary(page)).toHaveText("5 Marla");
  await expect(derived(page)).toHaveText(UNKNOWN_BASIS);
  await expect(marlaSelect(page)).toHaveValue("");
  await openDraft(page, request, "area_sqft");
  await expect(areaSummary(page)).toHaveText("1,200 Square feet");
  await expect(derived(page)).toHaveText("About 1,200.00 sq ft");
  await expect(marlaSelect(page)).toHaveCount(0);
});

test("area: changing the unit away from marla hides the basis and does not send it; the server clears it", async ({ page, request }) => {
  await openDraft(page, request, "area_marla");
  await marlaSelect(page).selectOption("250"); // typed, then dropped with the unit
  await unitSelect(page).selectOption("sqft");
  await expect(marlaSelect(page)).toHaveCount(0);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  const sent = await patches(request);
  expect(sent.bodies).toEqual([{ base_revision: 2, fields: { area_unit: "sqft" } }]);
  await expect(derived(page)).toHaveText("About 10.00 sq ft");
  await expect(areaSummary(page)).toHaveText("10 Square feet");
  // Back to marla: the basis the server cleared is unknown again.
  await unitSelect(page).selectOption("marla");
  await expect(marlaSelect(page)).toHaveValue("");
  await expect(derived(page)).toHaveText(`About 10.00 sq ft${UNSAVED}`); // the saved figure until the next save
});

test("area: switching away and back before saving keeps the stored basis and sends nothing", async ({ page, request }) => {
  await openDraft(page, request, "area_marla");
  await unitSelect(page).selectOption("acre");
  await unitSelect(page).selectOption("marla");
  await expect(marlaSelect(page)).toHaveValue("272.25");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(0);
  // Marla to kanal keeps the basis too: only the unit is sent.
  await unitSelect(page).selectOption("kanal");
  await expect(marlaSelect(page)).toHaveValue("272.25");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies).toEqual([{ base_revision: 2, fields: { area_unit: "kanal" } }]);
  await expect(derived(page)).toHaveText("About 54,450.00 sq ft");
});

test("area: clearing the value and the unit sends null for each and removes the figure", async ({ page, request }) => {
  await openDraft(page, request, "area_marla");
  await areaInput(page).fill("");
  await unitSelect(page).selectOption("");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies).toEqual([{ base_revision: 2, fields: { area_value: null, area_unit: null } }]);
  await expect(derived(page)).toHaveCount(0);
  await expect(areaSummary(page)).toHaveText("Not set");
  await expect(marlaSelect(page)).toHaveCount(0);
});

test("area: a value without a unit saves and says nothing about square feet", async ({ page, request }) => {
  await openDraft(page, request);
  await areaInput(page).fill("40");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await expect(derived(page)).toHaveCount(0);
  await expect(areaSummary(page)).toHaveText("40 (unit not set)");
});

test("area: the derived square feet are never sent", async ({ page, request }) => {
  await openDraft(page, request, "area_sqft");
  await areaInput(page).fill("1300");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await expect(derived(page)).toHaveText("About 1,300.00 sq ft");
  for (const body of (await patches(request)).bodies) expect(JSON.stringify(body)).not.toContain("area_sqft");
});

const BAD_AREAS: [string, string, string][] = [
  ["zero", "0", AREA_LIMITS],
  ["negative", "-5", AREA_LIMITS],
  ["five decimals", "1.12345", AREA_LIMITS],
  ["over the maximum", "10000000000", AREA_LIMITS],
  ["below the minimum", "0.0000", AREA_LIMITS],
  ["comma", "12,5", AREA_INVALID],
  ["exponent", "1e3", AREA_INVALID],
  ["letters", "abc", AREA_INVALID],
  ["zero padded", "0010", AREA_INVALID],
  ["inner space", "1 200", AREA_INVALID],
  ["lone point", ".", AREA_INVALID],
];
for (const [name, typed, message] of BAD_AREAS) {
  test(`area validation (${name}): the real rule's code is explained under the control and the typed text is kept`, async ({ page, request }) => {
    await openDraft(page, request);
    await areaInput(page).fill(typed);
    await saveButton(page).click();
    await expect(page.locator("#area_value-error")).toHaveText(`Error: ${message}`);
    await expect(summary(page)).toBeFocused();
    await expect(summary(page).getByRole("link", { name: /^Area value:/ })).toBeVisible();
    await expect(areaInput(page)).toHaveAttribute("aria-invalid", "true");
    await expect(areaInput(page)).toHaveValue(typed);
    await expect(revision(page)).toHaveText("3");
    expect((await patches(request)).bodies[0].fields).toEqual({ area_value: typed });
    await areaInput(page).fill("12");
    await expect(page.locator("#area_value-error")).toHaveCount(0);
  });
}

test("area validation: the registry's own bounds judge the value (a stub registry with a scale of 2)", async ({ page, request }) => {
  await registryFields(request, "other");
  await openDraft(page, request);
  await areaInput(page).fill("5.123");
  await saveButton(page).click();
  await expect(page.locator("#area_value-error")).toHaveText(`Error: ${AREA_LIMITS}`);
  await areaInput(page).fill("0.5");
  await saveButton(page).click();
  await expect(page.locator("#area_value-error")).toHaveText(`Error: ${AREA_LIMITS}`);
  await areaInput(page).fill("5.12");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await expect(areaInput(page)).toHaveValue("5.1200");
});

test("area validation: a unit the server no longer offers is invalid_choice on its control", async ({ page, request }) => {
  await openDraft(page, request);
  await unitSelect(page).selectOption("acre");
  await registryFields(request, "other"); // acre is no longer allowed on the server
  await saveButton(page).click();
  await expect(page.locator("#area_unit-error")).toHaveText("Error: Choose a unit from the list.");
  await expect(unitSelect(page)).toHaveValue("acre");
  await expect(summary(page).getByRole("link", { name: /^Unit:/ })).toBeVisible();
});

test("area validation: a basis the server no longer offers is invalid_choice on its control", async ({ page, request }) => {
  await openDraft(page, request);
  await unitSelect(page).selectOption("marla");
  await marlaSelect(page).selectOption("272.25");
  await registryFields(request, "other"); // 272.25 is no longer allowed on the server
  await saveButton(page).click();
  await expect(page.locator("#marla_basis-error")).toHaveText("Error: Choose a marla size from the list.");
  await expect(marlaSelect(page)).toHaveValue("272.25");
});

test("area validation: invalid_area, invalid_choice and not_applicable each map to text under their own control", async ({ page, request }) => {
  await openDraft(page, request, "area_marla");
  await setMode(request, "listing-patch", "area_codes");
  await areaInput(page).fill("0");
  await unitSelect(page).selectOption("kanal");
  await marlaSelect(page).selectOption("225");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(page.locator("#area_value-error")).toHaveText(`Error: ${AREA_LIMITS}`);
  await expect(page.locator("#area_unit-error")).toHaveText("Error: Choose a unit from the list.");
  await expect(page.locator("#marla_basis-error")).toHaveText("Error: A marla size applies only when the unit is marla or kanal.");
  await expect(summary(page).getByRole("link")).toHaveCount(3);
  await expect(live(page)).toHaveText(ERRORS_ANNOUNCED);
  await expect(areaInput(page)).toHaveValue("0");
  await expect(unitSelect(page)).toHaveValue("kanal");
  await expect(marlaSelect(page)).toHaveValue("225");
  await expect(saveButton(page)).not.toHaveAttribute("aria-disabled");
  await summary(page).getByRole("link", { name: /^Marla basis:/ }).click();
  await expect(marlaSelect(page)).toBeFocused();
});

test("area validation: a not_applicable basis while its control is hidden goes to the list, never to a link", async ({ page, request }) => {
  await openDraft(page, request, "area_sqft");
  await setMode(request, "listing-patch", "area_hidden");
  await areaInput(page).fill("1300");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(summary(page).getByRole("link")).toHaveCount(0);
  await expect(summary(page).getByRole("listitem")).toHaveText(["A marla size applies only when the unit is marla or kanal."]);
  await expect(marlaSelect(page)).toHaveCount(0);
  await expect(areaInput(page)).toHaveValue("1300");
});

test("area conflict: another session changed the area; latest values are formatted, and Use latest and Keep mine apply per field", async ({ page, request }) => {
  await openDraft(page, request, "area_marla");
  await otherSession(request, id(1), { area_value: "2500.5000", area_unit: "kanal", marla_basis: "250" });
  await areaInput(page).fill("12");
  await unitSelect(page).selectOption("acre");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(conflictBanner(page)).toBeFocused();
  await expect(revision(page)).toHaveText("3");
  await expect(page.getByTestId("conflict-area_value")).toContainText("Latest saved: 2,500.5");
  await expect(page.getByTestId("conflict-area_unit")).toContainText("Latest saved: Kanal");
  await expect(page.getByTestId("conflict-marla_basis")).toHaveCount(0); // the basis is hidden for the owner's unit
  await expect(areaInput(page)).toHaveValue("12");
  await expect(unitSelect(page)).toHaveValue("acre");
  await expect(areaSummary(page)).toHaveText("2,500.5 Kanal, 250 sq ft per marla"); // the summary shows the latest saved data
  await page.getByRole("button", { name: "Use latest for Area unit" }).click();
  await expect(unitSelect(page)).toHaveValue("kanal");
  await expect(unitSelect(page)).toBeFocused();
  await expect(marlaSelect(page)).toHaveValue("250");
  await page.getByRole("button", { name: "Keep mine for Area value" }).click();
  await expect(areaInput(page)).toHaveValue("12");
  await expect(live(page)).toHaveText("Your choices are applied. Save to keep them.");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[1]).toEqual({ base_revision: 3, fields: { area_value: "12" } });
  await expect(derived(page)).toHaveText("About 60,000.00 sq ft");
});

test("area conflict: a basis the owner chose shows the latest basis label; Use latest applies it", async ({ page, request }) => {
  await openDraft(page, request, "area_marla");
  await otherSession(request, id(1), { marla_basis: "225" });
  await marlaSelect(page).selectOption("250");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(page.getByTestId("conflict-marla_basis")).toContainText("Latest saved: 225 sq ft");
  await page.getByRole("button", { name: "Use latest for Marla basis" }).click();
  await expect(marlaSelect(page)).toHaveValue("225");
  await expect(page.getByTestId("conflict-marla_basis")).toHaveCount(0);
  await expect(conflictBanner(page)).toHaveCount(0);
});

test("area conflict: a basis cleared elsewhere shows as not set in the row", async ({ page, request }) => {
  await openDraft(page, request, "area_marla");
  await otherSession(request, id(1), { marla_basis: "" });
  await marlaSelect(page).selectOption("250");
  await saveButton(page).click();
  await expect(page.getByTestId("conflict-marla_basis")).toContainText("Latest saved: I don't know yet");
  await expect(derived(page)).toHaveText(`${UNKNOWN_BASIS}${UNSAVED}`); // the latest data has no figure; the owner has an unsaved basis
});

test("area conflict: the unit moved elsewhere to square feet (the server cleared the basis) is a normal conflict, not already saved", async ({ page, request }) => {
  await openDraft(page, request, "area_marla");
  await otherSession(request, id(1), { area_unit: "sqft" });
  await areaInput(page).fill("11");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(unitSelect(page)).toHaveValue("sqft"); // not the owner's input: it takes the latest value
  await expect(marlaSelect(page)).toHaveCount(0);
  await expect(areaInput(page)).toHaveValue("11");
  await expect(derived(page)).toHaveText(`About 10.00 sq ft${UNSAVED}`);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[1]).toEqual({ base_revision: 3, fields: { area_value: "11" } });
});

test("area conflict: a retry after a lost response is already saved, even when the server writes the value with four decimals", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "lost_once");
  await areaInput(page).fill("5");
  await unitSelect(page).selectOption("marla");
  await marlaSelect(page).selectOption("225");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(SERVER);
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(ALREADY_SAVED);
  await expect(page.locator('[data-testid^="conflict-"]:not([data-testid="draft-conflict"])')).toHaveCount(0);
  await expect(areaInput(page)).toHaveValue("5"); // what was typed stays
  await expect(derived(page)).toHaveText("About 1,125.00 sq ft");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(2);
});

test("area: a change elsewhere to the area while the owner edits another field is a normal conflict, not already saved", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "lost_once");
  await titleInput(page).fill("Updated title for the house");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(SERVER);
  await otherSession(request, id(1), { area_value: "30", area_unit: "sqft" });
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(areaInput(page)).toHaveValue("30");
  await expect(unitSelect(page)).toHaveValue("sqft");
  await expect(derived(page)).toHaveText("About 30.00 sq ft");
});

test("area: a kanal with no basis says the figure is not available until the marla size is known", async ({ page, request }) => {
  await openDraft(page, request);
  await areaInput(page).fill("2");
  await unitSelect(page).selectOption("kanal");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await expect(derived(page)).toHaveText(UNKNOWN_BASIS);
  await expect(areaSummary(page)).toHaveText("2 Kanal");
});

test("area: the derived line says it is the saved figure while area input is unsaved, and drops the note once saved", async ({ page, request }) => {
  await openDraft(page, request, "area_sqft");
  await expect(derived(page)).toHaveText("About 1,200.00 sq ft");
  await areaInput(page).fill("1500");
  await expect(derived(page)).toHaveText(`About 1,200.00 sq ft${UNSAVED}`);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await expect(derived(page)).toHaveText("About 1,500.00 sq ft");
  await titleInput(page).fill("A title typed but not saved");
  await expect(derived(page)).toHaveText("About 1,500.00 sq ft"); // a non-area change does not make the figure stale
});

test("area: a stored basis the registry no longer offers stays selected instead of reading as unknown", async ({ page, request }) => {
  await registryFields(request, "other");
  await openDraft(page, request, "area_marla");
  await expect(marlaSelect(page)).toHaveValue("272.25");
  await expect(marlaSelect(page).locator("option")).toHaveText(["I don't know yet", "225 sq ft", "250 sq ft", "272.25 sq ft"]);
});

test("area validation: invalid on the unit, not_editable on the value and required on the basis map to their texts", async ({ page, request }) => {
  await openDraft(page, request, "area_marla");
  await setMode(request, "listing-patch", "area_other_codes");
  await areaInput(page).fill("11");
  await saveButton(page).click();
  await expect(page.locator("#area_unit-error")).toHaveText("Error: Choose a unit from the list.");
  await expect(page.locator("#area_value-error")).toHaveText("Error: This detail cannot be changed here.");
  await expect(page.locator("#marla_basis-error")).toHaveText("Error: Choose the marla size.");
  await expect(summary(page).getByRole("link")).toHaveCount(3);
});

test("area validation: moving the unit away from marla removes the basis error and its summary link", async ({ page, request }) => {
  await openDraft(page, request, "area_unknown");
  await marlaSelect(page).selectOption("272.25");
  await registryFields(request, "other"); // 272.25 is no longer allowed on the server
  await saveButton(page).click();
  await expect(page.locator("#marla_basis-error")).toHaveText("Error: Choose a marla size from the list.");
  await unitSelect(page).selectOption("sqft");
  await expect(page.locator("#marla_basis-error")).toHaveCount(0);
  await expect(summary(page)).toHaveCount(0); // no empty error box
  await expect(marlaSelect(page)).toHaveCount(0);
});

test("area equality: text is compared by amount only in the real shape, with the scale of the registry", async ({ page, request }) => {
  await registryFields(request, "scale6");
  await openDraft(page, request, "area_sqft");
  await otherSession(request, id(1), { area_value: "1.234560" });
  await page.reload();
  await expect(areaInput(page)).toHaveValue("1.234560");
  await expect(page.locator("#area_value-hint")).toContainText("up to 6 decimal places");
  await areaInput(page).fill("1.23456");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(0);
  await areaInput(page).fill("1.2345600");
  await saveButton(page).click();
  await expect(page.locator("#area_value-error")).toBeVisible(); // too many decimals is sent, not swallowed
  expect((await patches(request)).count).toBe(1);
});

test("area equality: padded text is sent for the server to refuse, never taken for the saved amount", async ({ page, request }) => {
  await openDraft(page, request, "area_sqft");
  await areaInput(page).fill("01200");
  await saveButton(page).click();
  await expect(page.locator("#area_value-error")).toHaveText(`Error: ${AREA_INVALID}`);
  expect((await patches(request)).bodies[0].fields).toEqual({ area_value: "01200" });
  await areaInput(page).fill("1200.00");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  await areaInput(page).fill("1,200");
  await saveButton(page).click();
  await expect(page.locator("#area_value-error")).toHaveText(`Error: ${AREA_INVALID}`);
  expect((await patches(request)).count).toBe(2);
});

test("area conflict: Use latest on the unit when the latest unit needs no basis clears the banner and leaves no hidden row", async ({ page, request }) => {
  await openDraft(page, request, "area_marla");
  await unitSelect(page).selectOption("kanal");
  await marlaSelect(page).selectOption("250");
  await otherSession(request, id(1), { area_unit: "sqft" }); // the server clears the basis
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(page.getByTestId("conflict-area_unit")).toContainText("Latest saved: Square feet");
  await expect(page.getByTestId("conflict-marla_basis")).toContainText("Latest saved: I don't know yet");
  await page.getByRole("button", { name: "Use latest for Area unit" }).click();
  await expect(unitSelect(page)).toHaveValue("sqft");
  await expect(marlaSelect(page)).toHaveCount(0);
  await expect(page.getByTestId("conflict-marla_basis")).toHaveCount(0);
  await expect(conflictBanner(page)).toHaveCount(0);
  await expect(live(page)).toHaveText("Your choices are applied. Save to keep them.");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(1);
});

test("area conflict: a basis typed while another session moved the unit away is reset and the banner says so", async ({ page, request }) => {
  await openDraft(page, request, "area_marla");
  await marlaSelect(page).selectOption("250");
  await otherSession(request, id(1), { area_unit: "sqft" });
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(`${CONFLICT} The marla size no longer applies because the unit changed in another session.`);
  await expect(unitSelect(page)).toHaveValue("sqft");
  await expect(marlaSelect(page)).toHaveCount(0);
  await expect(page.locator('[data-testid^="conflict-"]:not([data-testid="draft-conflict"])')).toHaveCount(0);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  await unitSelect(page).selectOption("marla");
  await expect(marlaSelect(page)).toHaveValue(""); // not the 250 that was typed
  expect((await patches(request)).count).toBe(1);
});

test("area: the area fields carry no listing data into storage, the console, the title or the address bar", async ({ page, request }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  await openDraft(page, request);
  await areaInput(page).fill("7777.7777");
  await unitSelect(page).selectOption("marla");
  await marlaSelect(page).selectOption("272.25");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await areaInput(page).fill("0");
  await setMode(request, "listing-patch", "area_codes");
  await saveButton(page).click();
  await expect(summary(page)).toBeVisible();
  await expect(page).toHaveTitle("Draft | EstateAI");
  expect(new URL(page.url()).search + new URL(page.url()).hash).toBe("");
  expect(await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]))).not.toContain("7777");
  expect(await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))).toBe("[{},{}]");
  expect(logs.join("\n")).not.toContain("7777");
});

// ---------------------------------------------------------------- accessibility

for (const viewport of viewports) {
  test(`accessibility (${viewport.name}): the editor, its errors, the conflict and the saved states have no axe violations`, async ({ page, request }) => {
    page.on("dialog", (dialog) => void dialog.accept()); // the page is left with unsaved changes on purpose
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openDraft(page, request);
    await expectNoViolations(page, "editor");
    await titleInput(page).fill("t".repeat(120));
    await expectNoViolations(page, "editor over the limit");
    await setMode(request, "listing-patch", "codes");
    await saveButton(page).click();
    await expect(summary(page)).toBeVisible();
    await expectNoViolations(page, "editor with errors");
    await setMode(request, "listing-patch", "ok");
    await titleInput(page).fill("My own title for the house");
    await descriptionInput(page).fill("My own description text");
    await priceInput(page).fill("1500000");
    await otherSession(request, id(1), { title: "Other title from phone", description: "Description from phone" });
    await saveButton(page).click();
    await expect(conflictBanner(page)).toBeVisible();
    await expect(page.getByTestId("conflict-title")).toBeVisible();
    await expectNoViolations(page, "conflict");
    await page.getByRole("button", { name: "Keep mine for Title" }).click();
    await page.getByRole("button", { name: "Keep mine for Description" }).click();
    await saveButton(page).click();
    await expect(live(page)).toHaveText("Saved");
    await expectNoViolations(page, "saved");
    await setMode(request, "listing-patch", "error");
    await titleInput(page).fill("Failing title for the house");
    await saveButton(page).click();
    await expect(notice(page)).toBeVisible();
    await expectNoViolations(page, "failure notice");
    await openDraft(page, request, "rent_filled");
    await expectNoViolations(page, "rent editor");
    await openDraft(page, request, "rent");
    await expectNoViolations(page, "empty rent editor");
  });
}

for (const viewport of viewports) {
  test(`accessibility (${viewport.name}): the Area block in its states has no axe violations`, async ({ page, request }) => {
    page.on("dialog", (dialog) => void dialog.accept()); // the page is left with unsaved changes on purpose
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openDraft(page, request);
    await expectNoViolations(page, "empty area");
    await unitSelect(page).selectOption("marla");
    await expect(marlaSelect(page)).toBeVisible();
    await expectNoViolations(page, "marla with the explanation");
    await areaInput(page).fill("5");
    await saveButton(page).click();
    await expect(derived(page)).toHaveText(UNKNOWN_BASIS);
    await expectNoViolations(page, "marla with an unknown basis");
    await marlaSelect(page).selectOption("225");
    await saveButton(page).click();
    await expect(derived(page)).toHaveText("About 1,125.00 sq ft");
    await expectNoViolations(page, "derived square feet");
    await areaInput(page).fill("0");
    await setMode(request, "listing-patch", "area_codes");
    await saveButton(page).click();
    await expect(summary(page)).toBeVisible();
    await expectNoViolations(page, "area errors");
    await setMode(request, "listing-patch", "ok");
    await areaInput(page).fill("12");
    await unitSelect(page).selectOption("acre");
    await otherSession(request, id(1), { area_value: "2500.5000", area_unit: "kanal", marla_basis: "250" });
    await saveButton(page).click();
    await expect(conflictBanner(page)).toBeVisible();
    await expect(page.getByTestId("conflict-area_value")).toBeVisible();
    await expect(page.getByTestId("conflict-area_unit")).toBeVisible();
    await expectNoViolations(page, "area conflict");
  });
}
