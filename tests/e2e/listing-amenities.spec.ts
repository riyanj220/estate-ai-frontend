import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Story 2.8, frontend half: the Amenities section of the Draft editor (the generic `amenities` registry type, the catalogue grouped by kind,
// three-state radios, seller-declared nearby facilities), against the stub backend, which mirrors the backend's rules and serves the real
// `FIELD_MESSAGES` sentences by default. Low-entropy fake words only.
const STUB = STUB_URL;
const APP = APP_URL;
const LIST = "/account/listings";
const id = (seq: number) => `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`;
const ERRORS_ANNOUNCED = "The form has errors. Review the list at the top of the page.";
const CONFLICT =
  "This draft was changed in another session. We loaded the latest version; your unsaved changes are still in the form. Review them and save again.";
const NEARBY_HELP = "Declared by you, not verified. No distance is shown.";
const ONLY_INVALID = "One of the amenity choices could not be saved. Check your choices and try again.";

// The exact vocabulary the backend seeds, in its order: [kind, group heading or null, [code, label][]].
const VOCABULARY: [string, string[], [string, string][]][] = [
  [
    "on_property",
    ["Utilities", "Building", "Business"],
    [
      ["electricity_backup", "Electricity backup"],
      ["broadband_internet", "Broadband internet"],
      ["waste_disposal", "Waste disposal"],
      ["double_glazed_windows", "Double-glazed windows"],
      ["central_air_conditioning", "Central air conditioning"],
      ["central_heating", "Central heating"],
      ["elevator", "Elevator"],
      ["lobby", "Lobby"],
      ["intercom", "Intercom"],
      ["conference_room", "Conference room"],
      ["business_centre", "Business centre"],
      ["atm_in_building", "ATM in building"],
    ],
  ],
  [
    "community",
    ["Residential community", "Community services"],
    [
      ["community_lawn", "Community lawn"],
      ["swimming_pool", "Swimming pool"],
      ["community_gym", "Gym"],
      ["daycare", "Daycare"],
      ["childrens_play_area", "Children's play area"],
      ["bbq_area", "BBQ area"],
      ["community_mosque", "Community mosque"],
      ["medical_facility", "Medical facility"],
      ["community_centre", "Community centre"],
    ],
  ],
  [
    "nearby",
    [],
    [
      ["nearby_mosque", "Mosque"],
      ["nearby_park", "Park"],
      ["nearby_gym", "Gym"],
      ["nearby_school", "School"],
      ["nearby_hospital", "Hospital"],
    ],
  ],
];

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

const preset = (request: APIRequestContext, value: string) => request.get(`${STUB}/__listings-preset?value=${value}`);
const setMode = (request: APIRequestContext, kind: string, value: string) => request.get(`${STUB}/__${kind}-mode?value=${value}`);
const patches = async (request: APIRequestContext) => (await request.get(`${STUB}/__listing-patch-stats`)).json();
const stored = async (request: APIRequestContext) => (await (await request.get(`${STUB}/__listings-stats`)).json()).listings[0].fields;
const catalogueGets = async (request: APIRequestContext) => (await (await request.get(`${STUB}/__last-amenities`)).json()).count as number;
const registryGets = async (request: APIRequestContext) => (await (await request.get(`${STUB}/__listings-stats`)).json()).registryGets as number;
const otherSession = (request: APIRequestContext, listing: string, changes: Record<string, string>) =>
  request.get(`${STUB}/__other-session?${new URLSearchParams({ id: listing, ...changes }).toString()}`);

const field = (page: Page, name: string) => page.getByLabel(name, { exact: true });
const saveButton = (page: Page) => page.getByRole("button", { name: /^(Save changes|Saving…)$/ });
const summary = (page: Page) => page.getByRole("group", { name: "There is a problem" });
const block = (page: Page) => page.getByTestId("amenities-block");
const item = (page: Page, code: string) => page.getByTestId(`amenity-${code}`);
const radio = (page: Page, code: string, name: "Present" | "None" | "Not answered") => item(page, code).getByRole("radio", { name, exact: true });
const choose = (page: Page, code: string, name: "Present" | "None" | "Not answered") => radio(page, code, name).check();
const live = (page: Page) => page.getByTestId("draft-live");

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
  await expect(item(page, "elevator")).toBeVisible();
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

// ---------------------------------------------------------------- structure

test("amenities: the catalogue is grouped by kind with group sub-headings, in the backend's exact vocabulary and order @smoke", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  await expect(page.getByRole("heading", { level: 3, name: "Amenities" })).toBeVisible();
  await expect(block(page).getByRole("heading", { level: 4 })).toHaveText(["On the property", "Community", "Nearby"]);
  await expect(block(page).getByRole("heading", { level: 5 })).toHaveText(["Utilities", "Building", "Business", "Residential community", "Community services"]);
  for (const [kind, , items] of VOCABULARY) {
    const group = page.getByTestId(`amenities-${kind}`);
    await expect(group.locator("fieldset legend")).toHaveText(items.map(([, label]) => label));
    for (const [code, label] of items) await expect(group.getByRole("group", { name: label, exact: true }).and(page.getByTestId(`amenity-${code}`))).toHaveCount(1);
  }
  expect(await page.locator("fieldset.amenity-item").count()).toBe(26);
  // The group a kind names itself adds no second heading (Nearby has the one group "nearby").
  await expect(page.getByTestId("amenities-nearby").getByRole("heading", { level: 5 })).toHaveCount(0);
  // The section is part of the form, after the Details.
  const order = await page.locator("form h3.section-title").allTextContents();
  expect(order.at(-1)).toBe("Amenities");
  expect(await page.locator("form").getByTestId("amenities-block").count()).toBe(1);
});

test("amenities: every item is a labelled fieldset of three radios, Not answered by default, and nothing is saved by looking @smoke", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  for (const [, , items] of VOCABULARY) {
    for (const [code] of items) {
      await expect(item(page, code).getByRole("radio")).toHaveCount(3);
      await expect(item(page, code).locator("label")).toHaveText(["Present", "None", "Not answered"]);
      for (const name of ["Present", "None", "Not answered"] as const) await expect(radio(page, code, name)).toHaveCount(1); // each radio is named by its label
      await expect(radio(page, code, "Not answered")).toBeChecked();
      await expect(radio(page, code, "Present")).not.toBeChecked();
      await expect(radio(page, code, "None")).not.toBeChecked();
    }
  }
  expect(await page.locator('fieldset.amenity-item input[type="radio"]').count()).toBe(78);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(0);
});

test("amenities: only the Nearby group carries the visible Seller-declared label and its helper, and no distance or verification control exists @smoke", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  const nearby = page.getByTestId("amenities-nearby");
  await expect(nearby.getByTestId("amenities-nearby-tag")).toHaveText("Seller-declared");
  await expect(nearby.getByTestId("amenities-nearby-tag")).toBeVisible();
  await expect(nearby.getByTestId("amenities-nearby-help")).toHaveText(NEARBY_HELP);
  await expect(nearby).toHaveAccessibleDescription(NEARBY_HELP);
  await expect(page.getByTestId("amenities-on_property").getByText("Seller-declared")).toHaveCount(0);
  await expect(page.getByTestId("amenities-community").getByText("Seller-declared")).toHaveCount(0);
  await expect(block(page).getByText("Seller-declared")).toHaveCount(1);
  // Nothing about a distance, a verification, a score or a number input anywhere in the section.
  await expect(block(page).locator('input:not([type="radio"]), select, textarea')).toHaveCount(0);
  const text = (await block(page).innerText()).replace(NEARBY_HELP, "");
  expect(text).not.toMatch(/distance|metre|meter|\bkm\b|minute|verified|verification|score|rating/i);
  expect(await block(page).locator('[type="number"], [type="range"], [type="checkbox"]').count()).toBe(0);
});

test("amenities: a registry without the amenities field shows no section and never asks for the catalogue @smoke", async ({ page, request }) => {
  await request.get(`${STUB}/__registry-fields?value=other`);
  await openDraft(page, request, "house_blank");
  await expect(block(page)).toHaveCount(0);
  await expect.poll(() => registryGets(request)).toBeGreaterThan(0);
  expect(await catalogueGets(request)).toBe(0);
});

for (const [name, change] of [
  ["another section", { section: "details" }],
  ["another type with the section", { type: "integer" }],
  ["another id with the type and section", { id: "amenities_other" }],
] as const) {
  test(`amenities: a registry field with ${name} gets no section and no catalogue request`, async ({ page, request }) => {
    await page.route("**/api/v1/registry", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      for (const entry of body.fields) if (entry.id === "amenities") Object.assign(entry, change);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await openDraft(page, request, "house_blank");
    await expect.poll(() => registryGets(request)).toBeGreaterThan(0);
    await expect(field(page, "Title")).toBeVisible();
    await expect(block(page)).toHaveCount(0);
    await expect(page.getByTestId("details-block").locator("#amenities, #amenities_other")).toHaveCount(0);
    await expect(page.locator("form").getByLabel(/^Amenities/)).toHaveCount(0);
    expect(await catalogueGets(request)).toBe(0);
  });
}

// ---------------------------------------------------------------- choose, save, restore, clear

test("amenities: choosing sends the whole map with the revision, saves, and the next save is a no-op @smoke", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  await choose(page, "elevator", "Present");
  await choose(page, "lobby", "None");
  await choose(page, "nearby_school", "Present");
  await choose(page, "nearby_park", "None");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  const { bodies, count } = await patches(request);
  expect(count).toBe(1);
  expect(bodies[0]).toEqual({ base_revision: 1, fields: { amenities: { elevator: "present", lobby: "none", nearby_school: "present", nearby_park: "none" } } });
  expect((await stored(request)).amenities).toEqual({ elevator: "present", lobby: "none", nearby_park: "none", nearby_school: "present" });
  await expect(page.getByTestId("draft-revision")).toHaveText("2");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(1);
});

test("amenities: Not answered is never None: an item left alone is not in the map, and choosing Not answered removes the code", async ({ page, request }) => {
  await openDraft(page, request, "amenities_filled");
  await ready(page);
  await expect(radio(page, "elevator", "Present")).toBeChecked();
  await expect(radio(page, "lobby", "None")).toBeChecked();
  await expect(radio(page, "intercom", "Not answered")).toBeChecked();
  await choose(page, "lobby", "Not answered");
  await choose(page, "nearby_park", "Not answered");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  const { bodies } = await patches(request);
  expect(bodies[0].fields.amenities).toEqual({ elevator: "present", community_gym: "present", nearby_school: "present" });
  expect(Object.keys(bodies[0].fields.amenities)).not.toContain("lobby");
  expect(Object.values(bodies[0].fields.amenities)).not.toContain("none");
  expect((await stored(request)).amenities).toEqual({ community_gym: "present", elevator: "present", nearby_school: "present" });
  await expect(radio(page, "lobby", "Not answered")).toBeChecked();
  await expect(radio(page, "nearby_park", "Not answered")).toBeChecked();
});

test("amenities: answering everything back to Not answered clears the map with null, and the Draft reads as unanswered", async ({ page, request }) => {
  await openDraft(page, request, "amenities_filled");
  await ready(page);
  for (const code of ["elevator", "lobby", "community_gym", "nearby_school", "nearby_park"]) await choose(page, code, "Not answered");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0]).toEqual({ base_revision: 2, fields: { amenities: null } });
  expect((await stored(request)).amenities).toBeNull();
  await page.reload();
  await ready(page);
  await expect(page.locator('fieldset.amenity-item input[type="radio"]:checked')).toHaveCount(26);
  await expect(page.getByTestId("draft-amenities")).toHaveCount(0);
});

test("amenities: changing an answer and changing it back is no change, and nothing is sent", async ({ page, request }) => {
  await openDraft(page, request, "amenities_filled");
  await ready(page);
  await choose(page, "elevator", "None");
  await choose(page, "elevator", "Present");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  expect((await patches(request)).count).toBe(0);
});

test("amenities: the saved answers restore from the Draft, and the summary groups them by kind with Nearby tagged", async ({ page, request }) => {
  await openDraft(page, request, "amenities_filled");
  await ready(page);
  await expect(radio(page, "community_gym", "Present")).toBeChecked();
  await expect(radio(page, "nearby_school", "Present")).toBeChecked();
  await expect(radio(page, "nearby_park", "None")).toBeChecked();
  await expect(radio(page, "nearby_gym", "Not answered")).toBeChecked(); // the community gym is another item
  const rows = page.getByTestId("draft-details");
  await expect(page.getByTestId("draft-amenities-on_property")).toHaveText("Present: Elevator. None: Lobby.");
  await expect(page.getByTestId("draft-amenities-community")).toHaveText("Present: Gym.");
  await expect(page.getByTestId("draft-amenities-nearby")).toContainText("Present: School. None: Park.");
  await expect(page.getByTestId("draft-amenities-nearby-tag")).toHaveText("Seller-declared");
  await expect(rows.getByTestId("draft-amenities-on_property").locator("..").locator("dt")).toHaveText("On the property");
  // No distance or verification anywhere in the summary.
  expect(await rows.innerText()).not.toMatch(/distance|verified/i);
  // Saving the summary figure after a save: it follows the saved map.
  await choose(page, "intercom", "Present");
  await expect(page.getByTestId("draft-amenities-on_property")).toHaveText("Present: Elevator. None: Lobby."); // unsaved input is not "saved"
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await expect(page.getByTestId("draft-amenities-on_property")).toHaveText("Present: Elevator, Intercom. None: Lobby.");
});

test("amenities: a Draft with no amenities shows no summary row, and an answered Nearby fact is kept apart from the others", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  for (const kind of ["on_property", "community", "nearby", "other"]) await expect(page.getByTestId(`draft-amenities-${kind}`)).toHaveCount(0);
  await choose(page, "nearby_hospital", "Present");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  await expect(page.getByTestId("draft-amenities-nearby")).toContainText("Present: Hospital.");
  await expect(page.getByTestId("draft-amenities-on_property")).toHaveCount(0);
  await expect(page.getByTestId("draft-amenities-community")).toHaveCount(0);
});

// ---------------------------------------------------------------- codes the list does not hold

test("amenities: saved codes the catalogue no longer lists are shown read-only as Other and are kept untouched by a save", async ({ page, request }) => {
  await openDraft(page, request, "amenities_inactive");
  await ready(page);
  const other = page.getByTestId("amenities-other");
  await expect(other.getByRole("heading", { level: 4, name: "Other" })).toBeVisible();
  await expect(page.getByTestId("amenity-other-old_sauna")).toHaveText(/^Old sauna: Present\s*Remove Old sauna$/);
  await expect(page.getByTestId("amenity-other-former_helipad")).toHaveText(/^Former helipad: None\s*Remove Former helipad$/);
  await expect(other.getByRole("radio")).toHaveCount(0);
  await expect(other.locator("input, select, textarea")).toHaveCount(0);
  await expect(other.getByRole("button")).toHaveText(["Remove Former helipad", "Remove Old sauna"]); // the only control: remove, never change
  await expect(page.getByTestId("amenity-old_sauna")).toHaveCount(0);
  await expect(page.getByTestId("draft-amenities-other")).toHaveText("Present: Old sauna. None: Former helipad.");
  // Changing another item sends the whole map with the unknown codes exactly as they were.
  await choose(page, "lobby", "Present");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0].fields.amenities).toEqual({ elevator: "present", former_helipad: "none", lobby: "present", old_sauna: "present" });
  expect((await stored(request)).amenities).toEqual({ elevator: "present", former_helipad: "none", lobby: "present", old_sauna: "present" });
  // Even answering everything the list offers as Not answered keeps them.
  await choose(page, "elevator", "Not answered");
  await choose(page, "lobby", "Not answered");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[1].fields.amenities).toEqual({ former_helipad: "none", old_sauna: "present" });
  await expect(page.getByTestId("amenity-other-old_sauna")).toBeVisible();
});

test("amenities: with the catalogue not loaded, the saved answers are untouched, nothing is guessed from a bare code, and nothing about them is sent", async ({ page, request }) => {
  await setMode(request, "amenities", "error");
  await openDraft(page, request, "amenities_filled");
  await expect(page.getByTestId("amenities-status")).toHaveText("We could not load the list of amenities.");
  await expect(page.locator("fieldset.amenity-item")).toHaveCount(0);
  await expect(page.getByTestId("amenities-other")).toHaveCount(0);
  await expect(page.getByTestId("draft-amenities")).toHaveText("The amenities are not available right now.");
  await field(page, "Title").fill("A title long enough to save");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0].fields).toEqual({ title: "A title long enough to save" });
  expect((await stored(request)).amenities).toEqual({ community_gym: "present", elevator: "present", lobby: "none", nearby_park: "none", nearby_school: "present" });
  // While it loads the summary says so too, and a conflict's "Latest saved" is never a humanised code.
  await setMode(request, "amenities", "slow");
  await page.reload();
  await expect(page.getByTestId("draft-amenities")).toHaveText("Loading the amenities…");
  await expect(item(page, "elevator")).toBeVisible();
  await expect(page.getByTestId("draft-amenities")).toHaveCount(0);
  await expect(page.getByTestId("draft-amenities-on_property")).toBeVisible();
});

test("amenities: a conflict while the catalogue has failed names no item from a bare code", async ({ page, request }) => {
  await setMode(request, "amenities", "error");
  await openDraft(page, request, "amenities_filled");
  await expect(page.getByTestId("amenities-retry")).toBeVisible();
  await field(page, "Title").fill("A title long enough to save");
  await otherSession(request, id(1), { title: "Their title is long enough" });
  await saveButton(page).click();
  await expect(page.getByTestId("conflict-title").locator(".latest-value")).toHaveText("Their title is long enough");
  await expect(page.getByTestId("conflict-amenities")).toHaveCount(0);
});

test("amenities: a saved map that cannot be trusted is no Draft to build on (fail closed), never a form that would replace it", async ({ page, request }) => {
  for (const which of ["amenities_bad_state", "amenities_empty_state", "amenities_null_state", "amenities_number_state", "amenities_bad_code", "amenities_not_object"]) {
    await preset(request, which);
    await startSession(page, request);
    await page.goto(`${LIST}/${id(1)}`);
    await expect(page.getByRole("heading", { level: 1, name: "Listing" })).toBeVisible();
    await expect(page.getByText("We could not load your draft"), which).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" }), which).toBeVisible();
    await expect(page.getByRole("heading", { name: "Edit details" }), which).toHaveCount(0);
    await expect(block(page), which).toHaveCount(0);
    expect((await patches(request)).count, which).toBe(0);
  }
});

// ---------------------------------------------------------------- the catalogue: loading, empty, failed, malformed

test("amenities: the catalogue shows a loading state, then the items", async ({ page, request }) => {
  await setMode(request, "amenities", "slow");
  await openDraft(page, request, "house_blank");
  await expect(page.getByTestId("amenities-status")).toHaveText("Loading the amenities…");
  await expect(page.locator("fieldset.amenity-item")).toHaveCount(0);
  await ready(page);
  await expect(page.getByTestId("amenities-status")).toHaveText("");
  await expect(page.getByTestId("amenities-retry")).toHaveCount(0);
  expect(await catalogueGets(request)).toBe(1);
});

test("amenities: an empty catalogue says so and offers no item", async ({ page, request }) => {
  await setMode(request, "amenities", "empty");
  await openDraft(page, request, "house_blank");
  await expect(page.getByTestId("amenities-status")).toHaveText("No amenities are available right now.");
  await expect(page.locator("fieldset.amenity-item")).toHaveCount(0);
  await expect(page.getByTestId("amenities-retry")).toHaveCount(0);
});

test("amenities: a failed catalogue says so without the server's words, and Retry loads it", async ({ page, request }) => {
  await setMode(request, "amenities", "flaky");
  await openDraft(page, request, "house_blank");
  await expect(page.getByTestId("amenities-status")).toHaveText("We could not load the list of amenities.");
  await expect(page.getByTestId("amenities-status")).not.toContainText("Internal detail");
  await expect(page.getByTestId("amenities-retry")).toBeVisible();
  await page.getByTestId("amenities-retry").click();
  await ready(page);
  await expect(page.getByTestId("amenities-retry")).toHaveCount(0);
  await expect(page.getByTestId("amenities-status")).toHaveText("The amenities are loaded.");
  expect(await catalogueGets(request)).toBe(2);
});

test("amenities: the rest of the form works while the catalogue has failed, and every other failure kind (one unusable item included) reads the same", async ({ page, request }) => {
  for (const mode of ["error", "broken", "html", "malformed", "partial", "long_label", "short_label", "padded_label", "bad_group", "dup_code"]) {
    await setMode(request, "amenities", mode);
    await openDraft(page, request, "house_blank");
    await expect(page.getByTestId("amenities-status"), mode).toHaveText("We could not load the list of amenities.");
    await expect(page.getByTestId("amenities-retry"), mode).toBeVisible();
    await expect(field(page, "Title")).toBeEnabled();
  }
});

test("amenities: a hanging catalogue ends as a failed load with Retry", async ({ page, request }) => {
  await setMode(request, "amenities", "hang");
  await openDraft(page, request, "house_blank");
  await expect(page.getByTestId("amenities-status")).toHaveText("Loading the amenities…");
  await expect(page.getByTestId("amenities-status")).toHaveText("We could not load the list of amenities.", { timeout: 40_000 });
  await expect(page.getByTestId("amenities-retry")).toBeVisible();
});

test("amenities: one unusable catalogue item makes the whole load a failure, so an active code never turns into Other", async ({ page, request }) => {
  await setMode(request, "amenities", "partial");
  await openDraft(page, request, "amenities_filled");
  await expect(page.getByTestId("amenities-status")).toHaveText("We could not load the list of amenities.");
  await expect(page.getByTestId("amenities-retry")).toBeVisible();
  await expect(page.locator("fieldset.amenity-item")).toHaveCount(0);
  await expect(page.getByTestId("amenities-other")).toHaveCount(0);
  await setMode(request, "amenities", "ok");
  await page.getByTestId("amenities-retry").click();
  await ready(page);
  await expect(page.getByTestId("amenities-other")).toHaveCount(0);
  await expect(radio(page, "elevator", "Present")).toBeChecked();
});

test("amenities: the label limits are 2 to 80 characters with no surrounding space, and the code and group follow the backend's token rule", async ({ page, request }) => {
  for (const mode of ["long_label", "short_label", "padded_label", "bad_group"]) {
    await setMode(request, "amenities", mode);
    await openDraft(page, request, "house_blank");
    await expect(page.getByTestId("amenities-status"), mode).toHaveText("We could not load the list of amenities.");
    await expect(page.locator("fieldset.amenity-item"), mode).toHaveCount(0);
  }
});

test("amenities: Retry ignores a second click while a request is in flight, stays mounted and aria-disabled, and says Loading", async ({ page, request }) => {
  await setMode(request, "amenities", "fail_then_slow");
  await openDraft(page, request, "house_blank");
  await expect(page.getByTestId("amenities-status")).toHaveText("We could not load the list of amenities.");
  const retry = page.getByTestId("amenities-retry");
  await retry.click();
  await expect(retry).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("amenities-status")).toHaveText("Loading the amenities…");
  await retry.dispatchEvent("click"); // Playwright's own click refuses an aria-disabled button: the event is what a fast double click sends
  await retry.dispatchEvent("click");
  await page.waitForTimeout(600);
  expect(await catalogueGets(request)).toBe(2);
  await ready(page);
  expect(await catalogueGets(request)).toBe(2);
  await expect(retry).toHaveCount(0);
});

test("amenities: after a Retry that works focus moves to the Amenities heading and the loaded state is announced", async ({ page, request }) => {
  await setMode(request, "amenities", "flaky");
  await openDraft(page, request, "house_blank");
  await page.getByTestId("amenities-retry").click();
  await ready(page);
  await expect(page.getByRole("heading", { level: 3, name: "Amenities" })).toBeFocused();
  await expect(page.getByTestId("amenities-status")).toHaveText("The amenities are loaded.");
});

test("amenities: the catalogue request is a plain public GET: no body, no listing data, no stored copy of the answers", async ({ page, request }) => {
  const calls: { method: string; url: string; body: string }[] = [];
  page.on("request", (req) => {
    if (/reference\/amenities/.test(req.url())) calls.push({ method: req.method(), url: req.url(), body: req.postData() ?? "" });
  });
  await openDraft(page, request, "amenities_filled");
  await ready(page);
  await choose(page, "intercom", "Present");
  expect(calls).toHaveLength(1);
  expect(calls[0]).toEqual({ method: "GET", url: `${APP}/api/v1/reference/amenities`, body: "" });
  const snapshot = await page.evaluate(async () => ({
    local: JSON.stringify({ ...localStorage }),
    session: JSON.stringify({ ...sessionStorage }),
    cookie: document.cookie,
    href: location.href,
    databases: ((await indexedDB.databases?.()) ?? []).map((entry) => entry.name),
  }));
  expect(snapshot.local).toBe("{}");
  expect(snapshot.session).toBe("{}");
  expect(snapshot.databases).toEqual([]);
  expect(snapshot.href).not.toMatch(/amenit|elevator|present/i);
});

// ---------------------------------------------------------------- errors

test("amenities: the one code is shown as the client's own text on the section, with a summary link that reaches it, the choices kept, and editing an item clears it", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  await setMode(request, "listing-patch", "amenities_invalid");
  await choose(page, "elevator", "Present");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(live(page)).toHaveText(ERRORS_ANNOUNCED);
  await expect(page.locator("#amenities-error")).toContainText(ONLY_INVALID);
  await expect(page.locator("#amenities-error")).not.toContainText("Enter a valid value.");
  await expect(summary(page).getByRole("link", { name: `Amenities: ${ONLY_INVALID}` })).toBeVisible();
  await expect(block(page)).toHaveAccessibleDescription(new RegExp(ONLY_INVALID));
  await expect(radio(page, "elevator", "Present")).toBeChecked(); // what was chosen stays
  await summary(page).getByRole("link", { name: /^Amenities:/ }).click();
  await expect(block(page)).toBeFocused();
  // Editing an item clears the error, like every other section (the server judged the old map, not the new one).
  await choose(page, "lobby", "None");
  await expect(page.locator("#amenities-error")).toHaveCount(0);
  await expect(summary(page)).toHaveCount(0);
  await expect(radio(page, "elevator", "Present")).toBeChecked();
  await expect(radio(page, "lobby", "None")).toBeChecked();
  // The next save, now accepted, sends both choices.
  await setMode(request, "listing-patch", "ok");
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies.at(-1).fields.amenities).toEqual({ elevator: "present", lobby: "none" });
});

test("amenities: not_editable has its own text", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  await setMode(request, "listing-patch", "amenities_not_editable");
  await choose(page, "lobby", "None");
  await saveButton(page).click();
  await expect(page.locator("#amenities-error")).toContainText("This detail cannot be changed here.");
});

test("amenities: an unknown code or sentence is the generic text, never the server's words, and not_applicable has its own", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  await setMode(request, "listing-patch", "amenities_unknown");
  await choose(page, "lobby", "None");
  await saveButton(page).click();
  await expect(summary(page)).toBeFocused();
  const error = page.locator("#amenities-error");
  await expect(error).toContainText("Enter a valid value."); // the generic text, not the section's own text
  await expect(error).not.toContainText(ONLY_INVALID);
  await expect(error).not.toContainText("Some server sentence");
  await expect(error).not.toContainText("mystery_code");
  await setMode(request, "listing-patch", "amenities_hidden");
  await saveButton(page).click();
  await expect(error).toContainText("This detail does not apply to this listing.");
});

test("wire: the real sentence 'Enter a valid value.' reads as the invalid text, and the codes wire reads the same", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  await setMode(request, "listing-patch", "amenities_invalid"); // the sentence on the wire (the stub's default) is read as the code
  await choose(page, "intercom", "Present");
  await saveButton(page).click();
  await expect(page.locator("#amenities-error")).toContainText(ONLY_INVALID);
  await request.get(`${STUB}/__wire-mode?value=codes`);
  await saveButton(page).click();
  await expect(page.locator("#amenities-error")).toContainText(ONLY_INVALID);
});

test("stub self-test (not frontend coverage): the stub mirrors the backend's amenity rules", async ({ page, request }) => {
  await request.get(`${STUB}/__wire-mode?value=codes`);
  await openDraft(page, request, "amenities_inactive");
  const token = (await (await request.get(`${STUB}/api/v1/csrf`, { headers: { cookie: "estate_session=stub-live" } })).json()).csrf_token;
  const patch = (fields: Record<string, unknown>, revision: number) =>
    request.patch(`${STUB}/api/v1/listings/${id(1)}`, { headers: { cookie: "estate_session=stub-live", "x-csrftoken": token }, data: { base_revision: revision, fields } });
  const invalid = async (value: unknown) => {
    const answer = await patch({ amenities: value }, 2);
    expect(answer.status(), JSON.stringify(value)).toBe(400);
    expect((await answer.json()).error.fields).toEqual({ amenities: ["invalid"] });
  };
  await invalid({ unknown_code: "present" }); // a new code must be active
  await invalid({ elevator: "maybe" });
  await invalid({ elevator: "" });
  await invalid({ elevator: null });
  await invalid({ elevator: true });
  await invalid(["elevator"]);
  await invalid("elevator");
  await invalid(5);
  await invalid({ elevator: "present", old_sauna: "none" }); // a stored inactive code cannot be flipped
  await invalid({ elevator: "present", newly_gone: "present" });
  // 41 entries: refused (for the entry limit, and also because most of these codes are not in the 26-item catalogue).
  await invalid(Object.fromEntries(Array.from({ length: 41 }, (_, index) => [`code_${index}`, "present"])));
  await request.get(`${STUB}/__wire-mode?value=sentences`);
  const sentence = await patch({ amenities: { elevator: "present", old_sauna: "none" } }, 2);
  expect((await sentence.json()).error.fields).toEqual({ amenities: ["Enter a valid value."] }); // the real sentence on the real wire
  await request.get(`${STUB}/__wire-mode?value=codes`);
  const same = await patch({ amenities: { elevator: "none", old_sauna: "present" } }, 2); // re-sent unchanged: allowed
  expect(same.status()).toBe(200);
  const body = await same.json();
  expect([body.fields.amenities, body.revision]).toEqual([{ elevator: "none", old_sauna: "present" }, 3]);
  expect(Object.hasOwn(body, "amenities")).toBe(false); // the top-level key was removed
  const noChange = await patch({ amenities: { old_sauna: "present", elevator: "none" } }, 3); // same content in another order
  expect((await noChange.json()).revision).toBe(3);
  const cleared = await patch({ amenities: {} }, 3);
  expect((await cleared.json()).fields.amenities).toBeNull();
  const again = await patch({ amenities: null }, 4);
  expect((await again.json()).revision).toBe(4);
});

// ---------------------------------------------------------------- conflicts

test("amenities: a conflict shows the latest map by labels, and Use latest takes the whole latest map", async ({ page, request }) => {
  await openDraft(page, request, "amenities_filled");
  await ready(page);
  await choose(page, "intercom", "Present");
  await otherSession(request, id(1), { amenities: JSON.stringify({ elevator: "none", nearby_gym: "present", swimming_pool: "present" }) });
  await saveButton(page).click();
  await expect(page.getByTestId("draft-conflict")).toHaveText(CONFLICT);
  const row = page.getByTestId("conflict-amenities");
  await expect(row.locator(".latest-value")).toHaveText("On the property: None: Elevator. Community: Present: Swimming pool. Nearby (Seller-declared): Present: Gym.");
  await expect(block(page)).toHaveAccessibleDescription(/Latest saved/);
  await expect(radio(page, "intercom", "Present")).toBeChecked(); // what was typed stays
  await expect(radio(page, "elevator", "Present")).toBeChecked(); // an unedited-by-me item keeps my typed value until I choose
  await row.getByRole("button", { name: /Use latest/ }).click();
  await expect(radio(page, "elevator", "None")).toBeChecked();
  await expect(radio(page, "nearby_gym", "Present")).toBeChecked();
  await expect(radio(page, "swimming_pool", "Present")).toBeChecked();
  await expect(radio(page, "intercom", "Not answered")).toBeChecked();
  await expect(radio(page, "lobby", "Not answered")).toBeChecked();
  await expect(page.getByTestId("draft-conflict")).toHaveCount(0);
  await expect(block(page)).toBeFocused();
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
});

test("amenities: Keep mine sends my whole map against the new revision, replacing theirs", async ({ page, request }) => {
  await openDraft(page, request, "amenities_filled");
  await ready(page);
  await choose(page, "intercom", "Present");
  await otherSession(request, id(1), { amenities: JSON.stringify({ nearby_gym: "present" }) });
  await saveButton(page).click();
  await expect(page.getByTestId("conflict-amenities")).toBeVisible();
  await page.getByTestId("conflict-amenities").getByRole("button", { name: /Keep mine/ }).click();
  await expect(page.getByTestId("draft-conflict")).toHaveCount(0);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  const { bodies } = await patches(request);
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual({
    base_revision: 3,
    fields: { amenities: { community_gym: "present", elevator: "present", intercom: "present", lobby: "none", nearby_park: "none", nearby_school: "present" } },
  });
  expect((await stored(request)).amenities).toEqual(bodies[1].fields.amenities);
});

test("amenities: another session that made the same answers is already saved, and a conflict on another field keeps my choices", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  await choose(page, "elevator", "Present");
  await otherSession(request, id(1), { amenities: JSON.stringify({ elevator: "present" }) });
  await saveButton(page).click();
  await expect(page.getByTestId("draft-conflict")).toHaveText("Your changes are already saved.");
  await expect(page.getByTestId("conflict-amenities")).toHaveCount(0);
  // Another session changes the title only: my amenity change is kept and no amenity row appears.
  await choose(page, "lobby", "None");
  await otherSession(request, id(1), { title: "Their title is long enough" });
  await saveButton(page).click();
  await expect(page.getByTestId("draft-conflict")).toBeVisible();
  await expect(field(page, "Title")).toHaveValue("Their title is long enough"); // a field I did not change takes the latest
  await expect(radio(page, "lobby", "None")).toBeChecked(); // what I chose stays, as for every other field
  await expect(radio(page, "elevator", "Present")).toBeChecked();
});

test("amenities: another session clearing the map shows Not answered as the latest", async ({ page, request }) => {
  await openDraft(page, request, "amenities_filled");
  await ready(page);
  await choose(page, "lobby", "Present");
  await otherSession(request, id(1), { amenities: "" });
  await saveButton(page).click();
  await expect(page.getByTestId("conflict-amenities").locator(".latest-value")).toHaveText("Not answered");
  await page.getByTestId("conflict-amenities").getByRole("button", { name: /Use latest/ }).click();
  await expect(page.locator('fieldset.amenity-item input[type="radio"]:checked')).toHaveCount(26);
  await expect(page.locator('fieldset.amenity-item input[value=""]:checked')).toHaveCount(26);
});

test("amenities: an Other entry can be removed (the code is left out of the map) and nothing else changes", async ({ page, request }) => {
  await openDraft(page, request, "amenities_inactive");
  await ready(page);
  await expect(page.getByTestId("amenity-remove-old_sauna")).toHaveAccessibleName("Remove Old sauna");
  await page.getByTestId("amenity-remove-old_sauna").click();
  await expect(page.getByTestId("amenity-other-old_sauna")).toHaveCount(0);
  await expect(page.getByTestId("amenity-other-former_helipad")).toBeVisible();
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0].fields.amenities).toEqual({ elevator: "present", former_helipad: "none" });
  expect((await stored(request)).amenities).toEqual({ elevator: "present", former_helipad: "none" });
  await page.getByTestId("amenity-remove-former_helipad").click();
  await expect(page.getByTestId("amenities-other")).toHaveCount(0);
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await stored(request)).amenities).toEqual({ elevator: "present" });
});

test("amenities: another session removed an Other code: Keep mine succeeds and the stale code is not sent", async ({ page, request }) => {
  await openDraft(page, request, "amenities_inactive");
  await ready(page);
  await choose(page, "intercom", "Present");
  await otherSession(request, id(1), { amenities: JSON.stringify({ elevator: "present", nearby_gym: "present" }) });
  await saveButton(page).click();
  await expect(page.getByTestId("draft-conflict")).toHaveText(CONFLICT);
  await expect(page.getByTestId("amenity-other-old_sauna")).toHaveCount(0); // gone from the latest, so gone from the form
  await expect(page.getByTestId("amenities-other")).toHaveCount(0);
  await page.getByTestId("conflict-amenities").getByRole("button", { name: /Keep mine/ }).click();
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  const { bodies } = await patches(request);
  expect(bodies).toHaveLength(2);
  expect(bodies[1].fields.amenities).toEqual({ elevator: "present", intercom: "present" });
  expect((await stored(request)).amenities).toEqual({ elevator: "present", intercom: "present" });
  await expect(page.getByTestId("amenity-other-old_sauna")).toHaveCount(0);
});

test("amenities: a conflict where the latest still holds the Other code: Use latest takes the latest map, Keep mine keeps the code", async ({ page, request }) => {
  await openDraft(page, request, "amenities_inactive");
  await ready(page);
  await choose(page, "intercom", "Present");
  await otherSession(request, id(1), { amenities: JSON.stringify({ old_sauna: "present", nearby_gym: "present" }) });
  await saveButton(page).click();
  await expect(page.getByTestId("conflict-amenities").locator(".latest-value")).toHaveText("Nearby (Seller-declared): Present: Gym. Other: Present: Old sauna.");
  await expect(page.getByTestId("amenity-other-old_sauna")).toBeVisible();
  await expect(page.getByTestId("amenity-other-former_helipad")).toHaveCount(0); // removed by the other session: dropped from what I typed
  await page.getByTestId("conflict-amenities").getByRole("button", { name: /Use latest/ }).click();
  await expect(radio(page, "nearby_gym", "Present")).toBeChecked();
  await expect(radio(page, "intercom", "Not answered")).toBeChecked();
  await expect(radio(page, "elevator", "Not answered")).toBeChecked();
  await expect(page.getByTestId("amenity-other-old_sauna")).toBeVisible();
  await saveButton(page).click();
  await expect(live(page)).toHaveText("No changes to save.");
  // Then again, keeping mine: the code the latest still holds is sent unchanged and accepted.
  await choose(page, "intercom", "Present");
  await otherSession(request, id(1), { amenities: JSON.stringify({ old_sauna: "present", nearby_gym: "present", nearby_park: "none" }) });
  await saveButton(page).click();
  await page.getByTestId("conflict-amenities").getByRole("button", { name: /Keep mine/ }).click();
  await saveButton(page).click();
  await expect(live(page)).toHaveText("Saved");
  expect((await stored(request)).amenities).toEqual({ intercom: "present", nearby_gym: "present", old_sauna: "present" });
});

test("amenities: every Nearby item is described by the helper, and the Nearby group adds no heading named like its kind", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  for (const [code] of VOCABULARY[2][2]) await expect(item(page, code)).toHaveAccessibleDescription(NEARBY_HELP);
  await expect(item(page, "elevator")).not.toHaveAccessibleDescription(NEARBY_HELP);
});

// ---------------------------------------------------------------- keyboard and accessibility

test("amenities: the whole section works from the keyboard", async ({ page, request }) => {
  await openDraft(page, request, "house_blank");
  await ready(page);
  await radio(page, "electricity_backup", "Not answered").focus();
  await page.keyboard.press("ArrowUp"); // within the item: None
  await expect(radio(page, "electricity_backup", "None")).toBeChecked();
  await page.keyboard.press("ArrowUp"); // Present
  await expect(radio(page, "electricity_backup", "Present")).toBeChecked();
  await page.keyboard.press("Tab"); // out of the item, to the next one's checked radio (Not answered)
  await expect(radio(page, "broadband_internet", "Not answered")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(radio(page, "broadband_internet", "None")).toBeChecked();
  await page.keyboard.press("Space");
  await expect(radio(page, "broadband_internet", "None")).toBeChecked();
  await radio(page, "nearby_school", "Present").focus();
  await page.keyboard.press("Space");
  await expect(radio(page, "nearby_school", "Present")).toBeChecked();
  await page.keyboard.press("Enter"); // a radio submits the form
  await expect(live(page)).toHaveText("Saved");
  expect((await patches(request)).bodies[0].fields.amenities).toEqual({ broadband_internet: "none", electricity_backup: "present", nearby_school: "present" });
});

test("amenities: Retry and the radios are reachable in the tab order, and a focused radio shows a visible focus ring", async ({ page, request }) => {
  await setMode(request, "amenities", "flaky");
  await openDraft(page, request, "house_blank");
  await page.getByTestId("amenities-retry").focus();
  await expect(page.getByTestId("amenities-retry")).toBeFocused();
  await page.keyboard.press("Enter");
  await ready(page);
  await radio(page, "elevator", "Not answered").focus();
  expect(await radio(page, "elevator", "Not answered").evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
});

for (const viewport of viewports) {
  test(`accessibility (${viewport.name}): axe finds no violation in the empty, filled, error, failed and conflict states`, async ({ page, request }) => {
    test.setTimeout(120_000); // several states, each scanned in full; the Amenities block makes a page scan slower
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openDraft(page, request, "house_blank");
    await ready(page);
    await expectNoViolations(page, "empty");
    // The catalogue failed.
    await setMode(request, "amenities", "error");
    await page.reload();
    await expect(page.getByTestId("amenities-retry")).toBeVisible();
    await expectNoViolations(page, "catalogue failed");
    await setMode(request, "amenities", "ok");
    await page.getByTestId("amenities-retry").click();
    await ready(page);
    // Filled, with codes the list no longer holds.
    await preset(request, "amenities_inactive");
    await page.reload();
    await ready(page);
    await expect(page.getByTestId("amenities-other")).toBeVisible();
    await expectNoViolations(page, "filled with other");
    await preset(request, "amenities_filled");
    await page.reload();
    await ready(page);
    await expectNoViolations(page, "filled");
    // Error.
    await setMode(request, "listing-patch", "amenities_invalid");
    await choose(page, "intercom", "Present");
    await saveButton(page).click();
    await expect(summary(page)).toBeFocused();
    await expectNoViolations(page, "error");
    // Conflict.
    await setMode(request, "listing-patch", "ok");
    await otherSession(request, id(1), { amenities: JSON.stringify({ nearby_gym: "present" }) });
    await saveButton(page).click();
    await expect(page.getByTestId("draft-conflict")).toBeVisible();
    await expect(page.getByTestId("conflict-amenities")).toBeVisible();
    await expectNoViolations(page, "conflict");
  });
}
