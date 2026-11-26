import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Story 2.15, frontend half: the Publish section of the Draft page against the stub backend, which mirrors the backend's publish rules
// (required items from its own registry and data, image presence, a counted allowance per account, Idempotency-Key replay and reuse,
// account states, stale revision, not-a-draft, quota details).
const STUB = STUB_URL;
const LIST = "/account/listings";
const id = (seq: number) => `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`;
const COPY = "Publishing makes this listing visible to everyone immediately. It uses 1 of your monthly publications.";
const KEY = /^[A-Za-z0-9._:-]{1,128}$/;

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

const setMode = (request: APIRequestContext, kind: string, value: string) => request.get(`${STUB}/__${kind}-mode?value=${value}`);
const publishMode = (request: APIRequestContext, value: string) => setMode(request, "listing-publish", value);
const preset = (request: APIRequestContext, value: string) => request.get(`${STUB}/__listings-preset?value=${value}`);
type Attempt = { id: string; key: string | null; token: string | null; body: { base_revision: number } };
const stats = async (request: APIRequestContext): Promise<{ attempts: Attempt[]; used: Record<string, number>; records: string[] }> =>
  (await request.get(`${STUB}/__listing-publish-stats`)).json();

async function open(page: Page, request: APIRequestContext, which = "publish_ready", seq = 1) {
  await preset(request, which);
  await request.get(`${STUB}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
  await page.goto(`${LIST}/${id(seq)}`);
  await expect(page.getByRole("heading", { level: 1, name: /^(Draft|Listing)$/ })).toBeVisible();
  if (which.startsWith("published")) await expect(page.getByTestId("draft-status")).toBeVisible();
  else await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
}
const publishButton = (page: Page) => page.getByTestId("publish-button");
const note = (page: Page) => page.getByTestId("publish-note");
const summary = (page: Page) => page.getByRole("group", { name: "There is a problem" });

async function expectNoViolations(page: Page, label: string) {
  await expect(page).toHaveTitle(/.+/);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}
const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];

test("ready: the Publish section says what publishing does and how many publications remain; a click publishes @smoke", async ({ page, request }) => {
  await open(page, request);
  const section = page.getByTestId("publish-section");
  await expect(section.getByRole("heading", { level: 2, name: "Publish" })).toBeVisible();
  await expect(section).toContainText(COPY);
  await expect(page.getByTestId("publish-allowance")).toHaveText("You have 1 publication remaining this month.");
  await expect(publishButton(page)).not.toHaveAttribute("aria-disabled", "true");
  await publishButton(page).click();
  await expect(page.getByTestId("publish-live")).toContainText("Your listing is published. It is now visible to everyone.");
  await expect(page.getByTestId("published-allowance")).toHaveText("You have 0 publications remaining this month.");
  await expect(page.getByTestId("publish-live")).toHaveAttribute("role", "status");
  await expect(page.getByTestId("draft-status")).toHaveText("Published");
  // Story 2.17: a published listing is edited under the publication rules; the identity fields are read only.
  await expect(page.getByRole("heading", { level: 1, name: "Listing" })).toBeVisible();
  await expect(page.getByTestId("identity-note")).toBeVisible();
  await expect(page.getByTestId("draft-not-editable")).toHaveCount(0);
  await expect(page.getByTestId("publish-section")).toHaveCount(0);
  await expect(page.getByTestId("delete-draft")).toHaveCount(0);
  await expect(page.getByLabel("Title", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("Area value", { exact: true })).toHaveAttribute("aria-readonly", "true");
  await expect(page.getByTestId("status-section").getByRole("button")).toHaveText(["Archive", "Mark as sold"]);
  const { attempts, used } = await stats(request);
  expect(attempts).toHaveLength(1);
  expect(attempts[0].id).toBe(id(1));
  expect(attempts[0].body).toEqual({ base_revision: 4 });
  expect(attempts[0].key).toMatch(KEY);
  expect(attempts[0].token).toBe("csrf-0");
  expect(Object.values(used)).toEqual([1]);
});

test("a published listing has no Publish section", async ({ page, request }) => {
  await open(page, request, "published_one");
  await expect(page.getByTestId("publish-section")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publish listing" })).toHaveCount(0);
});

test("unsaved changes: Publish is aria-disabled with the reason, sends nothing, and works after saving", async ({ page, request }) => {
  await open(page, request);
  await page.getByLabel("Title", { exact: true }).fill("Corner house with a bigger garden");
  await expect(publishButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("publish-reason")).toHaveText("Save your changes before publishing");
  await expect(publishButton(page)).toHaveAccessibleDescription("Save your changes before publishing");
  await publishButton(page).click({ force: true });
  expect((await stats(request)).attempts).toHaveLength(0);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  await expect(page.getByTestId("publish-reason")).toHaveCount(0);
  await publishButton(page).click();
  await expect(page.getByTestId("publish-live")).toContainText("Your listing is published.");
  expect((await stats(request)).attempts[0].body).toEqual({ base_revision: 5 });
});

test("publishing: Save, images and Delete wait, Publish says it is working; the held answer then publishes", async ({ page, request }) => {
  await publishMode(request, "hold");
  await open(page, request);
  await publishButton(page).click();
  await expect(publishButton(page)).toHaveText("Publishing…");
  await expect(publishButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("publish-working")).toHaveText("Publishing the listing…");
  await expect(page.getByTestId("publish-paused")).toHaveText("Saving, editing and image changes are paused while the listing is published.");
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("delete-draft")).toHaveAttribute("aria-disabled", "true");
  await publishButton(page).click({ force: true }); // a second click while it runs sends nothing
  await expect.poll(async () => (await stats(request)).attempts.length).toBe(1);
  await request.get(`${STUB}/__listing-publish-release`);
  await expect(page.getByTestId("publish-live")).toContainText("Your listing is published.");
  await expect.poll(async () => (await stats(request)).attempts.length).toBe(1);
});

test("missing items: a summary lists every one with a link, each shows next to its field, the images next to Images @smoke", async ({ page, request }) => {
  await open(page, request, "publish_empty");
  await publishButton(page).click();
  const list = summary(page);
  await expect(list).toBeFocused();
  await expect(list.getByRole("heading", { name: "There is a problem" })).toBeVisible();
  for (const text of [
    "Images: Add at least one image.",
    "Title: Enter a title.",
    "Asking price: Enter an asking price.",
    "Price basis: Choose a price basis.",
    "Area value: Enter an area.",
    "Unit: Choose a unit.",
    "Bedrooms: Enter a whole number.",
    "Bathrooms: Enter a whole number.",
    "City: Choose a city.",
    "Locality: Choose a locality.",
  ]) {
    await expect(list.getByRole("link", { name: text })).toBeVisible();
  }
  await expect(page.getByTestId("images-publish-error")).toHaveText("Error: Add at least one image.");
  await expect(page.locator("#title-error")).toHaveText("Error: Enter a title.");
  await expect(page.locator("#bedrooms-error")).toHaveText("Error: Enter a whole number.");
  await expect(page.locator("#city-error")).toHaveText("Error: Choose a city.");
  await expect(page.getByLabel("Title", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByTestId("draft-live")).toHaveText("The listing cannot be published yet. Review the list at the top of the page.");
  // Nothing was consumed, it is still a draft with the Publish section.
  await expect(page.getByTestId("draft-status")).toHaveText("Draft");
  expect((await stats(request)).used).toEqual({});
  // A link moves the focus to its field; editing a field removes its error and its summary item.
  await list.getByRole("link", { name: "Title: Enter a title." }).click();
  await expect(page.getByLabel("Title", { exact: true })).toBeFocused();
  await page.getByLabel("Title", { exact: true }).fill("Corner house with garden");
  await expect(page.locator("#title-error")).toHaveCount(0);
  await expect(list.getByRole("link", { name: "Title: Enter a title." })).toHaveCount(0);
  await list.getByRole("link", { name: "Images: Add at least one image." }).click();
  await expect(page.getByLabel("Add images")).toBeFocused();
});

test("a rent draft without a rental period, a cleared city, an image missing and an unconfirmed Assistant value are each named", async ({ page, request }) => {
  await open(page, request, "publish_rent_no_period");
  await publishButton(page).click();
  await expect(summary(page).getByRole("link", { name: "Rental period: Choose a rental period." })).toBeVisible();
  await expect(page.locator("#rental_period-error")).toHaveText("Error: Choose a rental period.");
  await expect(summary(page).getByRole("listitem")).toHaveCount(1);

  await open(page, request, "publish_cleared_city");
  await publishButton(page).click();
  await expect(page.locator("#city-error")).toHaveText("Error: Choose a city.");
  await expect(page.locator("#locality-error")).toHaveText("Error: Choose a locality.");

  await open(page, request, "publish_no_image");
  await publishButton(page).click();
  await expect(summary(page).getByRole("listitem")).toHaveCount(1);
  await expect(page.getByTestId("images-publish-error")).toBeVisible();

  await open(page, request, "publish_ai_street");
  await publishButton(page).click();
  await expect(summary(page).getByRole("link", { name: /Confirm this value before publishing\.$/ })).toBeVisible();
  await expect(page.locator("#street-error")).toHaveText("Error: Confirm this value before publishing.");
  expect((await stats(request)).used).toEqual({});
});

test("adding an image clears the images error, and the next publish carries the new revision", async ({ page, request }) => {
  await open(page, request, "publish_no_image");
  await publishButton(page).click();
  await expect(page.getByTestId("images-publish-error")).toBeVisible();
  await page.locator("#images-add").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") });
  await expect(page.getByTestId("images-publish-error")).toHaveCount(0);
  await expect(page.getByTestId("image-item")).toHaveCount(1);
  const revision = Number(await page.getByTestId("draft-revision").textContent());
  expect(revision).toBeGreaterThan(4);
  await publishButton(page).click();
  await expect(page.getByTestId("publish-live")).toContainText("Your listing is published.");
  const { attempts } = await stats(request);
  expect(attempts.map((attempt) => attempt.body.base_revision)).toEqual([4, revision]);
});

test("confirm: a field the Assistant filled in gets a Confirm button that saves just that value; the next publish succeeds", async ({ page, request }) => {
  await open(page, request, "publish_ai_street");
  await publishButton(page).click();
  const button = page.getByTestId("confirm-street").getByRole("button", { name: "Confirm this value for Street" });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator("#street-error")).toHaveCount(0);
  await expect(page.getByTestId("draft-revision")).toHaveText("5");
  await expect(page.getByTestId("confirm-street")).toHaveCount(0);
  await expect(summary(page)).toHaveCount(0);
  await publishButton(page).click();
  await expect(page.getByTestId("publish-live")).toContainText("Your listing is published.");
  expect((await stats(request)).attempts.map((attempt) => attempt.body.base_revision)).toEqual([4, 5]);
});

test("a refused publish whose summary is replaced by a save error shows one summary at a time", async ({ page, request }) => {
  await open(page, request, "publish_empty");
  await publishButton(page).click();
  await expect(summary(page)).toHaveCount(1);
  await page.getByLabel("Title", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(summary(page)).toHaveCount(1);
  await expect(summary(page).getByRole("link", { name: /^Asking price/ })).toHaveCount(0);
});

test("a server-named error beyond 'required' shows next to its field", async ({ page, request }) => {
  await publishMode(request, "invalid_extra");
  await open(page, request);
  await publishButton(page).click();
  await expect(page.locator("#title-error")).toContainText("too short");
});

test("quota exhausted: the message names the limit and the reset date and links to the dashboard; nothing is consumed", async ({ page, request }) => {
  await publishMode(request, "quota");
  await open(page, request);
  await expect(page.getByTestId("publish-allowance")).toHaveText("You have 1 publication remaining this month.");
  await publishButton(page).click();
  await expect(note(page)).toContainText("You have used all 2 publications this month. The allowance resets on 1 December 2026.");
  await expect(note(page)).toBeFocused();
  await expect(page.getByTestId("publish-note-link")).toHaveAttribute("href", "/dashboard");
  await expect(page.getByTestId("draft-status")).toHaveText("Draft");
  expect((await stats(request)).used).toEqual({});
});

test("a used-up allowance is stated before the click, and the second draft of a month is refused after the first publishes", async ({ page, request }) => {
  await setMode(request, "allowance", "last");
  await open(page, request, "publish_two", 2);
  await publishButton(page).click();
  await expect(page.getByTestId("publish-live")).toContainText("Your listing is published.");
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
  await expect(page.getByTestId("publish-allowance")).toContainText("You have used all 2 publications this month. The allowance resets on 1 December 2026.");
  await expect(page.getByRole("link", { name: "Go to your dashboard" })).toHaveAttribute("href", "/dashboard");
  await publishButton(page).click();
  await expect(note(page)).toContainText("You have used all 2 publications this month. The allowance resets on 1 December 2026.");
  await expect(page.getByTestId("draft-status")).toHaveText("Draft");
  expect(Object.values((await stats(request)).used)).toEqual([1]);
});

test("a quota answer without usable numbers still says the allowance is used up", async ({ page, request }) => {
  await publishMode(request, "quota_no_details");
  await open(page, request);
  await publishButton(page).click();
  await expect(note(page)).toContainText("You have used all your publications this month.");
});

test("an Email-unverified account is told to verify, with a link; a Suspended account is told it cannot publish", async ({ page, request }) => {
  await setMode(request, "signin", "unverified");
  await open(page, request);
  await publishButton(page).click();
  await expect(note(page)).toContainText("Verify your email to publish.");
  await expect(page.getByTestId("publish-note-link")).toHaveAttribute("href", "/verify-email");
  await expect(page.getByTestId("draft-status")).toHaveText("Draft");

  await setMode(request, "signin", "suspended");
  await open(page, request);
  await publishButton(page).click();
  await expect(note(page)).toHaveText("Your account cannot publish right now.");
  expect((await stats(request)).used).toEqual({});
});

test("a stale revision opens the existing conflict flow with the latest data; nothing is published", async ({ page, request }) => {
  await publishMode(request, "stale");
  await open(page, request);
  await publishButton(page).click();
  await expect(page.getByTestId("draft-conflict")).toContainText("This draft was changed in another session.");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Changed in another session");
  await expect(page.getByTestId("draft-status")).toHaveText("Draft");
  await expect(page.getByTestId("draft-revision")).toHaveText("5");
  expect((await stats(request)).used).toEqual({});
  // The next attempt carries the new revision and a new key.
  await publishMode(request, "ok");
  await publishButton(page).click();
  await expect(page.getByTestId("publish-live")).toContainText("Your listing is published.");
  const { attempts } = await stats(request);
  expect(attempts.map((attempt) => attempt.body.base_revision)).toEqual([4, 5]);
  expect(attempts[0].key).not.toBe(attempts[1].key);
});

test("a stale answer without the latest data reads the Draft again", async ({ page, request }) => {
  await publishMode(request, "stale_no_current");
  await open(page, request);
  await publishButton(page).click();
  await expect(page.getByTestId("draft-conflict")).toBeVisible();
});

test("already published elsewhere (409 conflict): the page reads it again and switches to the published state", async ({ page, request }) => {
  await publishMode(request, "conflict");
  await open(page, request);
  await publishButton(page).click();
  await expect(page.getByTestId("publish-live")).toHaveText("This listing is already published. We loaded the latest version.");
  await expect(page.getByTestId("draft-status")).toHaveText("Published");
  await expect(page.getByTestId("publish-section")).toHaveCount(0);
});

test("a key reuse answer is retried once with a new key; a second one shows a generic retry message", async ({ page, request }) => {
  await publishMode(request, "reuse_once");
  await open(page, request);
  await publishButton(page).click();
  await expect(page.getByTestId("publish-live")).toContainText("Your listing is published.");
  const { attempts } = await stats(request);
  expect(attempts).toHaveLength(2);
  expect(attempts[0].key).not.toBe(attempts[1].key);

  await request.get(`${STUB}/__reset`);
  await publishMode(request, "reuse_always");
  await open(page, request);
  await publishButton(page).click();
  await expect(note(page)).toHaveText("We could not publish the listing. Try again.");
  expect((await stats(request)).attempts).toHaveLength(2);
  await expect(page.getByTestId("draft-status")).toHaveText("Draft");
});

test("a lost answer: Retry reuses the same key and the server replays the one publication", async ({ page, request }) => {
  await publishMode(request, "lost_once");
  await open(page, request);
  await publishButton(page).click();
  // The app's proxy turns the dropped connection into a server error: either way the answer is unknown and Retry is offered.
  await expect(note(page)).toContainText("We could not confirm whether the listing was published.");
  await expect(page.getByTestId("draft-status")).toHaveText("Draft");
  await page.getByTestId("publish-retry").click();
  await expect(page.getByTestId("publish-live")).toContainText("Your listing is published.");
  const { attempts, used } = await stats(request);
  expect(attempts).toHaveLength(2);
  expect(attempts[1].key).toBe(attempts[0].key);
  expect(Object.values(used)).toEqual([1]);
});

test("a server error offers Retry with the same key; an edit afterwards starts a new attempt with a new key", async ({ page, request }) => {
  await publishMode(request, "error");
  await open(page, request);
  await publishButton(page).click();
  await expect(note(page)).toContainText("Something went wrong on our side. Please try again in a moment.");
  await expect(page.getByTestId("publish-retry")).toBeVisible();
  await page.getByTestId("publish-retry").click();
  await expect(note(page)).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("Corner house with a bigger garden");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  await publishMode(request, "ok");
  await publishButton(page).click();
  await expect(page.getByTestId("publish-live")).toContainText("Your listing is published.");
  const { attempts } = await stats(request);
  expect(attempts).toHaveLength(3);
  expect(attempts[1].key).toBe(attempts[0].key);
  expect(attempts[2].key).not.toBe(attempts[0].key);
});

test("a success that cannot be read is not shown as published; Retry replays it", async ({ page, request }) => {
  await publishMode(request, "garbled");
  await open(page, request);
  await publishButton(page).click();
  await expect(note(page)).toContainText("We could not confirm whether the listing was published.");
  await expect(page.getByTestId("draft-status")).toHaveText("Draft");
  await publishMode(request, "ok");
  await page.getByTestId("publish-retry").click();
  await expect(page.getByTestId("publish-live")).toContainText("Your listing is published.");
  const { attempts, used } = await stats(request);
  expect(attempts[1].key).toBe(attempts[0].key);
  expect(Object.values(used)).toEqual([1]);
});

test("a session that ended during publishing goes to sign-in", async ({ page, request }) => {
  await publishMode(request, "session_gone");
  await open(page, request);
  await publishButton(page).click();
  await expect(page).toHaveURL(/\/sign-in\?next=/);
});

test("a throttled answer shows the wait and Retry", async ({ page, request }) => {
  await publishMode(request, "rate_limited");
  await open(page, request);
  await publishButton(page).click();
  await expect(note(page)).toContainText("Too many attempts. Try again in 2 minutes.");
});

test("stale answer that says published (published elsewhere or by a lost earlier attempt) is the published-elsewhere outcome, not a conflict", async ({ page, request }) => {
  await publishMode(request, "stale_published");
  await open(page, request);
  await publishButton(page).click();
  await expect(page.getByTestId("publish-live")).toHaveText("This listing is already published. We loaded the latest version.");
  await expect(page.getByTestId("draft-conflict")).toHaveCount(0);
  await expect(page.getByTestId("draft-status")).toHaveText("Published");
  await expect(page.getByTestId("draft-revision")).toHaveText("5");
  await expect(page.getByTestId("publish-section")).toHaveCount(0);
});

test("a 409 conflict while the listing still is a draft says nothing was published and keeps Publish", async ({ page, request }) => {
  await publishMode(request, "conflict_draft");
  await open(page, request);
  await publishButton(page).click();
  await expect(note(page)).toHaveText("We could not publish the listing. Try again.");
  await expect(page.getByTestId("publish-live")).toHaveText("");
  await expect(page.getByTestId("draft-status")).toHaveText("Draft");
  await expect(page.getByTestId("draft-revision")).toHaveText("4");
  await expect(publishButton(page)).toBeVisible();
});

test("Retry is aria-disabled with the reason while the form has unsaved changes", async ({ page, request }) => {
  await publishMode(request, "error");
  await open(page, request);
  await publishButton(page).click();
  await expect(page.getByTestId("publish-retry")).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("Corner house with a bigger garden");
  await expect(page.getByTestId("publish-retry")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("publish-retry")).toHaveAccessibleDescription("Save your changes before publishing");
  await page.getByTestId("publish-retry").click({ force: true });
  await expect.poll(async () => (await stats(request)).attempts.length).toBe(1);
});

test("a partly typed date counts as unsaved input", async ({ page, request }) => {
  await open(page, request, "rent_terms_blank");
  await page.locator("#availability_date").click();
  await page.keyboard.type("03");
  await expect(publishButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("publish-reason")).toHaveText("Save your changes before publishing");
});

test("while publishing the fields are read-only, the images and Delete wait, and a same-tick double click sends one request", async ({ page, request }) => {
  await publishMode(request, "hold");
  await open(page, request);
  await publishButton(page).evaluate((element: HTMLElement) => {
    element.click();
    element.click();
  });
  await expect(publishButton(page)).toHaveText("Publishing…");
  const title = page.getByLabel("Title", { exact: true });
  await expect(title).toHaveAttribute("readonly", "");
  await title.focus();
  await page.keyboard.type("xyz");
  await expect(title).toHaveValue("Corner house with garden");
  await expect(page.locator("#images-add")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("button", { name: "Delete image 1 of 2" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("button", { name: "Set as cover image 2 of 2" })).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("button", { name: "Delete image 1 of 2" }).click({ force: true });
  await expect(page.getByTestId("image-confirm")).toHaveCount(0);
  await expect.poll(async () => (await stats(request)).attempts.length).toBe(1);
  await request.get(`${STUB}/__listing-publish-release`);
  await expect(page.getByTestId("publish-live")).toContainText("Your listing is published.");
  await expect.poll(async () => (await stats(request)).attempts.length).toBe(1);
});

test("an edit that is reverted still starts a new attempt with a new key", async ({ page, request }) => {
  await publishMode(request, "error");
  await open(page, request);
  await publishButton(page).click();
  await expect(note(page)).toBeVisible();
  const title = page.getByLabel("Title", { exact: true });
  await title.fill("Corner house with a bigger garden");
  await title.fill("Corner house with garden");
  await expect(publishButton(page)).not.toHaveAttribute("aria-disabled", "true");
  await publishButton(page).click();
  await expect(note(page)).toBeVisible();
  const { attempts } = await stats(request);
  expect(attempts).toHaveLength(2);
  expect(attempts[1].key).not.toBe(attempts[0].key);
});

test("a limit of one says 'used your 1 publication'", async ({ page, request }) => {
  await publishMode(request, "quota_one");
  await open(page, request);
  await publishButton(page).click();
  await expect(note(page)).toContainText("You have used your 1 publication this month. The allowance resets on 1 December 2026.");
});

test("a real 403 is sent once: email-unverified and suspended answers are not retried; a stale CSRF token is retried once with the same key", async ({ page, request }) => {
  await setMode(request, "signin", "unverified");
  await open(page, request);
  await publishButton(page).click();
  await expect(note(page)).toContainText("Verify your email to publish.");
  await expect.poll(async () => (await stats(request)).attempts.length).toBe(1);

  await request.get(`${STUB}/__reset`);
  await setMode(request, "signin", "suspended");
  await open(page, request);
  await publishButton(page).click();
  await expect(note(page)).toHaveText("Your account cannot publish right now.");
  await expect.poll(async () => (await stats(request)).attempts.length).toBe(1);

  await request.get(`${STUB}/__reset`);
  await publishMode(request, "csrf_once");
  await open(page, request);
  await publishButton(page).click();
  await expect(page.getByTestId("publish-live")).toContainText("Your listing is published.");
  const csrf = (await stats(request)).attempts;
  expect(csrf).toHaveLength(2);
  expect(csrf[1].key).toBe(csrf[0].key);
  expect(csrf[1].token).not.toBe(csrf[0].token);

  await request.get(`${STUB}/__reset`);
  await publishMode(request, "forbidden");
  await open(page, request);
  await publishButton(page).click();
  await expect(note(page)).toHaveText("This request could not be submitted. Please try again.");
  expect((await stats(request)).attempts).toHaveLength(2); // the plain `forbidden` answer is retried once, with the same key
  expect((await stats(request)).used).toEqual({});
});

test("a dropped connection is an unknown outcome with Retry", async ({ page, request }) => {
  await publishMode(request, "broken");
  await open(page, request);
  await publishButton(page).click();
  await expect(note(page)).toContainText("We could not confirm whether the listing was published.");
  await expect(page.getByTestId("publish-retry")).toBeVisible();
});

test("publishing waits for the form: with the form unavailable Publish is aria-disabled with the reason", async ({ page, request }) => {
  await setMode(request, "registry", "error");
  await preset(request, "publish_ready");
  await request.get(`${STUB}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByTestId("registry-error")).toBeVisible();
  await expect(publishButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("publish-reason")).toContainText("Publishing is not available until the form has loaded.");
  await publishButton(page).click({ force: true });
  expect((await stats(request)).attempts).toHaveLength(0);
});

for (const viewport of viewports) {
  test(`axe at ${viewport.name}: ready, errors, quota exhausted and published`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await open(page, request);
    await expect(page.getByTestId("publish-allowance")).toHaveText("You have 1 publication remaining this month.");
    await expectNoViolations(page, `${viewport.name} ready`);

    await page.getByLabel("Title", { exact: true }).fill("Corner house with a bigger garden");
    await expectNoViolations(page, `${viewport.name} unsaved`);

    await open(page, request, "publish_empty");
    await publishButton(page).click();
    await expect(summary(page)).toBeFocused();
    await expectNoViolations(page, `${viewport.name} errors`);

    await publishMode(request, "quota");
    await open(page, request);
    await publishButton(page).click();
    await expect(note(page)).toContainText("You have used all 2 publications");
    await expectNoViolations(page, `${viewport.name} quota exhausted`);

    await publishMode(request, "ok");
    await open(page, request);
    await publishButton(page).click();
    await expect(page.getByTestId("published-allowance")).toBeVisible();
    await expectNoViolations(page, `${viewport.name} published`);
  });
}
