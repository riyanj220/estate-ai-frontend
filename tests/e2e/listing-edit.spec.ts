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
  await expect(page.getByTestId("draft-registry-version")).toHaveText("7");
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
  await expect(page.locator("#asking_price-error")).toHaveText("Error: Enter an amount within the limits shown above, with at most two decimal places.");
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
  // (The Details section of Story 2.4 has its own tests: it is left out here.)
  const controlIds = () =>
    page
      .locator("form")
      .locator("input, select, textarea")
      .evaluateAll((nodes) => nodes.filter((node) => !node.closest('[data-testid="details-block"], [data-testid="terms-block"], [data-testid="location-block"]')).map((node) => node.id));
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
  expect(
    await page
      .locator("form")
      .locator("input, select, textarea")
      .evaluateAll((nodes) => nodes.filter((node) => !node.closest('[data-testid="details-block"], [data-testid="terms-block"], [data-testid="location-block"]')).map((node) => node.id)),
  ).toEqual(["title", "description", "asking_price", "price_basis"]);
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

// ---------------------------------------------------------------- details (Story 2.4)

const detail = (page: Page, name: string) => page.getByLabel(name, { exact: true });
const detailGroup = (page: Page, key: "required" | "recommended" | "more") => page.getByTestId(`details-${key}`);
const detailLabels = (page: Page, key: "required" | "recommended" | "more") => detailGroup(page, key).locator("label");
const summaryItem = (page: Page, id: string) => page.getByTestId(`draft-detail-${id}`);
const INTEGER_INVALID = "Enter a whole number, digits only, for example 3.";
const INTEGER_RANGE = "Enter a whole number within the allowed range.";
const FLOOR = "The floor cannot be above the number of floors in the building. Check both numbers.";
const BOOLEAN_INVALID = "Choose Yes, No or Not answered.";
const CHOICE_INVALID = "Choose an option from the list.";
const COVERED_INVALID = "Enter digits only, with an optional decimal point. Do not use commas, signs or units, for example 1200 or 10.5.";
const COVERED_LIMITS = "Enter an amount above zero within the allowed range, with no more decimal places than allowed.";
const CHARGES_INVALID = "Enter digits only, with an optional decimal point. Do not use commas or currency signs, for example 2500 or 2500.50.";
const CHARGES_LIMITS = "Enter an amount within the allowed range, with at most two decimal places.";
const NOT_APPLICABLE = "This detail does not apply to this listing.";
const storedFields = async (request: APIRequestContext) => (await stats(request)).listings[0].fields;

const HOUSE_REQUIRED = ["Bedrooms", "Bathrooms"];
const HOUSE_RECOMMENDED = ["Year built", "Condition", "Furnishing", "Parking spaces", "Occupancy status", "Covered area (sq ft)", "Total floors", "Kitchens", "Construction status"];
const HOUSE_MORE = ["Drawing rooms", "Dining rooms", "TV lounges", "Study rooms", "Prayer rooms", "Store rooms", "Laundry rooms", "Powder rooms", "Servant quarters", "Basement"];
const APARTMENT_RECOMMENDED = ["Year built", "Condition", "Furnishing", "Parking spaces", "Occupancy status", "Covered area (sq ft)", "Floor number", "Floors in the building", "Lift", "Backup electricity", "Building security"];
const APARTMENT_MORE = ["Balcony or terrace", "Building lobby", "Intercom", "Maintenance charges (PKR per month)"];

test("details: a House shows its own applicable fields grouped by requirement, in registry order, each group a fieldset with a legend", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await expect(page.getByRole("heading", { level: 3, name: "Details" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Required before you publish" })).toHaveCount(1); // the sale terms have none required
  await expect(page.getByTestId("details-block").getByRole("group", { name: "Recommended" })).toBeVisible();
  await expect(page.getByTestId("details-block").getByRole("group", { name: "More details" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Recommended" })).toHaveCount(2); // the Terms and the Details each have one
  await expect(page.getByRole("group", { name: "More details" })).toHaveCount(2);
  await expect(page.locator("fieldset.detail-group")).toHaveCount(3);
  await expect(detailLabels(page, "required")).toHaveText(HOUSE_REQUIRED);
  await expect(detailLabels(page, "recommended")).toHaveText(HOUSE_RECOMMENDED);
  await expect(detailLabels(page, "more")).toHaveText(HOUSE_MORE);
  for (const apartmentOnly of ["Floor number", "Floors in the building", "Lift", "Backup electricity", "Building security", "Balcony or terrace", "Building lobby", "Intercom", "Maintenance charges (PKR per month)"]) {
    await expect(detail(page, apartmentOnly)).toHaveCount(0);
  }
  // Nothing is preselected: every detail is unanswered.
  await expect(detail(page, "Bedrooms")).toHaveValue("");
  await expect(detail(page, "Condition")).toHaveValue("");
  await expect(detail(page, "Basement")).toHaveValue("");
});

test("details: an Apartment shows its own set, and a registry with no details for a Subtype shows no Details at all", async ({ page, request }) => {
  await openDraft(page, request, "apartment_blank");
  await expect(detailLabels(page, "required")).toHaveText(HOUSE_REQUIRED);
  await expect(detailLabels(page, "recommended")).toHaveText(APARTMENT_RECOMMENDED);
  await expect(detailLabels(page, "more")).toHaveText(APARTMENT_MORE);
  for (const houseOnly of ["Total floors", "Kitchens", "Construction status", "Drawing rooms", "Servant quarters", "Basement"]) {
    await expect(detail(page, houseOnly)).toHaveCount(0);
  }
  await registryFields(request, "other"); // this registry defines no detail for a plot
  await openDraft(page, request, "plot_blank");
  await expect(page.getByTestId("details-block")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 3, name: "Details" })).toHaveCount(0);
  await expect(page.locator("fieldset")).toHaveCount(0);
  await expect(areaInput(page)).toBeVisible(); // the hand-built fields are still there
});

test("details: the control follows the registry type, with Not answered first and the hints from the registry's limits", async ({ page, request }) => {
  await openDraft(page, request, "apartment_blank");
  // integer: a text input for digits, never a number input
  await expect(detail(page, "Bedrooms")).toHaveAttribute("inputmode", "numeric");
  await expect(detail(page, "Bedrooms")).toHaveAttribute("type", "text");
  await expect(page.locator("#bedrooms-hint")).toHaveText("Number of bedrooms. 0 for a studio. Whole number from 0 to 50.");
  await expect(page.locator("#bathrooms-hint")).toHaveText("Whole number from 0 to 50.");
  await expect(page.locator("#construction_year-hint")).toHaveText("Year the building was built. Whole number from 1900 to 2100.");
  await expect(page.locator("#floor_number-hint")).toHaveText("Floor of the unit. 0 is the ground floor. Whole number from 0 to 200.");
  await expect(page.locator("#building_floors-hint")).toHaveText("Number of floors in the building. Whole number from 1 to 200.");
  // boolean: Not answered, Yes, No
  await expect(detail(page, "Lift").locator("option")).toHaveText(["Not answered", "Yes", "No"]);
  await expect(detail(page, "Lift").locator("option").nth(1)).toHaveAttribute("value", "true");
  await expect(detail(page, "Lift").locator("option").nth(2)).toHaveAttribute("value", "false");
  await expect(page.locator("#lift-hint")).toHaveCount(0);
  // enum: Not answered first, then the registry's choices
  await expect(detail(page, "Condition").locator("option")).toHaveText(["Not answered", "New", "Excellent", "Good", "Needs renovation"]);
  await expect(detail(page, "Furnishing").locator("option")).toHaveText(["Not answered", "Unfurnished", "Semi furnished", "Furnished"]);
  await expect(detail(page, "Occupancy status").locator("option")).toHaveText(["Not answered", "Owner occupied", "Tenant occupied", "Vacant"]);
  await expect(page.locator("#condition-hint")).toHaveCount(0);
  // decimal and money: text inputs with the 2.2 and 2.3 string rules
  await expect(detail(page, "Covered area (sq ft)")).toHaveAttribute("inputmode", "decimal");
  await expect(page.locator("#covered_area_sqft-hint")).toHaveText(
    "Covered area in square feet, whatever unit the area uses. Digits with an optional decimal point, up to 4 decimal places. Between 0.0001 and 9999999999.9999.",
  );
  await expect(detail(page, "Maintenance charges (PKR per month)")).toHaveAttribute("inputmode", "decimal");
  await expect(page.locator("#maintenance_charges-hint")).toHaveText("Maintenance charges in PKR per month. Amount in PKR. Between 0 and 999999999999.99.");
  await expect(page.getByTestId("details-more").locator(".money-prefix")).toHaveText("PKR");
  // the requirement is the group's, not repeated in the hint
  await expect(page.locator("#bedrooms-hint")).not.toContainText("Required");
});

test("details: the Draft's saved answers fill the controls, zero and No are answers, and the summary lists answered details only", async ({ page, request }) => {
  await openDraft(page, request, "house_details");
  await expect(detail(page, "Bedrooms")).toHaveValue("4");
  await expect(detail(page, "Bathrooms")).toHaveValue("3");
  await expect(detail(page, "Total floors")).toHaveValue("2");
  await expect(detail(page, "Condition")).toHaveValue("good");
  await expect(detail(page, "Basement")).toHaveValue("true");
  await expect(detail(page, "Covered area (sq ft)")).toHaveValue("2400.5000");
  await expect(detail(page, "Kitchens")).toHaveValue("1");
  await expect(detail(page, "Parking spaces")).toHaveValue("");
  await expect(summaryItem(page, "bedrooms")).toHaveText("4");
  await expect(summaryItem(page, "bathrooms")).toHaveText("3");
  await expect(summaryItem(page, "condition")).toHaveText("Good");
  await expect(summaryItem(page, "basement")).toHaveText("Yes");
  await expect(summaryItem(page, "covered_area_sqft")).toHaveText("2,400.5");
  await expect(page.locator('[data-testid^="draft-detail-"]')).toHaveCount(7); // bedrooms, bathrooms, total floors, kitchens, condition, basement, covered
});

test("details: zero and No are answers shown as such, while an unanswered detail stays empty and is not listed", async ({ page, request }) => {
  await openDraft(page, request, "house_zero");
  await expect(detail(page, "Bedrooms")).toHaveValue("0");
  await expect(detail(page, "Kitchens")).toHaveValue("0");
  await expect(detail(page, "Basement")).toHaveValue("false");
  await expect(detail(page, "Bathrooms")).toHaveValue("");
  await expect(summaryItem(page, "bedrooms")).toHaveText("0");
  await expect(summaryItem(page, "basement")).toHaveText("No");
  await expect(summaryItem(page, "bathrooms")).toHaveCount(0);
  await expect(page.locator('[data-testid^="draft-detail-"]')).toHaveCount(3);
});

test("details: untouched or equivalent text sends nothing and says there are no changes", async ({ page, request }) => {
  await openDraft(page, request, "house_details");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  await detail(page, "Covered area (sq ft)").fill("2400.50"); // the same amount written another way
  await detail(page, "Bedrooms").fill(" 4 "); // a trim-only difference
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  await detail(page, "Parking spaces").fill("   "); // blank stays unanswered
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  await settle();
  expect((await patches(request)).count).toBe(0);
});

test("details: a House's answers are sent as JSON integers, booleans and text; only the changed fields, and the stored values keep their types", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await detail(page, "Bedrooms").fill("3");
  await detail(page, "Bathrooms").fill("2");
  await detail(page, "Kitchens").fill("0"); // zero is an answer
  await detail(page, "Condition").selectOption("good");
  await detail(page, "Basement").selectOption("false"); // No is an answer, not "unanswered"
  await detail(page, "Covered area (sq ft)").fill(" 1200.5 ");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  const sent = await patches(request);
  expect(sent.count).toBe(1);
  expect(sent.bodies[0]).toEqual({
    base_revision: 1,
    fields: { bedrooms: 3, bathrooms: 2, kitchens: 0, condition: "good", basement: false, covered_area_sqft: "1200.5" },
  });
  expect(typeof sent.bodies[0].fields.bedrooms).toBe("number");
  expect(typeof sent.bodies[0].fields.covered_area_sqft).toBe("string");
  const stored = await storedFields(request);
  expect(stored).toMatchObject({ bedrooms: 3, bathrooms: 2, kitchens: 0, condition: "good", basement: false, covered_area_sqft: "1200.5000", lift: null, parking_spaces: null });
  await expect(revision(page)).toHaveText("2");
  await expect(detail(page, "Covered area (sq ft)")).toHaveValue("1200.5000"); // shown as the server wrote it
  await expect(detail(page, "Bedrooms")).toHaveValue("3");
  await expect(summaryItem(page, "covered_area_sqft")).toHaveText("1,200.5");
  await expect(summaryItem(page, "basement")).toHaveText("No");
  // The next save sends only what changed since.
  await detail(page, "Furnishing").selectOption("furnished");
  await saveButton(page).click();
  await expect(revision(page)).toHaveText("3");
  expect((await patches(request)).bodies[1]).toEqual({ base_revision: 2, fields: { furnishing: "furnished" } });
});

test("details: an Apartment's answers include a floor of zero, No, an amount of money and a number of floors", async ({ page, request }) => {
  await openDraft(page, request, "apartment_blank");
  await detail(page, "Floor number").fill("0");
  await detail(page, "Floors in the building").fill("12");
  await detail(page, "Lift").selectOption("true");
  await detail(page, "Backup electricity").selectOption("false");
  await detail(page, "Maintenance charges (PKR per month)").fill("2500");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({
    base_revision: 1,
    fields: { floor_number: 0, building_floors: 12, lift: true, backup_electricity: false, maintenance_charges: "2500" },
  });
  expect(await storedFields(request)).toMatchObject({ floor_number: 0, building_floors: 12, lift: true, backup_electricity: false, maintenance_charges: "2500.00", building_security: null });
  await expect(detail(page, "Maintenance charges (PKR per month)")).toHaveValue("2500.00");
  await expect(summaryItem(page, "maintenance_charges")).toHaveText("PKR 2,500.00");
  await expect(summaryItem(page, "floor_number")).toHaveText("0");
  await expect(summaryItem(page, "building_security")).toHaveCount(0);
});

test("details: clearing an answer sends null, and the summary drops it", async ({ page, request }) => {
  await openDraft(page, request, "apartment_details");
  await detail(page, "Lift").selectOption(""); // Not answered
  await detail(page, "Bedrooms").fill("");
  await detail(page, "Maintenance charges (PKR per month)").fill("");
  await detail(page, "Furnishing").selectOption("");
  await detail(page, "Backup electricity").selectOption(""); // was No: also an answer that can be withdrawn
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({
    base_revision: 2,
    fields: { lift: null, bedrooms: null, maintenance_charges: null, furnishing: null, backup_electricity: null },
  });
  expect(await storedFields(request)).toMatchObject({ lift: null, bedrooms: null, maintenance_charges: null, furnishing: null, backup_electricity: null, bathrooms: 2 });
  await expect(summaryItem(page, "bedrooms")).toHaveCount(0);
  await expect(summaryItem(page, "lift")).toHaveCount(0);
  await expect(summaryItem(page, "bathrooms")).toHaveText("2");
});

test("details: integer text is sent as a JSON integer only in the exact shape; any other text goes as typed for the server to refuse, never through Number", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  // Number("1e2") would be 100 and Number("0x10") 16; non-ASCII digits are not digits here.
  const attempts = ["007", "05", "-1", "1.5", "5.0", "1e2", "0x10", "abc", "١٢", "1234567890"];
  let count = 0;
  for (const typed of attempts) {
    await detail(page, "Bedrooms").fill(typed);
    await saveButton(page).click();
    await expect(page.locator("#bedrooms-error")).toHaveText(`Error: ${INTEGER_INVALID}`);
    count += 1;
    const sent = await patches(request);
    expect(sent.count).toBe(count);
    expect(sent.bodies[count - 1]).toEqual({ base_revision: 1, fields: { bedrooms: typed } });
    await expect(detail(page, "Bedrooms")).toHaveValue(typed); // what was typed is kept
    await expect(detail(page, "Bedrooms")).toHaveAttribute("aria-invalid", "true");
  }
  await expect(summary(page).getByRole("link", { name: /^Bedrooms:/ })).toBeVisible();
  // The exact shape: 0, or digits without a leading zero, with surrounding spaces trimmed.
  // Up to nine ASCII digits without a leading zero are sent as integers (exact), so the server judges the range, not the shape.
  for (const typed of ["99999", "123456789"]) {
    await detail(page, "Bedrooms").fill(typed);
    await saveButton(page).click();
    await expect(page.locator("#bedrooms-error")).toHaveText(`Error: ${INTEGER_RANGE}`);
    count += 1;
    expect((await patches(request)).bodies[count - 1]).toEqual({ base_revision: 1, fields: { bedrooms: Number(typed) } });
  }
  await detail(page, "Bedrooms").fill(" 7 ");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[count]).toEqual({ base_revision: 1, fields: { bedrooms: 7 } });
  expect((await storedFields(request)).bedrooms).toBe(7);
});

test("details: a number outside the registry's limits is invalid_range under its own control, and the input stays", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await detail(page, "Bedrooms").fill("51");
  await detail(page, "Year built").fill("1899");
  await detail(page, "Total floors").fill("0");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(page.locator("#bedrooms-error")).toHaveText(`Error: ${INTEGER_RANGE}`);
  await expect(page.locator("#construction_year-error")).toHaveText(`Error: ${INTEGER_RANGE}`);
  await expect(page.locator("#total_floors-error")).toHaveText(`Error: ${INTEGER_RANGE}`);
  await expect(summary(page).getByRole("link")).toHaveCount(3);
  await expect(detail(page, "Bedrooms")).toHaveValue("51");
  await expect(detail(page, "Bedrooms")).toHaveAttribute("aria-describedby", /bedrooms-hint bedrooms-error/);
  expect((await patches(request)).bodies[0].fields).toEqual({ bedrooms: 51, construction_year: 1899, total_floors: 0 });
  await summary(page).getByRole("link", { name: /^Year built:/ }).click();
  await expect(detail(page, "Year built")).toBeFocused();
  await detail(page, "Year built").fill("2001");
  await expect(page.locator("#construction_year-error")).toHaveCount(0);
  await expect(page.locator("#bedrooms-error")).toBeVisible();
  await expect(revision(page)).toHaveText("1");
});

test("details: covered area and maintenance charges follow the decimal and money rules (invalid, invalid_area, invalid_price)", async ({ page, request }) => {
  await openDraft(page, request, "apartment_blank");
  const covered = detail(page, "Covered area (sq ft)");
  const charges = detail(page, "Maintenance charges (PKR per month)");
  await covered.fill("1,200");
  await charges.fill("2,500");
  await saveButton(page).click();
  await expect(page.locator("#covered_area_sqft-error")).toHaveText(`Error: ${COVERED_INVALID}`);
  await expect(page.locator("#maintenance_charges-error")).toHaveText(`Error: ${CHARGES_INVALID}`);
  expect((await patches(request)).bodies[0].fields).toEqual({ covered_area_sqft: "1,200", maintenance_charges: "2,500" }); // text as typed
  await covered.fill("0");
  await charges.fill("2500.555");
  await saveButton(page).click();
  await expect(page.locator("#covered_area_sqft-error")).toHaveText(`Error: ${COVERED_LIMITS}`);
  await expect(page.locator("#maintenance_charges-error")).toHaveText(`Error: ${CHARGES_LIMITS}`);
  await covered.fill("12345678901");
  await charges.fill("-1");
  await saveButton(page).click();
  await expect(page.locator("#covered_area_sqft-error")).toHaveText(`Error: ${COVERED_LIMITS}`);
  await expect(page.locator("#maintenance_charges-error")).toHaveText(`Error: ${CHARGES_LIMITS}`);
  await expect(covered).toHaveValue("12345678901");
  // Zero charges are allowed (the registry's minimum is 0), and no float is ever formed.
  await covered.fill("1200.25");
  await charges.fill("0");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect(await storedFields(request)).toMatchObject({ covered_area_sqft: "1200.2500", maintenance_charges: "0.00" });
  expect((await patches(request)).bodies[3].fields).toEqual({ covered_area_sqft: "1200.25", maintenance_charges: "0" });
});

test("details: the floor rule shows under both floor fields, even the one the owner did not edit, and any edit clears it", async ({ page, request }) => {
  await openDraft(page, request, "apartment_details"); // floor 5 of 12
  const floor = detail(page, "Floor number");
  const building = detail(page, "Floors in the building");
  await building.fill("3");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  // The owner edited only the building; the code is also reported on the floor, whose control shows it.
  await expect(page.locator("#building_floors-error")).toHaveText(`Error: ${FLOOR}`);
  await expect(page.locator("#floor_number-error")).toHaveText(`Error: ${FLOOR}`);
  await expect(floor).toHaveAttribute("aria-invalid", "true");
  await expect(summary(page).getByRole("link", { name: /^Floor number:/ })).toBeVisible();
  expect((await patches(request)).bodies[0]).toEqual({ base_revision: 2, fields: { building_floors: 3 } });
  await summary(page).getByRole("link", { name: /^Floor number:/ }).click();
  await expect(floor).toBeFocused();
  // Fixing one field clears the problem on both.
  await floor.fill("2");
  await expect(page.locator("#floor_number-error")).toHaveCount(0);
  await expect(page.locator("#building_floors-error")).toHaveCount(0);
  await expect(summary(page)).toHaveCount(0);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[1]).toEqual({ base_revision: 2, fields: { floor_number: 2, building_floors: 3 } });
  expect(await storedFields(request)).toMatchObject({ floor_number: 2, building_floors: 3 });
});

test("details: a floor above the stored building is invalid_floor on the floor alone, and editing the building clears it", async ({ page, request }) => {
  await openDraft(page, request, "apartment_details");
  await detail(page, "Floor number").fill("20");
  await saveButton(page).click();
  await expect(page.locator("#floor_number-error")).toHaveText(`Error: ${FLOOR}`);
  await expect(page.locator("#building_floors-error")).toHaveCount(0);
  await expect(summary(page).getByRole("link")).toHaveCount(1);
  await detail(page, "Floors in the building").fill("30"); // the other field of the rule
  await expect(page.locator("#floor_number-error")).toHaveCount(0);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect(await storedFields(request)).toMatchObject({ floor_number: 20, building_floors: 30 });
});

test("details: every code maps to text under its control, with the summary focused and the values kept", async ({ page, request }) => {
  await openDraft(page, request, "apartment_details");
  await setMode(request, "listing-patch", "detail_codes");
  await detail(page, "Bedrooms").fill("99");
  await detail(page, "Lift").selectOption("false");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(page.locator("#bedrooms-error")).toHaveText(`Error: ${INTEGER_RANGE}`);
  await expect(page.locator("#condition-error")).toHaveText(`Error: ${CHOICE_INVALID}`);
  await expect(page.locator("#lift-error")).toHaveText(`Error: ${BOOLEAN_INVALID}`);
  await expect(page.locator("#covered_area_sqft-error")).toHaveText(`Error: ${COVERED_LIMITS}`);
  await expect(page.locator("#maintenance_charges-error")).toHaveText(`Error: ${CHARGES_LIMITS}`);
  await expect(page.locator("#floor_number-error")).toHaveText(`Error: ${FLOOR}`);
  await expect(summary(page).getByRole("link")).toHaveCount(6);
  await expect(live(page)).toHaveText(ERRORS_ANNOUNCED);
  await expect(detail(page, "Bedrooms")).toHaveValue("99");
  await expect(detail(page, "Lift")).toHaveValue("false");
  await expect(detail(page, "Lift")).toHaveAttribute("aria-invalid", "true");
  await expect(revision(page)).toHaveText("2");
  // An error clears when its own field is edited; the floor problem (between fields) stays until one of the floor fields is edited.
  await detail(page, "Condition").selectOption("good");
  await expect(page.locator("#condition-error")).toHaveCount(0);
  await expect(page.locator("#floor_number-error")).toBeVisible();
  await expect(page.locator("#bedrooms-error")).toBeVisible();
  await expect(page.locator("#lift-error")).toBeVisible();
  await detail(page, "Floors in the building").fill("20");
  await expect(page.locator("#floor_number-error")).toHaveCount(0);
  await expect(page.locator("#bedrooms-error")).toBeVisible();
  await expect(page.locator("#lift-error")).toBeVisible();
});

test("details: a code for a detail with no control goes to the list, never to a link, and the control is not there", async ({ page, request }) => {
  await openDraft(page, request, "apartment_details"); // an apartment has no kitchens
  await setMode(request, "listing-patch", "detail_hidden");
  await detail(page, "Bedrooms").fill("3");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(summary(page).getByRole("link")).toHaveCount(0);
  await expect(summary(page).getByRole("listitem")).toHaveText([NOT_APPLICABLE]);
  await expect(detail(page, "Kitchens")).toHaveCount(0);
  await expect(detail(page, "Bedrooms")).toHaveValue("3");
});

test("details: unknown codes, sentences, prototype keys and unknown fields are generic, never the server's text", async ({ page, request }) => {
  await openDraft(page, request, "apartment_details");
  await setMode(request, "listing-patch", "detail_unknown");
  await detail(page, "Bedrooms").fill("3");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(page.locator("#bedrooms-error")).toHaveText(`Error: ${GENERIC}`);
  await expect(page.locator("#condition-error")).toHaveText(`Error: ${GENERIC}`);
  await expect(page.locator("#lift-error")).toHaveText(`Error: ${GENERIC} ${BOOLEAN_INVALID}`);
  await expect(summary(page).getByRole("link")).toHaveCount(3);
  await expect(summary(page).getByRole("listitem").last()).toHaveText(REJECTED);
  await expect(page.locator("body")).not.toContainText("Some server sentence");
  await expect(page.locator("body")).not.toContainText("constructor");
});

test("details: what was typed survives an error, a conflict and a failed save, and a restored page loads the saved answers again", async ({ page, request }) => {
  await openDraft(page, request, "house_details");
  await setMode(request, "listing-patch", "error");
  await detail(page, "Bedrooms").fill("9");
  await detail(page, "Basement").selectOption("false");
  await saveButton(page).click();
  await expect(notice(page)).toHaveText(SERVER);
  await expect(detail(page, "Bedrooms")).toHaveValue("9");
  await expect(detail(page, "Basement")).toHaveValue("false");
  page.on("dialog", (dialog) => void dialog.accept());
  await setMode(request, "listing-patch", "ok");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(detail(page, "Bedrooms")).toHaveValue("4"); // a restored page starts again from the server
  await expect(detail(page, "Basement")).toHaveValue("true");
});

test("details conflict: the latest values are formatted per type, Use latest and Keep mine apply per field, and the banner clears when all rows are resolved", async ({ page, request }) => {
  await openDraft(page, request, "house_details");
  await otherSession(request, id(1), { bedrooms: "6", condition: "excellent", basement: "false", covered_area_sqft: "3000.1000", kitchens: "", bathrooms: "5" });
  await detail(page, "Bedrooms").fill("5");
  await detail(page, "Condition").selectOption("needs_renovation");
  await detail(page, "Basement").selectOption(""); // Not answered
  await detail(page, "Covered area (sq ft)").fill("2500");
  await detail(page, "Kitchens").fill("2");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(conflictBanner(page)).toBeFocused();
  await expect(revision(page)).toHaveText("3");
  await expect(page.getByTestId("conflict-bedrooms")).toContainText("Latest saved: 6");
  await expect(page.getByTestId("conflict-condition")).toContainText("Latest saved: Excellent");
  await expect(page.getByTestId("conflict-basement")).toContainText("Latest saved: No");
  await expect(page.getByTestId("conflict-covered_area_sqft")).toContainText("Latest saved: 3,000.1");
  await expect(page.getByTestId("conflict-kitchens")).toContainText("Latest saved: Not answered");
  await expect(page.getByTestId("conflict-bathrooms")).toHaveCount(0); // the owner did not edit it: it takes the latest, with no row
  await expect(detail(page, "Bathrooms")).toHaveValue("5");
  await expect(page.locator('[data-testid^="conflict-"]')).toHaveCount(5);
  // The owner's input stays as typed.
  await expect(detail(page, "Bedrooms")).toHaveValue("5");
  await expect(detail(page, "Condition")).toHaveValue("needs_renovation");
  await expect(detail(page, "Covered area (sq ft)")).toHaveValue("2500");
  await expect(liveRegions(page)).toHaveCount(1);
  await expect(detail(page, "Bedrooms")).toHaveAttribute("aria-describedby", /bedrooms-hint bedrooms-latest/);
  await page.getByRole("button", { name: "Use latest for Bedrooms" }).click();
  await expect(detail(page, "Bedrooms")).toHaveValue("6");
  await expect(detail(page, "Bedrooms")).toBeFocused();
  await page.getByRole("button", { name: "Keep mine for Condition" }).click();
  await expect(detail(page, "Condition")).toHaveValue("needs_renovation");
  await page.getByRole("button", { name: "Use latest for Basement" }).click();
  await expect(detail(page, "Basement")).toHaveValue("false");
  await page.getByRole("button", { name: "Keep mine for Covered area (sq ft)" }).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT); // one row is still open
  await page.getByRole("button", { name: "Use latest for Kitchens" }).click();
  await expect(detail(page, "Kitchens")).toHaveValue("");
  await expect(conflictBanner(page)).toHaveCount(0); // every row resolved: the banner goes
  await expect(live(page)).toHaveText("Your choices are applied. Save to keep them.");
  await expect(page.locator('[data-testid^="conflict-"]')).toHaveCount(0);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[1]).toEqual({
    base_revision: 3,
    fields: { condition: "needs_renovation", covered_area_sqft: "2500" },
  });
  expect(await storedFields(request)).toMatchObject({ bedrooms: 6, condition: "needs_renovation", basement: false, covered_area_sqft: "2500.0000", kitchens: null, bathrooms: 5 });
});

test("details conflict: money, yes/no and floors are formatted, and a value another session left equal to the owner's is already saved", async ({ page, request }) => {
  await openDraft(page, request, "apartment_details");
  await otherSession(request, id(1), { maintenance_charges: "3000", lift: "true", floor_number: "6" });
  await detail(page, "Maintenance charges (PKR per month)").fill("2600");
  await detail(page, "Lift").selectOption("false");
  await detail(page, "Floor number").fill("7");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(page.getByTestId("conflict-maintenance_charges")).toContainText("Latest saved: PKR 3,000");
  await expect(page.getByTestId("conflict-lift")).toContainText("Latest saved: Yes");
  await expect(page.getByTestId("conflict-floor_number")).toContainText("Latest saved: 6");
  await page.getByRole("button", { name: "Use latest for Lift" }).click();
  await expect(detail(page, "Lift")).toHaveValue("true");
  await page.getByRole("button", { name: "Keep mine for Maintenance charges (PKR per month)" }).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT); // the floor row is still open
  // Hiding the last row by typing the latest value by hand also resolves it, and the banner goes.
  await detail(page, "Floor number").fill("6");
  await expect(page.getByTestId("conflict-floor_number")).toHaveCount(0);
  await expect(conflictBanner(page)).toHaveCount(0);
  await expect(live(page)).toHaveText("Your choices are applied. Save to keep them.");
  page.on("dialog", (dialog) => void dialog.accept()); // the next Draft is opened with unsaved changes in this one
  // A retry after a lost response: every typed value equals the latest (an amount in another notation counts as equal).
  await openDraft(page, request, "house_details");
  await otherSession(request, id(1), { bedrooms: "5", covered_area_sqft: "2500.5000", basement: "false" });
  await detail(page, "Bedrooms").fill("5");
  await detail(page, "Covered area (sq ft)").fill("2500.5");
  await detail(page, "Basement").selectOption("false");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(ALREADY_SAVED);
  await expect(page.locator('[data-testid^="conflict-"]')).toHaveCount(0);
});

test("details conflict: a change elsewhere to a detail the owner did not touch is a normal conflict, and a second conflict keeps the input", async ({ page, request }) => {
  await openDraft(page, request, "house_details");
  await otherSession(request, id(1), { bathrooms: "5" });
  await detail(page, "Bedrooms").fill("8");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT); // not "already saved"
  await expect(detail(page, "Bathrooms")).toHaveValue("5"); // untouched by the owner: takes the latest
  await expect(page.getByTestId("conflict-bathrooms")).toHaveCount(0); // and no row for it: only the owner's own change has one
  await expect(page.locator('[data-testid^="conflict-"]')).toHaveCount(1);
  await otherSession(request, id(1), { bedrooms: "9" });
  await saveButton(page).click();
  await expect(page.getByTestId("conflict-bedrooms")).toContainText("Latest saved: 9");
  await expect(detail(page, "Bedrooms")).toHaveValue("8");
});

test("details: the form follows the registry (other limits, requirements and choices), and a field it does not define gets no control", async ({ page, request }) => {
  await registryFields(request, "other");
  await openDraft(page, request, "house_blank");
  await expect(page.getByRole("group", { name: "Required before you publish" })).toHaveCount(0); // nothing is required in this registry for a house
  await expect(detailLabels(page, "recommended")).toHaveText(["Bedrooms"]);
  await expect(detailLabels(page, "more")).toHaveText(["Condition", "Kitchens"]);
  await expect(page.locator("#bedrooms-hint")).toHaveText("Number of bedrooms. Whole number from 1 to 9.");
  await expect(page.locator("#kitchens-hint")).toHaveText("Whole number from 1 to 3.");
  await expect(detail(page, "Condition").locator("option")).toHaveText(["Not answered", "New", "Used"]);
  await expect(detail(page, "Bathrooms")).toHaveCount(0); // not defined by this registry
  await expect(detail(page, "Basement")).toHaveCount(0);
  await openDraft(page, request, "apartment_blank");
  await expect(detailLabels(page, "required")).toHaveText(["Lift"]);
  await expect(detailLabels(page, "recommended")).toHaveText(["Bedrooms"]);
  await expect(detail(page, "Kitchens")).toHaveCount(0);
});

test("details: a registry field with no label of its own still gets its control, hint, group and saving (the humanised id is its label)", async ({ page, request }) => {
  await registryFields(request, "extra");
  await openDraft(page, request, "house_blank");
  await expect(detailLabels(page, "required")).toHaveText(["Bedrooms", "Bathrooms", "Solar panels"]);
  await expect(detailLabels(page, "recommended")).toHaveText([...HOUSE_RECOMMENDED, "Roof type"]);
  await expect(detailLabels(page, "more")).toHaveText([...HOUSE_MORE, "Swimming pool", "Garden area sqft", "Garage slots"]);
  await expect(page.locator("#garage_slots-hint")).toHaveText("Whole number. At least 1."); // one bound: only that one is claimed
  await expect(page.locator("#solar_panels-hint")).toHaveText("Whole number from 0 to 99.");
  await expect(page.locator("#garden_area_sqft-hint")).toHaveText("Digits with an optional decimal point, up to 2 decimal places. Between 1 and 99999.");
  await expect(detail(page, "Roof type").locator("option")).toHaveText(["Not answered", "Flat", "Sloped"]);
  await expect(detail(page, "Swimming pool").locator("option")).toHaveText(["Not answered", "Yes", "No"]);
  await expect(detail(page, "Agent notes")).toHaveCount(0); // a text field has no control here
  await expect(detail(page, "Roof geometry")).toHaveCount(0); // neither does a type the editor does not know
  await detail(page, "Solar panels").fill("4");
  await detail(page, "Swimming pool").selectOption("true");
  await detail(page, "Roof type").selectOption("sloped");
  await detail(page, "Garden area sqft").fill("120.5");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({
    base_revision: 1,
    fields: { solar_panels: 4, swimming_pool: true, roof_type: "sloped", garden_area_sqft: "120.5" },
  });
  await expect(detail(page, "Garden area sqft")).toHaveValue("120.50");
  await expect(summaryItem(page, "swimming_pool")).toHaveText("Yes");
  await expect(summaryItem(page, "roof_type")).toHaveText("Sloped");
  await expect(detailLabels(page, "required")).toHaveCount(3);
});

test("details: another area scale changes only the area hint, and a registry without editable fields shows no Details section", async ({ page, request }) => {
  await registryFields(request, "scale6"); // the same details with another area scale
  await openDraft(page, request, "house_blank");
  await expect(detail(page, "Bedrooms")).toBeVisible();
  await expect(page.locator("#area_value-hint")).toContainText("up to 6 decimal places");
  await registryFields(request, "none");
  await page.reload();
  await expect(page.getByTestId("draft-nothing-editable")).toBeVisible();
  await expect(page.getByTestId("details-block")).toHaveCount(0);
});

test("details: the answers carry no listing data into storage, the console, the title or the address bar", async ({ page, request }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  page.on("dialog", (dialog) => void dialog.accept());
  await openDraft(page, request, "apartment_blank");
  await detail(page, "Bedrooms").fill("7");
  await detail(page, "Covered area (sq ft)").fill("7777.7777");
  await detail(page, "Maintenance charges (PKR per month)").fill("3333.33");
  await detail(page, "Lift").selectOption("true");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await setMode(request, "listing-patch", "detail_codes");
  await detail(page, "Covered area (sq ft)").fill("0");
  await saveButton(page).click();
  await expect(summary(page)).toBeVisible();
  await expect(page).toHaveTitle("Draft | EstateAI");
  expect(new URL(page.url()).search + new URL(page.url()).hash).toBe("");
  const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
  for (const secret of ["7777", "3333", id(1)]) expect(stored).not.toContain(secret);
  expect(await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))).toBe("[{},{}]");
  for (const secret of ["7777", "3333", id(1)]) expect(logs.join("\n")).not.toContain(secret);
});

test("details: Save stays aria-disabled while saving and a double click sends one request", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await setMode(request, "listing-patch", "slow");
  await detail(page, "Bedrooms").fill("3");
  await saveButton(page).dblclick();
  await expect(saveButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(saveButton(page)).not.toBeDisabled();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).count).toBe(1);
});

test("details: a 400 for a value typed after the request went out is dropped, and so is a floor problem that touches it", async ({ page, request }) => {
  await openDraft(page, request, "apartment_details");
  await setMode(request, "listing-patch", "detail_codes_slow");
  // 1. Bedrooms retyped during the save: its error is dropped, the untouched floor error stays.
  await detail(page, "Bedrooms").fill("99");
  await saveButton(page).click();
  await expect.poll(async () => (await patches(request)).count).toBe(1);
  await detail(page, "Bedrooms").fill("3");
  await expect(page.locator("#floor_number-error")).toHaveText(`Error: ${FLOOR}`);
  await expect(page.locator("#bedrooms-error")).toHaveCount(0);
  await expect(summary(page).getByRole("link")).toHaveCount(1);
  await expect(detail(page, "Bedrooms")).toHaveValue("3");
  // 2. A floor field retyped during the save: the whole floor problem is dropped, the bedrooms error stays.
  await detail(page, "Bedrooms").fill("98");
  await saveButton(page).click();
  await expect.poll(async () => (await patches(request)).count).toBe(2);
  await detail(page, "Floors in the building").fill("20");
  await expect(page.locator("#bedrooms-error")).toHaveText(`Error: ${INTEGER_RANGE}`);
  await expect(page.locator("#floor_number-error")).toHaveCount(0);
  await expect(summary(page).getByRole("link")).toHaveCount(1);
  // 3. Everything judged was retyped: no error and no summary at all.
  await detail(page, "Bedrooms").fill("97");
  await saveButton(page).click();
  await expect.poll(async () => (await patches(request)).count).toBe(3);
  await detail(page, "Bedrooms").fill("4");
  await detail(page, "Floor number").fill("6");
  await expect(saveButton(page)).not.toHaveAttribute("aria-disabled");
  await expect(summary(page)).toHaveCount(0);
  await expect(page.locator(".field-error")).toHaveCount(0);
});

test("details: the floor problem clears when either floor field is edited, and Use latest clears the field's own error", async ({ page, request }) => {
  await openDraft(page, request, "apartment_details");
  await setMode(request, "listing-patch", "detail_floor"); // the server names only the floor
  await detail(page, "Floor number").fill("7");
  await saveButton(page).click();
  await expect(page.locator("#floor_number-error")).toHaveText(`Error: ${FLOOR}`);
  await detail(page, "Bedrooms").fill("3"); // an unrelated edit leaves it
  await expect(page.locator("#floor_number-error")).toBeVisible();
  await detail(page, "Floors in the building").fill("11"); // the other field of the rule clears it
  await expect(page.locator("#floor_number-error")).toHaveCount(0);
  // After a conflict a row can stay while a new error shows: Use latest replaces the value the error was about.
  await setMode(request, "listing-patch", "ok");
  await otherSession(request, id(1), { floor_number: "6" });
  await saveButton(page).click();
  await expect(page.getByTestId("conflict-floor_number")).toContainText("Latest saved: 6");
  await setMode(request, "listing-patch", "detail_floor");
  await saveButton(page).click();
  await expect(page.locator("#floor_number-error")).toHaveText(`Error: ${FLOOR}`);
  await page.getByRole("button", { name: "Use latest for Floor number" }).click();
  await expect(detail(page, "Floor number")).toHaveValue("6");
  await expect(page.locator("#floor_number-error")).toHaveCount(0);
  await expect(summary(page).getByRole("link", { name: /^Floor number:/ })).toHaveCount(0);
});

test("details: not_editable and not_applicable on a field that has a control map to their texts under it", async ({ page, request }) => {
  await openDraft(page, request, "apartment_details");
  await setMode(request, "listing-patch", "detail_not_editable");
  await detail(page, "Bedrooms").fill("3");
  await saveButton(page).click();
  await expect(page.locator("#bedrooms-error")).toHaveText("Error: This detail cannot be changed here.");
  await setMode(request, "listing-patch", "detail_not_applicable");
  await detail(page, "Lift").selectOption("false");
  await saveButton(page).click();
  await expect(page.locator("#lift-error")).toHaveText(`Error: ${NOT_APPLICABLE}`);
  await expect(summary(page).getByRole("link", { name: /^Lift:/ })).toBeVisible();
  await expect(detail(page, "Lift")).toHaveValue("false");
});

test("details: values the form cannot represent are shown as the server holds them and can be restored; a poisoned key is ignored", async ({ page, request }) => {
  await openDraft(page, request, "house_odd");
  await expect(detail(page, "Bedrooms")).toHaveValue("3.5"); // a float for an integer
  await expect(detail(page, "Kitchens")).toHaveValue("1e+21"); // an unsafe integer
  await expect(detail(page, "Covered area (sq ft)")).toHaveValue("1200.5"); // a JSON number for a decimal
  await expect(summaryItem(page, "bedrooms")).toHaveText("3.5");
  await expect(summaryItem(page, "covered_area_sqft")).toHaveText("1,200.5");
  await expect(page.locator("#__proto__")).toHaveCount(0); // no control for a poisoned key, and the page works
  await expect(page.locator('[data-testid="draft-detail-__proto__"]')).toHaveCount(0);
  // A yes/no that is not true or false stays selectable.
  await expect(detail(page, "Basement")).toHaveValue("maybe");
  await expect(detail(page, "Basement").locator("option")).toHaveText(["Not answered", "Yes", "No", "maybe (stored value)"]);
  // A choice outside the registry stays offered, marked, even after another option is picked.
  await expect(detail(page, "Condition")).toHaveValue("mint");
  await expect(detail(page, "Condition").locator("option").last()).toHaveText("Mint (no longer offered)");
  await detail(page, "Condition").selectOption("good");
  await expect(detail(page, "Condition").locator("option").last()).toHaveText("Mint (no longer offered)");
  await detail(page, "Condition").selectOption("mint"); // restored: no change
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  await settle();
  expect((await patches(request)).count).toBe(0);
  // Saved as another choice, the old one is no longer the saved value and goes from the list.
  await detail(page, "Condition").selectOption("good");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({ base_revision: 2, fields: { condition: "good" } });
  await expect(detail(page, "Condition").locator("option")).toHaveText(["Not answered", "New", "Excellent", "Good", "Needs renovation"]);
  await expect(detail(page, "Bedrooms")).toHaveValue("3.5"); // still held as it was
});

test("details: money is compared at the registry's scale, leading-zero text is a change that is sent, and the latest value is padded", async ({ page, request }) => {
  await openDraft(page, request, "apartment_details"); // charges "2500.00"
  const charges = detail(page, "Maintenance charges (PKR per month)");
  await charges.fill("2500");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  await charges.fill("02500"); // not the same text as the saved amount: sent for the server to judge
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({ base_revision: 2, fields: { maintenance_charges: "02500" } });
  // Another session writes "3000"; the row pads it to the scale.
  await otherSession(request, id(1), { maintenance_charges: "3000" });
  await charges.fill("2600");
  await saveButton(page).click();
  await expect(page.getByTestId("conflict-maintenance_charges")).toContainText("Latest saved: PKR 3,000.00");
});

test("details conflict: a detail the owner changed that no longer applies is reset to the latest and the banner says so", async ({ page, request }) => {
  await openDraft(page, request, "apartment_details");
  await detail(page, "Lift").selectOption("false");
  await detail(page, "Bedrooms").fill("3");
  await otherSession(request, id(1), { category: "house", subtype: "house" });
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(`${CONFLICT} Some details no longer apply to this draft, so your changes to them were dropped.`);
  await expect(detail(page, "Lift")).toHaveCount(0);
  await expect(detail(page, "Kitchens")).toBeVisible();
  await expect(detail(page, "Bedrooms")).toHaveValue("3"); // an applicable detail keeps what was typed
  await expect(page.getByTestId("conflict-bedrooms")).toContainText("Latest saved: 2");
  await page.getByRole("button", { name: "Keep mine for Bedrooms" }).click();
  await expect(conflictBanner(page)).toHaveCount(0);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[1]).toEqual({ base_revision: 3, fields: { bedrooms: 3 } }); // never the dropped lift
});

test("details: a label-less registry field gets a humanised label in its error and its conflict row", async ({ page, request }) => {
  await registryFields(request, "extra");
  await openDraft(page, request, "house_blank");
  await detail(page, "Solar panels").fill("abc");
  await saveButton(page).click();
  await expect(page.locator("#solar_panels-error")).toHaveText(`Error: ${INTEGER_INVALID}`);
  await expect(summary(page).getByRole("link", { name: /^Solar panels:/ })).toBeVisible();
  await otherSession(request, id(1), { solar_panels: "7" });
  await detail(page, "Solar panels").fill("9");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(page.getByTestId("conflict-solar_panels")).toContainText("Latest saved: 7");
  await page.getByRole("button", { name: "Keep mine for Solar panels" }).waitFor();
  await page.getByRole("button", { name: "Use latest for Solar panels" }).click();
  await expect(detail(page, "Solar panels")).toHaveValue("7");
  await expect(conflictBanner(page)).toHaveCount(0);
});

test("details: the three lists of hand-built ids agree (the client's two and the stub's)", async ({ request }) => {
  const { HAND_BUILT_KEYS } = await import("../../src/lib/listing-labels");
  const stub = (await (await request.get(`${STUB}/__hand-ids`)).json()).ids as string[];
  expect([...HAND_BUILT_KEYS].sort()).toEqual([...stub].sort());
});

// ---------------------------------------------------------------- plot and commercial details (Story 2.5)

const SELLER_DECLARED = "Seller-declared";
const SELLER_HELP = "You are stating this. EstateAI has not checked it.";
const MEASURE_INVALID = "Enter digits only, with an optional decimal point. Do not use commas, signs or units, for example 1200 or 10.5.";
const MEASURE_LIMITS = "Enter a number above zero within the allowed range, using digits and an optional decimal point.";
const CLAIMS = ["possession_status", "balloting_status", "development_status", "approval_authority"];
const PLOT_RECOMMENDED = ["Electricity", "Water", "Plot width (feet)", "Plot depth (feet)", "Possession status", "Corner plot", "Road width (feet)", "Balloting status", "Sewerage", "Development status", "Approval authority"];
const PLOT_MORE = ["Gas", "Park facing", "On a main boulevard", "Boundary wall", "Orientation"];
const SHOP_RECOMMENDED = ["Condition", "Furnishing or fit-out", "Parking spaces", "Occupancy status", "Floor number", "Floors in the building", "Building security", "Electricity", "Water", "Business use", "Frontage (feet)", "Road access"];
const SHOP_MORE = ["Building lobby", "Maintenance charges (PKR per month)", "Gas", "Ceiling height (feet)", "Power load (kW)", "Three-phase electricity"];
const OFFICE_RECOMMENDED = ["Condition", "Furnishing or fit-out", "Parking spaces", "Occupancy status", "Floor number", "Floors in the building", "Lift", "Building security", "Electricity", "Water", "Business use", "Road access"];
const OFFICE_MORE = [...SHOP_MORE, "Conference rooms", "Business centre facilities"];
const declaredTag = (page: Page, fieldId: string) => page.getByTestId(`${fieldId}-seller-declared`);
const summaryTag = (page: Page, fieldId: string) => page.getByTestId(`draft-detail-${fieldId}-seller-declared`);
/**
 * No platform badge or verification wording anywhere on the Draft: the owner's claims are only ever the owner's. Scans the page (without the
 * site header, navigation and footer, which carry the product name), the labels, titles and alt texts, and the tags' generated content.
 */
async function expectNoPlatformBadge(page: Page) {
  await expect(main(page).locator('svg, img, [class*="badge"], [data-testid*="badge"], [data-testid*="verified"]')).toHaveCount(0);
  const found = await page.evaluate((help) => {
    const root = document.body.cloneNode(true) as HTMLElement;
    root.querySelectorAll("header, nav, footer, script, style").forEach((element) => element.remove());
    const attributes = [...document.querySelectorAll("main [aria-label], main [title], main [alt]")].map((element) =>
      [element.getAttribute("aria-label"), element.getAttribute("title"), element.getAttribute("alt")].filter(Boolean).join(" "),
    );
    const generated = [...document.querySelectorAll(".declared-tag")].flatMap((element) => ["::before", "::after"].map((pseudo) => getComputedStyle(element, pseudo).content));
    return { text: (root.textContent ?? "").replaceAll(help, ""), attributes, generated };
  }, SELLER_HELP);
  expect(found.text).not.toMatch(/verified|estateai|checked by|approved by|trusted|✓|✔/i);
  expect(found.attributes.join(" ")).not.toMatch(/verified|estateai|badge|checked|approved|trusted/i);
  for (const content of found.generated) expect(["none", "normal", '""']).toContain(content);
}

test("plot details: a Residential Plot shows only its own details, grouped by requirement, with nothing preselected", async ({ page, request }) => {
  await openDraft(page, request, "plot_blank");
  await expect(page.locator("fieldset.detail-group")).toHaveCount(2);
  await expect(page.getByRole("group", { name: "Required before you publish" })).toHaveCount(0);
  await expect(detailLabels(page, "recommended")).toHaveText(PLOT_RECOMMENDED);
  await expect(detailLabels(page, "more")).toHaveText(PLOT_MORE);
  for (const other of ["Plot file status", "Bedrooms", "Condition", "Furnishing or fit-out", "Business use", "Frontage (feet)", "Floor number", "Lift"]) await expect(detail(page, other)).toHaveCount(0);
  for (const name of ["Plot width (feet)", "Possession status", "Corner plot", "Approval authority", "Orientation", "Electricity"]) await expect(detail(page, name)).toHaveValue("");
  await expect(detail(page, "Plot width (feet)")).toHaveAttribute("inputmode", "decimal");
  await expect(page.locator("#plot_width-hint")).toHaveText("Plot width in feet. Digits with an optional decimal point, up to 2 decimal places. Between 0.01 and 99999.99.");
  await expect(page.locator("#road_width_ft-hint")).toHaveText("Width of the road in front, in feet. Digits with an optional decimal point, up to 2 decimal places. Between 1.00 and 999.99.");
  await expect(detail(page, "Orientation").locator("option")).toHaveText(["Not answered", "North", "South", "East", "West", "North-east", "North-west", "South-east", "South-west"]);
  await expect(detail(page, "Balloting status").locator("option")).toHaveText(["Not answered", "Not applicable", "Balloting pending", "Balloted"]);
  await expect(detail(page, "Development status").locator("option")).toHaveText(["Not answered", "Developed", "Partially developed", "Undeveloped"]);
  await expect(detail(page, "Approval authority").locator("option")).toHaveText([
    "Not answered",
    "Lahore Development Authority (LDA)",
    "Capital Development Authority (CDA)",
    "Karachi Development Authority (KDA)",
    "Rawalpindi Development Authority (RDA)",
    "Faisalabad Development Authority (FDA)",
    "Multan Development Authority (MDA)",
    "Gujranwala Development Authority (GDA)",
    "Bahawalpur Development Authority (BDA)",
    "Peshawar Development Authority",
    "Private society",
    "None",
    "Other",
  ]);
  await expect(page.locator('[data-testid^="draft-detail-"]')).toHaveCount(0);
});

test("plot details: a Commercial Plot shows the same plot details as a Residential Plot", async ({ page, request }) => {
  await openDraft(page, request, "plot_blank");
  await otherSession(request, id(1), { subtype: "commercial_plot" });
  await page.reload();
  await expect(detailLabels(page, "recommended")).toHaveText(PLOT_RECOMMENDED);
  await expect(detailLabels(page, "more")).toHaveText(PLOT_MORE);
});

test("plot file: the Plot File offers only file_only for possession, never preselected, and adds the plot file status", async ({ page, request }) => {
  await openDraft(page, request, "plot_file_blank");
  await expect(detailLabels(page, "recommended")).toHaveText(PLOT_RECOMMENDED);
  await expect(detailLabels(page, "more")).toHaveText([...PLOT_MORE, "Plot file status"]);
  await expect(detail(page, "Possession status").locator("option")).toHaveText(["Not answered", "File only (no possession)"]);
  await expect(detail(page, "Possession status").locator("option").nth(1)).toHaveAttribute("value", "file_only");
  await expect(detail(page, "Possession status")).toHaveValue(""); // nothing is chosen for the owner
  await expect(detail(page, "Plot file status").locator("option")).toHaveText(["Not answered", "Open file", "Allocation letter", "Possession letter"]);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(0);
  await detail(page, "Possession status").selectOption("file_only");
  await detail(page, "Plot file status").selectOption("allocation_letter");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({ base_revision: 1, fields: { possession_status: "file_only", plot_file_status: "allocation_letter" } });
  await expect(summaryItem(page, "possession_status")).toContainText("File only (no possession)");
  await expect(summaryItem(page, "plot_file_status")).toContainText("Allocation letter");
});

test("plot file: a Residential Plot is offered possession_ready and possession_pending, never file_only", async ({ page, request }) => {
  await openDraft(page, request, "plot_blank");
  await expect(detail(page, "Possession status").locator("option")).toHaveText(["Not answered", "Possession ready", "Possession pending"]);
  await expect(detail(page, "Possession status").locator('option[value="file_only"]')).toHaveCount(0);
  await openDraft(page, request, "plot_file_details");
  await expect(detail(page, "Possession status")).toHaveValue("file_only");
  await expect(detail(page, "Possession status").locator('option[value="possession_ready"]')).toHaveCount(0);
  await expect(detail(page, "Possession status").locator('option[value="possession_pending"]')).toHaveCount(0);
});

test("shop details: a Shop shows the shared commercial details, the fit-out label and its own, and not the office-only ones", async ({ page, request }) => {
  await openDraft(page, request, "shop_blank");
  await expect(page.getByRole("group", { name: "Required before you publish" })).toHaveCount(0);
  await expect(detailLabels(page, "recommended")).toHaveText(SHOP_RECOMMENDED);
  await expect(detailLabels(page, "more")).toHaveText(SHOP_MORE);
  for (const other of ["Lift", "Conference rooms", "Business centre facilities", "Bedrooms", "Plot width (feet)", "Possession status", "Furnishing", "Backup electricity"]) await expect(detail(page, other)).toHaveCount(0);
  await expect(detail(page, "Frontage (feet)")).toHaveAttribute("inputmode", "decimal");
  await expect(page.locator("#frontage_ft-hint")).toHaveText("Width of the frontage in feet. Digits with an optional decimal point, up to 2 decimal places. Between 0.01 and 9999.99.");
  await expect(page.locator("#power_load_kw-hint")).toHaveText("Sanctioned power load in kilowatts. Digits with an optional decimal point, up to 2 decimal places. Between 0.01 and 99999.99.");
  await expect(detail(page, "Furnishing or fit-out").locator("option")).toHaveText(["Not answered", "Unfurnished", "Semi furnished", "Furnished"]);
  await expect(detail(page, "Business use").locator("option")).toHaveText(["Not answered", "Retail", "Restaurant", "Office work", "Clinic", "Warehouse", "Showroom", "Mixed", "Other"]);
  await expect(detail(page, "Road access").locator("option")).toHaveText(["Not answered", "Main road", "Secondary road", "Inner street"]);
  await expect(detail(page, "Condition")).toHaveValue("");
  await expect(declaredTag(page, "business_use")).toHaveCount(0); // a business use is not a legal claim
});

test("office details: an Office shows the lift and its own details, and not the shop-only frontage", async ({ page, request }) => {
  await openDraft(page, request, "office_blank");
  await expect(detailLabels(page, "recommended")).toHaveText(OFFICE_RECOMMENDED);
  await expect(detailLabels(page, "more")).toHaveText(OFFICE_MORE);
  await expect(detail(page, "Frontage (feet)")).toHaveCount(0);
  await expect(detail(page, "Furnishing")).toHaveCount(0);
  await expect(detail(page, "Conference rooms")).toHaveAttribute("inputmode", "numeric");
  await expect(page.locator("#conference_rooms-hint")).toHaveText("Whole number from 0 to 50.");
  await expect(detail(page, "Business centre facilities").locator("option")).toHaveText(["Not answered", "Yes", "No"]);
});

test("seller-declared: the claims carry the label and the helper line, tied to the control, and nothing else does", async ({ page, request }) => {
  await openDraft(page, request, "plot_blank");
  for (const claim of CLAIMS) {
    await expect(declaredTag(page, claim)).toHaveText(SELLER_DECLARED);
    await expect(page.getByTestId(`${claim}-declared-help`)).toHaveText(SELLER_HELP);
    await expect(page.locator(`#${claim}`)).toHaveAttribute("aria-describedby", new RegExp(`${claim}-declared-tag ${claim}-declared`));
    await expect(page.locator(`#${claim}-declared`)).toHaveText(SELLER_HELP);
    await expect(page.locator(`#${claim}-declared-tag`)).toHaveText(SELLER_DECLARED);
  }
  // A sale Draft also shows the sale terms (Story 2.6), whose possession availability is a claim too.
  await expect(page.locator('[data-testid$="-seller-declared"]')).toHaveCount(CLAIMS.length + 1);
  await expect(declaredTag(page, "possession_availability")).toHaveText(SELLER_DECLARED);
  for (const plain of ["plot_width", "corner_plot", "sewerage", "orientation", "electricity"]) {
    await expect(declaredTag(page, plain)).toHaveCount(0);
    await expect(page.locator(`#${plain}`)).not.toHaveAttribute("aria-describedby", /declared/);
  }
  await expect(page.getByTestId("possession_status-seller-declared")).toBeVisible();
  // the label of the control stays its own name
  await expect(detail(page, "Possession status")).toHaveCount(1);
  await expectNoPlatformBadge(page);
  await openDraft(page, request, "plot_file_blank");
  await expect(page.locator('[data-testid$="-seller-declared"]')).toHaveCount(CLAIMS.length + 2);
  await expect(declaredTag(page, "plot_file_status")).toHaveText(SELLER_DECLARED);
  await expectNoPlatformBadge(page);
});

test("seller-declared: the Draft summary marks the claims and only the claims, with no platform badge", async ({ page, request }) => {
  await openDraft(page, request, "plot_details");
  for (const claim of ["possession_status", "development_status", "approval_authority"]) await expect(summaryTag(page, claim)).toHaveText(SELLER_DECLARED);
  await expect(summaryItem(page, "possession_status")).toHaveText("Possession ready. Seller-declared");
  await expect(summaryItem(page, "approval_authority")).toHaveText("Lahore Development Authority (LDA). Seller-declared");
  await expect(summaryItem(page, "development_status")).toHaveText("Developed. Seller-declared");
  await expect(summaryTag(page, "balloting_status")).toHaveCount(0); // not answered: not listed
  for (const plain of ["plot_width", "plot_depth", "corner_plot", "road_width_ft", "sewerage", "electricity"]) await expect(summaryTag(page, plain)).toHaveCount(0);
  await expect(page.locator('[data-testid="draft-details"] [data-testid$="-seller-declared"]')).toHaveCount(3);
  await expectNoPlatformBadge(page);
  await openDraft(page, request, "plot_file_details");
  await expect(summaryTag(page, "plot_file_status")).toHaveText(SELLER_DECLARED);
  await expect(summaryItem(page, "possession_status")).toHaveText("File only (no possession). Seller-declared");
  await expectNoPlatformBadge(page);
});

test("plot details: the saved values fill the controls, the feet keep their scale, and the summary formats them", async ({ page, request }) => {
  await openDraft(page, request, "plot_details");
  await expect(detail(page, "Plot width (feet)")).toHaveValue("35.00");
  await expect(detail(page, "Plot depth (feet)")).toHaveValue("70.50");
  await expect(detail(page, "Possession status")).toHaveValue("possession_ready");
  await expect(detail(page, "Corner plot")).toHaveValue("true");
  await expect(detail(page, "Sewerage")).toHaveValue("false"); // No is an answer
  await expect(detail(page, "Water")).toHaveValue("");
  await expect(summaryItem(page, "plot_width")).toHaveText("35.00");
  await expect(summaryItem(page, "plot_depth")).toHaveText("70.50");
  await expect(summaryItem(page, "road_width_ft")).toHaveText("40.00");
  await expect(summaryItem(page, "corner_plot")).toHaveText("Yes");
  await expect(summaryItem(page, "sewerage")).toHaveText("No");
  await expect(summaryItem(page, "water")).toHaveCount(0);
});

test("plot details: answers are sent as text feet, booleans and choices; only the changed fields; equal text is no change; the feet keep their scale", async ({ page, request }) => {
  await openDraft(page, request, "plot_blank");
  await detail(page, "Plot width (feet)").fill(" 35 ");
  await detail(page, "Plot depth (feet)").fill("70.5");
  await detail(page, "Possession status").selectOption("possession_pending");
  await detail(page, "Corner plot").selectOption("false");
  await detail(page, "Road width (feet)").fill("40.25");
  await detail(page, "Approval authority").selectOption("peshawar_development_authority");
  await detail(page, "Orientation").selectOption("north_east");
  await detail(page, "Water").selectOption("true");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({
    base_revision: 1,
    fields: {
      plot_width: "35",
      plot_depth: "70.5",
      possession_status: "possession_pending",
      corner_plot: false,
      road_width_ft: "40.25",
      approval_authority: "peshawar_development_authority",
      orientation: "north_east",
      water: true,
    },
  });
  expect(await storedFields(request)).toMatchObject({ plot_width: "35.00", plot_depth: "70.50", road_width_ft: "40.25", corner_plot: false, water: true });
  expect((await storedFields(request)).sewerage ?? null).toBeNull(); // never a zero or false for what was not answered
  await expect(detail(page, "Plot width (feet)")).toHaveValue("35.00"); // the server's text
  await expect(summaryItem(page, "plot_width")).toHaveText("35.00");
  await expect(summaryItem(page, "approval_authority")).toHaveText("Peshawar Development Authority. Seller-declared");
  await expect(summaryItem(page, "orientation")).toHaveText("North-east");
  // the same amount written another way is no change; another scale is
  await detail(page, "Plot width (feet)").fill("35.0");
  await detail(page, "Plot depth (feet)").fill("70.500");
  await saveButton(page).click();
  await expect(page.locator("#plot_depth-error")).toHaveText(`Error: ${MEASURE_LIMITS}`); // three decimals are sent for the server to judge
  expect((await patches(request)).count).toBe(2);
  expect((await patches(request)).bodies[1].fields).toEqual({ plot_depth: "70.500" });
  await detail(page, "Plot depth (feet)").fill("70.50");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(2);
});

test("plot details: clearing a feet field sends null and never creates a zero", async ({ page, request }) => {
  await openDraft(page, request, "plot_details");
  await detail(page, "Plot width (feet)").fill("");
  await detail(page, "Corner plot").selectOption("");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({ base_revision: 2, fields: { plot_width: null, corner_plot: null } });
  expect(await storedFields(request)).toMatchObject({ plot_width: null, corner_plot: null });
  await expect(summaryItem(page, "plot_width")).toHaveCount(0);
  await expect(detail(page, "Plot width (feet)")).toHaveValue("");
});

test("plot details: the feet fields follow the strict text rules (invalid and invalid_measure), sent as typed and never as numbers", async ({ page, request }) => {
  await openDraft(page, request, "plot_blank");
  const width = detail(page, "Plot width (feet)");
  const road = detail(page, "Road width (feet)");
  await width.fill("12,5");
  await road.fill("40 ft");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(page.locator("#plot_width-error")).toHaveText(`Error: ${MEASURE_INVALID}`);
  await expect(page.locator("#road_width_ft-error")).toHaveText(`Error: ${MEASURE_INVALID}`);
  expect((await patches(request)).bodies[0].fields).toEqual({ plot_width: "12,5", road_width_ft: "40 ft" });
  for (const [typed, field] of [
    ["0", "plot_width"],
    ["35.001", "plot_width"],
    ["-5", "plot_width"],
    ["100000", "plot_width"],
    ["0.99", "road_width_ft"],
    ["1000", "road_width_ft"],
  ] as const) {
    await width.fill(field === "plot_width" ? typed : "");
    await road.fill(field === "road_width_ft" ? typed : "");
    await saveButton(page).click();
    await expect(page.locator(`#${field}-error`), typed).toHaveText(`Error: ${MEASURE_LIMITS}`);
    await expect(detail(page, field === "plot_width" ? "Plot width (feet)" : "Road width (feet)")).toHaveValue(typed); // the input stays
  }
  await width.fill("007");
  await saveButton(page).click();
  await expect(page.locator("#plot_width-error")).toHaveText(`Error: ${MEASURE_INVALID}`);
  await width.fill("99999.99");
  await road.fill("1");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect(await storedFields(request)).toMatchObject({ plot_width: "99999.99", road_width_ft: "1.00" });
});

test("plot details: invalid_choice, invalid, not_applicable and invalid_measure map to text under their controls", async ({ page, request }) => {
  await openDraft(page, request, "plot_details");
  await setMode(request, "listing-patch", "plot_codes");
  await detail(page, "Plot depth (feet)").fill("71");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(page.locator("#plot_width-error")).toHaveText(`Error: ${MEASURE_LIMITS}`);
  await expect(page.locator("#possession_status-error")).toHaveText(`Error: ${CHOICE_INVALID}`);
  await expect(page.locator("#corner_plot-error")).toHaveText(`Error: ${BOOLEAN_INVALID}`);
  await expect(page.locator("#road_width_ft-error")).toHaveText(`Error: ${MEASURE_INVALID}`);
  await expect(page.locator("#approval_authority-error")).toHaveText(`Error: ${NOT_APPLICABLE}`);
  await expect(summary(page).getByRole("link")).toHaveCount(5);
  await expect(summary(page).getByRole("link", { name: "Possession status" })).toBeVisible();
  await expect(live(page)).toHaveText(ERRORS_ANNOUNCED);
  await expect(detail(page, "Plot depth (feet)")).toHaveValue("71");
  await expect(detail(page, "Possession status")).toHaveAttribute("aria-invalid", "true");
  await detail(page, "Possession status").selectOption("possession_pending");
  await expect(page.locator("#possession_status-error")).toHaveCount(0);
  await expect(page.locator("#plot_width-error")).toBeVisible();
});

test("commercial details: a Shop's answers are sent, the feet and kW keep their scale, and the shared fields use the same columns", async ({ page, request }) => {
  await openDraft(page, request, "shop_blank");
  await detail(page, "Business use").selectOption("clinic");
  await detail(page, "Frontage (feet)").fill("18.5");
  await detail(page, "Road access").selectOption("main_road");
  await detail(page, "Condition").selectOption("good");
  await detail(page, "Furnishing or fit-out").selectOption("semi_furnished");
  await detail(page, "Parking spaces").fill("0");
  await detail(page, "Floor number").fill("2");
  await detail(page, "Floors in the building").fill("3");
  await detail(page, "Power load (kW)").fill("12.5");
  await detail(page, "Three-phase electricity").selectOption("true");
  await detail(page, "Maintenance charges (PKR per month)").fill("4000");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({
    base_revision: 1,
    fields: {
      condition: "good",
      furnishing: "semi_furnished",
      parking_spaces: 0,
      floor_number: 2,
      building_floors: 3,
      maintenance_charges: "4000",
      business_use: "clinic",
      frontage_ft: "18.5",
      road_access: "main_road",
      power_load_kw: "12.5",
      three_phase_electricity: true,
    },
  });
  expect(await storedFields(request)).toMatchObject({ frontage_ft: "18.50", power_load_kw: "12.50", maintenance_charges: "4000.00" });
  await expect(summaryItem(page, "frontage_ft")).toHaveText("18.50");
  await expect(summaryItem(page, "power_load_kw")).toHaveText("12.50");
  await expect(summaryItem(page, "furnishing")).toHaveText("Semi furnished");
  await expect(page.locator('[data-testid="draft-details"] dt', { hasText: "Furnishing or fit-out" })).toHaveCount(1);
  await expect(page.locator('[data-testid="draft-details"] [data-testid$="-seller-declared"]')).toHaveCount(0); // no commercial claim here
});

test("commercial details: the feet and kW errors, and the floor rule on a Shop and an Office, use the same texts", async ({ page, request }) => {
  page.on("dialog", (dialog) => void dialog.accept()); // the page is left with unsaved changes on purpose
  await openDraft(page, request, "shop_blank");
  await detail(page, "Frontage (feet)").fill("0");
  await detail(page, "Power load (kW)").fill("1,5");
  await detail(page, "Floor number").fill("5");
  await detail(page, "Floors in the building").fill("3");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(page.locator("#frontage_ft-error")).toHaveText(`Error: ${MEASURE_LIMITS}`);
  await expect(page.locator("#power_load_kw-error")).toHaveText(`Error: ${MEASURE_INVALID}`);
  await expect(page.locator("#floor_number-error")).toHaveText(`Error: ${FLOOR}`);
  await expect(page.locator("#building_floors-error")).toHaveText(`Error: ${FLOOR}`);
  await detail(page, "Floors in the building").fill("6"); // either floor clears the linked problem
  await expect(page.locator("#floor_number-error")).toHaveCount(0);
  await expect(page.locator("#building_floors-error")).toHaveCount(0);
  await expect(page.locator("#frontage_ft-error")).toBeVisible();
  await openDraft(page, request, "office_details");
  await detail(page, "Floor number").fill("9");
  await saveButton(page).click();
  await expect(page.locator("#floor_number-error")).toHaveText(`Error: ${FLOOR}`);
  await expect(page.locator("#building_floors-error")).toHaveCount(0); // the floors in the building were not sent
  await detail(page, "Conference rooms").fill("51");
  await detail(page, "Floor number").fill("2");
  await saveButton(page).click();
  await expect(page.locator("#conference_rooms-error")).toHaveText(`Error: ${INTEGER_RANGE}`);
  await detail(page, "Conference rooms").fill("4");
  await detail(page, "Lift").selectOption("false");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect(await storedFields(request)).toMatchObject({ conference_rooms: 4, lift: false, floor_number: 2 });
});

test("commercial details: the server's codes for the Shop's fields map to text under their controls", async ({ page, request }) => {
  await openDraft(page, request, "shop_details");
  await setMode(request, "listing-patch", "commercial_codes");
  await detail(page, "Frontage (feet)").fill("19");
  await saveButton(page).click();
  await expect(page.locator("#frontage_ft-error")).toHaveText(`Error: ${MEASURE_LIMITS}`);
  await expect(page.locator("#power_load_kw-error")).toHaveText(`Error: ${MEASURE_INVALID}`);
  await expect(page.locator("#business_use-error")).toHaveText(`Error: ${CHOICE_INVALID}`);
  await expect(page.locator("#floor_number-error")).toHaveText(`Error: ${FLOOR}`);
  await expect(page.locator("#building_floors-error")).toHaveText(`Error: ${FLOOR}`);
});

test("plot conflict: the latest feet, choices and claims are formatted, and Use latest and Keep mine apply per field", async ({ page, request }) => {
  await openDraft(page, request, "plot_details");
  await otherSession(request, id(1), { plot_width: "40.00", possession_status: "possession_pending", approval_authority: "cda", road_width_ft: "45.50", sewerage: "true" });
  await detail(page, "Plot width (feet)").fill("36");
  await detail(page, "Possession status").selectOption("");
  await detail(page, "Approval authority").selectOption("kda");
  await detail(page, "Road width (feet)").fill("");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await expect(page.getByTestId("conflict-plot_width")).toContainText("Latest saved: 40.00");
  await expect(page.getByTestId("conflict-possession_status")).toContainText("Latest saved (seller-declared): Possession pending");
  await expect(page.getByTestId("conflict-approval_authority")).toContainText("Latest saved (seller-declared): Capital Development Authority (CDA)");
  await expect(page.getByTestId("conflict-road_width_ft")).toContainText("Latest saved: 45.50");
  await expect(page.getByTestId("conflict-sewerage")).toHaveCount(0); // untouched: takes the latest, no row
  await expect(detail(page, "Sewerage")).toHaveValue("true");
  await expect(page.locator('[data-testid^="conflict-"]')).toHaveCount(4);
  await expect(detail(page, "Plot width (feet)")).toHaveValue("36");
  await expect(declaredTag(page, "possession_status")).toBeVisible(); // the claims keep their label in the conflict
  await expect(detail(page, "Possession status")).toHaveAttribute("aria-describedby", /possession_status-declared-tag possession_status-declared possession_status-hint possession_status-latest/);
  await page.getByRole("button", { name: "Use latest for Plot width (feet)" }).click();
  await expect(detail(page, "Plot width (feet)")).toHaveValue("40.00");
  await page.getByRole("button", { name: "Keep mine for Possession status" }).click();
  await page.getByRole("button", { name: "Use latest for Approval authority" }).click();
  await expect(detail(page, "Approval authority")).toHaveValue("cda");
  await expect(conflictBanner(page)).toHaveText(CONFLICT);
  await page.getByRole("button", { name: "Keep mine for Road width (feet)" }).click();
  await expect(conflictBanner(page)).toHaveCount(0);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[1]).toEqual({ base_revision: 3, fields: { possession_status: null, road_width_ft: null } });
  expect(await storedFields(request)).toMatchObject({ plot_width: "40.00", possession_status: null, approval_authority: "cda", road_width_ft: null, sewerage: true });
});

test("commercial conflict: the latest feet and kW are padded to their scale, and a value left equal to the owner's is already saved", async ({ page, request }) => {
  await openDraft(page, request, "shop_details");
  await otherSession(request, id(1), { frontage_ft: "20.00", power_load_kw: "1200.50", business_use: "restaurant" });
  await detail(page, "Frontage (feet)").fill("19");
  await detail(page, "Power load (kW)").fill("13");
  await detail(page, "Business use").selectOption("clinic");
  await saveButton(page).click();
  await expect(page.getByTestId("conflict-frontage_ft")).toContainText("Latest saved: 20.00");
  await expect(page.getByTestId("conflict-power_load_kw")).toContainText("Latest saved: 1,200.50");
  await expect(page.getByTestId("conflict-business_use")).toContainText("Latest saved: Restaurant");
  await page.getByRole("button", { name: "Use latest for Frontage (feet)" }).click();
  await page.getByRole("button", { name: "Keep mine for Power load (kW)" }).click();
  await page.getByRole("button", { name: "Use latest for Business use" }).click();
  await expect(conflictBanner(page)).toHaveCount(0);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[1]).toEqual({ base_revision: 3, fields: { power_load_kw: "13" } });
  // the same amount written another way elsewhere is already saved
  await otherSession(request, id(1), { frontage_ft: "21.00" });
  await detail(page, "Frontage (feet)").fill("21");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toHaveText(ALREADY_SAVED);
});

test("registry-driven: the by-subtype map, the by-purpose map and the seller-declared flags come from the registry", async ({ page, request }) => {
  await registryFields(request, "plotmap");
  await openDraft(page, request, "plot_details"); // a sale: the Subtype's list narrowed by the purpose's list
  await expect(detail(page, "Possession status").locator("option")).toHaveText(["Not answered", "Possession pending", "Possession ready (no longer offered)"]);
  await expect(detail(page, "Possession status")).toHaveValue("possession_ready"); // the stored value stays visible
  await expect(declaredTag(page, "approval_authority")).toHaveCount(0); // this registry does not flag it
  await expect(declaredTag(page, "possession_status")).toHaveText(SELLER_DECLARED);
  await expect(summaryTag(page, "approval_authority")).toHaveCount(0);
  await otherSession(request, id(1), { subtype: "commercial_plot" }); // its list and the sale list share nothing
  await page.reload();
  await expect(detail(page, "Possession status").locator("option")).toHaveText(["Not answered", "Possession ready (no longer offered)"]);
  await otherSession(request, id(1), { subtype: "plot_file", possession_status: "file_only" });
  await page.reload();
  await expect(detail(page, "Possession status").locator("option")).toHaveText(["Not answered", "File only (no possession)", "Possession pending"]);
  await otherSession(request, id(1), { subtype: "residential_plot", purpose: "rent" }); // rent allows only ready, the Subtype only pending
  await page.reload();
  await expect(detail(page, "Possession status").locator("option")).toHaveText(["Not answered", "File only (no possession) (no longer offered)"]);
  await openDraft(page, request, "shop_blank");
  await expect(declaredTag(page, "condition")).toHaveText(SELLER_DECLARED); // another registry makes another field a claim, with no code
  await expect(page.getByTestId("condition-declared-help")).toHaveText(SELLER_HELP);
});

test("registry-driven: the default registry keeps the whole choice list for a field with no by-subtype map", async ({ page, request }) => {
  await openDraft(page, request, "shop_blank");
  await expect(declaredTag(page, "condition")).toHaveCount(0);
  await expect(detail(page, "Condition").locator("option")).toHaveText(["Not answered", "New", "Excellent", "Good", "Needs renovation"]);
});

test("plot details: the answers carry no listing data into storage, the console, the title or the address bar", async ({ page, request }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  page.on("dialog", (dialog) => void dialog.accept());
  await openDraft(page, request, "plot_blank");
  await detail(page, "Plot width (feet)").fill("3535.35");
  await detail(page, "Possession status").selectOption("possession_ready");
  await detail(page, "Approval authority").selectOption("lda");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await setMode(request, "listing-patch", "plot_codes");
  await detail(page, "Road width (feet)").fill("4545.45");
  await saveButton(page).click();
  await expect(summary(page)).toBeVisible();
  await expect(page).toHaveTitle("Draft | EstateAI");
  expect(new URL(page.url()).search + new URL(page.url()).hash).toBe("");
  const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
  for (const secret of ["3535", "4545", "possession_ready", id(1)]) expect(stored).not.toContain(secret);
  expect(await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))).toBe("[{},{}]");
  for (const secret of ["3535", "4545", id(1)]) expect(logs.join("\n")).not.toContain(secret);
});

test("fail closed: a by-subtype map that is present but empty offers nothing, and so does a purpose the by-purpose map does not list", async ({ page, request }) => {
  await registryFields(request, "emptymap");
  await openDraft(page, request, "plot_blank");
  await expect(detail(page, "Possession status").locator("option")).toHaveText(["Not answered"]);
  await registryFields(request, "purposegap"); // the map lists rent only; this Draft is a sale
  await openDraft(page, request, "plot_blank");
  await expect(detail(page, "Possession status").locator("option")).toHaveText(["Not answered"]);
  await otherSession(request, id(1), { purpose: "rent" }); // the purpose now listed: the Subtype's list narrows it as usual
  await page.reload();
  await expect(detail(page, "Possession status").locator("option")).toHaveText(["Not answered", "Possession ready", "Possession pending"]);
});

test("registry payload without the Story 2.5 keys: no flag means no label, and a missing by-subtype map falls back to the purpose's list", async ({ page, request }) => {
  await registryFields(request, "nokeys");
  await openDraft(page, request, "plot_blank");
  await expect(page.locator('[data-testid$="-seller-declared"]')).toHaveCount(0);
  await expect(page.locator('[data-testid$="-declared-help"]')).toHaveCount(0);
  await expect(detail(page, "Possession status").locator("option")).toHaveText(["Not answered", "Possession ready", "Possession pending", "File only (no possession)"]);
  await expect(detail(page, "Possession status")).not.toHaveAttribute("aria-describedby", /declared/);
});

test("a saved possession the Plot File does not offer stays visible and marked, changes nothing until fixed, and the fix is accepted", async ({ page, request }) => {
  await openDraft(page, request, "plot_file_stale");
  const possession = detail(page, "Possession status");
  await expect(possession).toHaveValue("possession_ready");
  await expect(possession.locator("option")).toHaveText(["Not answered", "File only (no possession)", "Possession ready (no longer offered)"]);
  await expect(page.locator("#possession_status-hint")).toHaveText("As stated by the seller. A Plot File is never possession-ready. The saved value is not offered for this type of property.");
  await expect(summaryItem(page, "possession_status")).toHaveText("Possession ready (no longer offered). Seller-declared");
  await expectNoPlatformBadge(page);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(0);
  await possession.selectOption("file_only");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({ base_revision: 2, fields: { possession_status: "file_only" } });
  expect((await storedFields(request)).possession_status).toBe("file_only");
  await expect(page.locator("#possession_status-hint")).toHaveText("As stated by the seller. A Plot File is never possession-ready.");
  await expect(summaryItem(page, "possession_status")).toHaveText("File only (no possession). Seller-declared");
});

test("seller-declared: the accessible description reads the tag, the helper and the hint in that order, and a hand-built field a registry flags gets them too", async ({ page, request }) => {
  await openDraft(page, request, "plot_blank");
  await expect(detail(page, "Possession status")).toHaveAccessibleDescription(`${SELLER_DECLARED} ${SELLER_HELP} As stated by the seller. A Plot File is never possession-ready.`);
  await expect(detail(page, "Approval authority")).toHaveAccessibleDescription(`${SELLER_DECLARED} ${SELLER_HELP}`);
  await expect(detail(page, "Plot width (feet)")).not.toHaveAccessibleDescription(/Seller-declared/);
  await registryFields(request, "claimprice");
  await openDraft(page, request, "titled");
  await expect(declaredTag(page, "asking_price")).toHaveText(SELLER_DECLARED);
  await expect(page.getByTestId("asking_price-declared-help")).toHaveText(SELLER_HELP);
  await expect(priceInput(page)).toHaveAccessibleDescription(new RegExp(`^${SELLER_DECLARED} ${SELLER_HELP} Required before you publish`));
  await expect(declaredTag(page, "title")).toHaveCount(0);
});

test("decimals: every decimal but the two areas is padded to its registry scale, and a saved value with more decimals than the scale is no change when typed without the zeros", async ({ page, request }) => {
  await openDraft(page, request, "plot_details");
  await otherSession(request, id(1), { plot_width: "10.5000" }); // saved by an older rule
  await page.reload();
  await expect(detail(page, "Plot width (feet)")).toHaveValue("10.5000");
  await expect(summaryItem(page, "plot_width")).toHaveText("10.5000");
  await detail(page, "Plot width (feet)").fill("10.5");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(0);
  await detail(page, "Plot width (feet)").fill("10.50000"); // more than the saved text carries: sent for the server to judge
  await saveButton(page).click();
  await expect(page.locator("#plot_width-error")).toHaveText(`Error: ${MEASURE_LIMITS}`);
  expect((await patches(request)).count).toBe(1);
  await openDraft(page, request, "plot_details");
  await detail(page, "Plot width (feet)").fill("35.0000");
  await saveButton(page).click();
  await expect(page.locator("#plot_width-error")).toHaveText(`Error: ${MEASURE_LIMITS}`);
});

test("decimals: the areas keep the trimmed form while another decimal of the registry shows its scale", async ({ page, request }) => {
  await registryFields(request, "extra");
  await openDraft(page, request, "house_details");
  await expect(summaryItem(page, "covered_area_sqft")).toHaveText("2,400.5");
  await detail(page, "Garden area sqft").fill("120.5");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await expect(summaryItem(page, "garden_area_sqft")).toHaveText("120.50");
});

test("commercial label: a made-up commercial Subtype inherits Furnishing or fit-out from its Category", async ({ page, request }) => {
  await registryFields(request, "kiosk");
  await openDraft(page, request, "kiosk_blank");
  await expect(detail(page, "Furnishing or fit-out")).toBeVisible();
  await expect(detail(page, "Furnishing")).toHaveCount(0);
  await openDraft(page, request, "apartment_blank");
  await expect(detail(page, "Furnishing")).toBeVisible();
  await expect(detail(page, "Furnishing or fit-out")).toHaveCount(0);
});

test("furnishing on a Shop: an invalid choice and a conflict name the field by its fit-out label in the summary link and the buttons", async ({ page, request }) => {
  await openDraft(page, request, "shop_details");
  await setMode(request, "listing-patch", "commercial_codes");
  await detail(page, "Frontage (feet)").fill("19");
  await saveButton(page).click();
  await expect(page.locator("#furnishing-error")).toHaveText(`Error: ${CHOICE_INVALID}`);
  await expect(summary(page).getByRole("link", { name: "Furnishing or fit-out" })).toBeVisible();
  await setMode(request, "listing-patch", "ok");
  await openDraft(page, request, "shop_details");
  await otherSession(request, id(1), { furnishing: "furnished" });
  await detail(page, "Furnishing or fit-out").selectOption("unfurnished");
  await saveButton(page).click();
  await expect(page.getByTestId("conflict-furnishing")).toContainText("Latest saved: Furnished");
  await expect(page.getByRole("button", { name: "Use latest for Furnishing or fit-out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep mine for Furnishing or fit-out" })).toBeVisible();
  await expectNoPlatformBadge(page);
});

test("no platform badge: none appears on a Shop, an Office, with errors, in a conflict or beside a value no longer offered", async ({ page, request }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await openDraft(page, request, "shop_details");
  await expectNoPlatformBadge(page);
  await openDraft(page, request, "office_details");
  await expectNoPlatformBadge(page);
  await openDraft(page, request, "plot_details");
  await setMode(request, "listing-patch", "plot_codes");
  await detail(page, "Plot depth (feet)").fill("71");
  await saveButton(page).click();
  await expect(summary(page)).toBeVisible();
  await expectNoPlatformBadge(page);
  await setMode(request, "listing-patch", "ok");
  await otherSession(request, id(1), { approval_authority: "cda", possession_status: "possession_pending" });
  await detail(page, "Approval authority").selectOption("kda");
  await saveButton(page).click();
  await expect(conflictBanner(page)).toBeVisible();
  await expectNoPlatformBadge(page);
  await registryFields(request, "plotmap");
  await openDraft(page, request, "plot_details");
  await expect(detail(page, "Possession status").locator("option").last()).toHaveText("Possession ready (no longer offered)");
  await expectNoPlatformBadge(page);
});

test("the registry's ETag carries the version, a hash of what it serves and the shape, and a registry change changes it", async ({ request }) => {
  const first = (await request.get(`${STUB}/api/v1/registry`)).headers().etag;
  expect(first).toMatch(/^"7-[0-9a-f]{8}-6"$/);
  expect((await request.get(`${STUB}/api/v1/registry`)).headers().etag).toBe(first);
  await registryFields(request, "plotmap");
  const changed = (await request.get(`${STUB}/api/v1/registry`)).headers().etag;
  expect(changed).toMatch(/^"7-[0-9a-f]{8}-6"$/);
  expect(changed).not.toBe(first);
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

for (const viewport of viewports) {
  test(`accessibility (${viewport.name}): the Details section in its states has no axe violations`, async ({ page, request }) => {
    page.on("dialog", (dialog) => void dialog.accept()); // the page is left with unsaved changes on purpose
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openDraft(page, request, "house_blank");
    await expectNoViolations(page, "empty house details");
    await openDraft(page, request, "house_details");
    await expectNoViolations(page, "house with answers");
    await openDraft(page, request, "apartment_blank");
    await expectNoViolations(page, "empty apartment details");
    await openDraft(page, request, "apartment_details");
    await expectNoViolations(page, "apartment with answers");
    await detail(page, "Bedrooms").fill("abc");
    await detail(page, "Lift").selectOption("false");
    await setMode(request, "listing-patch", "detail_codes");
    await saveButton(page).click();
    await expect(summary(page)).toBeVisible();
    await expect(page.locator("#floor_number-error")).toBeVisible();
    await expectNoViolations(page, "apartment with detail errors");
    await setMode(request, "listing-patch", "ok");
    await detail(page, "Bedrooms").fill("3");
    await detail(page, "Maintenance charges (PKR per month)").fill("2600");
    await detail(page, "Lift").selectOption("false");
    await otherSession(request, id(1), { maintenance_charges: "3000", lift: "true", bedrooms: "4" });
    await saveButton(page).click();
    await expect(conflictBanner(page)).toBeVisible();
    await expect(page.getByTestId("conflict-bedrooms")).toBeVisible();
    await expect(page.getByTestId("conflict-lift")).toBeVisible();
    await expect(page.getByTestId("conflict-maintenance_charges")).toBeVisible();
    await expectNoViolations(page, "apartment details conflict");
    await openDraft(page, request, "house_details");
    await otherSession(request, id(1), { bedrooms: "6", condition: "excellent", basement: "false" });
    await detail(page, "Bedrooms").fill("5");
    await saveButton(page).click();
    await expect(page.getByTestId("conflict-bedrooms")).toBeVisible();
    await expectNoViolations(page, "house details conflict");
  });
}

for (const viewport of viewports) {
  test(`accessibility (${viewport.name}): the Plot, Plot File, Shop and Office details in their states have no axe violations`, async ({ page, request }) => {
    page.on("dialog", (dialog) => void dialog.accept()); // the page is left with unsaved changes on purpose
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openDraft(page, request, "plot_blank");
    await expectNoViolations(page, "empty plot details");
    await openDraft(page, request, "plot_details");
    await expectNoViolations(page, "plot with answers and claims");
    await openDraft(page, request, "plot_file_blank");
    await expectNoViolations(page, "empty plot file details");
    await openDraft(page, request, "plot_file_details");
    await expectNoViolations(page, "plot file with answers");
    await openDraft(page, request, "shop_details");
    await expectNoViolations(page, "shop with answers");
    await openDraft(page, request, "office_blank");
    await expectNoViolations(page, "empty office details");
    await openDraft(page, request, "office_details");
    await expectNoViolations(page, "office with answers");
    await openDraft(page, request, "plot_details");
    await setMode(request, "listing-patch", "plot_codes");
    await detail(page, "Plot depth (feet)").fill("71");
    await saveButton(page).click();
    await expect(summary(page)).toBeVisible();
    await expect(page.locator("#possession_status-error")).toBeVisible();
    await expectNoViolations(page, "plot with detail errors");
    await setMode(request, "listing-patch", "ok");
    await detail(page, "Plot width (feet)").fill("36");
    await detail(page, "Approval authority").selectOption("kda");
    await otherSession(request, id(1), { plot_width: "40.00", approval_authority: "cda" });
    await saveButton(page).click();
    await expect(conflictBanner(page)).toBeVisible();
    await expect(page.getByTestId("conflict-plot_width")).toBeVisible();
    await expect(page.getByTestId("conflict-approval_authority")).toBeVisible();
    await expectNoViolations(page, "plot details conflict");
  });
}
