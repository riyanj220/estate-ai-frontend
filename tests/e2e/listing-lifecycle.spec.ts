import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Story 2.17, frontend half: My listings grouped by status (tabs, live counts, the address), the Listing page per status (the Published
// editor with the identity fields read only, the Archived editor, the view-only statuses), and the Archive / Mark as sold / Mark as rented
// actions with their confirmation, all against the stub backend, which mirrors the backend's lifecycle rules (transition table, purpose
// rule, edit rules, Suspended limits, counts, status filter).
const STUB = STUB_URL;
const APP = APP_URL;
const LIST = "/account/listings";
const SERVER = "Something went wrong on our side. Please try again in a moment.";
const THROTTLED = "Too many attempts. Try again in 2 minutes.";
const NOT_FOUND = "We could not find that listing.";
const IDENTITY_NOTE = "These details cannot be changed while the listing is published.";
const id = (seq: number) => `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`;

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

type Mode = "signin" | "listing-status" | "listing-counts" | "listing-detail" | "listings" | "listing-patch" | "image";
const setMode = (request: APIRequestContext, kind: Mode, value: string) => request.get(`${STUB}/__${kind}-mode?value=${value}`);
const preset = (request: APIRequestContext, value: string) => request.get(`${STUB}/__listings-preset?value=${value}`);
const stats = async (request: APIRequestContext) => (await request.get(`${STUB}/__listings-stats`)).json();
type Attempt = { id: string; token: string | null; body: { base_revision: number; status: string } };
const statusStats = async (request: APIRequestContext): Promise<{ attempts: Attempt[]; countsGets: number }> => (await request.get(`${STUB}/__listing-status-stats`)).json();
const lifecycle = (request: APIRequestContext, seq: number, changes: Record<string, string>) =>
  request.get(`${STUB}/__listing-lifecycle?${new URLSearchParams({ id: id(seq), ...changes }).toString()}`);

async function startSession(page: Page, request: APIRequestContext) {
  await request.get(`${STUB}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP }]);
}

// ---------------------------------------------------------------- helpers: My listings
const tabs = (page: Page) => page.getByRole("tab");
const tab = (page: Page, status: string) => page.getByTestId(`tab-${status}`);
const items = (page: Page) => page.getByTestId("listing");
async function openList(page: Page, request: APIRequestContext, which: string, query = "") {
  await preset(request, which);
  await startSession(page, request);
  await page.goto(`${LIST}${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "My listings" })).toBeVisible();
}
async function expectSelected(page: Page, status: string) {
  await expect(tab(page, status)).toHaveAttribute("aria-selected", "true");
  await expect(tabs(page).and(page.locator('[aria-selected="true"]'))).toHaveCount(1);
}

// ---------------------------------------------------------------- helpers: the Listing page
const statusLine = (page: Page) => page.getByTestId("draft-status");
const live = (page: Page) => page.getByTestId("status-live");
const dialog = (page: Page, name: string) => page.getByRole("dialog", { name });
const confirm = (page: Page) => page.getByTestId("status-confirm");
async function openListing(page: Page, request: APIRequestContext, which: string, seq = 1) {
  await preset(request, which);
  await startSession(page, request);
  await page.goto(`${LIST}/${id(seq)}`);
  await expect(page.getByRole("heading", { level: 1, name: /^(Draft|Listing)$/ })).toBeVisible();
  await expect(statusLine(page)).toBeVisible();
}
/** An identity field of a Published listing: read only (never disabled, so it stays reachable and is announced), described by the note. */
async function expectLocked(page: Page, name: string) {
  const field = page.getByLabel(name, { exact: true });
  await expect(field, name).toHaveAttribute("aria-readonly", "true");
  await expect(field, name).toBeEnabled();
  await expect(field, name).toHaveAccessibleDescription(new RegExp(IDENTITY_NOTE));
}
async function archive(page: Page) {
  await page.getByTestId("status-archived").click();
  await confirm(page).click();
}

async function expectNoViolations(page: Page, label: string) {
  // The tab title is the page's own: "Draft | EstateAI" for a draft, "Listing | EstateAI" for every other status, "My listings | EstateAI" in the list.
  if (new URL(page.url()).pathname === LIST) await expect(page).toHaveTitle("My listings | EstateAI");
  else {
    await expect(statusLine(page)).toBeVisible();
    await expect(page).toHaveTitle((await statusLine(page).innerText()) === "Draft" ? "Draft | EstateAI" : "Listing | EstateAI");
  }
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}
const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];

// ================================================================ My listings: the tabs

test("tabs: one tab per status with its live count; Published opens first and lists only its own @smoke", async ({ page, request }) => {
  await openList(page, request, "lifecycle");
  await expect(page.getByRole("tablist", { name: "Listing status" })).toBeVisible();
  await expect(tabs(page)).toHaveText(["Draft (2)", "Published (3)", "Archived (1)", "Sold (1)", "Rented (1)", "Removed (1)"]);
  await expectSelected(page, "published");
  await expect(items(page)).toHaveCount(3);
  await expect(page.locator(".status-marker")).toHaveText(["Published", "Published", "Published"]);
  // Each row keeps the open link and the Preview link.
  await expect(items(page).first().getByRole("link").first()).toHaveAttribute("href", `${LIST}/${id(5)}`);
  await expect(items(page).first().getByTestId("listing-preview-link")).toHaveAttribute("href", `${LIST}/${id(5)}/preview`);
  expect((await stats(request)).queries).toEqual(["?status=published"]);
  // The panel is the tab's panel.
  await expect(page.getByRole("tabpanel")).toHaveAccessibleName("Published (3)");
});

test("tabs: choosing a tab lists that status, keeps it in the address and Back returns to the tab before", async ({ page, request }) => {
  await openList(page, request, "lifecycle");
  await tab(page, "draft").click();
  await expect(page).toHaveURL(/\/account\/listings\?status=draft$/);
  await expectSelected(page, "draft");
  await expect(items(page)).toHaveCount(2);
  await expect(page.locator(".status-marker")).toHaveText(["Draft", "Draft"]);
  await expect(page.getByTestId("listings-status")).toHaveText("Showing draft listings.");
  await tab(page, "removed").click();
  await expect(page).toHaveURL(/status=removed$/);
  await expect(items(page)).toHaveCount(1);
  await expect(page.locator(".status-marker")).toHaveText("Removed");
  await page.goBack();
  await expect(page).toHaveURL(/status=draft$/);
  await expectSelected(page, "draft");
  await expect(items(page)).toHaveCount(2);
  await page.goBack();
  await expect(page).toHaveURL(/\/account\/listings$/);
  await expectSelected(page, "published");
  await expect(items(page)).toHaveCount(3);
  await page.goForward();
  await expectSelected(page, "draft");
});

test("tabs: the address names the tab; a reload keeps it; an unknown value opens the default", async ({ page, request }) => {
  await openList(page, request, "lifecycle", "?status=sold");
  await expectSelected(page, "sold");
  await expect(items(page)).toHaveCount(1);
  await expect(page.locator(".status-marker")).toHaveText("Sold");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "My listings" })).toBeVisible();
  await expectSelected(page, "sold");
  await expect(items(page)).toHaveCount(1);
  expect(((await stats(request)).queries as string[]).at(-1)).toBe("?status=sold");
  await page.goto(`${LIST}?status=bogus`);
  await expectSelected(page, "published");
  await expect(items(page)).toHaveCount(3);
  await page.goto(`${LIST}?status=SOLD`);
  await expectSelected(page, "published");
});

test("tabs: without a choice the first tab that is not empty opens, in the order Published, Draft, Archived, Sold, Rented, Removed", async ({ page, request }) => {
  await openList(page, request, "lifecycle_no_published");
  await expectSelected(page, "draft");
  await expect(items(page)).toHaveCount(2);
  await expect(tabs(page)).toHaveText(["Draft (2)", "Published (0)", "Archived (1)", "Sold (0)", "Rented (0)", "Removed (0)"]);
  await openList(page, request, "lifecycle_only_removed");
  await expectSelected(page, "removed");
  await expect(items(page)).toHaveCount(1);
});

test("tabs: a tab with nothing in it says so, and the tabs stay", async ({ page, request }) => {
  await openList(page, request, "lifecycle_no_published");
  await tab(page, "published").click();
  await expect(page.getByTestId("listings-tab-empty")).toHaveText("You have no published listings.");
  await expect(items(page)).toHaveCount(0);
  await expectSelected(page, "published");
  await tab(page, "sold").click();
  await expect(page.getByTestId("listings-tab-empty")).toHaveText("You have no sold listings.");
});

test("tabs: an account with no listings sees the one empty state and no tabs", async ({ page, request }) => {
  await openList(page, request, "empty");
  await expect(page.getByTestId("listings-empty")).toContainText("You have no listings yet.");
  await expect(tabs(page)).toHaveCount(0);
});

test("tabs: each tab has its own load more (the status stays in the cursor request)", async ({ page, request }) => {
  await openList(page, request, "published_many");
  await expect(items(page)).toHaveCount(20);
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(items(page)).toHaveCount(25);
  await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);
  expect((await stats(request)).queries).toEqual(["?status=published", "?status=published&cursor=pos-6"]);
  await expect(tabs(page)).toHaveText(["Draft (0)", "Published (25)", "Archived (0)", "Sold (0)", "Rented (0)", "Removed (0)"]);
});

test("tabs: arrow keys, Home and End move between the tabs and Enter opens the focused one", async ({ page, request }) => {
  await openList(page, request, "lifecycle");
  await tab(page, "published").focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab(page, "archived")).toBeFocused();
  await expect(tab(page, "published")).toHaveAttribute("aria-selected", "true"); // moving the focus does not open it
  await page.keyboard.press("End");
  await expect(tab(page, "removed")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(tab(page, "draft")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tab(page, "removed")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(tab(page, "draft")).toBeFocused();
  await page.keyboard.press("Enter");
  await expectSelected(page, "draft");
  await expect(items(page)).toHaveCount(2);
  await tab(page, "sold").focus();
  await page.keyboard.press("Space");
  await expectSelected(page, "sold");
  await expect(items(page)).toHaveCount(1);
  await tab(page, "draft").focus();
  await page.keyboard.press("Enter");
  // Only the selected tab is in the tab order.
  await expect(tab(page, "draft")).toHaveAttribute("tabindex", "0");
  await expect(tab(page, "published")).toHaveAttribute("tabindex", "-1");
});

test("tabs: counts that cannot be read leave the tabs without numbers and Published open", async ({ page, request }) => {
  await setMode(request, "listing-counts", "error");
  await openList(page, request, "lifecycle");
  await expect(tabs(page)).toHaveText(["Draft", "Published", "Archived", "Sold", "Rented", "Removed"]);
  await expectSelected(page, "published");
  await expect(items(page)).toHaveCount(3);
  await setMode(request, "listing-counts", "malformed");
  await page.reload();
  await expect(tabs(page)).toHaveText(["Draft", "Published", "Archived", "Sold", "Rented", "Removed"]);
});

test("tabs: a failed list read shows the load error with Retry; the other tabs still work", async ({ page, request }) => {
  await setMode(request, "listings", "flaky");
  await openList(page, request, "lifecycle");
  await expect(page.getByTestId("load-error-message")).toBeVisible();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(items(page)).toHaveCount(3);
});

test("tabs: a tab that fails to load keeps the tabs on screen with the error and Retry in the panel", async ({ page, request }) => {
  await openList(page, request, "lifecycle");
  await expect(items(page)).toHaveCount(3);
  await setMode(request, "listings", "flaky"); // the next list read (the Draft tab) fails once
  await tab(page, "draft").click();
  await expect(page.getByTestId("listings-panel").getByTestId("load-error-message")).toBeVisible();
  await expect(tabs(page)).toHaveText(["Draft (2)", "Published (3)", "Archived (1)", "Sold (1)", "Rented (1)", "Removed (1)"]);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(items(page)).toHaveCount(2);
  await expectSelected(page, "draft");
  // Another tab can be chosen while the failure shows.
  await setMode(request, "listings", "flaky");
  await tab(page, "sold").click();
  await expect(page.getByTestId("load-error-message")).toBeVisible();
  await tab(page, "archived").click();
  await expect(items(page)).toHaveCount(1);
  await expect(page.getByTestId("load-error-message")).toHaveCount(0);
});

test("tabs: a load more still running when another tab is chosen is dropped (no announcement, no focus move)", async ({ page, request }) => {
  await openList(page, request, "published_many_and_draft");
  await expect(items(page)).toHaveCount(20);
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/api\/v1\/me\/listings\?.*cursor=/, async (route) => {
    await gate;
    await route.continue();
  });
  await page.getByRole("button", { name: "Load more" }).click();
  await tab(page, "draft").click();
  await expect(items(page)).toHaveCount(1);
  await tab(page, "draft").focus();
  release();
  await page.waitForTimeout(600);
  await expect(items(page)).toHaveCount(1);
  await expect(page.getByTestId("listings-status")).toHaveText("Showing draft listings.");
  await expect(tab(page, "draft")).toBeFocused();
  await page.unroute(/\/api\/v1\/me\/listings\?.*cursor=/);
});

test("tabs: counts that never answer time out; the tabs show no numbers and Published opens", async ({ page, request }) => {
  await setMode(request, "listing-counts", "hang");
  await preset(request, "lifecycle");
  await startSession(page, request);
  await page.clock.install();
  await page.goto(LIST);
  await expect.poll(async () => (await statusStats(request)).countsGets).toBe(1);
  await page.clock.runFor(21_000);
  await expect(items(page)).toHaveCount(3);
  await expect(tabs(page)).toHaveText(["Draft", "Published", "Archived", "Sold", "Rented", "Removed"]);
  await expectSelected(page, "published");
});

test("tabs: a refused counts read is the same unavailable answer as the list", async ({ page, request }) => {
  await setMode(request, "listing-counts", "forbidden");
  await openList(page, request, "lifecycle");
  await expect(page.getByTestId("listings-unavailable")).toBeVisible();
  await expect(tabs(page)).toHaveCount(0);
});

for (const viewport of viewports) {
  test(`tabs: no accessibility violations (${viewport.name})`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openList(page, request, "lifecycle");
    await expectNoViolations(page, `published tab ${viewport.name}`);
    await tab(page, "removed").click();
    await expect(items(page)).toHaveCount(1);
    await expectNoViolations(page, `removed tab ${viewport.name}`);
    await openList(page, request, "lifecycle_no_published");
    await tab(page, "sold").click();
    await expect(page.getByTestId("listings-tab-empty")).toBeVisible();
    await expectNoViolations(page, `empty tab ${viewport.name}`);
  });
}

// ================================================================ the Listing page per status

test("Published: the editor works, the identity fields are read only with the note, and a save sends only what changed @smoke", async ({ page, request }) => {
  await openListing(page, request, "published_sale");
  await expect(page.getByRole("heading", { level: 1, name: "Listing" })).toBeVisible();
  await expect(statusLine(page)).toHaveText("Published");
  await expect(page.getByTestId("identity-note")).toHaveText(IDENTITY_NOTE);
  // The registry's identity flag decides: city, locality, area value, unit and marla basis are shown but cannot be changed.
  for (const name of ["City", "Locality", "Area value", "Unit", "Marla basis"]) {
    await expectLocked(page, name);
  }
  // A read only text control cannot be typed into, and a select keeps its value.
  await expect(page.getByLabel("Area value", { exact: true })).toHaveAttribute("readonly", "");
  await page.getByLabel("City", { exact: true }).selectOption({ index: 2 }).catch(() => undefined);
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("11111111-1111-4111-8111-111111111111");
  await page.getByLabel("Area value", { exact: true }).press("1");
  await expect(page.getByLabel("Area value", { exact: true })).toHaveValue("10.0000");
  await expect(page.getByLabel("Title", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("Asking price", { exact: true })).toBeEnabled();
  // The editor stays: images, details, Save. There is no Publish, no Delete.
  await expect(page.getByTestId("images-section")).toBeVisible();
  await expect(page.getByTestId("publish-section")).toHaveCount(0);
  await expect(page.getByTestId("delete-draft")).toHaveCount(0);
  await expect(page.getByTestId("draft-not-editable")).toHaveCount(0);
  await page.getByLabel("Title", { exact: true }).fill("Corner house with a bigger garden");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  await expect(page.getByTestId("draft-revision")).toHaveText("5");
  await expect(statusLine(page)).toHaveText("Published");
  const patch = await (await request.get(`${STUB}/__listing-patch-stats`)).json();
  expect(patch.bodies).toEqual([{ base_revision: 4, fields: { title: "Corner house with a bigger garden" } }]);
});

test("Published: an identity field typed before the Listing was published is dropped and locked (a stale save)", async ({ page, request }) => {
  await openListing(page, request, "archived_one");
  await expect(page.getByLabel("Area value", { exact: true })).toBeEnabled();
  await page.getByLabel("Area value", { exact: true }).fill("12");
  // Another session publishes it meanwhile: the next save does not go through, the page reads the Listing again and locks the field.
  await lifecycle(request, 1, { status: "published" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("draft-conflict")).toBeVisible();
  await expect(statusLine(page)).toHaveText("Published");
  await expectLocked(page, "Area value");
  await expect(page.getByLabel("Area value", { exact: true })).toHaveValue("10.0000");
  await expect(page.getByTestId("identity-note")).toHaveText(IDENTITY_NOTE);
  // Nothing typed there remains to be saved.
  await expect(page.getByTestId("preview-hint")).toHaveCount(0);
});

test("Published: an edit that would leave the listing invalid is refused with every problem and nothing changes", async ({ page, request }) => {
  await openListing(page, request, "published_sale");
  await page.getByLabel("Title", { exact: true }).fill("");
  await page.getByLabel("Asking price", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save changes" }).click();
  const summary = page.getByRole("group", { name: "There is a problem" });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("Title");
  await expect(summary).toContainText("Asking price");
  await expect(page.locator("#title-error")).toContainText("Enter a title.");
  await expect(page.locator("#asking_price-error")).toContainText("Enter an asking price.");
  await expect(page.getByTestId("draft-revision")).toHaveText("4");
  await expect(statusLine(page)).toHaveText("Published");
  const listings = (await stats(request)).listings as { revision: number; status: string; fields: { title: string } }[];
  expect(listings[0].revision).toBe(4);
  expect(listings[0].fields.title).toBe("Corner house with garden");
  // Typing a title clears its own error; the rest stay until fixed.
  await page.getByLabel("Title", { exact: true }).fill("Corner house with a bigger garden");
  await expect(page.locator("#title-error")).toHaveCount(0);
  await page.getByLabel("Asking price", { exact: true }).fill("1600000");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
});

test("Published: the last image cannot be deleted; the control says why and nothing is sent", async ({ page, request }) => {
  await openListing(page, request, "published_one_image");
  await expect(page.getByTestId("images-last-note")).toHaveText("A published listing needs at least one image, so its last image cannot be deleted.");
  const remove = page.getByRole("button", { name: /^Delete image 1 of 1/ });
  await expect(remove).toHaveAttribute("aria-disabled", "true");
  await expect(remove).toHaveAccessibleDescription(/last image cannot be deleted/);
  await remove.click({ force: true });
  await expect(page.getByTestId("image-confirm")).toHaveCount(0);
  const images = await (await request.get(`${STUB}/__image-stats`)).json();
  expect(images.deletes).toEqual([]);
});

test("Published: a refused last-image delete from a stale page shows the backend's words", async ({ page, request }) => {
  await openListing(page, request, "archived_one");
  // Two images when the page loaded; the other session removed one and published it, so the page still offers Delete.
  await request.get(`${STUB}/__other-images?id=${id(1)}&op=delete_first`);
  await lifecycle(request, 1, { status: "published" });
  await page.getByRole("button", { name: /^Delete image 2 of 2/ }).click();
  await page.getByRole("button", { name: /^Yes, delete/ }).click();
  await expect(page.getByTestId("images-notice")).toHaveText("Add at least one image.");
  const images = await (await request.get(`${STUB}/__image-stats`)).json();
  expect(images.images[id(1)].images).toHaveLength(1);
});

test("Archived: everything is editable, identity fields included, with a Republish section", async ({ page, request }) => {
  await openListing(page, request, "archived_one");
  await expect(page.getByRole("heading", { level: 1, name: "Listing" })).toBeVisible();
  await expect(statusLine(page)).toHaveText("Archived");
  await expect(page.getByTestId("archived-note")).toHaveText("This listing is archived and not visible to the public. Use the Republish section below to make it visible again.");
  await expect(page.getByTestId("identity-note")).toHaveCount(0);
  for (const name of ["City", "Locality", "Area value", "Unit"]) await expect(page.getByLabel(name, { exact: true }), name).toBeEnabled();
  await expect(page.getByTestId("images-section")).toBeVisible();
  // Republish instead of Publish, no Delete, no status actions.
  await expect(page.getByTestId("republish-section")).toBeVisible();
  await expect(page.getByTestId("publish-section")).toHaveCount(0);
  await expect(page.getByTestId("delete-draft")).toHaveCount(0);
  await expect(page.getByTestId("status-section")).toHaveCount(0);
  await page.getByLabel("Area value", { exact: true }).fill("12");
  await page.getByLabel("Title", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save changes" }).click();
  // Judged like a Draft edit: clearing the title is allowed while archived.
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  await expect(page.getByTestId("draft-area")).toContainText("12 Marla");
  const patch = await (await request.get(`${STUB}/__listing-patch-stats`)).json();
  expect(patch.bodies).toEqual([{ base_revision: 4, fields: { title: null, area_value: "12" } }]);
  // The last image may be deleted while archived.
  await expect(page.getByTestId("images-last-note")).toHaveCount(0);
});

for (const [which, label, note] of [
  ["sold_one", "Sold", "This listing is sold. It is view only and cannot be edited."],
  ["rented_one", "Rented", "This listing is rented. It is view only and cannot be edited."],
  ["removed_one", "Removed", "This listing was removed. It is view only and cannot be changed."],
  ["restricted_one", "Published", "This listing is restricted. It is not visible to the public and is view only: it cannot be edited."],
] as const) {
  test(`view only: a ${which.replace("_one", "").replace("_", " ")} listing shows the note and no editing controls`, async ({ page, request }) => {
    await openListing(page, request, which);
    await expect(page.getByRole("heading", { level: 1, name: "Listing" })).toBeVisible();
    await expect(statusLine(page)).toHaveText(label);
    await expect(page.getByTestId("draft-not-editable")).toContainText(note);
    await expect(page.getByRole("button", { name: /^Save changes/ })).toHaveCount(0);
    await expect(page.getByLabel("Title", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("images-section")).toHaveCount(0);
    await expect(page.getByTestId("delete-draft")).toHaveCount(0);
    await expect(page.getByTestId("publish-section")).toHaveCount(0);
    // The summary and the Preview link remain.
    await expect(page.getByTestId("draft-price")).toHaveText("PKR 1,500,000.00");
    await expect(page.getByTestId("draft-preview-link")).toBeVisible();
  });
}

test("view only: the reason is shown for a removed and a restricted listing, and for no other", async ({ page, request }) => {
  await openListing(page, request, "removed_one");
  await expect(page.getByTestId("restriction-reason")).toHaveText("Reason: Removed after a report about the photos.");
  await openListing(page, request, "restricted_one");
  await expect(page.getByTestId("restriction-reason")).toHaveText("Reason: Under review: the price looks wrong.");
  await openListing(page, request, "sold_one");
  await expect(page.getByTestId("restriction-reason")).toHaveCount(0);
});

test("view only: a removed listing has no actions; a restricted one may only be archived", async ({ page, request }) => {
  await openListing(page, request, "removed_one");
  await expect(page.getByTestId("status-section")).toHaveCount(0);
  await openListing(page, request, "restricted_one");
  await expect(page.getByTestId("status-archived")).toBeVisible();
  await expect(page.getByTestId("status-sold")).toHaveCount(0);
  await expect(page.getByTestId("status-rented")).toHaveCount(0);
  await archive(page);
  await expect(statusLine(page)).toHaveText("Archived");
  // A restricted listing stays view only after it is archived.
  await expect(page.getByTestId("draft-not-editable")).toContainText("restricted");
  await expect(page.getByTestId("restriction-reason")).toBeVisible();
});

test("a draft keeps its Publish and Delete sections, has no status actions, and its heading and title say Draft", async ({ page, request }) => {
  await openListing(page, request, "publish_ready");
  await expect(page.getByRole("heading", { level: 1, name: "Draft" })).toBeVisible();
  await expect(page).toHaveTitle("Draft | EstateAI");
  await expect(page.getByTestId("status-section")).toHaveCount(0);
  await expect(page.getByTestId("publish-section")).toBeVisible();
  await expect(page.getByTestId("delete-draft")).toBeVisible();
});

test("titles: a published listing is never called a draft, in the heading or the tab title, before or after it loads", async ({ page, request }) => {
  await preset(request, "published_sale");
  await startSession(page, request);
  await setMode(request, "listing-detail", "flaky"); // the first read fails: the neutral loading and error states
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByTestId("load-error-message")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Listing");
  await expect(page).toHaveTitle("Listing | EstateAI");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(statusLine(page)).toHaveText("Published");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Listing");
  await expect(page).toHaveTitle("Listing | EstateAI");
  await openListing(page, request, "removed_one");
  await expect(page).toHaveTitle("Listing | EstateAI");
  await page.goto(`${LIST}/${id(99)}`);
  await expect(page.getByTestId("draft-not-found")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Listing");
  await expect(page).toHaveTitle("Listing | EstateAI");
});

test("Back to My listings returns to the tab of the listing's status", async ({ page, request }) => {
  await openListing(page, request, "sold_one");
  await expect(page.getByRole("link", { name: "Back to My listings" })).toHaveAttribute("href", `${LIST}?status=sold`);
  await page.getByRole("link", { name: "Back to My listings" }).click();
  await expectSelected(page, "sold");
  await expect(items(page)).toHaveCount(1);
  await openListing(page, request, "publish_ready");
  await expect(page.getByRole("link", { name: "Back to My listings" })).toHaveAttribute("href", `${LIST}?status=draft`);
});

test("a restricted Draft is view only: no Publish and no Delete under the note", async ({ page, request }) => {
  await openListing(page, request, "restricted_draft");
  await expect(page.getByTestId("draft-not-editable")).toContainText("restricted");
  await expect(page.getByTestId("restriction-reason")).toHaveText("Reason: Under review.");
  await expect(page.getByTestId("publish-section")).toHaveCount(0);
  await expect(page.getByTestId("delete-draft")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Save changes/ })).toHaveCount(0);
});

test("view only: a restricted Sold listing can still be archived by its owner", async ({ page, request }) => {
  await openListing(page, request, "restricted_sold");
  await expect(page.getByTestId("draft-not-editable")).toContainText("restricted");
  await expect(page.getByTestId("status-section").getByRole("button")).toHaveText(["Archive"]);
  await archive(page);
  await expect(statusLine(page)).toHaveText("Archived");
});

test("stale save: a listing sold meanwhile is shown view only and the lost changes are said to be lost", async ({ page, request }) => {
  await openListing(page, request, "published_sale");
  await page.getByLabel("Title", { exact: true }).fill("Corner house with a bigger garden");
  await lifecycle(request, 1, { status: "sold" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(statusLine(page)).toHaveText("Sold");
  await expect(live(page)).toHaveText("This listing is now sold and can no longer be edited. Your unsaved changes could not be kept.");
  await expect(live(page)).toBeFocused();
  await expect(page.getByTestId("draft-not-editable")).toContainText("This listing is sold.");
  await expect(page.getByLabel("Title", { exact: true })).toHaveCount(0);
});

test("stale save: a listing restricted meanwhile is shown view only with its reason", async ({ page, request }) => {
  await openListing(page, request, "published_sale");
  await page.getByLabel("Title", { exact: true }).fill("Corner house with a bigger garden");
  await lifecycle(request, 1, { restricted: "1", reason: "Under review: the price looks wrong." });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(live(page)).toHaveText("This listing is now restricted and can no longer be edited. Your unsaved changes could not be kept.");
  await expect(page.getByTestId("restriction-reason")).toHaveText("Reason: Under review: the price looks wrong.");
  await expect(page.getByTestId("status-section").getByRole("button")).toHaveText(["Archive"]);
});

test("a refused image action on a page that went stale reads the listing again and explains", async ({ page, request }) => {
  await openListing(page, request, "published_sale");
  await lifecycle(request, 1, { status: "sold" });
  await page.getByRole("button", { name: /^Delete image 1 of 2/ }).click();
  await page.getByRole("button", { name: /^Yes, delete/ }).click();
  await expect(statusLine(page)).toHaveText("Sold");
  await expect(live(page)).toHaveText("This listing is now sold and can no longer be edited.");
  await expect(page.getByTestId("images-section")).toHaveCount(0);
});

test("a delete refused because the listing is no longer a draft keeps what was typed when it can still be edited", async ({ page, request }) => {
  await setMode(request, "listing-detail", "ok");
  await openListing(page, request, "publish_ready");
  await page.getByLabel("Title", { exact: true }).fill("Corner house with a bigger garden");
  await request.get(`${STUB}/__listing-delete-mode?value=conflict`);
  await page.getByTestId("delete-draft").click();
  await page.getByTestId("delete-confirm").click();
  await expect(statusLine(page)).toHaveText("Published");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Corner house with a bigger garden");
  await expect(page.getByTestId("identity-note")).toBeVisible();
});

test("a delete refused because the listing was sold meanwhile explains that the typed changes could not be kept", async ({ page, request }) => {
  await openListing(page, request, "publish_ready");
  await page.getByLabel("Title", { exact: true }).fill("Corner house with a bigger garden");
  await lifecycle(request, 1, { status: "sold" });
  await page.getByTestId("delete-draft").click();
  await page.getByTestId("delete-confirm").click();
  await expect(statusLine(page)).toHaveText("Sold");
  await expect(live(page)).toHaveText("This listing is now sold and can no longer be edited. Your unsaved changes could not be kept.");
});

test("Published: a save that would leave it without an image shows the backend's refusal next to the images and in the summary", async ({ page, request }) => {
  await openListing(page, request, "published_one_image");
  await request.get(`${STUB}/__other-images?id=${id(1)}&op=delete_first`); // another session removed the only image
  await page.getByLabel("Title", { exact: true }).fill("Corner house with a bigger garden");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("draft-conflict")).toBeVisible(); // the stale save loads the latest (no image) beside what was typed
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("group", { name: "There is a problem" })).toContainText("Images: Add at least one image.");
  await expect(page.getByTestId("images-publish-error")).toContainText("Add at least one image.");
  const listings = (await stats(request)).listings as { fields: { title: string } }[];
  expect(listings[0].fields.title).toBe("Corner house with garden");
});

// ================================================================ the actions

test("actions: a Published sale listing offers Archive and Mark as sold; a rent listing Archive and Mark as rented", async ({ page, request }) => {
  await openListing(page, request, "published_sale");
  const section = page.getByTestId("status-section");
  await expect(section.getByRole("heading", { level: 2, name: "Change the status" })).toBeVisible();
  await expect(section.getByRole("button")).toHaveText(["Archive", "Mark as sold"]);
  await openListing(page, request, "published_rent");
  await expect(section.getByRole("button")).toHaveText(["Archive", "Mark as rented"]);
});

test("actions: Sold and Rented listings offer only Archive", async ({ page, request }) => {
  await openListing(page, request, "sold_one");
  await expect(page.getByTestId("status-section").getByRole("button")).toHaveText(["Archive"]);
  await openListing(page, request, "rented_one");
  await expect(page.getByTestId("status-section").getByRole("button")).toHaveText(["Archive"]);
});

test("actions: an Email-unverified owner has every action; a Suspended owner may only archive", async ({ page, request }) => {
  await setMode(request, "signin", "unverified");
  await openListing(page, request, "published_sale");
  await expect(page.getByTestId("status-section").getByRole("button")).toHaveText(["Archive", "Mark as sold"]);
  await setMode(request, "signin", "suspended");
  await openListing(page, request, "published_sale");
  await expect(page.getByTestId("status-section").getByRole("button")).toHaveText(["Archive"]);
  await openListing(page, request, "published_rent");
  await expect(page.getByTestId("status-section").getByRole("button")).toHaveText(["Archive"]);
  // A Suspended owner archives; the page then shows the Archived listing.
  await archive(page);
  await expect(statusLine(page)).toHaveText("Archived");
  expect((await statusStats(request)).attempts.map((attempt) => attempt.body.status)).toEqual(["archived"]);
});

test("a Suspended owner can archive a Sold listing", async ({ page, request }) => {
  await setMode(request, "signin", "suspended");
  await openListing(page, request, "sold_one");
  await expect(page.getByTestId("status-section").getByRole("button")).toHaveText(["Archive"]);
  await archive(page);
  await expect(statusLine(page)).toHaveText("Archived");
  expect((await statusStats(request)).attempts[0].body).toEqual({ base_revision: 4, status: "archived" });
});

test("Archive: the dialog says what it does; Cancel and Escape change nothing and return the focus @smoke", async ({ page, request }) => {
  await openListing(page, request, "published_sale");
  const button = page.getByTestId("status-archived");
  await button.click();
  const box = dialog(page, "Archive this listing?");
  await expect(box).toBeVisible();
  await expect(box).toContainText("Archiving removes this listing from public view.");
  await expect(box).toContainText("You can republish it later, which may use one of your monthly publications.");
  await expect(page.getByTestId("status-cancel")).toBeFocused();
  await page.getByTestId("status-cancel").click();
  await expect(box).toBeHidden();
  await expect(button).toBeFocused();
  await button.click();
  await expect(box).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(box).toBeHidden();
  await expect(button).toBeFocused();
  expect((await statusStats(request)).attempts).toEqual([]);
  await expect(statusLine(page)).toHaveText("Published");
});

test("Archive: a Sold listing's dialog does not claim to hide what is already hidden", async ({ page, request }) => {
  await openListing(page, request, "sold_one");
  await page.getByTestId("status-archived").click();
  const box = dialog(page, "Archive this listing?");
  await expect(box).toContainText("It is already hidden from the public.");
  await expect(box).not.toContainText("removes this listing from public view");
});

test("Archive: Tab stays between the two buttons of the dialog", async ({ page, request }) => {
  await openListing(page, request, "published_sale");
  await page.getByTestId("status-archived").click();
  await expect(page.getByTestId("status-cancel")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirm(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("status-cancel")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(confirm(page)).toBeFocused();
});

test("Archive: confirming sends the status with the CSRF token and the revision, then the page shows the Archived listing @smoke", async ({ page, request }) => {
  await openListing(page, request, "published_sale");
  await archive(page);
  await expect(statusLine(page)).toHaveText("Archived");
  await expect(live(page)).toHaveText("The listing is archived. It is no longer visible to the public.");
  await expect(live(page)).toHaveAttribute("role", "status");
  await expect(live(page)).toBeFocused();
  await expect(page.getByTestId("draft-revision")).toHaveText("5");
  await expect(page.getByRole("heading", { level: 1, name: "Listing" })).toBeVisible();
  // The page is now the Archived one: no actions, the archived note, identity fields editable.
  await expect(page.getByTestId("status-section")).toHaveCount(0);
  await expect(page.getByTestId("archived-note")).toBeVisible();
  await expect(page.getByLabel("Area value", { exact: true })).toBeEnabled();
  const { attempts } = await statusStats(request);
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toEqual({ id: id(1), token: "csrf-0", body: { base_revision: 4, status: "archived" } });
});

test("Mark as sold: the dialog explains it, the status becomes Sold and the page turns view only", async ({ page, request }) => {
  await openListing(page, request, "published_sale");
  await page.getByTestId("status-sold").click();
  const box = dialog(page, "Mark this listing as sold?");
  await expect(box).toContainText("records it as sold");
  await confirm(page).click();
  await expect(statusLine(page)).toHaveText("Sold");
  await expect(live(page)).toHaveText("The listing is marked as sold. It is no longer visible to the public.");
  await expect(page.getByTestId("draft-not-editable")).toContainText("This listing is sold.");
  await expect(page.getByRole("button", { name: /^Save changes/ })).toHaveCount(0);
  await expect(page.getByTestId("images-section")).toHaveCount(0);
  expect((await statusStats(request)).attempts[0].body).toEqual({ base_revision: 4, status: "sold" });
  // Sold can still be archived.
  await expect(page.getByTestId("status-section").getByRole("button")).toHaveText(["Archive"]);
  await archive(page);
  await expect(statusLine(page)).toHaveText("Archived");
  expect((await statusStats(request)).attempts[1].body).toEqual({ base_revision: 5, status: "archived" });
});

test("Mark as rented: the status becomes Rented and the page turns view only", async ({ page, request }) => {
  await openListing(page, request, "published_rent");
  await page.getByTestId("status-rented").click();
  await expect(dialog(page, "Mark this listing as rented?")).toContainText("records it as rented");
  await confirm(page).click();
  await expect(statusLine(page)).toHaveText("Rented");
  await expect(live(page)).toHaveText("The listing is marked as rented. It is no longer visible to the public.");
  await expect(page.getByTestId("draft-not-editable")).toContainText("This listing is rented.");
  expect((await statusStats(request)).attempts[0].body).toEqual({ base_revision: 4, status: "rented" });
});

test("counts: after an action My listings shows the new counts and the listing under its new tab", async ({ page, request }) => {
  await openListing(page, request, "lifecycle", 5);
  await page.getByTestId("status-rented").click();
  await confirm(page).click();
  await expect(statusLine(page)).toHaveText("Rented");
  await page.getByRole("link", { name: "Back to My listings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "My listings" })).toBeVisible();
  await expect(tabs(page)).toHaveText(["Draft (2)", "Published (2)", "Archived (1)", "Sold (1)", "Rented (2)", "Removed (1)"]);
  await tab(page, "rented").click();
  await expect(items(page)).toHaveCount(2);
});

test("unsaved changes: the actions wait with the reason and send nothing until the form is saved", async ({ page, request }) => {
  await openListing(page, request, "published_sale");
  await page.getByLabel("Title", { exact: true }).fill("Corner house with a bigger garden");
  const button = page.getByTestId("status-archived");
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("status-reason")).toHaveText("Save your changes before you change the status of this listing.");
  await expect(button).toHaveAccessibleDescription("Save your changes before you change the status of this listing.");
  await button.click({ force: true });
  await expect(dialog(page, "Archive this listing?")).toBeHidden();
  expect((await statusStats(request)).attempts).toEqual([]);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  await expect(button).not.toHaveAttribute("aria-disabled", "true");
  await archive(page);
  await expect(statusLine(page)).toHaveText("Archived");
  expect((await statusStats(request)).attempts[0].body.base_revision).toBe(5);
});

test("locks: while the status changes Save, the images and the other actions wait; the held answer then completes it", async ({ page, request }) => {
  await setMode(request, "listing-status", "hold");
  await openListing(page, request, "published_sale");
  await page.getByTestId("status-archived").click();
  await confirm(page).click();
  await expect(confirm(page)).toHaveText("Working…");
  await expect(confirm(page)).toHaveAttribute("aria-disabled", "true");
  // Escape does not close the dialog while the request runs.
  await page.keyboard.press("Escape");
  await expect(dialog(page, "Archive this listing?")).toBeVisible();
  // A second confirmation sends nothing.
  await confirm(page).click({ force: true });
  expect((await statusStats(request)).attempts).toHaveLength(1);
  await request.get(`${STUB}/__listing-status-release`);
  await expect(statusLine(page)).toHaveText("Archived");
  await expect(dialog(page, "Archive this listing?")).toBeHidden();
  expect((await statusStats(request)).attempts).toHaveLength(1);
});

test("locks: the form and the images are paused while the status changes, and an image action blocks the status change", async ({ page, request }) => {
  await setMode(request, "listing-status", "hold");
  await openListing(page, request, "published_sale");
  await page.getByTestId("status-sold").click();
  await confirm(page).click();
  await expect(page.getByTestId("status-paused")).toHaveText("Saving and image changes are paused while the status changes.");
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#images-add")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByLabel("Title", { exact: true })).toHaveAttribute("readonly", "");
  await request.get(`${STUB}/__listing-status-release`);
  await expect(statusLine(page)).toHaveText("Sold");
  // The other way round: an image upload that is running keeps the status change from starting.
  await setMode(request, "listing-status", "ok");
  await setMode(request, "image", "hold");
  await openListing(page, request, "published_sale");
  await page.locator("#images-add").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") });
  await expect(page.getByTestId("status-archived")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("status-reason")).toHaveText("Wait for the current save or image change to finish, then try again.");
  await page.getByTestId("status-archived").click({ force: true });
  await expect(dialog(page, "Archive this listing?")).toBeHidden();
  await request.get(`${STUB}/__image-release`);
  expect((await statusStats(request)).attempts).toHaveLength(1);
});

// ---------------------------------------------------------------- refusals and failures

test("stale revision: the usual conflict flow shows the latest data and nothing changes; the action then works", async ({ page, request }) => {
  await setMode(request, "listing-status", "stale");
  await openListing(page, request, "published_sale");
  await archive(page);
  await expect(page.getByTestId("draft-conflict")).toBeVisible();
  await expect(statusLine(page)).toHaveText("Published");
  await expect(page.getByTestId("draft-revision")).toHaveText("5");
  await expect(dialog(page, "Archive this listing?")).toBeHidden();
  await setMode(request, "listing-status", "ok");
  await archive(page);
  await expect(statusLine(page)).toHaveText("Archived");
  const { attempts } = await statusStats(request);
  expect(attempts.map((attempt) => attempt.body.base_revision)).toEqual([4, 5]);
});

test("stale revision: archived in another session while Mark as sold was asked: shown as archived, the move is said to be impossible", async ({ page, request }) => {
  await setMode(request, "listing-status", "stale_archived");
  await openListing(page, request, "published_sale");
  await page.getByTestId("status-sold").click();
  await confirm(page).click();
  await expect(statusLine(page)).toHaveText("Archived");
  await expect(live(page)).toHaveText("This listing is now archived, so it cannot be marked as sold any more. We loaded the latest version.");
  await expect(page.getByTestId("status-section")).toHaveCount(0);
});

test("stale revision: the same move already happened in another session: it is a success", async ({ page, request }) => {
  await setMode(request, "listing-status", "stale_archived");
  await openListing(page, request, "published_sale");
  await archive(page);
  await expect(statusLine(page)).toHaveText("Archived");
  await expect(live(page)).toHaveText("The listing is archived. It is no longer visible to the public.");
});

test("stale revision: sold in another session while Archive was asked: Archive is still possible and the page says what changed", async ({ page, request }) => {
  await setMode(request, "listing-status", "stale_sold");
  await openListing(page, request, "published_sale");
  await archive(page);
  await expect(statusLine(page)).toHaveText("Sold");
  await expect(live(page)).toHaveText("This listing was changed in another session and is now sold. We loaded the latest version: you can try again.");
  await expect(page.getByTestId("status-archived")).toBeVisible();
  await setMode(request, "listing-status", "ok");
  await archive(page);
  await expect(statusLine(page)).toHaveText("Archived");
});

test("stale revision without the current listing: the page reads it again and shows the conflict", async ({ page, request }) => {
  await setMode(request, "listing-status", "stale_no_current");
  await openListing(page, request, "published_sale");
  await archive(page);
  await expect(statusLine(page)).toHaveText("Published");
  await expect(page.getByTestId("draft-conflict").or(page.getByTestId("draft-notice"))).toBeVisible();
});

test("conflict: a move that is not allowed any more reads the listing again and explains", async ({ page, request }) => {
  await setMode(request, "listing-status", "conflict");
  await openListing(page, request, "published_sale");
  await page.getByTestId("status-sold").click();
  await confirm(page).click();
  await expect(statusLine(page)).toHaveText("Archived");
  await expect(live(page)).toHaveText("This listing is now archived, so it cannot be marked as sold any more. We loaded the latest version.");
  await expect(live(page)).toBeFocused();
  await expect(dialog(page, "Mark this listing as sold?")).toBeHidden();
  expect((await statusStats(request)).attempts).toHaveLength(1);
});

test("conflict: when the listing cannot be read again the page says to reload", async ({ page, request }) => {
  await setMode(request, "listing-status", "conflict_gone");
  await openListing(page, request, "published_sale");
  await setMode(request, "listing-detail", "error");
  await page.getByTestId("status-sold").click();
  await confirm(page).click();
  await expect(live(page)).toHaveText("This listing has changed. We could not load the latest version: reload the page.");
  await expect(statusLine(page)).toHaveText("Published"); // nothing was read, so the page is as it was
});

test("403: a refusal is shown in the dialog and on the page with Retry; Retry asks again", async ({ page, request }) => {
  await setMode(request, "listing-status", "forbidden");
  await openListing(page, request, "published_sale");
  await archive(page);
  await expect(page.getByTestId("status-error")).toHaveText("The status of this listing cannot be changed right now.");
  await expect(page.getByTestId("status-error")).toBeFocused();
  await expect(confirm(page)).toHaveText("Retry: Archive");
  await page.getByTestId("status-cancel").click();
  await expect(page.getByTestId("status-note")).toContainText("The status of this listing cannot be changed right now.");
  await expect(page.getByTestId("status-note")).toBeFocused();
  await setMode(request, "listing-status", "ok");
  await page.getByTestId("status-retry").click();
  await expect(dialog(page, "Archive this listing?")).toBeVisible();
  await expect(page.getByTestId("status-error")).toHaveCount(0);
  await confirm(page).click();
  await expect(statusLine(page)).toHaveText("Archived");
  // The refusal itself is sent twice (a 403 may be a stale CSRF token, so it is retried once with a fresh one), then the Retry once.
  expect((await statusStats(request)).attempts).toHaveLength(3);
});

for (const [name, mode, text] of [
  ["a server error", "error", SERVER],
  ["a dropped connection (the proxy answers a server error)", "broken", SERVER],
  ["rate limiting", "rate_limited", THROTTLED],
] as const) {
  test(`failure: ${name} is shown with Retry and the same dialog tries again`, async ({ page, request }) => {
    await setMode(request, "listing-status", mode);
    await openListing(page, request, "published_sale");
    await archive(page);
    await expect(page.getByTestId("status-error")).toHaveText(text);
    await expect(statusLine(page)).toHaveText("Published");
    await setMode(request, "listing-status", "ok");
    await confirm(page).click();
    await expect(statusLine(page)).toHaveText("Archived");
  });
}

test("failure: a success that cannot be read is not believed; reload shows the real status", async ({ page, request }) => {
  await setMode(request, "listing-status", "unreadable");
  await openListing(page, request, "published_sale");
  await archive(page);
  await expect(page.getByTestId("status-error")).toHaveText("We could not confirm the new status. Reload the page to see the latest.");
  await expect(statusLine(page)).toHaveText("Published");
  await page.reload();
  await expect(statusLine(page)).toHaveText("Archived");
});

test("failure: a lost answer is retried safely: the second try finds the move already made, which is a success", async ({ page, request }) => {
  await setMode(request, "listing-status", "lost_once");
  await openListing(page, request, "published_sale");
  await archive(page);
  await expect(page.getByTestId("status-error")).toBeVisible();
  await confirm(page).click();
  await expect(statusLine(page)).toHaveText("Archived");
  await expect(live(page)).toHaveText("The listing is archived. It is no longer visible to the public.");
});

test("failure: a status request that never answers times out with its own message and Retry works", async ({ page, request }) => {
  await openListing(page, request, "published_sale");
  await setMode(request, "listing-status", "hang");
  await page.clock.install();
  await page.getByTestId("status-archived").click();
  await confirm(page).click();
  await expect.poll(async () => (await statusStats(request)).attempts.length).toBe(1);
  await page.clock.runFor(21_000);
  await expect(page.getByTestId("status-error")).toHaveText("The server took too long to answer. Please try again.");
  await expect(statusLine(page)).toHaveText("Published");
  await setMode(request, "listing-status", "ok");
  await confirm(page).click();
  await expect(statusLine(page)).toHaveText("Archived");
});

test("failure: a listing that is gone (404) reads as not found", async ({ page, request }) => {
  await setMode(request, "listing-status", "not_found");
  await openListing(page, request, "published_sale");
  await archive(page);
  await expect(page.getByTestId("draft-not-found")).toHaveText(NOT_FOUND);
});

test("failure: a session that ended signs in again", async ({ page, request }) => {
  await setMode(request, "listing-status", "session_gone");
  await openListing(page, request, "published_sale");
  await archive(page);
  await expect(page).toHaveURL(/\/sign-in\?next=/);
});

test("failure: a stale CSRF token is replaced once and the action goes through", async ({ page, request }) => {
  await setMode(request, "listing-status", "csrf_once");
  await openListing(page, request, "published_sale");
  await archive(page);
  await expect(statusLine(page)).toHaveText("Archived");
  const { attempts } = await statusStats(request);
  expect(attempts).toHaveLength(2);
  expect(attempts[1].token).not.toBe(attempts[0].token);
});

// ---------------------------------------------------------------- the purpose and capability rules, on the wire

test("the stub mirrors the backend: sold only for a sale listing, rented only for a rent one, no move from a draft or an archived listing", async ({ request }) => {
  await preset(request, "published_sale");
  await request.get(`${STUB}/__force-session`);
  const csrf = (await (await request.get(`${STUB}/api/v1/csrf`)).json()).csrf_token as string;
  const post = (seq: number, body: object) => request.post(`${STUB}/api/v1/listings/${id(seq)}/status`, { data: body, headers: { "x-csrftoken": csrf, cookie: "estate_session=stub-live" } });
  expect((await post(1, { base_revision: 4, status: "rented" })).status()).toBe(409);
  expect((await post(1, { base_revision: 4, status: "published" })).status()).toBe(400);
  expect((await post(1, { base_revision: 4, status: "removed" })).status()).toBe(400);
  expect((await post(1, { base_revision: 3, status: "archived" })).status()).toBe(409);
  expect((await post(1, { base_revision: 4, status: "archived" })).status()).toBe(200);
  expect((await post(1, { base_revision: 5, status: "archived" })).status()).toBe(409); // already archived
  await preset(request, "publish_ready");
  expect((await post(1, { base_revision: 4, status: "archived" })).status()).toBe(409); // a draft
});

// ================================================================ accessibility

for (const viewport of viewports) {
  test(`accessibility (${viewport.name}): the Published editor, the dialog, the Archived editor and the view-only statuses`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openListing(page, request, "published_sale");
    await expectNoViolations(page, `published editor ${viewport.name}`);
    await page.getByTestId("status-sold").click();
    await expect(dialog(page, "Mark this listing as sold?")).toBeVisible();
    await expectNoViolations(page, `confirmation dialog ${viewport.name}`);
    await page.getByTestId("status-cancel").click();
    await expectNoViolations(page, `after cancel ${viewport.name}`);
    await openListing(page, request, "archived_one");
    await expectNoViolations(page, `archived editor ${viewport.name}`);
    for (const which of ["sold_one", "rented_one", "removed_one", "restricted_one"]) {
      await openListing(page, request, which);
      await expectNoViolations(page, `${which} ${viewport.name}`);
    }
    await openListing(page, request, "published_sale");
    await archive(page);
    await expect(statusLine(page)).toHaveText("Archived");
    await expectNoViolations(page, `after archive ${viewport.name}`);
    await setMode(request, "listing-status", "forbidden");
    await openListing(page, request, "published_sale");
    await archive(page);
    await expect(page.getByTestId("status-error")).toBeVisible();
    await expectNoViolations(page, `dialog with an error ${viewport.name}`);
  });
}
