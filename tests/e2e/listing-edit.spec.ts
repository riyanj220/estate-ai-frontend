import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Story 2.2, frontend half: the Draft editor, its validation, the conflict flow and the other answers, against the stub backend.
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
  await expect(page.getByTestId("draft-registry-version")).toHaveText("2");
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
