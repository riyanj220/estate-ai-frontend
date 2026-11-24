import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Story 2.7, frontend half: the Location section of the Draft editor (the generic `reference` control, the public location and the private
// address), against the stub backend, which mirrors the backend's rules. Low-entropy fake words only.
const STUB = "http://127.0.0.1:4010";
const APP = "http://127.0.0.1:3100";
const LIST = "/account/listings";
const id = (seq: number) => `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`;
const KARACHI = "11111111-1111-4111-8111-111111111111";
const LAHORE = "22222222-2222-4222-8222-222222222222";
const ISLAMABAD = "33333333-3333-4333-8333-333333333333";
const DHA = "aaaaaaaa-aaaa-4aaa-8aaa-000000000003";
const CLIFTON = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
const BLUE_AREA = "aaaaaaaa-aaaa-4aaa-8aaa-000000000011";
const ERRORS_ANNOUNCED = "The form has errors. Review the list at the top of the page.";
const CONFLICT =
  "This draft was changed in another session. We loaded the latest version; your unsaved changes are still in the form. Review them and save again.";
const PUBLIC_HELP = "Shown to everyone on your listing.";
const PRIVATE_HELP = "Never shown to buyers. Only you can see this.";
const PRIVATE_TITLE = "Private address (only you can see this)";
const SAVED_PRIVATE = ["Cedar Lane", "Plot 12", "24.860000", "67.010000"];

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

const preset = (request: APIRequestContext, value: string) => request.get(`${STUB}/__listings-preset?value=${value}`);
const setMode = (request: APIRequestContext, kind: string, value: string) => request.get(`${STUB}/__${kind}-mode?value=${value}`);
const patches = async (request: APIRequestContext) => (await request.get(`${STUB}/__listing-patch-stats`)).json();
const stored = async (request: APIRequestContext) => (await (await request.get(`${STUB}/__listings-stats`)).json()).listings[0].fields;
const cityGets = async (request: APIRequestContext) => (await (await request.get(`${STUB}/__last-cities`)).json()).count as number;
const localityGets = async (request: APIRequestContext) => (await (await request.get(`${STUB}/__last-localities`)).json()) as { count: number; answered: number; cityIds: string[] };
const registryGets = async (request: APIRequestContext) => (await (await request.get(`${STUB}/__listings-stats`)).json()).registryGets as number;
const otherSession = (request: APIRequestContext, listing: string, changes: Record<string, string>) =>
  request.get(`${STUB}/__other-session?${new URLSearchParams({ id: listing, ...changes }).toString()}`);

const field = (page: Page, name: string) => page.getByLabel(name, { exact: true });
const saveButton = (page: Page) => page.getByRole("button", { name: /^(Save changes|Saving…)$/ });
const publicGroup = (page: Page) => page.getByTestId("location-public");
const privateGroup = (page: Page) => page.getByTestId("location-private");
const summary = (page: Page) => page.getByRole("group", { name: "There is a problem" });

async function startSession(page: Page, request: APIRequestContext) {
  await request.get(`${STUB}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP }]);
}
async function openDraft(page: Page, request: APIRequestContext, which: string) {
  await preset(request, which);
  await startSession(page, request);
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Draft" })).toBeVisible();
  await expect(field(page, "Title")).toBeVisible();
}
async function ready(page: Page) {
  await expect(field(page, "City").locator("option", { hasText: "Karachi" })).toHaveCount(1);
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

// ---------------------------------------------------------------- structure

test("location: a Location block with the public group and a separated private address, each with its helper", async ({ page, request }) => {
  await openDraft(page, request, "location_filled");
  await ready(page);
  await expect(page.getByRole("heading", { level: 3, name: "Location" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Public location" })).toBeVisible();
  await expect(page.getByRole("group", { name: PRIVATE_TITLE })).toBeVisible();
  await expect(page.getByRole("heading", { level: 4, name: "Public location" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 4, name: PRIVATE_TITLE })).toBeVisible();
  await expect(publicGroup(page).locator(".hint").first()).toHaveText(PUBLIC_HELP);
  await expect(privateGroup(page).locator(".hint").first()).toHaveText(PRIVATE_HELP);
  await expect(publicGroup(page).locator("label")).toHaveText(["City", "Locality", "Society", "Phase", "Sector", "Block"]);
  await expect(privateGroup(page).locator("label")).toHaveText(["Street", "House number", "Latitude", "Longitude"]);
  // The private group has its own visible border; the public one has none.
  expect(await privateGroup(page).evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("2px");
  expect(await publicGroup(page).evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("0px");
  // The private fields are never inside the public group and the other way round.
  await expect(publicGroup(page).getByLabel("Street")).toHaveCount(0);
  await expect(privateGroup(page).getByLabel("City")).toHaveCount(0);
  // The location is not part of the "What exists so far" summary and not among the Details.
  // (the Draft really holds a street, a house number and coordinates: the preset is location_filled).
  expect((await stored(request)).street).toBe("Cedar Lane");
  for (const value of ["Cedar Lane", "Plot 12", "24.860000", "67.010000", "Palm Society", "Karachi"]) await expect(page.getByTestId("draft-details")).not.toContainText(value);
  await expect(page.getByTestId("details-more").getByLabel("Block")).toHaveCount(0);
});

test("location: a registry without location fields shows no Location block and asks for no reference list", async ({ page, request }) => {
  await request.get(`${STUB}/__registry-fields?value=other`);
  await openDraft(page, request, "house_blank");
  await expect(page.getByTestId("location-block")).toHaveCount(0);
  await expect.poll(() => registryGets(request)).toBeGreaterThan(0); // the registry was read, so the form had its chance to ask
  expect(await cityGets(request)).toBe(0);
  expect((await localityGets(request)).count).toBe(0);
});

test("location: the locality select is aria-disabled, not disabled, and reachable until a city is chosen", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  const locality = field(page, "Locality");
  await expect(locality).toHaveAttribute("aria-disabled", "true");
  expect(await locality.getAttribute("disabled")).toBeNull();
  await expect(locality.locator("option")).toHaveText(["Choose a city first"]);
  await locality.focus();
  await expect(locality).toBeFocused();
  await page.keyboard.press("ArrowDown"); // nothing to choose: the select offers only its placeholder
  await expect(locality).toHaveValue("");
  expect((await localityGets(request)).count).toBe(0);
  await field(page, "City").selectOption({ label: "Karachi" });
  await expect(locality.locator("option", { hasText: "DHA Phase 6" })).toHaveCount(1);
  await expect(locality).not.toHaveAttribute("aria-disabled", "true");
});

test("location: the localities are grouped Areas and Societies and belong to the chosen city", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  await field(page, "City").selectOption({ label: "Karachi" });
  const locality = field(page, "Locality");
  await expect(locality.locator("optgroup")).toHaveCount(2);
  await expect(locality.locator('optgroup[label="Areas"] option')).toHaveText(["Clifton", "Gulshan-e-Iqbal"]);
  await expect(locality.locator('optgroup[label="Societies"] option')).toHaveText(["DHA Phase 6", "Bahria Town Karachi"]);
  await field(page, "City").selectOption({ label: "Islamabad" });
  await expect(locality.locator("option", { hasText: "Blue Area" })).toHaveCount(1);
  await expect(locality.locator("option", { hasText: "Clifton" })).toHaveCount(0);
  expect((await localityGets(request)).cityIds).toEqual([KARACHI, ISLAMABAD]);
});

// ---------------------------------------------------------------- choose, save, restore, clear

test("location: choosing a city and a locality saves them with the revision flow and restores them", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  await field(page, "City").selectOption({ label: "Karachi" });
  await field(page, "Locality").selectOption({ label: "DHA Phase 6" });
  await field(page, "Society").fill("  Palm Society ");
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  await expect(page.getByTestId("draft-revision")).toHaveText("2");
  const { bodies } = await patches(request);
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toEqual({ base_revision: 1, fields: { city: KARACHI, locality: DHA, society: "Palm Society" } });
  const fields = await stored(request);
  expect([fields.city, fields.locality, fields.society]).toEqual([KARACHI, DHA, "Palm Society"]);
  await page.reload();
  await ready(page);
  await expect(field(page, "City")).toHaveValue(KARACHI);
  await expect(field(page, "Locality")).toHaveValue(DHA);
  await expect(field(page, "Locality").locator("option:checked")).toHaveText("DHA Phase 6");
  await expect(field(page, "Society")).toHaveValue("Palm Society");
});

test("location: the saved values restore from the Draft, private ones included, and an unchanged save sends nothing", async ({ page, request }) => {
  await openDraft(page, request, "location_filled");
  await ready(page);
  await expect(field(page, "City").locator("option:checked")).toHaveText("Karachi");
  await expect(field(page, "Locality").locator("option:checked")).toHaveText("DHA Phase 6");
  await expect(field(page, "Phase")).toHaveValue("Phase Two");
  await expect(field(page, "Sector")).toHaveValue("Sector Nine");
  await expect(field(page, "Block")).toHaveValue("Block Seven");
  for (const [label, value] of [["Street", "Cedar Lane"], ["House number", "Plot 12"], ["Latitude", "24.860000"], ["Longitude", "67.010000"]]) {
    await expect(privateGroup(page).getByLabel(label, { exact: true })).toHaveValue(value);
  }
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(0);
  // Typing the saved coordinate with fewer zeros is no change either.
  await privateGroup(page).getByLabel("Latitude").fill("24.86");
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(0);
});

test("location: changing the city clears the locality at once, and the save sends the city and a cleared locality", async ({ page, request }) => {
  await openDraft(page, request, "location_filled");
  await ready(page);
  await expect(field(page, "Locality")).toHaveValue(DHA);
  await field(page, "City").selectOption({ label: "Islamabad" });
  await expect(field(page, "Locality")).toHaveValue(""); // immediately, before any save
  await expect(page.getByTestId("draft-live")).toHaveText(/locality was cleared/i);
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  const { bodies } = await patches(request);
  expect(bodies[0]).toEqual({ base_revision: 2, fields: { city: ISLAMABAD, locality: null } });
  const fields = await stored(request);
  expect([fields.city, fields.locality]).toEqual([ISLAMABAD, null]);
});

test("location: clearing the city clears the locality and the stored values become unanswered, never empty text", async ({ page, request }) => {
  await openDraft(page, request, "location_filled");
  await ready(page);
  await field(page, "City").selectOption({ label: "Not answered" });
  await expect(field(page, "Locality")).toHaveValue("");
  await expect(field(page, "Locality")).toHaveAttribute("aria-disabled", "true");
  await field(page, "Society").fill("   ");
  await privateGroup(page).getByLabel("Street").fill("");
  await privateGroup(page).getByLabel("Latitude").fill("");
  await privateGroup(page).getByLabel("Longitude").fill("");
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  const { bodies } = await patches(request);
  expect(bodies[0].fields).toEqual({ city: null, locality: null, society: null, street: null, latitude: null, longitude: null });
  const fields = await stored(request);
  for (const key of ["city", "locality", "society", "street", "latitude", "longitude"]) expect(fields[key]).toBeNull();
});

test("stub self-test (not frontend coverage): the stub mirrors the backend's pair, clearing, pairing and range rules", async ({ page, request }) => {
  await request.get(`${STUB}/__wire-mode?value=codes`);
  await openDraft(page, request, "location_filled");
  // The stub mirrors the backend's pair rule: a locality of another city, a locality without a city, and the clearing rule.
  const token = (await (await request.get(`${STUB}/api/v1/csrf`, { headers: { cookie: "estate_session=stub-live" } })).json()).csrf_token;
  const patch = async (fields: Record<string, unknown>, revision: number) =>
    request.patch(`${STUB}/api/v1/listings/${id(1)}`, { headers: { cookie: "estate_session=stub-live", "x-csrftoken": token }, data: { base_revision: revision, fields } });
  let answer = await patch({ city: ISLAMABAD, locality: DHA }, 2);
  expect(answer.status()).toBe(400);
  expect((await answer.json()).error.fields).toEqual({ locality: ["locality_not_in_city"] });
  answer = await patch({ city: null, locality: BLUE_AREA }, 2);
  expect((await answer.json()).error.fields).toEqual({ locality: ["invalid"] });
  answer = await patch({ city: ISLAMABAD }, 2); // no locality sent: the stored one is cleared in the same write
  expect(answer.status()).toBe(200);
  const body = await answer.json();
  expect([body.fields.city, body.fields.locality, body.revision]).toEqual([ISLAMABAD, null, 3]);
  answer = await patch({ locality: "not-an-id" }, 3);
  expect((await answer.json()).error.fields).toEqual({ locality: ["invalid"] });
  answer = await patch({ longitude: null }, 3); // clearing only one of two stored coordinates: invalid on the cleared one
  expect((await answer.json()).error.fields).toEqual({ longitude: ["invalid"] });
  answer = await patch({ latitude: "91" }, 3);
  expect((await answer.json()).error.fields.latitude).toEqual(["out_of_range"]);
  answer = await patch({ street: "call 03001234567" }, 3);
  expect((await answer.json()).error.fields).toEqual({ street: ["contains_contact_details"] });
});

// ---------------------------------------------------------------- errors

test("location: the codes map to the client's own texts on the right fields, with a summary and focus", async ({ page, request }) => {
  await openDraft(page, request, "location_filled");
  await ready(page);
  await setMode(request, "listing-patch", "location_codes");
  await field(page, "Society").fill("Palm Society Two");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(page.getByTestId("draft-live")).toHaveText(ERRORS_ANNOUNCED);
  const errorOf = (name: string) => page.locator(`#${name}-error`);
  await expect(errorOf("city")).toContainText("Choose a city from the list.");
  await expect(errorOf("locality")).toContainText("Choose a locality that belongs to the selected city.");
  await expect(errorOf("society")).toContainText("This text cannot contain phone numbers, email addresses or street addresses.");
  await expect(errorOf("street")).toContainText("This text is too long. Check the limit shown above.");
  await expect(errorOf("latitude")).toContainText("Latitude must be between -90 and 90, with at most 6 decimal places.");
  await expect(errorOf("longitude")).toContainText("Enter a decimal number such as 24.860000. Latitude and longitude go together.");
  await expect(errorOf("block")).toContainText("Enter a valid value."); // an unknown code is generic
  await expect(field(page, "Locality")).toHaveAttribute("aria-invalid", "true");
  await expect(summary(page).getByRole("link", { name: /^Latitude:/ })).toBeVisible();
  // The values stay as typed, and fixing a field clears its own error.
  await expect(field(page, "Society")).toHaveValue("Palm Society Two");
  await field(page, "Society").fill("Palm Society");
  await expect(errorOf("society")).toHaveCount(0);
  await expect(errorOf("street")).toHaveCount(1);
});

test("location: the backend's own static sentences read as the same codes, and an unknown sentence is never shown", async ({ page, request }) => {
  await openDraft(page, request, "location_filled");
  await ready(page);
  await setMode(request, "listing-patch", "location_sentences");
  await field(page, "Phase").fill("Phase Three");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(page.locator("#locality-error")).toContainText("Choose a locality that belongs to the selected city.");
  await expect(page.locator("#society-error")).toContainText("This text cannot contain phone numbers");
  await expect(page.locator("#latitude-error")).toContainText("Latitude must be between -90 and 90");
  await expect(page.locator("#street-error")).toContainText("Enter a valid value.");
  await expect(main(page)).not.toContainText("Some server sentence");
});

test("location: a code with no control on the form goes to the form-level list, never a hidden control", async ({ page, request }) => {
  await openDraft(page, request, "location_filled");
  await ready(page);
  await setMode(request, "listing-patch", "location_unknown");
  await field(page, "Block").fill("Block Eight");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(page.locator("#city-error")).toContainText("Enter a valid value.");
  await expect(page.locator("#phase-error")).toContainText("Enter a valid value.");
  await expect(page.locator("#house_number-error")).toContainText("This detail does not apply to this listing.");
  await expect(main(page)).not.toContainText("constructor");
});

test("location: coordinates need both, judged by the server on the field that ends up empty", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  await privateGroup(page).getByLabel("Latitude").fill("24.5");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(page.locator("#longitude-error")).toContainText("Latitude and longitude go together.");
  await expect(page.locator("#latitude-error")).toHaveCount(0);
  await privateGroup(page).getByLabel("Longitude").fill("67.25");
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  const fields = await stored(request);
  expect([fields.latitude, fields.longitude]).toEqual(["24.500000", "67.250000"]);
  await privateGroup(page).getByLabel("Longitude").fill("181");
  await saveButton(page).click();
  await expect(page.locator("#longitude-error")).toContainText("Longitude must be between -180 and 180");
  await privateGroup(page).getByLabel("Longitude").fill("-67.25");
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  expect((await stored(request)).longitude).toBe("-67.250000");
});

test("location: a contact detail in a public text field is refused by the server and shown on that field", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  await field(page, "Society").fill("Call me on a@b.test");
  await saveButton(page).click();
  await expect(page.locator("#society-error")).toContainText("This text cannot contain phone numbers, email addresses or street addresses.");
  expect((await stored(request)).society).toBeNull();
});

// ---------------------------------------------------------------- reference list states

test("location: the cities load with a loading state, an empty state and a failed state with Retry", async ({ page, request }) => {
  await setMode(request, "cities", "slow");
  await openDraft(page, request, "house_blank");
  await expect(page.getByTestId("city-status")).toHaveText("Loading cities…");
  await expect(field(page, "City")).toHaveAttribute("aria-disabled", "true");
  await ready(page);
  await expect(page.getByTestId("city-status")).toHaveText("");
  await expect(page.getByTestId("city-retry")).toHaveCount(0);
  // Empty.
  await setMode(request, "cities", "empty");
  await page.reload();
  await expect(page.getByTestId("city-status")).toHaveText("No cities are available right now.");
  await expect(field(page, "City").locator("option")).toHaveText(["Not answered"]);
  // Failed, then Retry.
  await setMode(request, "cities", "flaky");
  await page.reload();
  await expect(page.getByTestId("city-status")).toHaveText("We could not load the list of cities.");
  await expect(page.getByTestId("city-status")).not.toContainText("Internal detail");
  await page.getByTestId("city-retry").click();
  await ready(page);
  await expect(page.getByTestId("city-retry")).toHaveCount(0);
  await expect(field(page, "City")).not.toHaveAttribute("aria-disabled", "true");
});

test("location: a malformed city list fails closed", async ({ page, request }) => {
  await setMode(request, "cities", "malformed");
  await openDraft(page, request, "house_blank");
  await expect(page.getByTestId("city-status")).toHaveText("We could not load the list of cities.");
  await expect(field(page, "City").locator("option")).toHaveText(["Not answered"]);
  await expect(page.getByTestId("city-retry")).toBeVisible();
});

test("location: the locality list has its own loading, empty, failed and Retry states, and an unusable item is dropped", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  await setMode(request, "localities", "error");
  await field(page, "City").selectOption({ label: "Karachi" });
  await expect(page.getByTestId("locality-status")).toHaveText("We could not load the localities.");
  await expect(field(page, "Locality")).toHaveAttribute("aria-disabled", "true");
  await setMode(request, "localities", "slow");
  await page.getByTestId("locality-retry").click();
  await expect(page.getByTestId("locality-retry")).toHaveAttribute("aria-disabled", "true"); // stays mounted while it reloads
  await expect(page.getByTestId("locality-status")).toHaveText("Loading localities…");
  await expect(field(page, "Locality").locator("option", { hasText: "Clifton" })).toHaveCount(1);
  await expect(page.getByTestId("locality-status")).toHaveText("");
  // A city with no localities (an empty list).
  await field(page, "City").selectOption({ label: "Lahore" });
  await expect(page.getByTestId("locality-status")).toHaveText("No localities are listed for this city.");
  await expect(field(page, "Locality")).toHaveAttribute("aria-disabled", "true");
  // A list with unusable items: only the valid ones are offered.
  await setMode(request, "localities", "partial");
  await field(page, "City").selectOption({ label: "Karachi" });
  await expect(field(page, "Locality").locator("option", { hasText: "Gulshan-e-Iqbal" })).toHaveCount(1);
  await expect(field(page, "Locality").locator("option", { hasText: /Odd|Wrong kind/ })).toHaveCount(0);
  await expect(field(page, "Locality").locator("option", { hasText: "Clifton" })).toHaveCount(1);
  // Nothing usable at all is a failure.
  await setMode(request, "localities", "malformed");
  await field(page, "City").selectOption({ label: "Islamabad" });
  await expect(page.getByTestId("locality-status")).toHaveText("We could not load the localities.");
});

test("location: a slow answer for an earlier city never replaces the list of the city chosen later", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  await setMode(request, "localities", "slow");
  await field(page, "City").selectOption({ label: "Karachi" });
  await field(page, "City").selectOption({ label: "Islamabad" });
  await expect(field(page, "Locality").locator("option", { hasText: "Blue Area" })).toHaveCount(1);
  await expect.poll(async () => (await localityGets(request)).answered).toBe(2); // both answers have been sent and received; only the later city's list may show
  await expect(field(page, "Locality").locator("option", { hasText: "Clifton" })).toHaveCount(0);
});

test("location: a saved city and locality that the lists no longer hold stay visible, marked, and nothing is sent unchanged", async ({ page, request }) => {
  await openDraft(page, request, "location_gone");
  await ready(page);
  const gone = "Saved choice (not in the current list)";
  await expect(field(page, "City").locator("option:checked")).toHaveText(gone);
  await expect(field(page, "Locality").locator("option:checked")).toHaveText(gone);
  await expect(page.getByTestId("locality-status")).toHaveText("No localities are listed for this city."); // the city is unknown: 404
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(0);
});

// ---------------------------------------------------------------- conflict

test("location: a conflict shows the latest city by name, and using it brings its own locality", async ({ page, request }) => {
  await openDraft(page, request, "location_filled");
  await ready(page);
  await field(page, "City").selectOption({ label: "Islamabad" });
  await field(page, "Society").fill("Mine Society");
  await otherSession(request, id(1), { city: LAHORE, locality: "", society: "Their Society" });
  await saveButton(page).click();
  await expect(page.getByTestId("draft-conflict")).toHaveText(CONFLICT);
  await expect(page.getByTestId("conflict-city").locator(".latest-value")).toHaveText("Lahore");
  await expect(page.getByTestId("conflict-society").locator(".latest-value")).toHaveText("Their Society");
  await page.getByTestId("conflict-city").getByRole("button", { name: /Use latest/ }).click();
  await expect(field(page, "City")).toHaveValue(LAHORE);
  await expect(field(page, "Locality")).toHaveValue("");
  await page.getByTestId("conflict-society").getByRole("button", { name: /Keep mine/ }).click();
  await expect(page.getByTestId("draft-conflict")).toHaveCount(0);
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  const fields = await stored(request);
  expect([fields.city, fields.society]).toEqual([LAHORE, "Mine Society"]);
});

test("location: a conflict on a private value shows the latest private value only on the owner's own page", async ({ page, request }) => {
  await openDraft(page, request, "location_filled");
  await ready(page);
  await privateGroup(page).getByLabel("Street").fill("Mine Street");
  await otherSession(request, id(1), { street: "Their Street" });
  await saveButton(page).click();
  await expect(page.getByTestId("conflict-street").locator(".latest-value")).toHaveText("Their Street");
  await page.getByTestId("conflict-street").getByRole("button", { name: /Use latest/ }).click();
  await expect(privateGroup(page).getByLabel("Street")).toHaveValue("Their Street");
});

// ---------------------------------------------------------------- the real wire: sentences

test("wire: the real API's sentences read as the right texts, one assertion each (the stub sends sentences by default)", async ({ page, request }) => {
  await openDraft(page, request, "apartment_blank");
  await ready(page);
  await setMode(request, "listing-patch", "sentence_all");
  await field(page, "Title").fill("A title long enough");
  const wire = page.waitForResponse((response) => response.request().method() === "PATCH");
  await saveButton(page).click();
  const sent = (await (await wire).json()).error.fields;
  // Proof that the stub spoke the real wire: sentences, not codes.
  expect(sent.title).toEqual(["This text is too short."]);
  expect(sent.floor_number).toEqual(["The floor cannot be above the number of floors in the building."]);
  await expect(summary(page)).toBeFocused();
  const errorOf = (name: string) => page.locator(`#${name}-error`);
  await expect(errorOf("title")).toContainText("The title is too short."); // too_short
  await expect(errorOf("asking_price")).toContainText("Enter an amount within the limits shown above"); // invalid_price
  await expect(errorOf("area_value")).toContainText("Enter an area above zero within the limits shown above"); // invalid_area
  await expect(errorOf("floor_number")).toContainText("The floor cannot be above the number of floors"); // invalid_floor
  await expect(errorOf("building_floors")).toContainText("The floor cannot be above the number of floors"); // the linked pair
  await expect(errorOf("lift")).toContainText("This detail does not apply to this listing."); // not_applicable
  await expect(errorOf("bedrooms")).toContainText("This detail cannot be changed here."); // not_editable
  await expect(errorOf("city")).toContainText("Choose a city from the list."); // invalid on a reference
  await expect(errorOf("street")).toContainText("This text is too long. Check the limit shown above."); // too_long
  await expect(errorOf("longitude")).toContainText("Latitude and longitude go together."); // the pairing on the empty coordinate
});

test("wire: the codes wire reads the same (both wires are supported)", async ({ page, request }) => {
  await request.get(`${STUB}/__wire-mode?value=codes`);
  await openDraft(page, request, "location_filled");
  await ready(page);
  await setMode(request, "listing-patch", "location_codes");
  await field(page, "Society").fill("Palm Society Two");
  const wire = page.waitForResponse((response) => response.request().method() === "PATCH");
  await saveButton(page).click();
  expect((await (await wire).json()).error.fields.street).toEqual(["too_long"]);
  await expect(page.locator("#street-error")).toContainText("This text is too long. Check the limit shown above.");
  await expect(page.locator("#locality-error")).toContainText("Choose a locality that belongs to the selected city.");
});

test("wire: the invalid locality text depends on whether a city is chosen", async ({ page, request }) => {
  await openDraft(page, request, "location_filled");
  await ready(page);
  await setMode(request, "listing-patch", "location_invalid");
  await field(page, "Society").fill("Palm Society Two");
  await saveButton(page).click();
  await expect(page.locator("#locality-error")).toContainText("Choose a locality from the list.");
  await field(page, "City").selectOption({ label: "Not answered" });
  await field(page, "Society").fill("Palm Society Three");
  await saveButton(page).click();
  await expect(page.locator("#locality-error")).toContainText("Choose a city first.");
});

// ---------------------------------------------------------------- pairs, names and states

test("location: owner changed only the locality while another session moved the city: the latest pair is taken whole", async ({ page, request }) => {
  await openDraft(page, request, "location_filled");
  await ready(page);
  await field(page, "Locality").selectOption({ label: "Bahria Town Karachi" });
  await otherSession(request, id(1), { city: LAHORE, locality: "" }); // the server cleared the locality with the city
  await saveButton(page).click();
  await expect(page.getByTestId("draft-conflict")).toContainText("The locality was replaced because the city was changed in another session.");
  await expect(field(page, "City")).toHaveValue(LAHORE);
  await expect(field(page, "Locality")).toHaveValue("");
  await expect(page.getByTestId("conflict-locality")).toHaveCount(0);
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("No changes to save.");
});

test("location: using the latest locality of another session brings its city with it", async ({ page, request }) => {
  await openDraft(page, request, "location_filled");
  await ready(page);
  await field(page, "City").selectOption({ label: "Islamabad" }); // clears the locality in the form
  await otherSession(request, id(1), { locality: CLIFTON });
  await saveButton(page).click();
  await expect(page.getByTestId("conflict-locality")).toBeVisible();
  // The latest locality is in another city than the form's: it is not named from the form's list, and not called missing.
  await expect(page.getByTestId("conflict-locality").locator(".latest-value")).toHaveText("Another locality");
  await page.getByTestId("conflict-locality").getByRole("button", { name: /Use latest/ }).click();
  await expect(field(page, "City")).toHaveValue(KARACHI);
  await expect(field(page, "Locality")).toHaveValue(CLIFTON);
  await expect(page.getByTestId("conflict-city")).toHaveCount(0);
});

test("location: the saved locality is not offered after the city moved away, and clearing always works", async ({ page, request }) => {
  await openDraft(page, request, "location_filled");
  await ready(page);
  await field(page, "City").selectOption({ label: "Islamabad" });
  await expect(field(page, "Locality").locator("option", { hasText: "Blue Area" })).toHaveCount(1);
  await expect(field(page, "Locality").locator("option", { hasText: "Saved choice" })).toHaveCount(0);
  // With a failed list the select offers only "Not answered" and the saved choice, and choosing "Not answered" is not swallowed.
  await setMode(request, "localities", "error");
  await page.reload();
  await expect(page.getByTestId("locality-status")).toHaveText("We could not load the localities.");
  await expect(field(page, "Locality")).toHaveValue(DHA);
  await field(page, "Locality").focus();
  await page.keyboard.press("ArrowUp");
  await expect(field(page, "Locality")).toHaveValue("");
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  expect((await patches(request)).bodies[0].fields).toEqual({ locality: null });
});

test("location: city A, B, A within one editing session restores the saved locality", async ({ page, request }) => {
  await openDraft(page, request, "location_filled");
  await ready(page);
  await field(page, "City").selectOption({ label: "Islamabad" });
  await expect(field(page, "Locality")).toHaveValue("");
  await field(page, "City").selectOption({ label: "Karachi" });
  await expect(field(page, "Locality")).toHaveValue(DHA);
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("No changes to save.");
});

test("location: a 404 that is not the backend's not_found answer is a failed load with Retry, and Retry does not linger after K, L, K", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  await setMode(request, "localities", "html404");
  await field(page, "City").selectOption({ label: "Karachi" });
  await expect(page.getByTestId("locality-status")).toHaveText("We could not load the localities.");
  await expect(page.getByTestId("locality-retry")).toBeVisible();
  await setMode(request, "localities", "ok");
  await page.getByTestId("locality-retry").click();
  await expect(field(page, "Locality").locator("option", { hasText: "Clifton" })).toHaveCount(1);
  await field(page, "City").selectOption({ label: "Lahore" });
  await expect(page.getByTestId("locality-status")).toHaveText("No localities are listed for this city.");
  await setMode(request, "localities", "slow");
  await field(page, "City").selectOption({ label: "Karachi" });
  await expect(page.getByTestId("locality-status")).toHaveText("Loading localities…");
  await expect(page.getByTestId("locality-retry")).toHaveCount(0); // an ordinary load, not a retry
});

test("location: a locality name is limited by code points of the trimmed name", async ({ page, request }) => {
  await setMode(request, "localities", "emoji");
  await openDraft(page, request, "house_blank");
  await ready(page);
  await field(page, "City").selectOption({ label: "Karachi" });
  await expect(field(page, "Locality").locator("option", { hasText: "😀".repeat(50) })).toHaveCount(1); // 50 code points, 100 UTF-16 units
  await expect(field(page, "Locality").locator("option", { hasText: "😀".repeat(81) })).toHaveCount(0);
});

test("location: the private inputs switch off browser help, and the selects point at their status lines", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  for (const name of ["Street", "House number", "Latitude", "Longitude"]) {
    const input = privateGroup(page).getByLabel(name, { exact: true });
    await expect(input).toHaveAttribute("autocomplete", "off");
    await expect(input).toHaveAttribute("spellcheck", "false");
    await expect(input).toHaveAttribute("autocorrect", "off");
    await expect(input).toHaveAttribute("autocapitalize", "off");
  }
  await expect(privateGroup(page).getByLabel("Latitude")).toHaveAttribute("inputmode", "text"); // the keypad can type a minus
  await expect(field(page, "City")).toHaveAttribute("aria-describedby", /city-status/);
  await field(page, "City").selectOption({ label: "Karachi" });
  await expect(field(page, "Locality")).toHaveAttribute("aria-describedby", /locality-status/);
});

test("location: a field with no class or an unknown class is treated as private", async ({ page, request }) => {
  await request.get(`${STUB}/__registry-fields?value=oddclass`);
  await openDraft(page, request, "house_blank");
  await ready(page);
  await expect(privateGroup(page).getByLabel("Society", { exact: true })).toBeVisible();
  await expect(privateGroup(page).getByLabel("Phase", { exact: true })).toBeVisible();
  await expect(publicGroup(page).getByLabel("Society", { exact: true })).toHaveCount(0);
  await expect(publicGroup(page).getByLabel("Block", { exact: true })).toBeVisible();
});

// ---------------------------------------------------------------- privacy

test("privacy: private values are never stored, logged or put in an address, and the reference requests carry none", async ({ page, request }) => {
  const logs: string[] = [];
  const urls: string[] = [];
  const bodies: { method: string; url: string; body: string }[] = [];
  page.on("console", (message) => logs.push(message.text()));
  page.on("pageerror", (error) => logs.push(String(error)));
  page.on("request", (req) => {
    urls.push(req.url());
    bodies.push({ method: req.method(), url: req.url(), body: req.postData() ?? "" });
  });
  await openDraft(page, request, "location_filled");
  await ready(page);
  const typed = ["Maple Row", "Unit 4", "24.5", "67.25"];
  await privateGroup(page).getByLabel("Street").fill(typed[0]);
  await privateGroup(page).getByLabel("House number").fill(typed[1]);
  await privateGroup(page).getByLabel("Latitude").fill(typed[2]);
  await privateGroup(page).getByLabel("Longitude").fill(typed[3]);
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  // A refused save and a conflict too.
  await setMode(request, "listing-patch", "location_codes");
  await privateGroup(page).getByLabel("Street").fill("Pine Row");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  // A conflict too: another session changes the street, the owner's save is refused with the latest data.
  await setMode(request, "listing-patch", "ok");
  await otherSession(request, id(1), { street: "Their Street" });
  await privateGroup(page).getByLabel("House number").fill("Unit 5");
  await saveButton(page).click();
  await expect(page.getByTestId("draft-conflict")).toBeVisible();
  await expect(page.getByTestId("conflict-street").locator(".latest-value")).toHaveText("Their Street");
  const all = [...typed, "Pine Row", "Their Street", "Unit 5", ...SAVED_PRIVATE, "24.500000", "67.250000"];
  const snapshot = await page.evaluate(async () => ({
    local: JSON.stringify({ ...localStorage }),
    session: JSON.stringify({ ...sessionStorage }),
    cookie: document.cookie,
    state: JSON.stringify(history.state),
    href: location.href,
    title: document.title,
    databases: ((await indexedDB.databases?.()) ?? []).map((entry) => entry.name),
  }));
  const haystack = [JSON.stringify(snapshot), ...logs, ...urls, ...(await page.context().cookies()).map((cookie) => `${cookie.name}=${cookie.value}`)].join("\n");
  for (const value of all) expect(haystack, value).not.toContain(value);
  expect(snapshot.local).toBe("{}");
  expect(snapshot.session).toBe("{}");
  expect(snapshot.databases).toEqual([]);
  // Only the owner's own saves (PATCH of this Draft) carry a private value in a request body; every other request body is free of them.
  for (const entry of bodies) {
    const carries = all.some((value) => entry.body.includes(value));
    if (entry.method === "PATCH" && entry.url.endsWith(`/api/v1/listings/${id(1)}`)) continue;
    expect(carries, `${entry.method} ${entry.url}`).toBe(false);
  }
  expect(bodies.filter((entry) => entry.method === "PATCH" && entry.body.includes("Maple Row"))).toHaveLength(1);
  // The reference lists are plain GETs with no listing data.
  expect(urls.filter((url) => /reference\//.test(url)).every((url) => !/street|house|latitude|longitude/i.test(url))).toBe(true);
  // The Draft read is never cached.
  const read = await page.request.get(`${APP}/api/v1/listings/${id(1)}`);
  expect(read.headers()["cache-control"]).toMatch(/no-store/);
});

test("privacy: leaving the page and coming back shows the saved values from the server, not anything kept in the browser", async ({ page, request }) => {
  await openDraft(page, request, "location_filled");
  await ready(page);
  await privateGroup(page).getByLabel("Street").fill("Typed Not Saved");
  await page.evaluate(() => (window.onbeforeunload = null));
  page.once("dialog", (dialog) => void dialog.accept());
  await page.goto(`${LIST}`);
  await page.goto(`${LIST}/${id(1)}`);
  await ready(page);
  await expect(privateGroup(page).getByLabel("Street")).toHaveValue("Cedar Lane");
});

// ---------------------------------------------------------------- keyboard and accessibility

test("location: the whole section works from the keyboard", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  await field(page, "City").focus();
  await page.keyboard.press("ArrowDown"); // Karachi
  await expect(field(page, "City")).toHaveValue(KARACHI);
  await page.keyboard.press("Tab");
  await expect(field(page, "Locality")).toBeFocused();
  await expect(field(page, "Locality").locator("option", { hasText: "Clifton" })).toHaveCount(1);
  await page.keyboard.press("ArrowDown"); // Clifton, the first option after Not answered
  await expect(field(page, "Locality")).toHaveValue(CLIFTON);
  for (const text of ["Palm", "P1", "S1", "B1"]) {
    await page.keyboard.press("Tab");
    await page.keyboard.type(text);
  }
  await expect(field(page, "Block")).toHaveValue("B1");
  await page.keyboard.press("Tab"); // the private group: Street
  await expect(privateGroup(page).getByLabel("Street")).toBeFocused();
  await page.keyboard.type("Elm Row");
  await field(page, "Block").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  expect((await stored(request)).street).toBe("Elm Row");
});

for (const viewport of viewports) {
  test(`accessibility (${viewport.name}): axe finds no violation in the empty, filled, error and conflict states`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openDraft(page, request, "house_blank");
    await ready(page);
    await expectNoViolations(page, "empty");
    // Reference list problems.
    await setMode(request, "localities", "error");
    await field(page, "City").selectOption({ label: "Karachi" });
    await expect(page.getByTestId("locality-retry")).toBeVisible();
    await expectNoViolations(page, "list failed");
    await setMode(request, "localities", "ok");
    await page.getByTestId("locality-retry").click();
    await expect(field(page, "Locality").locator("option", { hasText: "Clifton" })).toHaveCount(1);
    // Filled.
    await preset(request, "location_filled");
    await page.reload();
    await ready(page);
    await expect(field(page, "Locality").locator("option:checked")).toHaveText("DHA Phase 6");
    await expectNoViolations(page, "filled");
    // Error.
    await setMode(request, "listing-patch", "location_codes");
    await field(page, "Society").fill("Palm Society Two");
    await saveButton(page).click();
    await expect(summary(page)).toBeFocused();
    await expectNoViolations(page, "error");
    // Conflict.
    await setMode(request, "listing-patch", "ok");
    await otherSession(request, id(1), { street: "Their Street", society: "Their Society" });
    await privateGroup(page).getByLabel("Street").fill("Mine Street");
    await saveButton(page).click();
    await expect(page.getByTestId("draft-conflict")).toBeVisible();
    await expectNoViolations(page, "conflict");
  });
}

const main = (page: Page) => page.getByRole("main");
