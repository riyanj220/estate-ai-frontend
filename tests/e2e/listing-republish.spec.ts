import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Story 2.18, frontend half: the Republish section of an Archived Listing page against the stub backend, which mirrors the backend's
// republication rules (full revalidation, the counted or free decision from the Karachi month of the last counted publication and the
// identity fingerprint, quota only for a counted one, Idempotency-Key replay with the original kind, restricted, sold and rented refusals).
const STUB = STUB_URL;
const LIST = "/account/listings";
const id = (seq: number) => `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`;
const COPY =
  "Republishing makes this listing visible to everyone again. It uses 1 of your monthly publications unless you republish in the same month as your last counted publication without changing the category, subtype, purpose, city, locality, area value or area unit.";
const COUNTED = "Republished. This used 1 of your publications.";
const FREE = "Republished. This did not use any of your publications.";
const KEY = /^[A-Za-z0-9._:-]{1,128}$/;

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

const setMode = (request: APIRequestContext, kind: string, value: string) => request.get(`${STUB}/__${kind}-mode?value=${value}`);
const publishMode = (request: APIRequestContext, value: string) => setMode(request, "listing-publish", value);
const preset = (request: APIRequestContext, value: string) => request.get(`${STUB}/__listings-preset?value=${value}`);
type Attempt = { id: string; key: string | null; token: string | null; body: { base_revision: number }; op: string };
const stats = async (request: APIRequestContext): Promise<{ attempts: Attempt[]; used: Record<string, number>; records: string[] }> =>
  (await request.get(`${STUB}/__listing-publish-stats`)).json();

async function open(page: Page, request: APIRequestContext, which = "archived_one", seq = 1) {
  await preset(request, which);
  await request.get(`${STUB}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
  await page.goto(`${LIST}/${id(seq)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Listing" })).toBeVisible();
  await expect(page.getByTestId("draft-status")).toBeVisible();
}
const button = (page: Page) => page.getByTestId("republish-button");
const note = (page: Page) => page.getByTestId("republish-note");
const live = (page: Page) => page.getByTestId("publish-live");
const summary = (page: Page) => page.getByRole("group", { name: "There is a problem" });
const save = async (page: Page) => {
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
};

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

test("archived: the Republish section states the rule and the allowance; no baseline is counted and the page becomes the Published editor @smoke", async ({ page, request }) => {
  await open(page, request);
  const section = page.getByTestId("republish-section");
  await expect(section.getByRole("heading", { level: 2, name: "Republish" })).toBeVisible();
  await expect(section).toContainText(COPY);
  await expect(page.getByTestId("republish-allowance")).toHaveText("You have 1 publication remaining this month.");
  await expect(page.getByTestId("publish-section")).toHaveCount(0);
  await expect(button(page)).toHaveText("Republish listing");
  await expect(button(page)).not.toHaveAttribute("aria-disabled", "true");
  await button(page).click();
  await expect(live(page)).toContainText(COUNTED);
  await expect(live(page)).toHaveAttribute("role", "status");
  await expect(page.getByTestId("published-allowance")).toHaveText("You have 0 publications remaining this month.");
  await expect(page.getByTestId("draft-status")).toHaveText("Published");
  await expect(page.getByTestId("identity-note")).toBeVisible(); // the Published editor: identity fields read only
  await expect(page.getByTestId("republish-section")).toHaveCount(0);
  await expect(page.getByTestId("archived-note")).toHaveCount(0);
  const { attempts, used } = await stats(request);
  expect(attempts).toHaveLength(1);
  expect(attempts[0].op).toBe("republish");
  expect(attempts[0].key).toMatch(KEY);
  expect(attempts[0].token).toBeTruthy();
  expect(attempts[0].body).toEqual({ base_revision: 4 });
  expect(Object.values(used)).toEqual([1]);
});

test("same month and unchanged identity: free, nothing is used and the announcement says so", async ({ page, request }) => {
  await open(page, request, "archived_free");
  await button(page).click();
  await expect(live(page)).toContainText(FREE);
  await expect(page.getByTestId("published-allowance")).toHaveText("You have 1 publication remaining this month.");
  await expect(page.getByTestId("draft-status")).toHaveText("Published");
  expect((await stats(request)).used).toEqual({});
});

test("an earlier month is counted", async ({ page, request }) => {
  await open(page, request, "archived_last_month");
  await button(page).click();
  await expect(live(page)).toContainText(COUNTED);
  expect(Object.values((await stats(request)).used)).toEqual([1]);
});

test("changing an identity field while archived makes a same-month republication counted; changing another field keeps it free", async ({ page, request }) => {
  await open(page, request, "archived_free");
  await page.getByLabel("Area value", { exact: true }).fill("12");
  await save(page);
  await button(page).click();
  await expect(live(page)).toContainText(COUNTED);
  expect(Object.values((await stats(request)).used)).toEqual([1]);

  await request.get(`${STUB}/__reset`);
  await open(page, request, "archived_free");
  await page.getByLabel("Title", { exact: true }).fill("Corner house with a bigger garden");
  await save(page);
  await button(page).click();
  await expect(live(page)).toContainText(FREE);
  expect((await stats(request)).used).toEqual({});
});

test("publish, archive and republish in one month is free; a counted publication is the baseline", async ({ page, request }) => {
  await open(page, request, "published_counted");
  await page.getByTestId("status-archived").click();
  await page.getByTestId("status-confirm").click();
  await expect(page.getByTestId("republish-section")).toBeVisible();
  await button(page).click();
  await expect(live(page)).toContainText(FREE);
  expect((await stats(request)).used).toEqual({});
});

test("a free republication works with an exhausted allowance; a counted one is refused with the quota message", async ({ page, request }) => {
  await setMode(request, "allowance", "exhausted");
  await open(page, request, "archived_two", 2);
  await expect(page.getByTestId("republish-allowance")).toHaveText("You have 0 publications remaining this month.");
  await button(page).click();
  await expect(live(page)).toContainText(FREE);
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByTestId("republish-section")).toBeVisible();
  await button(page).click();
  await expect(note(page)).toContainText("You have used all 2 publications this month. The allowance resets on 1 December 2026.");
  await expect(note(page)).toBeFocused();
  await expect(page.getByTestId("republish-note-link")).toHaveAttribute("href", "/dashboard");
  await expect(page.getByTestId("draft-status")).toHaveText("Archived");
  expect((await stats(request)).used).toEqual({});
});

test("quota answer: the message names the limit and the reset date; nothing is consumed", async ({ page, request }) => {
  await publishMode(request, "quota");
  await open(page, request);
  await button(page).click();
  await expect(note(page)).toContainText("You have used all 2 publications this month. The allowance resets on 1 December 2026.");
  await expect(page.getByTestId("draft-status")).toHaveText("Archived");
  expect((await stats(request)).used).toEqual({});
});

test("validation errors come back all at once, with links and the images error; the Confirm button saves an unconfirmed value", async ({ page, request }) => {
  await open(page, request, "archived_empty");
  await button(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(summary(page)).toContainText("Images");
  await expect(summary(page)).toContainText("Title");
  await expect(page.getByRole("status").filter({ hasText: "The listing cannot be republished yet. Review the list at the top of the page." }).first()).toBeAttached();
  await expect(page.getByTestId("draft-status")).toHaveText("Archived");
  expect((await stats(request)).used).toEqual({});

  await request.get(`${STUB}/__reset`);
  await open(page, request, "archived_no_image");
  await button(page).click();
  await expect(summary(page).getByRole("link", { name: "Images" })).toBeVisible();
  await expect(page.getByTestId("images-publish-error")).toHaveText("Error: Add at least one image.");

  await request.get(`${STUB}/__reset`);
  await open(page, request, "archived_ai_street");
  await button(page).click();
  await expect(page.getByText("Confirm this value before publishing.").first()).toBeVisible();
  await page.getByRole("button", { name: "Confirm this value" }).first().click();
  await expect(page.getByText("The value is confirmed.").first()).toBeAttached();
  await button(page).click();
  await expect(live(page)).toContainText(COUNTED);
});

test("the button is aria-disabled with the reason while there are unsaved changes", async ({ page, request }) => {
  await open(page, request);
  await page.getByLabel("Title", { exact: true }).fill("Corner house with a bigger garden");
  await expect(button(page)).toHaveAttribute("aria-disabled", "true");
  await expect(button(page)).toHaveAccessibleDescription("Save your changes before republishing");
  await button(page).click({ force: true });
  await page.waitForTimeout(300); // a request that was wrongly sent would have arrived by now
  expect((await stats(request)).attempts).toHaveLength(0);
  await save(page);
  await expect(button(page)).not.toHaveAttribute("aria-disabled", "true");
});

test("while republishing the form and the button wait and a same-tick double click sends one request", async ({ page, request }) => {
  await publishMode(request, "hold");
  await open(page, request);
  await button(page).evaluate((element: HTMLElement) => {
    element.click();
    element.click();
  });
  await expect(button(page)).toHaveText("Republishing…");
  await expect(button(page)).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("republish-working")).toHaveText("Republishing the listing…");
  await expect(page.getByLabel("Title", { exact: true })).toHaveAttribute("readonly", "");
  await expect.poll(async () => (await stats(request)).attempts.length).toBe(1);
  await request.get(`${STUB}/__listing-publish-release`);
  await expect(live(page)).toContainText(COUNTED);
});

test("a lost answer: Retry reuses the same key and the replay keeps the original outcome and charges once", async ({ page, request }) => {
  await publishMode(request, "lost_once");
  await open(page, request);
  await button(page).click();
  await expect(page.getByTestId("republish-retry")).toBeVisible();
  await expect(note(page)).toContainText("We could not confirm whether the listing was republished. Retrying is safe: it never republishes twice.");
  await page.getByTestId("republish-retry").click();
  await expect(live(page)).toContainText(COUNTED);
  const { attempts, used } = await stats(request);
  expect(attempts).toHaveLength(2);
  expect(attempts[1].key).toBe(attempts[0].key);
  expect(Object.values(used)).toEqual([1]);
});

test("a key reuse answer is retried once with a new key; a second one shows a generic retry message", async ({ page, request }) => {
  await publishMode(request, "reuse_once");
  await open(page, request);
  await button(page).click();
  await expect(live(page)).toContainText(COUNTED);
  const { attempts } = await stats(request);
  expect(attempts).toHaveLength(2);
  expect(attempts[0].key).not.toBe(attempts[1].key);

  await request.get(`${STUB}/__reset`);
  await publishMode(request, "reuse_always");
  await open(page, request);
  await button(page).click();
  await expect(note(page)).toHaveText("We could not republish the listing. Try again.");
  await expect(page.getByTestId("draft-status")).toHaveText("Archived");
});

test("email-unverified and suspended answers are shown and sent once", async ({ page, request }) => {
  await setMode(request, "signin", "unverified");
  await open(page, request);
  await button(page).click();
  await expect(note(page)).toContainText("Verify your email to republish.");
  await expect(page.getByTestId("republish-note-link")).toHaveAttribute("href", /verify-email/);
  await expect.poll(async () => (await stats(request)).attempts.length).toBe(1);

  await request.get(`${STUB}/__reset`);
  await setMode(request, "signin", "suspended");
  await open(page, request);
  await button(page).click();
  await expect(note(page)).toHaveText("Your account cannot publish right now.");
  await expect.poll(async () => (await stats(request)).attempts.length).toBe(1);
});

test("a stale revision opens the conflict flow; republished elsewhere is the published-elsewhere outcome", async ({ page, request }) => {
  await publishMode(request, "stale");
  await open(page, request);
  await button(page).click();
  await expect(page.getByTestId("draft-status")).toHaveText("Archived");
  await expect(page.getByText("Changed in another session").first()).toBeVisible();
  expect((await stats(request)).used).toEqual({});

  await request.get(`${STUB}/__reset`);
  await publishMode(request, "stale_published");
  await open(page, request);
  await button(page).click();
  await expect(live(page)).toHaveText("This listing is already published. We loaded the latest version.");
  await expect(page.getByTestId("draft-status")).toHaveText("Published");

  await request.get(`${STUB}/__reset`);
  await publishMode(request, "conflict");
  await open(page, request);
  await button(page).click();
  await expect(live(page)).toHaveText("This listing is already published. We loaded the latest version.");
  await expect(page.getByTestId("draft-status")).toHaveText("Published");

  await request.get(`${STUB}/__reset`);
  await publishMode(request, "conflict_draft");
  await open(page, request);
  await button(page).click();
  await expect(note(page)).toHaveText("We could not republish the listing. Try again.");
  await expect(page.getByTestId("draft-status")).toHaveText("Archived");
});

test("a restricted archived listing shows a note and no Republish", async ({ page, request }) => {
  await open(page, request, "restricted_archived");
  await expect(page.getByTestId("republish-forbidden")).toHaveText("This listing cannot be republished.");
  await expect(page.getByTestId("republish-section")).toHaveCount(0);
  await expect(button(page)).toHaveCount(0);
});

test("a 403 forbidden is explained only when the listing was restricted: the page reads it again", async ({ page, request }) => {
  await publishMode(request, "restricted_race");
  await open(page, request);
  await button(page).click();
  await expect(page.getByTestId("status-live")).toHaveText("This listing is now restricted, so it cannot be republished any more. We loaded the latest version.");
  await expect(page.getByTestId("republish-forbidden")).toHaveText("This listing cannot be republished.");
  await expect(page.getByTestId("republish-section")).toHaveCount(0);
  expect((await stats(request)).used).toEqual({});

  // A plain forbidden (a persistent CSRF or account refusal) on a listing that is not restricted is the generic message, never the restricted one.
  await request.get(`${STUB}/__reset`);
  await publishMode(request, "forbidden");
  await open(page, request);
  await button(page).click();
  await expect(note(page)).toHaveText("This request could not be submitted. Please try again.");
  await expect(page.getByTestId("republish-section")).toBeVisible();
  await expect(page.getByTestId("draft-status")).toHaveText("Archived");
  expect((await stats(request)).attempts).toHaveLength(2); // the stale-token retry, once, with the same key
});

test("the status moved under a republication: the page says what the listing is now and why Republish is gone", async ({ page, request }) => {
  const cases: [string, string][] = [
    ["conflict_sold", "This listing is now sold, so it cannot be republished any more. We loaded the latest version."],
    ["stale_removed", "This listing is now removed, so it cannot be republished any more. We loaded the latest version."],
    ["conflict_published_restricted", "This listing is now restricted, so it cannot be republished any more. We loaded the latest version."],
  ];
  for (const [mode, text] of cases) {
    await request.get(`${STUB}/__reset`);
    await publishMode(request, mode);
    await open(page, request);
    await button(page).click();
    await expect(page.getByTestId("status-live"), mode).toHaveText(text);
    await expect(page.getByTestId("republish-section"), mode).toHaveCount(0);
    await expect(page.getByTestId("publish-live"), mode).toHaveText("");
  }
});

test("a 200 without publication_kind gives the neutral announcement", async ({ page, request }) => {
  await publishMode(request, "no_kind");
  await open(page, request);
  await button(page).click();
  await expect(live(page)).toContainText("Republished. Your listing is visible to everyone again.");
  await expect(page.getByTestId("draft-status")).toHaveText("Published");
});

test("an edit after a failed attempt starts a new attempt with a new key", async ({ page, request }) => {
  await publishMode(request, "error");
  await open(page, request);
  await button(page).click();
  await expect(page.getByTestId("republish-retry")).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("Corner house with a bigger garden");
  await save(page);
  await button(page).click();
  await expect.poll(async () => (await stats(request)).attempts.length).toBe(2);
  const { attempts } = await stats(request);
  expect(attempts[1].key).not.toBe(attempts[0].key);
});

test("the publish key and the republish key of one listing differ", async ({ page, request }) => {
  await preset(request, "publish_ready");
  await request.get(`${STUB}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
  await page.goto(`${LIST}/${id(1)}`);
  await page.getByTestId("publish-button").click();
  await expect(live(page)).toContainText("Your listing is published.");
  await page.getByTestId("status-archived").click();
  await page.getByTestId("status-confirm").click();
  await expect(page.getByTestId("republish-section")).toBeVisible();
  await button(page).click();
  await expect(live(page)).toContainText(FREE);
  const { attempts } = await stats(request);
  expect(attempts.map((attempt) => attempt.op)).toEqual(["publish", "republish"]);
  expect(attempts[1].key).not.toBe(attempts[0].key);
});

test("sold and rented pages say to archive first beside the Archive action and offer no Republish; removed has neither", async ({ page, request }) => {
  await open(page, request, "restricted_sold");
  await expect(page.getByTestId("republish-archive-first")).toHaveCount(0);
  await expect(page.getByTestId("republish-section")).toHaveCount(0);
  for (const which of ["sold_one", "rented_one"]) {
    await open(page, request, which);
    await expect(page.getByTestId("republish-archive-first")).toHaveText("Archive this listing first to republish it.");
    await expect(page.getByTestId("status-section").getByRole("button")).toHaveText(["Archive"]);
    await expect(page.getByTestId("republish-section")).toHaveCount(0);
    await expect(button(page)).toHaveCount(0);
  }
  await open(page, request, "removed_one");
  await expect(page.getByTestId("republish-archive-first")).toHaveCount(0);
  await expect(page.getByTestId("republish-section")).toHaveCount(0);
  // Archiving a sold listing then offers Republish.
  await open(page, request, "sold_one");
  await page.getByTestId("status-archived").click();
  await page.getByTestId("status-confirm").click();
  await expect(page.getByTestId("republish-section")).toBeVisible();
  await expect(page.getByTestId("republish-archive-first")).toHaveCount(0);
});

for (const viewport of viewports) {
  test(`axe at ${viewport.name}: archived, errors, quota exhausted, free and counted outcomes, sold note`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await open(page, request);
    await expectNoViolations(page, `${viewport.name} archived with Republish`);

    await request.get(`${STUB}/__reset`);
    await open(page, request, "archived_empty");
    await button(page).click();
    await expect(summary(page)).toBeFocused();
    await expectNoViolations(page, `${viewport.name} errors`);

    await request.get(`${STUB}/__reset`);
    await publishMode(request, "quota");
    await open(page, request);
    await button(page).click();
    await expect(note(page)).toBeFocused();
    await expectNoViolations(page, `${viewport.name} quota exhausted`);

    await request.get(`${STUB}/__reset`);
    await open(page, request, "archived_free");
    await button(page).click();
    await expect(live(page)).toContainText(FREE);
    await expectNoViolations(page, `${viewport.name} free`);

    await request.get(`${STUB}/__reset`);
    await open(page, request);
    await button(page).click();
    await expect(live(page)).toContainText(COUNTED);
    await expectNoViolations(page, `${viewport.name} counted`);

    await request.get(`${STUB}/__reset`);
    await open(page, request, "sold_one");
    await expect(page.getByTestId("republish-archive-first")).toBeVisible();
    await expectNoViolations(page, `${viewport.name} sold note`);

    await request.get(`${STUB}/__reset`);
    await open(page, request, "restricted_archived");
    await expectNoViolations(page, `${viewport.name} restricted archived`);
  });
}
