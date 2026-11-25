import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Story 2.13, frontend half: the owner's Preview page, the Delete draft action with its confirmation, and the draft_expiring notification,
// against the stub backend (which mirrors the backend's preview and delete rules).
const STUB = STUB_URL;
const APP = APP_URL;
const LIST = "/account/listings";
const SERVER = "Something went wrong on our side. Please try again in a moment.";
const THROTTLED = "Too many attempts. Try again in 2 minutes.";
const NOT_FOUND = "We could not find that listing.";
const BANNER = "This is a preview. Only you can see it.";
const DELETE_TEXT = "This deletes the draft and its images. This cannot be undone.";
const id = (seq: number) => `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`;
const SENTENCE = (days: string) => `Your draft has had no activity for a long time and will be deleted in ${days} unless you open it.`;

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

type Mode = "signin" | "listing-preview" | "listing-delete" | "listing-patch" | "image";
const setMode = (request: APIRequestContext, kind: Mode, value: string) => request.get(`${STUB}/__${kind}-mode?value=${value}`);
const preset = (request: APIRequestContext, value: string) => request.get(`${STUB}/__listings-preset?value=${value}`);
const stats = async (request: APIRequestContext) => (await request.get(`${STUB}/__listings-stats`)).json();

async function startSession(page: Page, request: APIRequestContext) {
  await request.get(`${STUB}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP }]);
}
async function openPreview(page: Page, request: APIRequestContext, which = "preview_rich") {
  await preset(request, which);
  await startSession(page, request);
  await page.goto(`${LIST}/${id(1)}/preview`);
  await expect(page.getByRole("heading", { level: 1, name: "Preview" })).toBeVisible();
}
async function openDraft(page: Page, request: APIRequestContext, which = "preview_rich") {
  await preset(request, which);
  await startSession(page, request);
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Draft" })).toBeVisible();
  // A published listing has no edit form.
  if (which.startsWith("published")) await expect(page.getByTestId("draft-status")).toBeVisible();
  else await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
}
const deleteButton = (page: Page) => page.getByTestId("delete-draft");
const dialog = (page: Page) => page.getByRole("dialog", { name: "Delete this draft?" });

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

// ---------------------------------------------------------------- preview

test("preview: the banner, the public projection, an empty Estimate and no private value @smoke", async ({ page, request }) => {
  await openPreview(page, request);
  await expect(page.getByTestId("preview-banner")).toHaveText(BANNER);
  await expect(page.getByTestId("preview-title-text")).toHaveText("Corner house with garden");
  await expect(page.getByTestId("preview-summary")).toHaveText("Sale · House · House");
  await expect(page.getByTestId("preview-price")).toHaveText("PKR 1,500,000.00 (Total)");
  await expect(page.getByTestId("preview-area")).toContainText("10 Marla, 272.25 sq ft per marla");
  await expect(page.getByTestId("preview-description")).toHaveText("Three bedrooms near the park.\nQuiet street.");
  await expect(page.getByTestId("preview-location-city")).toBeVisible();
  await expect(page.getByTestId("preview-location-society")).toHaveText("Palm Society");
  await expect(page.getByTestId("preview-location-phase")).toHaveText("Phase Two");
  await expect(page.getByTestId("preview-detail-bedrooms")).toHaveText("4");
  await expect(page.getByTestId("preview-detail-basement")).toHaveText("Yes");
  await expect(page.getByTestId("preview-amenities-on_property")).toContainText("Present");
  await expect(page.getByTestId("preview-amenities-nearby")).toContainText("Seller-declared");
  await expect(page.getByTestId("preview-estimate")).toHaveText("Not available yet");
  await expect(page.getByRole("heading", { level: 3, name: "Estimate" })).toBeVisible();
  const images = page.getByTestId("preview-images").getByRole("img");
  await expect(images).toHaveCount(2);
  await expect(images.first()).toHaveAttribute("src", `/api/v1/listings/${id(1)}/images/00000000-0000-4000-a000-000000000001/file`);
  // Nothing private, no edit control, no phone.
  const body = await page.locator("main").innerText();
  for (const secret of ["Cedar Lane", "Plot 12", "24.860000", "67.010000", "Street", "House number", "Latitude", "Revision", "Provenance"]) expect(body).not.toContain(secret);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /save|delete|upload/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to the draft" })).toHaveAttribute("href", `${LIST}/${id(1)}`);
  await expect(page).toHaveTitle("Preview | EstateAI");
  expect((await stats(request)).previewIds).toEqual([id(1)]);
});

test("preview: a Draft with almost nothing set still renders, without images", async ({ page, request }) => {
  await openPreview(page, request, "house_blank");
  await expect(page.getByTestId("preview-banner")).toHaveText(BANNER);
  await expect(page.getByTestId("preview-title-text")).toHaveText("Untitled listing");
  await expect(page.getByTestId("preview-no-images")).toBeVisible();
  await expect(page.getByTestId("preview-price")).toHaveText("Not set");
  await expect(page.getByTestId("preview-estimate")).toHaveText("Not available yet");
});

test("preview: the Draft page and a My listings row link to it, and the Back link returns", async ({ page, request }) => {
  await openDraft(page, request);
  await page.getByTestId("draft-preview-link").click();
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}/preview$`));
  await expect(page.getByTestId("preview-banner")).toBeVisible();
  await page.getByRole("link", { name: "Back to the draft" }).click();
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}$`));
  await page.goto(LIST);
  await page.getByTestId("listing-preview-link").first().click();
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}/preview$`));
  await expect(page.getByTestId("preview-banner")).toBeVisible();
});

test("preview: a Visitor is sent to sign in and back", async ({ page, request }) => {
  await preset(request, "preview_rich");
  await page.goto(`${LIST}/${id(1)}/preview`);
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=${encodeURIComponent(`${LIST}/${id(1)}/preview`)}$`));
});

for (const [name, mode] of [["not found", "not_found"], ["forbidden", "forbidden"]] as const) {
  test(`preview: ${name} reads as one not-found answer`, async ({ page, request }) => {
    await setMode(request, "listing-preview", mode);
    await openPreview(page, request).catch(() => undefined);
    await expect(page.getByTestId("preview-not-found")).toHaveText(NOT_FOUND);
    await expect(page.getByTestId("preview-banner")).toHaveCount(0);
  });
}

test("preview: an id that is not an id is not found without a request", async ({ page, request }) => {
  await preset(request, "preview_rich");
  await startSession(page, request);
  await page.goto(`${LIST}/not-an-id/preview`);
  await expect(page.getByTestId("preview-not-found")).toHaveText(NOT_FOUND);
  expect((await stats(request)).previewGets).toBe(0);
});

test("preview: another account's, an unknown id and an administrator all read as not found", async ({ page, request }) => {
  await preset(request, "foreign");
  await startSession(page, request);
  await page.goto(`${LIST}/${id(900)}/preview`);
  await expect(page.getByTestId("preview-not-found")).toHaveText(NOT_FOUND);
  await page.goto(`${LIST}/${id(77)}/preview`);
  await expect(page.getByTestId("preview-not-found")).toHaveText(NOT_FOUND);
});

test("preview: a failed read shows the load error and Retry loads it", async ({ page, request }) => {
  await setMode(request, "listing-preview", "flaky");
  await preset(request, "preview_rich");
  await startSession(page, request);
  await page.goto(`${LIST}/${id(1)}/preview`);
  await expect(page.getByTestId("load-error-message")).toHaveText("Check your connection and try again.");
  await expect(page.getByText("Internal detail that must not show.")).toHaveCount(0);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("preview-banner")).toBeVisible();
});

test("preview: rate limited shows the wait; a body for another listing is refused; a session that ended signs in again", async ({ page, request }) => {
  await setMode(request, "listing-preview", "rate_limited");
  await openPreview(page, request).catch(() => undefined);
  await expect(page.getByTestId("load-error-message")).toHaveText(THROTTLED);
  await setMode(request, "listing-preview", "other_id");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("load-error-message")).toHaveText("Check your connection and try again.");
  await setMode(request, "listing-preview", "malformed");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("load-error-message")).toBeVisible();
  await setMode(request, "listing-preview", "session_gone");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=${encodeURIComponent(`${LIST}/${id(1)}/preview`)}$`));
});

test("preview: nothing is stored, logged or put in the URL, and every image is a same-origin owner route @smoke", async ({ page, request }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  page.on("pageerror", (error) => logs.push(error.message));
  await openPreview(page, request);
  await expect(page.getByTestId("preview-estimate")).toBeVisible();
  expect(new URL(page.url()).search + new URL(page.url()).hash).toBe("");
  const stored = await page.evaluate(async () => {
    const databases = (await indexedDB.databases?.()) ?? [];
    return JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie, databases, await caches.keys()]);
  });
  for (const secret of ["Cedar Lane", "Plot 12", "24.860000", "Corner house", id(1)]) expect(stored).not.toContain(secret);
  expect(await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))).toBe("[{},{}]");
  expect(await page.evaluate(() => [...document.querySelectorAll("img")].every((img) => img.src.startsWith(`${location.origin}/api/v1/listings/`)))).toBe(true);
  const logged = logs.filter((line) => !/Download the React DevTools|Fast Refresh|\[HMR\]/.test(line)).join("\n");
  for (const secret of ["Cedar Lane", "Plot 12", "24.860000", "Corner house", id(1)]) expect(logged).not.toContain(secret);
});

for (const viewport of viewports) {
  test(`accessibility (${viewport.name}): the preview and its states have no axe violations`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openPreview(page, request);
    await expect(page.getByTestId("preview-amenities-nearby")).toBeVisible();
    await expectNoViolations(page, "preview");
    await page.goto(`${LIST}/${id(77)}/preview`);
    await expect(page.getByTestId("preview-not-found")).toBeVisible();
    await expectNoViolations(page, "preview not found");
  });
}

// ---------------------------------------------------------------- delete

test("delete: the dialog names what is deleted; Escape and Cancel keep the draft and return focus @smoke", async ({ page, request }) => {
  await openDraft(page, request);
  await expect(page.getByRole("heading", { level: 2, name: "Delete this draft" })).toBeVisible();
  await deleteButton(page).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByText(DELETE_TEXT)).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  // Focus stays inside the dialog.
  await page.keyboard.press("Tab");
  await expect(dialog(page).getByRole("button", { name: "Delete draft" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog(page).getByRole("button", { name: "Delete draft" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(deleteButton(page)).toBeFocused();
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(deleteButton(page)).toBeFocused();
  expect((await stats(request)).deletes).toEqual([]);
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}$`));
});

test("delete: confirming sends DELETE with the CSRF token, goes to My listings with a polite confirmation and the draft is gone @smoke", async ({ page, request }) => {
  await openDraft(page, request);
  // Unsaved edits are discarded without a second prompt.
  await page.getByLabel("Title", { exact: true }).fill("An edit that was never saved");
  let prompted = false;
  page.on("dialog", () => {
    prompted = true;
  });
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(page).toHaveURL(new RegExp(`${LIST}$`));
  await expect(page.getByTestId("listings-flash")).toHaveText("Draft deleted.");
  await expect(page.getByTestId("listings-flash")).toHaveAttribute("role", "status");
  await expect(page.getByTestId("listings-empty")).toBeVisible();
  const after = await stats(request);
  expect(after.deletes).toEqual([id(1)]);
  expect(after.deleteTokens[0]).toMatch(/^csrf-/);
  expect(prompted).toBe(false);
  // Reading the deleted draft is a not-found page.
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByTestId("draft-not-found")).toHaveText(NOT_FOUND);
});

test("delete: the confirmation is announced from an empty status region, shows once across client-side navigation, and not on a later visit", async ({ page, request }) => {
  await openDraft(page, request, "few");
  await page.evaluate(() => ((window as unknown as { __kept: number }).__kept = 1));
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(page).toHaveURL(new RegExp(`${LIST}$`));
  const flash = page.getByTestId("listings-flash");
  await expect(flash).toHaveText("Draft deleted.");
  await expect(flash).toHaveAttribute("role", "status");
  // List -> another draft -> back to the list, all client-side: the message is not shown again.
  await page.getByRole("link", { name: /^Sale · Plot · Plot file/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(2)}$`));
  await page.getByRole("link", { name: "Back to My listings" }).click();
  await expect(page).toHaveURL(new RegExp(`${LIST}$`));
  await expect(page.getByTestId("listing").first()).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("listings-flash")).toHaveText("");
  expect(await page.evaluate(() => (window as unknown as { __kept?: number }).__kept)).toBe(1); // never a full reload
});

test("delete: a message whose page was never shown does not turn up on a later visit", async ({ page, request }) => {
  await openDraft(page, request, "few");
  await request.get(`${STUB}/__listings-mode?value=session_gone`);
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await request.get(`${STUB}/__listings-mode?value=ok`);
  await request.get(`${STUB}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP }]);
  await page.goto(LIST);
  await expect(page.getByTestId("listing").first()).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("listings-flash")).toHaveText("");
});

test("delete: a draft that is already gone (404) goes to My listings with its own line", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-delete", "not_found");
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(page).toHaveURL(new RegExp(`${LIST}$`));
  await expect(page.getByTestId("listings-flash")).toHaveText("That draft was already deleted.");
});

test("delete: a listing that is not a draft any more (409) says so and keeps the page", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-delete", "conflict");
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByTestId("delete-note")).toHaveText("A published listing cannot be deleted here.");
  await expect(page.getByTestId("delete-note")).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}$`));
  // The page was stale: the Listing is read again, its status flips and Delete and Save are gone.
  await expect(page.getByTestId("draft-status")).toHaveText("Published");
  await expect(deleteButton(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Save changes/ })).toHaveCount(0);
  await expect(page.getByTestId("draft-not-editable")).toBeVisible();
  await expect(page.getByTestId("delete-note")).toHaveText("A published listing cannot be deleted here.");
});

test("delete: a 404 that is not the backend's not-found answer is a failure and the page stays", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-delete", "html_404");
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(page.getByTestId("delete-error")).toHaveText("This request could not be submitted. Please try again.");
  await expect(page.getByTestId("delete-note")).toHaveText("This request could not be submitted. Please try again.");
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}$`));
  await expect(page.getByTestId("listings-flash")).toHaveCount(0);
});

for (const [name, mode, text] of [
  ["a server error", "error", SERVER],
  ["a rate limit", "rate_limited", THROTTLED],
  ["a refusal that is not a suspension", "forbidden", "This request could not be submitted. Please try again."],
] as const) {
  test(`delete: ${name} keeps the dialog with the error and a retry works`, async ({ page, request }) => {
    await openDraft(page, request);
    await setMode(request, "listing-delete", mode);
    await deleteButton(page).click();
    await dialog(page).getByRole("button", { name: "Delete draft" }).click();
    await expect(page.getByTestId("delete-error")).toHaveText(text);
    await expect(page.getByTestId("delete-error")).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}$`));
    await setMode(request, "listing-delete", "ok");
    await dialog(page).getByRole("button", { name: "Delete draft" }).click();
    await expect(page).toHaveURL(new RegExp(`${LIST}$`));
  });
}

test("delete: a suspended owner gets the exact account message", async ({ page, request }) => {
  await setMode(request, "signin", "suspended");
  await openDraft(page, request);
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(page.getByTestId("delete-error")).toHaveText("Your account cannot delete listings right now.");
});

test("delete: a stale CSRF token is renewed once; a session that ended signs in again", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-delete", "csrf_once");
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(page).toHaveURL(new RegExp(`${LIST}$`));
  await openDraft(page, request);
  await setMode(request, "listing-delete", "session_gone");
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=${encodeURIComponent(`${LIST}/${id(1)}`)}$`));
});

test("delete: a published listing has no delete action", async ({ page, request }) => {
  await openDraft(page, request, "published_one");
  await expect(page.getByTestId("draft-status")).toHaveText("Published");
  await expect(deleteButton(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Delete this draft" })).toHaveCount(0);
});

test("delete: while the delete runs, Save and the image actions are paused and a second delete is not sent", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-delete", "hold");
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(dialog(page).getByRole("button", { name: "Deleting…" })).toHaveAttribute("aria-disabled", "true");
  await dialog(page).getByRole("button", { name: "Deleting…" }).click({ force: true });
  await page.keyboard.press("Escape"); // does not cancel a running delete
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByTestId("delete-paused")).toHaveText("Saving and image changes are paused while the draft is deleted.");
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByLabel("Add images", { exact: true })).toHaveAttribute("aria-disabled", "true");
  await expect.poll(async () => (await stats(request)).deletes.length).toBe(1);
  expect((await stats(request)).deletes).toHaveLength(1);
  await request.get(`${STUB}/__listing-delete-release`);
  await expect(page).toHaveURL(new RegExp(`${LIST}$`));
  // Counted after the release too: the clicks on the running button and Escape sent nothing more.
  await page.waitForTimeout(300);
  expect((await stats(request)).deletes).toHaveLength(1);
});

test("delete: it waits for an image upload in flight, and an upload cannot start while it runs", async ({ page, request }) => {
  await openDraft(page, request, "images_none");
  await setMode(request, "image", "hold");
  await page.getByLabel("Add images", { exact: true }).setInputFiles([{ name: "a.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") }]);
  await expect(page.getByTestId("upload-status").first()).toHaveText("Uploading…");
  await expect(deleteButton(page)).toHaveAttribute("aria-disabled", "true");
  await deleteButton(page).click({ force: true });
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByTestId("delete-note")).toHaveText("Wait for the current save or image change to finish, then delete the draft.");
  expect((await stats(request)).deletes).toEqual([]);
  await request.get(`${STUB}/__image-release`);
  await expect(page.getByTestId("upload-status").first()).toHaveText("Uploaded");
  await deleteButton(page).click();
  await expect(dialog(page)).toBeVisible();
});

test("delete: it waits for a save in flight", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "slow");
  await page.getByLabel("Title", { exact: true }).fill("A title being saved");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeVisible();
  await deleteButton(page).click({ force: true });
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByTestId("delete-note")).toBeVisible();
  expect((await stats(request)).deletes).toEqual([]);
});

for (const viewport of viewports) {
  test(`accessibility (${viewport.name}): the Delete section and its dialog have no axe violations`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openDraft(page, request);
    await expectNoViolations(page, "draft with delete section");
    await deleteButton(page).click();
    await expect(dialog(page)).toBeVisible();
    await expectNoViolations(page, "delete dialog");
    await setMode(request, "listing-delete", "error");
    await dialog(page).getByRole("button", { name: "Delete draft" }).click();
    await expect(page.getByTestId("delete-error")).toHaveText(SERVER);
    await expectNoViolations(page, "delete dialog with an error");
  });
}

// ---------------------------------------------------------------- notification

for (const [days, text] of [["5", "5 days"], ["1", "1 day"], ["0", "0 days"]] as const) {
  test(`notification: listing.draft_expiring (${days}) reads as the fixed sentence and links to the draft`, async ({ page, request }) => {
    await request.get(`${STUB}/__notifications-preset?value=empty`);
    await request.get(`${STUB}/__notifications-add?kind=listing.draft_expiring&days_left=${days}&listing_id=${id(1)}`);
    await startSession(page, request);
    await page.goto("/account/notifications");
    const item = page.getByTestId("notification");
    await expect(item).toHaveCount(1);
    await expect(item).toContainText(SENTENCE(text));
    await expect(item.getByTestId("notification-link")).toHaveAttribute("href", `${LIST}/${id(1)}`);
    await expect(item.getByRole("link", { name: /^Open the draft\s*: Your draft has had no activity/ })).toBeVisible();
    await item.getByTestId("notification-link").click();
    await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}$`));
  });
}

for (const bad of ["-1", "366", "x"]) {
  test(`notification: an out-of-range days_left (${bad}) keeps the generic line and no link`, async ({ page, request }) => {
    await request.get(`${STUB}/__notifications-preset?value=empty`);
    await request.get(`${STUB}/__notifications-add?kind=listing.draft_expiring&days_left=${bad}&listing_id=${id(1)}`);
    await startSession(page, request);
    await page.goto("/account/notifications");
    await expect(page.getByTestId("notification")).toContainText("You have a notification.");
    await expect(page.getByTestId("notification-link")).toHaveCount(0);
  });
}

test("notification: a bad listing id keeps the sentence but gives no link", async ({ page, request }) => {
  await request.get(`${STUB}/__notifications-preset?value=empty`);
  await request.get(`${STUB}/__notifications-add?kind=listing.draft_expiring&days_left=3&listing_id=../admin`);
  await startSession(page, request);
  await page.goto("/account/notifications");
  await expect(page.getByTestId("notification")).toContainText(SENTENCE("3 days"));
  await expect(page.getByTestId("notification-link")).toHaveCount(0);
});

// ---------------------------------------------------------------- review additions

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const imageStats = async (request: APIRequestContext) => (await request.get(`${STUB}/__image-stats`)).json();
const patchStats = async (request: APIRequestContext) => (await request.get(`${STUB}/__listing-patch-stats`)).json();

test("delete: Escape twice during a running delete keeps the dialog; a failure then shows on the dialog and the page, and Delete works again", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-delete", "hold_fail");
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(dialog(page).getByRole("button", { name: "Deleting…" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await dialog(page).getByRole("button", { name: "Cancel" }).click({ force: true }); // does not cancel a running delete
  await expect(dialog(page)).toBeVisible();
  await request.get(`${STUB}/__listing-delete-release`);
  await expect(page.getByTestId("delete-error")).toHaveText(SERVER);
  await expect(page.getByTestId("delete-note")).toHaveText(SERVER);
  await expect(dialog(page).getByRole("button", { name: "Delete draft" })).not.toHaveAttribute("aria-disabled", "true");
  // Even when the platform closes the dialog, the failure stays on the page and Delete opens it again.
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(deleteButton(page)).toBeFocused();
  await expect(page.getByTestId("delete-note")).toHaveText(SERVER);
  await setMode(request, "listing-delete", "ok");
  await deleteButton(page).click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByTestId("delete-error")).toHaveCount(0);
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(page).toHaveURL(new RegExp(`${LIST}$`));
});

test("delete: when the navigation never happens the page is given back with a message", async ({ page, request }) => {
  await openDraft(page, request);
  await page.route(/\/account\/listings\?_rsc=/, () => undefined); // the navigation request is never answered
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(page.getByTestId("delete-note")).toHaveText("The draft was deleted, but My listings could not be opened. Use the link at the bottom of the page.", { timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Back to My listings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).not.toHaveAttribute("aria-disabled", "true");
});

test("preview link: the hint appears only while the form has unsaved changes", async ({ page, request }) => {
  await openDraft(page, request);
  await expect(page.getByTestId("preview-hint")).toHaveCount(0);
  await page.getByLabel("Title", { exact: true }).fill("Something not saved yet");
  await expect(page.getByTestId("preview-hint")).toHaveText("Preview shows your saved changes.");
  await expect(page.getByTestId("draft-preview-link")).toHaveAccessibleDescription("Preview shows your saved changes.");
  await page.getByTestId("draft-preview-link").click();
  await expect(page.getByTestId("preview-title-text")).toHaveText("Corner house with garden"); // the saved title, not the typed one
});

test("preview: a body that wrongly carries owner-only data and an estimate renders none of it", async ({ page, request }) => {
  await setMode(request, "listing-preview", "leaky");
  await openPreview(page, request);
  await expect(page.getByTestId("preview-estimate")).toHaveText("Not available yet");
  const body = await page.locator("main").innerText();
  for (const secret of ["Cedar Lane", "Plot 12", "24.860000", "67.010000", "+923001234567", "3001234567", "manual", "77", "private", "Revision", "Provenance", "Visibility"]) expect(body).not.toContain(secret);
  await expect(page.getByText("value")).toHaveCount(0);
});

test("preview: public keys that are all null render as not set, with nothing broken", async ({ page, request }) => {
  await setMode(request, "listing-preview", "nulls");
  await openPreview(page, request);
  await expect(page.getByTestId("preview-price")).toHaveText("Not set");
  await expect(page.getByTestId("preview-area")).toHaveText("Not set");
  await expect(page.getByTestId("preview-location-city")).toHaveCount(0);
  await expect(page.getByTestId("preview-detail-bedrooms")).toHaveCount(0);
  await expect(page.getByTestId("preview-estimate")).toHaveText("Not available yet");
});

test("published listing: the Draft page and My listings link to its preview, which renders its images", async ({ page, request }) => {
  await openDraft(page, request, "published_with_images");
  await expect(page.getByTestId("draft-status")).toHaveText("Published");
  await expect(page.getByTestId("draft-preview-link")).toBeVisible();
  await page.goto(LIST);
  await expect(page.getByTestId("listing-preview-link")).toHaveCount(1);
  await page.getByTestId("listing-preview-link").click();
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}/preview$`));
  await expect(page.getByTestId("preview-banner")).toHaveText(BANNER);
  await expect(page.getByTestId("preview-title-text")).toHaveText("Published house");
  await expect(page.getByTestId("preview-price")).toHaveText("PKR 2,500,000.00 (Total)");
  await expect(page.getByTestId("preview-images").getByRole("img")).toHaveCount(2);
  await expect(page.getByTestId("preview-images").getByRole("img").first()).toHaveAttribute("src", `/api/v1/listings/${id(1)}/images/00000000-0000-4000-a000-000000000001/file`);
});

test("preview: a Suspended owner can still read it", async ({ page, request }) => {
  await setMode(request, "signin", "suspended");
  await openPreview(page, request);
  await expect(page.getByTestId("preview-banner")).toHaveText(BANNER);
});

for (const [name, mode] of [["a bad request (400)", "bad_request"], ["an unprocessable id (422)", "unprocessable"]] as const) {
  test(`preview: ${name} reads as not found`, async ({ page, request }) => {
    await setMode(request, "listing-preview", mode);
    await openPreview(page, request);
    await expect(page.getByTestId("preview-not-found")).toHaveText(NOT_FOUND);
  });
}

test("preview: a session that is gone on the first load signs in again and returns", async ({ page, request }) => {
  await setMode(request, "listing-preview", "session_gone");
  await preset(request, "preview_rich");
  await startSession(page, request);
  await page.goto(`${LIST}/${id(1)}/preview`);
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=${encodeURIComponent(`${LIST}/${id(1)}/preview`)}$`));
});

test("preview: a bad id offers the way back to My listings", async ({ page, request }) => {
  await preset(request, "preview_rich");
  await startSession(page, request);
  await page.goto(`${LIST}/not-an-id/preview`);
  await expect(page.getByTestId("preview-not-found")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to My listings" })).toHaveAttribute("href", LIST);
});

for (const mode of ["error", "broken"] as const) {
  test(`preview: a ${mode} answer shows the load error without the server's words and Retry works`, async ({ page, request }) => {
    await setMode(request, "listing-preview", mode);
    await openPreview(page, request);
    await expect(page.getByTestId("load-error-message")).toHaveText("Check your connection and try again.");
    await expect(page.getByText("Internal detail that must not show.")).toHaveCount(0);
    await setMode(request, "listing-preview", "ok");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByTestId("preview-banner")).toBeVisible();
  });
}

test("preview: an answer that never comes ends in the load error", async ({ page, request }) => {
  test.setTimeout(60_000);
  await setMode(request, "listing-preview", "hang");
  await openPreview(page, request);
  await expect(page.getByTestId("load-error-message")).toBeVisible({ timeout: 30_000 });
});

test("delete: a stale CSRF token that stays refused is retried once with a new token, then fails", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-delete", "csrf_always");
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(page.getByTestId("delete-error")).toHaveText("This request could not be submitted. Please try again.");
  const after = await stats(request);
  expect(after.deletes).toHaveLength(2); // the request and exactly one retry
  expect(after.deleteTokens[0]).not.toBe(after.deleteTokens[1]);
});

test("delete: a slow answer shows the working state until it arrives", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-delete", "slow");
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(dialog(page).getByRole("button", { name: "Deleting…" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${LIST}$`));
});

test("delete: a connection that breaks shows the server error and keeps the page", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-delete", "broken");
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(page.getByTestId("delete-error")).toHaveText(SERVER); // the proxy answers a broken connection with a 5xx
  await expect(page).toHaveURL(new RegExp(`${LIST}/${id(1)}$`));
});

test("delete: an answer that never comes ends in the timeout message", async ({ page, request }) => {
  test.setTimeout(60_000);
  await openDraft(page, request);
  await setMode(request, "listing-delete", "hang");
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect(page.getByTestId("delete-error")).toHaveText("The server took too long to answer. Please try again.", { timeout: 30_000 });
  await expect(dialog(page).getByRole("button", { name: "Delete draft" })).not.toHaveAttribute("aria-disabled", "true");
});

test("delete locks: while it runs, Enter-submit, an upload, cover, reorder and image removal do nothing", async ({ page, request }) => {
  await openDraft(page, request, "images_three");
  await setMode(request, "listing-delete", "hold");
  await deleteButton(page).click();
  await dialog(page).getByRole("button", { name: "Delete draft" }).click();
  await expect.poll(async () => (await stats(request)).deletes.length).toBe(1);
  await page.getByLabel("Title", { exact: true }).evaluate((input: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "Typed during the delete");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.form?.requestSubmit(); // what Enter in a field does
  });
  await page.getByLabel("Add images", { exact: true }).setInputFiles([{ name: "late.png", mimeType: "image/png", buffer: PNG }]);
  for (const name of [/^Move later/, /^Move earlier/, /^Set as cover/, /^Delete/]) {
    const buttons = page.getByTestId("image-item").getByRole("button", { name });
    for (let i = 0; i < (await buttons.count()); i += 1) await buttons.nth(i).evaluate((node: HTMLElement) => node.click());
  }
  for (const confirm of await page.getByRole("button", { name: /^Yes, delete/ }).all()) await confirm.evaluate((node: HTMLElement) => node.click());
  await page.waitForTimeout(500);
  const sent = await imageStats(request);
  expect(sent.attempts).toBe(0);
  expect(sent.uploads).toHaveLength(0);
  expect(sent.orderBodies).toHaveLength(0);
  expect(sent.deletes).toHaveLength(0);
  expect((await patchStats(request)).count).toBe(0);
  await request.get(`${STUB}/__listing-delete-release`);
  await expect(page).toHaveURL(new RegExp(`${LIST}$`));
});

for (const days of ["365"]) {
  test(`notification: ${days} days is the largest valid value`, async ({ page, request }) => {
    await request.get(`${STUB}/__notifications-preset?value=empty`);
    await request.get(`${STUB}/__notifications-add?kind=listing.draft_expiring&days_left=${days}&listing_id=${id(1)}`);
    await startSession(page, request);
    await page.goto("/account/notifications");
    await expect(page.getByTestId("notification")).toContainText(SENTENCE("365 days"));
  });
}

for (const [name, query] of [["a fraction (2.5)", "days_left=2.5"], ['a string ("5")', "days_text=5"]] as const) {
  test(`notification: ${name} for days_left keeps the generic line and no link`, async ({ page, request }) => {
    await request.get(`${STUB}/__notifications-preset?value=empty`);
    await request.get(`${STUB}/__notifications-add?kind=listing.draft_expiring&${query}&listing_id=${id(1)}`);
    await startSession(page, request);
    await page.goto("/account/notifications");
    await expect(page.getByTestId("notification")).toContainText("You have a notification.");
    await expect(page.getByTestId("notification-link")).toHaveCount(0);
  });
}

for (const viewport of viewports) {
  test(`accessibility (${viewport.name}): the notification list with the draft link has no axe violations`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await request.get(`${STUB}/__notifications-preset?value=empty`);
    await request.get(`${STUB}/__notifications-add?kind=listing.draft_expiring&days_left=4&listing_id=${id(1)}`);
    await startSession(page, request);
    await page.goto("/account/notifications");
    await expect(page.getByTestId("notification-link")).toBeVisible();
    await expectNoViolations(page, "notifications with a draft link");
  });
}
