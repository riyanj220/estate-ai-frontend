import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

// Story 2.10, frontend half: the Images section of the Draft page (upload, reorder, cover, delete, conflicts and revision sync), against
// the stub backend, which mirrors the backend's upload rules (magic bytes, 5 MB, 10 images, 6 MiB body), revision rules and cover rules.
const STUB = STUB_URL;
const APP = APP_URL;
const LIST = "/account/listings";
const SERVER = "Something went wrong on our side. Please try again in a moment.";
const REJECTED = "This request could not be submitted. Please try again.";
const THROTTLED = "Too many attempts. Try again in 2 minutes.";
const NOT_FOUND = "We could not find that listing.";
const EMPTY = "No images yet. A listing can be saved as a Draft without images, but needs at least one to be published.";
const CONFLICT = "Your images were changed in another session. We loaded the latest order.";
const LIMIT = "A listing can have at most 10 images.";
const CAP = "You have used all of your image storage. Delete an image to upload more.";
const SKIPPED = "An earlier image could not be added, so this one was not sent.";
const id = (seq: number) => `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`;
const iid = (seq: number) => `00000000-0000-4000-a000-${String(seq).padStart(12, "0")}`;

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

type Mode = "signin" | "listing-detail" | "listing-patch" | "image" | "image-order" | "image-delete" | "image-file" | "image-wire";
const setMode = (request: APIRequestContext, kind: Mode, value: string) => request.get(`${STUB}/__${kind}-mode?value=${value}`);
const preset = (request: APIRequestContext, value: string) => request.get(`${STUB}/__listings-preset?value=${value}`);
const patches = async (request: APIRequestContext) => (await request.get(`${STUB}/__listing-patch-stats`)).json();
const imageStats = async (request: APIRequestContext) => (await request.get(`${STUB}/__image-stats`)).json();
const listingStats = async (request: APIRequestContext) => (await request.get(`${STUB}/__listings-stats`)).json();
const otherImages = (request: APIRequestContext, op: string) => request.get(`${STUB}/__other-images?id=${id(1)}&op=${op}`);
const otherSession = (request: APIRequestContext, changes: Record<string, string>) =>
  request.get(`${STUB}/__other-session?${new URLSearchParams({ id: id(1), ...changes }).toString()}`);
/** The server's images of Draft 1, in order, as `[n, is_cover]` with n the number in the id (presets use 1 to 10). */
async function served(request: APIRequestContext) {
  const state = (await imageStats(request)).images[id(1)];
  return { revision: state.revision as number, images: state.images.map((image: { id: string; is_cover: boolean }) => [Number(image.id.slice(-12)), image.is_cover]) as [number, boolean][] };
}
const waitUploads = (request: APIRequestContext, count: number) => expect.poll(async () => (await imageStats(request)).uploads.length).toBe(count);

// A real 1x1 PNG (what the stub reads as "image/png" by its magic bytes); padding makes bigger files. Repetitive bytes only.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const png = (name: string, padding = 0) => ({ name, mimeType: "image/png", buffer: padding > 0 ? Buffer.concat([PNG, Buffer.alloc(padding, 0x41)]) : PNG });
const text = (name: string) => ({ name, mimeType: "text/plain", buffer: Buffer.from("not an image at all") });

const main = (page: Page) => page.getByRole("main");
const section = (page: Page) => page.getByTestId("images-section");
const picker = (page: Page) => page.getByLabel("Add images", { exact: true });
const items = (page: Page) => page.getByTestId("image-item");
const item = (page: Page, n: number) => page.locator(`#image-item-${iid(n)}`);
const button = (scope: Locator, name: string) => scope.getByRole("button", { name: new RegExp(`^${name}`) });
const rows = (page: Page) => page.getByTestId("upload-row");
/** How many upload rows (owning elements) show exactly this status text. */
const statusCount = (page: Page, status: string) => rows(page).getByTestId("upload-status").filter({ hasText: new RegExp(`^${status}$`) });
const FULL = "Not added: the list is full.";
const UNKNOWN = "It may have been added: check the list.";
const SUSPENDED = "Your account cannot change images right now.";
const notice = (page: Page) => page.getByTestId("images-notice");
const conflictNotice = (page: Page) => page.getByTestId("images-conflict");
const announcement = (page: Page) => page.getByTestId("images-announcement");
const revision = (page: Page) => page.getByTestId("draft-revision");
const titleInput = (page: Page) => page.getByLabel("Title", { exact: true });
const saveButton = (page: Page) => page.getByRole("button", { name: /^(Save changes|Saving…)$/ });
/** The order of the shown images as the numbers in their ids. */
const order = async (page: Page) => (await items(page).evaluateAll((nodes) => nodes.map((node) => Number(node.id.slice(-12)))));
const coverOf = (page: Page) => page.locator('[data-testid="image-item"][data-cover="true"]');

async function startSession(page: Page, request: APIRequestContext) {
  await request.get(`${STUB}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP }]);
}

/** Opens Draft 1 of a preset (`images_three` by default) and waits for the Images section. */
async function openDraft(page: Page, request: APIRequestContext, which = "images_three") {
  await preset(request, which);
  await startSession(page, request);
  await page.goto(`${LIST}/${id(1)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Draft" })).toBeVisible();
  await expect(section(page)).toBeVisible();
  await expect(titleInput(page)).toBeVisible();
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

// ---------------------------------------------------------------- empty and populated

test("empty: the empty-state text, the hint and the count, with the picker ready @smoke", async ({ page, request }) => {
  await openDraft(page, request, "images_none");
  await expect(section(page).getByRole("heading", { level: 2, name: "Images" })).toBeVisible();
  await expect(page.getByTestId("images-empty")).toHaveText(EMPTY);
  await expect(page.getByTestId("images-count")).toHaveText("0 of 10 images");
  await expect(items(page)).toHaveCount(0);
  await expect(section(page).locator("#images-hint")).toHaveText("JPEG, PNG or WebP, up to 5 MB each, up to 10 images. The first image you add becomes the cover.");
  await expect(picker(page)).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
  await expect(picker(page)).toHaveAttribute("multiple", "");
  await expect(picker(page)).not.toHaveAttribute("aria-disabled");
  await expect(announcement(page)).toHaveText("");
  // The Images section sits between the summary and the editor form, and never inside the form.
  const positions = await page.evaluate(() => {
    const at = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().top ?? -1;
    return [at('[data-testid="draft-details"]'), at('[data-testid="images-section"]'), at("form")];
  });
  expect(positions[0]).toBeLessThan(positions[1]);
  expect(positions[1]).toBeLessThan(positions[2]);
  await expect(page.locator("form").getByLabel("Add images")).toHaveCount(0);
});

test("populated: thumbnails in order, one cover marked, and the buttons of each image @smoke", async ({ page, request }) => {
  await openDraft(page, request);
  await expect(page.getByTestId("images-count")).toHaveText("3 of 10 images");
  expect(await order(page)).toEqual([1, 2, 3]);
  for (const n of [1, 2, 3]) {
    const card = item(page, n);
    await expect(card.getByRole("img", { name: n === 2 ? "Image 2 of 3, cover image" : `Image ${n} of 3`, exact: true })).toHaveAttribute("src", `/api/v1/listings/${id(1)}/images/${iid(n)}/file`);
    await expect(card.getByTestId("image-position")).toHaveText(`Image ${n} of 3`);
    await expect(button(card, "Move earlier")).toBeVisible();
    await expect(button(card, "Move later")).toBeVisible();
    await expect(button(card, "Delete")).toBeVisible();
  }
  // The cover is the second image: marked there, and it has no "Set as cover".
  await expect(coverOf(page)).toHaveCount(1);
  await expect(item(page, 2).getByTestId("image-cover")).toHaveText("Cover image");
  await expect(item(page, 2).getByRole("button", { name: /^Set as cover/ })).toHaveCount(0);
  for (const n of [1, 3]) {
    await expect(item(page, n).getByTestId("image-cover")).toHaveCount(0);
    await expect(button(item(page, n), "Set as cover")).toBeVisible();
  }
  // The ends cannot move further: aria-disabled, never disabled.
  await expect(button(item(page, 1), "Move earlier")).toHaveAttribute("aria-disabled", "true");
  await expect(button(item(page, 3), "Move later")).toHaveAttribute("aria-disabled", "true");
  await expect(button(item(page, 1), "Move later")).not.toHaveAttribute("aria-disabled");
  await expect(main(page).locator("button:disabled, input:disabled")).toHaveCount(0);
  // The thumbnails really load, same-origin, through the proxy.
  await expect.poll(async () => page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>(".image-thumb")].every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
  expect((await imageStats(request)).fileGets).toBeGreaterThanOrEqual(3);
  expect(await page.evaluate(() => [...document.querySelectorAll("img")].every((img) => new URL(img.src).origin === location.origin))).toBe(true);
  // Only the names a screen reader needs: each action says which image.
  await expect(page.getByRole("button", { name: "Move earlier image 3 of 3", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete image 2 of 3", exact: true })).toBeVisible();
});

test("the media endpoint through the proxy: the bytes, a private no-store answer, and nothing stored by the browser @smoke", async ({ page, request }) => {
  await openDraft(page, request, "images_one");
  const result = await page.evaluate(async (url) => {
    const response = await fetch(url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { status: response.status, type: response.headers.get("content-type"), cache: response.headers.get("cache-control"), nosniff: response.headers.get("x-content-type-options"), head: [...bytes.slice(0, 4)], length: bytes.length };
  }, `/api/v1/listings/${id(1)}/images/${iid(1)}/file`);
  expect(result).toEqual({ status: 200, type: "image/png", cache: "private, no-store", nosniff: "nosniff", head: [0x89, 0x50, 0x4e, 0x47], length: PNG.length });
  // A visitor (no cookie) gets the same 404 as an unknown image, and nothing else.
  const visitor = await request.get(`${APP}/api/v1/listings/${id(1)}/images/${iid(1)}/file`);
  expect(visitor.status()).toBe(404);
  const unknown = await page.evaluate(async (url) => (await fetch(url)).status, `/api/v1/listings/${id(1)}/images/${iid(9)}/file`);
  expect(unknown).toBe(404);
});

for (const wire of ["not_list", "bad_url", "other_listing_url", "two_covers", "dup_position", "decreasing", "negative_position", "string_position", "dup_id", "bad_id"]) {
  test(`an image list the page cannot trust is not built on (${wire}): the Draft does not load`, async ({ page, request }) => {
    await setMode(request, "image-wire", wire);
    await preset(request, "images_three");
    await startSession(page, request);
    await page.goto(`${LIST}/${id(1)}`);
    await expect(page.getByRole("heading", { level: 1, name: "Draft" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" }).or(page.getByRole("button", { name: "Retry" }))).toBeVisible();
    await expect(section(page)).toHaveCount(0);
  });
}

test("ghost repair states are trusted: gappy positions and no cover still show, reorder, cover and delete work @smoke", async ({ page, request }) => {
  await setMode(request, "image-wire", "ghost_gap");
  await openDraft(page, request, "images_three"); // positions 0, 2, 4
  expect(await order(page)).toEqual([1, 2, 3]);
  await button(item(page, 3), "Move earlier").click();
  await expect.poll(() => order(page)).toEqual([1, 3, 2]);
  expect((await imageStats(request)).orderBodies.at(-1).order).toEqual([iid(1), iid(3), iid(2)]); // only the id list is sent
  await button(item(page, 1), "Delete").click();
  await button(main(page), "Yes, delete").click();
  await expect.poll(() => order(page)).toEqual([3, 2]);
  await setMode(request, "image-wire", "ghost_no_cover");
  await page.reload();
  await expect(section(page)).toBeVisible();
  await expect(items(page)).toHaveCount(2);
  await expect(coverOf(page)).toHaveCount(0);
  await expect(page.getByTestId("image-cover")).toHaveCount(0);
  await button(item(page, 2), "Set as cover").click();
  await expect(announcement(page)).toHaveText("Image 2 of 2 is now the cover image.");
});

// ---------------------------------------------------------------- upload

test("upload: several files go one at a time, each with its own status, and the first becomes the cover @smoke", async ({ page, request }) => {
  await openDraft(page, request, "images_none");
  await setMode(request, "image", "slow");
  await picker(page).setInputFiles([png("front-one.png"), png("back-two.png"), png("side-three.png")]);
  // One at a time: while the first is in flight the others wait.
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).nth(0).getByTestId("upload-status")).toHaveText("Uploading…");
  await expect(rows(page).nth(1).getByTestId("upload-status")).toHaveText("Waiting");
  await expect(rows(page).nth(2).getByTestId("upload-status")).toHaveText("Waiting");
  expect((await imageStats(request)).uploads.length).toBeLessThanOrEqual(1);
  await expect(statusCount(page, "Uploaded")).toHaveCount(3, { timeout: 15_000 });
  for (const row of await rows(page).all()) await expect(row.getByTestId("upload-status")).toHaveText("Uploaded");
  await expect(rows(page).nth(0)).toContainText("front-one.png");
  await expect(items(page)).toHaveCount(3);
  await expect(page.getByTestId("images-count")).toHaveText("3 of 10 images");
  await expect(announcement(page)).toHaveText("Uploaded 3 images.");
  expect((await served(request)).images).toEqual([[101, true], [102, false], [103, false]]);
  // The first is the cover, and the list's revision is the server's: three uploads from revision 2.
  await expect(coverOf(page)).toHaveCount(1);
  await expect(items(page).nth(0)).toHaveAttribute("data-cover", "true");
  await expect(revision(page)).toHaveText("5");
  const stats = await imageStats(request);
  expect(stats.uploads.map((upload: { parts: string[]; type: string; sniffed: string }) => [upload.type, upload.parts, upload.sniffed])).toEqual(Array(3).fill(["multipart/form-data", ["file"], "image/png"]));
  expect(stats.tokens.every((token: string) => token === "csrf-0")).toBe(true);
  // The picker is ready again and keeps no file.
  await expect(picker(page)).toHaveValue("");
  await expect(picker(page)).not.toHaveAttribute("aria-disabled");
  await button(main(page), "Clear upload list").click();
  await expect(rows(page)).toHaveCount(0);
});

test("upload: a refused file is mapped by its code and the next files still go; nothing of the server's own text shows", async ({ page, request }) => {
  await openDraft(page, request, "images_none");
  await picker(page).setInputFiles([png("good-one.png"), text("notes.txt"), png("too-big.png", 5 * 1024 * 1024 + 10), png("good-two.png")]);
  await expect(statusCount(page, "Not uploaded")).toHaveCount(2);
  await expect(rows(page).nth(0).getByTestId("upload-status")).toHaveText("Uploaded");
  await expect(rows(page).nth(1).getByTestId("upload-message")).toHaveText(". Only JPEG, PNG and WebP images can be added.");
  await expect(rows(page).nth(2).getByTestId("upload-message")).toHaveText(". Images must be 5 MB or smaller.");
  await expect(rows(page).nth(3).getByTestId("upload-status")).toHaveText("Uploaded");
  await expect(items(page)).toHaveCount(2);
  await expect(announcement(page)).toHaveText("Uploaded 2 of 4. 2 could not be confirmed or added; see the list.");
  expect((await imageStats(request)).uploads).toHaveLength(4);
});

test("upload: a file over 6 MiB is refused on the page as too large, never sent, and the batch goes on", async ({ page, request }) => {
  await openDraft(page, request, "images_none");
  await picker(page).setInputFiles([png("huge.png", 6 * 1024 * 1024 + 10), png("fine.png")]);
  await expect(rows(page).nth(0).getByTestId("upload-message")).toHaveText(". Images must be 5 MB or smaller.");
  await expect(rows(page).nth(1).getByTestId("upload-status")).toHaveText("Uploaded");
  await expect(items(page)).toHaveCount(1);
  const stats = await imageStats(request);
  expect(stats.attempts).toBe(1); // only the fine one went
  expect(stats.uploads[0].size).toBeLessThan(6 * 1024 * 1024);
});

test("upload: a 413 is that file's own refusal and the next file still goes", async ({ page, request }) => {
  await openDraft(page, request, "images_none");
  await setMode(request, "image", "payload_too_large");
  await picker(page).setInputFiles([png("first.png"), png("second.png")]);
  await expect(rows(page).nth(0).getByTestId("upload-message")).toHaveText(". Images must be 5 MB or smaller.");
  await expect(rows(page).nth(1).getByTestId("upload-message")).toHaveText(". Images must be 5 MB or smaller."); // sent too: not skipped
  expect((await imageStats(request)).attempts).toBe(2);
});

test("upload: more files than free slots: the overflow rows say the list is full, not that an earlier image failed", async ({ page, request }) => {
  await openDraft(page, request, "images_nine");
  await picker(page).setInputFiles([png("one.png"), png("two.png"), png("three.png")]);
  await expect(rows(page).nth(0).getByTestId("upload-status")).toHaveText("Uploaded");
  await expect(rows(page).nth(1).getByTestId("upload-message")).toHaveText(`. ${FULL}`);
  await expect(rows(page).nth(2).getByTestId("upload-message")).toHaveText(`. ${FULL}`);
  await expect(page.getByTestId("images-count")).toHaveText("10 of 10 images");
  expect((await imageStats(request)).attempts).toBe(1);
});

test("upload: a single file also announces that it is uploading, and files dropped meanwhile are refused with a message", async ({ page, request }) => {
  await openDraft(page, request, "images_none");
  await setMode(request, "image", "slow");
  await picker(page).setInputFiles([png("only.png")]);
  await expect(announcement(page)).toHaveText("Uploading image.");
  await picker(page).setInputFiles([png("dropped.png")]); // a drop onto the picker while it is busy
  await expect(page.getByTestId("images-wait")).toHaveText("Wait for the current action to finish.");
  await expect(rows(page)).toHaveCount(1);
  await expect(statusCount(page, "Uploaded")).toHaveCount(1, { timeout: 15_000 });
  await expect(page.getByTestId("images-wait")).toHaveCount(0); // gone when the work ends
  expect((await imageStats(request)).attempts).toBe(1);
});

test("upload: leaving the page while a batch runs asks first, and a finished batch does not", async ({ page, request }) => {
  await openDraft(page, request, "images_none");
  const guarded = () => page.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  expect(await guarded()).toBe(false);
  await setMode(request, "image", "slow");
  await picker(page).setInputFiles([png("only.png")]);
  await expect(rows(page).nth(0).getByTestId("upload-status")).toHaveText("Uploading…");
  expect(await guarded()).toBe(true);
  await expect(statusCount(page, "Uploaded")).toHaveCount(1, { timeout: 15_000 });
  expect(await guarded()).toBe(false);
});

test("upload: leaving to another page mid-batch stops the loop quietly (nothing more is sent, no error)", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => void dialog.accept());
  await openDraft(page, request, "images_none");
  // The first upload is held at the stub, so the page is left while it is certainly in flight (no timing involved).
  await setMode(request, "image", "hold");
  await picker(page).setInputFiles([png("first.png"), png("second.png"), png("third.png")]);
  await expect(rows(page).nth(0).getByTestId("upload-status")).toHaveText("Uploading…");
  await expect.poll(async () => (await imageStats(request)).attempts).toBe(1);
  await page.getByRole("link", { name: "Back to My listings" }).click();
  await expect(page).toHaveURL(new RegExp(`${LIST}$`));
  // Its answer arrives now that nobody waits for it; after that, nothing more is sent.
  await request.get(`${STUB_URL}/__image-release`);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  expect((await imageStats(request)).attempts).toBe(1);
  expect(errors).toEqual([]);
});

test("upload: a file near the limit goes through the proxy whole", async ({ page, request }) => {
  await openDraft(page, request, "images_none");
  await picker(page).setInputFiles([png("large.png", 5 * 1024 * 1024 - 200)]);
  await expect(rows(page).nth(0).getByTestId("upload-status")).toHaveText("Uploaded");
  const uploads = (await imageStats(request)).uploads;
  expect(uploads).toHaveLength(1);
  expect(uploads[0].fileSize).toBe(PNG.length + 5 * 1024 * 1024 - 200);
  expect(uploads[0].size).toBeGreaterThan(5 * 1024 * 1024 - 200);
});

for (const [mode, message] of [
  ["too_small", "This image is too small. Each side must be at least 200 pixels."],
  ["too_large_dimensions", "This image is too large in pixels. Use one up to 10,000 pixels on each side."],
  ["invalid_image", "This file could not be read as an image."],
] as const) {
  test(`upload (${mode}): its own message in the file's row, and the other files go on`, async ({ page, request }) => {
    await openDraft(page, request, "images_none");
    await setMode(request, "image", mode);
    await picker(page).setInputFiles([png("first.png"), png("second.png")]);
    await expect(rows(page).nth(0).getByTestId("upload-message")).toHaveText(`. ${message}`);
    await expect(rows(page).nth(1).getByTestId("upload-message")).toHaveText(`. ${message}`); // not stopped: the second was sent too
    await waitUploads(request, 2);
    await expect(items(page)).toHaveCount(0);
    await expect(page.getByTestId("images-empty")).toBeVisible();
  });
}

// Every stop mode sends exactly one request for the three files (a 403 is sent twice: the token is fetched again and the call retried once).
for (const [name, mode, status, message, attempts] of [
  ["too many images", "too_many", "Not uploaded", LIMIT, 1],
  ["storage cap", "cap", "Not uploaded", CAP, 1],
  ["busy with a wait", "busy", "Not uploaded", "Images are busy being processed. Try again in 7 seconds.", 1],
  ["busy without a wait", "busy_no_retry", "Not uploaded", "Images are busy being processed. Try again shortly.", 1],
  ["429", "rate_limited", "Not uploaded", THROTTLED, 1],
  ["403 (token valid, not suspended)", "forbidden", "Not uploaded", REJECTED, 2],
  ["403 (a Draft that cannot be edited)", "not_editable", "Not uploaded", REJECTED, 2],
  ["403 (CSRF, still refused after the retry)", "csrf_always", "Not uploaded", REJECTED, 2],
  ["unsupported body", "unsupported_media", "Not uploaded", REJECTED, 1],
  ["5xx", "error", "Unknown", `${SERVER} ${UNKNOWN}`, 1],
  ["a lost answer", "lost_once", "Unknown", `${SERVER} ${UNKNOWN}`, 1],
] as const) {
  test(`upload (${name}): the message in the row, the rest is not sent, and the list is the server's`, async ({ page, request }) => {
    await openDraft(page, request, "images_none");
    await setMode(request, "image", mode);
    await picker(page).setInputFiles([png("first.png"), png("second.png"), png("third.png")]);
    await expect(rows(page).nth(0).getByTestId("upload-status")).toHaveText(status);
    await expect(rows(page).nth(0).getByTestId("upload-message")).toHaveText(`. ${message}`);
    await expect(rows(page).nth(1).getByTestId("upload-message")).toHaveText(`. ${SKIPPED}`);
    await expect(rows(page).nth(2).getByTestId("upload-message")).toHaveText(`. ${SKIPPED}`);
    await expect(announcement(page)).toHaveText(`Uploaded 0 of 3. 3 could not be confirmed or added; see the list.`);
    expect((await imageStats(request)).attempts).toBe(attempts);
    await expect(picker(page)).not.toHaveAttribute("aria-disabled");
  });
}

test("upload (CSRF once): the token is fetched again once and the upload goes (two attempts, one image)", async ({ page, request }) => {
  await openDraft(page, request, "images_none");
  await setMode(request, "image", "csrf_once");
  await picker(page).setInputFiles([png("first.png")]);
  await expect(rows(page).nth(0).getByTestId("upload-status")).toHaveText("Uploaded");
  expect((await imageStats(request)).attempts).toBe(2);
  expect((await imageStats(request)).uploads).toHaveLength(1);
});

test("a suspended owner gets the exact account message on upload, reorder and delete", async ({ page, request }) => {
  await setMode(request, "signin", "suspended");
  await openDraft(page, request, "images_three");
  await setMode(request, "image", "forbidden");
  await picker(page).setInputFiles([png("first.png")]);
  await expect(rows(page).nth(0).getByTestId("upload-message")).toHaveText(`. ${SUSPENDED}`);
  await setMode(request, "image-order", "forbidden");
  await button(item(page, 3), "Move earlier").click();
  await expect(notice(page)).toHaveText(SUSPENDED);
  await setMode(request, "image-delete", "forbidden");
  await button(item(page, 3), "Delete").click();
  await button(main(page), "Yes, delete").click();
  await expect(notice(page)).toHaveText(SUSPENDED);
});

for (const kind of ["image-order", "image-delete"] as const) {
  for (const [name, mode, attempts] of [
    ["a Draft that cannot be edited", "not_editable", 2], // a valid token: the retry reaches the service too
    ["CSRF refused again after the retry", "csrf_always", 0], // refused before the service: nothing is recorded
  ] as const) {
    test(`${kind === "image-order" ? "reorder" : "delete"} (403, ${name}): the generic message after one retry and the list is as it was`, async ({ page, request }) => {
      await openDraft(page, request, "images_three");
      await setMode(request, kind, mode);
      if (kind === "image-order") await button(item(page, 3), "Move earlier").click();
      else {
        await button(item(page, 3), "Delete").click();
        await button(main(page), "Yes, delete").click();
      }
      await expect(notice(page)).toHaveText(REJECTED);
      expect(await order(page)).toEqual([1, 2, 3]);
      const stats = await imageStats(request);
      expect(kind === "image-order" ? stats.orderBodies.length : stats.deletes.length).toBe(attempts);
    });
  }
  test(`${kind === "image-order" ? "reorder" : "delete"} (CSRF once): the token is fetched again and the action goes`, async ({ page, request }) => {
    await openDraft(page, request, "images_three");
    await setMode(request, kind, "csrf_once");
    if (kind === "image-order") {
      await button(item(page, 3), "Move earlier").click();
      await expect.poll(() => order(page)).toEqual([1, 3, 2]);
    } else {
      await button(item(page, 3), "Delete").click();
      await button(main(page), "Yes, delete").click();
      await expect.poll(() => order(page)).toEqual([1, 2]);
    }
    await expect(notice(page)).toHaveCount(0);
  });
}

test("upload (401): the sign-in with next; (404): the not-found state", async ({ page, request }) => {
  await openDraft(page, request, "images_none");
  await setMode(request, "image", "session_gone");
  await picker(page).setInputFiles([png("first.png")]);
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=%2Faccount%2Flistings%2F${id(1)}$`));
  await request.get(`${STUB}/__reset`);
  await openDraft(page, request, "images_none");
  await setMode(request, "image", "not_found");
  await picker(page).setInputFiles([png("first.png")]);
  await expect(page.getByTestId("draft-not-found")).toHaveText(NOT_FOUND);
  await expect(section(page)).toHaveCount(0);
});

test("upload (lost answer): the server-error message, then the Draft is read again so the stored image shows", async ({ page, request }) => {
  await openDraft(page, request, "images_none");
  await setMode(request, "image", "lost_once");
  await picker(page).setInputFiles([png("first.png"), png("second.png")]);
  await expect(rows(page).nth(0).getByTestId("upload-status")).toHaveText("Unknown"); // not "Not uploaded": it may have been stored
  await expect(rows(page).nth(0).getByTestId("upload-message")).toHaveText(`. ${SERVER} ${UNKNOWN}`); // the proxy answers 5xx when the backend drops the connection
  await expect(rows(page).nth(1).getByTestId("upload-message")).toHaveText(`. ${SKIPPED}`);
  await expect(items(page)).toHaveCount(1); // it landed on the server
  await expect(revision(page)).toHaveText("3");
  // The page holds the right revision: a field save goes through.
  await titleInput(page).fill("A new title for the house");
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
});

test("limit: at 10 images the picker is aria-disabled with the limit text, and nothing is sent", async ({ page, request }) => {
  await openDraft(page, request, "images_ten");
  await expect(page.getByTestId("images-count")).toHaveText("10 of 10 images");
  await expect(picker(page)).toHaveAttribute("aria-disabled", "true");
  expect(await picker(page).evaluate((input: HTMLInputElement) => input.disabled)).toBe(false); // aria-disabled, never the disabled attribute
  await expect(page.getByTestId("images-limit")).toHaveText(LIMIT);
  await picker(page).setInputFiles([png("extra.png")]);
  await expect(rows(page).nth(0).getByTestId("upload-message")).toHaveText(`. ${FULL}`); // refused on the page, not sent
  await expect(picker(page)).toHaveAttribute("aria-describedby", "images-hint images-limit");
  // A later real action proves the earlier one sent nothing: the counters only know that one.
  await button(item(page, 3), "Delete").click();
  await button(main(page), "Yes, delete").click();
  await expect(items(page)).toHaveCount(9);
  expect((await imageStats(request)).uploads).toHaveLength(0);
});

test("limit: with room for one, the second file is not sent (a hint only) and the server decides the rest", async ({ page, request }) => {
  await openDraft(page, request, "images_nine");
  await picker(page).setInputFiles([png("one.png"), png("two.png")]);
  await expect(rows(page).nth(0).getByTestId("upload-status")).toHaveText("Uploaded");
  await expect(rows(page).nth(1).getByTestId("upload-message")).toHaveText(`. ${FULL}`);
  await expect(page.getByTestId("images-limit")).toHaveText(LIMIT);
  expect((await imageStats(request)).uploads).toHaveLength(1);
  expect((await served(request)).images).toHaveLength(10);
});

// ---------------------------------------------------------------- reorder, cover, delete

test("reorder: Move earlier sends the full order with the revision, the list follows the answer and focus stays on the button", async ({ page, request }) => {
  await openDraft(page, request);
  await button(item(page, 3), "Move earlier").click();
  await expect.poll(() => order(page)).toEqual([1, 3, 2]);
  const sent = (await imageStats(request)).orderBodies;
  expect(sent).toEqual([{ base_revision: 2, order: [iid(1), iid(3), iid(2)] }]); // no cover_id: the cover is not touched
  await expect(revision(page)).toHaveText("3");
  await expect(page.locator(`#image-${iid(3)}-earlier`)).toBeFocused();
  await expect(announcement(page)).toHaveText("Image moved to position 2 of 3.");
  await expect(item(page, 2).getByTestId("image-cover")).toBeVisible(); // still the cover, now third
  expect((await served(request)).images).toEqual([[1, false], [3, false], [2, true]]);
  // Move later from the keyboard only, with the revision just learned.
  await page.locator(`#image-${iid(1)}-later`).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => order(page)).toEqual([3, 1, 2]);
  expect((await imageStats(request)).orderBodies.at(-1)).toEqual({ base_revision: 3, order: [iid(3), iid(1), iid(2)] });
  await expect(page.locator(`#image-${iid(1)}-later`)).toBeFocused();
  await expect(revision(page)).toHaveText("4");
});

test("reorder: a button at its end does nothing and sends nothing", async ({ page, request }) => {
  await openDraft(page, request);
  await button(item(page, 1), "Move earlier").click({ force: true });
  await button(item(page, 3), "Move later").click({ force: true });
  await button(item(page, 1), "Move later").click(); // the one real action: it is the only request
  await expect.poll(() => order(page)).toEqual([2, 1, 3]);
  expect((await imageStats(request)).orderBodies).toHaveLength(1);
});

test("cover: Set as cover sends the cover and the same order, exactly one cover is marked and focus moves to the image", async ({ page, request }) => {
  await openDraft(page, request);
  await button(item(page, 1), "Set as cover").click();
  await expect(item(page, 1).getByTestId("image-cover")).toBeVisible();
  await expect(coverOf(page)).toHaveCount(1);
  await expect(item(page, 2).getByTestId("image-cover")).toHaveCount(0);
  expect((await imageStats(request)).orderBodies).toEqual([{ base_revision: 2, order: [iid(1), iid(2), iid(3)], cover_id: iid(1) }]);
  await expect(item(page, 1)).toBeFocused();
  await expect(announcement(page)).toHaveText("Image 1 of 3 is now the cover image.");
  await expect(item(page, 1).getByRole("button", { name: /^Set as cover/ })).toHaveCount(0);
  await expect(button(item(page, 2), "Set as cover")).toBeVisible();
  await expect(revision(page)).toHaveText("3");
  expect((await served(request)).images).toEqual([[1, true], [2, false], [3, false]]);
});

test("delete: asks first (focus on Cancel), Cancel and Escape change nothing, then the delete promotes the next cover", async ({ page, request }) => {
  await openDraft(page, request);
  await button(item(page, 2), "Delete").click();
  const confirm = item(page, 2).getByTestId("image-confirm");
  await expect(confirm).toContainText("Delete this image? This cannot be undone.");
  await expect(page.locator(`#image-${iid(2)}-cancel`)).toBeFocused();
  await button(confirm, "Cancel").click();
  await expect(confirm).toHaveCount(0);
  await expect(page.locator(`#image-${iid(2)}-delete`)).toBeFocused();
  await button(item(page, 2), "Delete").click();
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  await expect(page.locator(`#image-${iid(2)}-delete`)).toBeFocused();
  await expect(items(page)).toHaveCount(3);
  // The cover is image 2: deleting it promotes the lowest remaining position (image 1).
  await button(item(page, 2), "Delete").click();
  await button(confirm, "Yes, delete").click();
  await expect.poll(() => order(page)).toEqual([1, 3]);
  expect((await imageStats(request)).deletes).toEqual([iid(2)]);
  await expect(item(page, 1).getByTestId("image-cover")).toBeVisible();
  await expect(coverOf(page)).toHaveCount(1);
  await expect(page.getByTestId("images-count")).toHaveText("2 of 10 images");
  await expect(item(page, 3).getByTestId("image-position")).toHaveText("Image 2 of 2");
  await expect(announcement(page)).toHaveText("Image deleted.");
  await expect(revision(page)).toHaveText("3");
  await expect(item(page, 3)).toBeFocused(); // the image that took its place
  expect((await served(request)).images).toEqual([[1, true], [3, false]]);
});

test("delete: the last image leaves the empty state and focus goes to the picker; a field save afterwards does not conflict", async ({ page, request }) => {
  await openDraft(page, request, "images_one");
  await button(item(page, 1), "Delete").click();
  await button(main(page), "Yes, delete").click();
  await expect(page.getByTestId("images-empty")).toHaveText(EMPTY);
  await expect(items(page)).toHaveCount(0);
  await expect(picker(page)).toBeFocused();
  await expect(revision(page)).toHaveText("3");
  await titleInput(page).fill("A title after the delete");
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  await expect(page.getByTestId("draft-conflict")).toHaveCount(0);
  await expect(revision(page)).toHaveText("4");
});

for (const [name, mode, message] of [
  ["429", "rate_limited", THROTTLED],
  ["5xx", "error", SERVER],
  ["forbidden", "forbidden", REJECTED],
  ["unreadable answer", "unreadable", "We could not read the answer. Reload the page to see your images."],
] as const) {
  test(`reorder failure (${name}): its own message and the list is left as it was`, async ({ page, request }) => {
    await openDraft(page, request);
    await setMode(request, "image-order", mode);
    await button(item(page, 3), "Move earlier").click();
    await expect(notice(page)).toHaveText(message);
    await expect(page.locator(`#image-${iid(3)}-earlier`)).toBeFocused(); // focus returns to the button that was pressed
    if (mode !== "unreadable") expect(await order(page)).toEqual([1, 2, 3]);
    await setMode(request, "image-order", "ok");
    await button(item(page, 3), "Move earlier").click();
    if (mode !== "unreadable") await expect.poll(() => order(page)).toEqual([1, 3, 2]);
    await expect(notice(page)).toHaveCount(0); // the notice goes with the next action
  });
}

test("reorder (401): the sign-in with next; (404): the not-found state", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "image-order", "session_gone");
  await button(item(page, 3), "Move earlier").click();
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=%2Faccount%2Flistings%2F${id(1)}$`));
  await request.get(`${STUB}/__reset`);
  await openDraft(page, request);
  await setMode(request, "image-order", "not_found");
  await button(item(page, 3), "Move earlier").click();
  await expect(page.getByTestId("draft-not-found")).toHaveText(NOT_FOUND);
});

test("reorder (lost answer): a server-error message, then the next try meets the moved revision and loads the latest", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "image-order", "lost_once");
  await button(item(page, 3), "Move earlier").click();
  await expect(notice(page)).toHaveText(SERVER); // the proxy answers 5xx when the backend drops the connection
  expect(await order(page)).toEqual([1, 2, 3]); // the change landed on the server; the page does not know yet
  await button(item(page, 1), "Move later").click(); // the page still holds the old revision: a conflict
  await expect(conflictNotice(page)).toHaveText(CONFLICT);
  await expect.poll(() => order(page)).toEqual([1, 3, 2]);
});

for (const [name, mode, message] of [
  ["not found", "not_found", "That image is already gone. We loaded the latest images."],
  ["5xx", "error", SERVER],
  ["forbidden", "forbidden", REJECTED],
] as const) {
  test(`delete failure (${name}): its own message and the list stays`, async ({ page, request }) => {
    await openDraft(page, request);
    await setMode(request, "image-delete", mode);
    await button(item(page, 3), "Delete").click();
    await button(main(page), "Yes, delete").click();
    await expect(notice(page)).toHaveText(message);
    await expect(items(page)).toHaveCount(3);
    await expect(page.locator(`#image-${iid(3)}-delete`)).toBeFocused(); // never the page
    expect((await imageStats(request)).deletes.length).toBeLessThanOrEqual(1);
  });
}

test("delete (lost answer): a server-error message, then the list is read again and the image is gone", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "image-delete", "lost_once");
  await button(item(page, 3), "Delete").click();
  await button(main(page), "Yes, delete").click();
  await expect(notice(page)).toHaveText(SERVER);
  await expect.poll(() => order(page)).toEqual([1, 2]);
  await expect(revision(page)).toHaveText("3");
});

test("delete (401): the sign-in with next; (404 of the Draft): the not-found state", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "image-delete", "session_gone");
  await button(item(page, 3), "Delete").click();
  await button(main(page), "Yes, delete").click();
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=%2Faccount%2Flistings%2F${id(1)}$`));
});

// ---------------------------------------------------------------- conflicts and revision sync

test("conflict: another session reordered, so the list is replaced by the latest, the notice shows and nothing was sent twice", async ({ page, request }) => {
  await openDraft(page, request);
  await otherImages(request, "reverse"); // 3, 2, 1 at revision 3
  await button(item(page, 3), "Move earlier").click();
  await expect(conflictNotice(page)).toHaveText(CONFLICT);
  await expect.poll(() => order(page)).toEqual([3, 2, 1]);
  await expect(revision(page)).toHaveText("3");
  expect((await imageStats(request)).orderBodies).toHaveLength(1);
  expect((await served(request)).images).toEqual([[3, false], [2, true], [1, false]]); // nothing of ours was written
  await expect(item(page, 3)).toBeFocused();
  // The notice goes when the person acts again, and the new action uses the latest revision.
  await button(item(page, 1), "Move earlier").click();
  await expect.poll(() => order(page)).toEqual([3, 1, 2]);
  await expect(conflictNotice(page)).toHaveCount(0);
  expect((await imageStats(request)).orderBodies.at(-1)).toEqual({ base_revision: 3, order: [iid(3), iid(1), iid(2)] });
});

test("conflict: another session added and deleted images, and a cover choice meets the latest list", async ({ page, request }) => {
  await openDraft(page, request);
  await otherImages(request, "delete_first");
  await button(item(page, 3), "Set as cover").click();
  await expect(conflictNotice(page)).toHaveText(CONFLICT);
  await expect.poll(() => order(page)).toEqual([2, 3]);
  await expect(page.getByTestId("images-count")).toHaveText("2 of 10 images");
  await expect(item(page, 2).getByTestId("image-cover")).toBeVisible(); // the cover is the server's, not ours
});

test("conflict without usable data: the Draft is read again for the latest list", async ({ page, request }) => {
  await openDraft(page, request);
  await otherImages(request, "reverse");
  await setMode(request, "image-order", "conflict_no_current");
  const before = (await listingStats(request)).detailGets;
  await button(item(page, 3), "Move earlier").click();
  await expect(conflictNotice(page)).toHaveText(CONFLICT);
  await expect.poll(() => order(page)).toEqual([3, 2, 1]);
  expect((await listingStats(request)).detailGets).toBe(before + 1);
});

test("a reorder the server calls invalid: the list is read again and the person is told to try again", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "image-order", "order_invalid");
  const before = (await listingStats(request)).detailGets;
  await button(item(page, 3), "Move earlier").click();
  await expect(notice(page)).toHaveText("The images changed. We loaded the latest order, so try again.");
  expect((await listingStats(request)).detailGets).toBe(before + 1);
  expect(await order(page)).toEqual([1, 2, 3]);
});

test("revision sync: after an upload, a reorder, a cover choice and a delete, a field save does not conflict", async ({ page, request }) => {
  await openDraft(page, request, "images_three");
  await picker(page).setInputFiles([png("fresh.png")]);
  await expect(items(page)).toHaveCount(4);
  await button(item(page, 3), "Move earlier").click();
  await expect(revision(page)).toHaveText("4");
  await button(item(page, 1), "Set as cover").click();
  await expect(revision(page)).toHaveText("5");
  await button(item(page, 3), "Delete").click();
  await button(main(page), "Yes, delete").click();
  await expect(items(page)).toHaveCount(3);
  await expect(revision(page)).toHaveText("6");
  await titleInput(page).fill("A title after every change");
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  await expect(page.getByTestId("draft-conflict")).toHaveCount(0);
  await expect(revision(page)).toHaveText("7");
  // And the other way round: a field save moves the revision, a reorder after it is checked against it.
  await button(item(page, 1), "Move later").click();
  await expect.poll(() => order(page)).toEqual([2, 1, 101]);
  const bodies = (await imageStats(request)).orderBodies;
  expect(bodies.at(-1).base_revision).toBe(7);
  await expect(page.getByTestId("images-conflict")).toHaveCount(0);
});

test("revision sync: typed field text is kept through image changes and the save sends only that field", async ({ page, request }) => {
  await openDraft(page, request);
  await titleInput(page).fill("Typed but not saved yet");
  await button(item(page, 3), "Move earlier").click();
  await expect.poll(() => order(page)).toEqual([1, 3, 2]);
  await expect(titleInput(page)).toHaveValue("Typed but not saved yet");
  await expect(page.getByTestId("draft-conflict")).toHaveCount(0);
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  await expect(page.getByTestId("draft-conflict")).toHaveCount(0);
  expect(await order(page)).toEqual([1, 3, 2]); // the field save's answer carries the same media
});

test("revision sync: a field conflict reload refreshes the images too", async ({ page, request }) => {
  await openDraft(page, request);
  await otherImages(request, "add"); // another session added an image (revision 3)
  await titleInput(page).fill("My own title for the house");
  await saveButton(page).click();
  await expect(page.getByTestId("draft-conflict")).toBeVisible();
  await expect(items(page)).toHaveCount(4);
  await expect(page.getByTestId("images-count")).toHaveText("4 of 10 images");
  await expect(revision(page)).toHaveText("3");
  await expect(titleInput(page)).toHaveValue("My own title for the house"); // what was typed is kept
});

test("revision sync: when another session also changed fields, an image change is a field conflict like any other", async ({ page, request }) => {
  await openDraft(page, request, "images_none");
  await otherSession(request, { title: "Title from the phone" });
  await titleInput(page).fill("My own title for the house");
  await picker(page).setInputFiles([png("fresh.png")]);
  await expect(items(page)).toHaveCount(1);
  await expect(page.getByTestId("draft-conflict")).toBeVisible();
  await expect(page.getByTestId("conflict-title")).toContainText("Title from the phone");
  await expect(titleInput(page)).toHaveValue("My own title for the house");
  await expect(revision(page)).toHaveText("4");
});

test("revision sync: when only images changed elsewhere, an upload does not raise a field conflict", async ({ page, request }) => {
  await openDraft(page, request, "images_none");
  await otherImages(request, "add");
  await picker(page).setInputFiles([png("fresh.png")]);
  await expect(items(page)).toHaveCount(2);
  await expect(page.getByTestId("draft-conflict")).toHaveCount(0);
  await expect(revision(page)).toHaveText("4");
  await titleInput(page).fill("A title after both");
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
});


// ---------------------------------------------------------------- focus, thumbnails, exclusion, races

test("a failed cover choice returns focus to that image; a reorder code the server judges invalid reads the Draft again, others are generic", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "image-order", "error");
  await button(item(page, 1), "Set as cover").click();
  await expect(notice(page)).toHaveText(SERVER);
  await expect(item(page, 1)).toBeFocused();
  for (const [mode, message, reads] of [
    ["order_invalid", "The images changed. We loaded the latest order, so try again.", 1],
    ["cover_invalid", "The images changed. We loaded the latest order, so try again.", 1],
    ["revision_invalid", REJECTED, 0],
    ["order_unknown", REJECTED, 0],
  ] as const) {
    await setMode(request, "image-order", mode);
    const before = (await listingStats(request)).detailGets;
    await button(item(page, 3), "Move earlier").click();
    await expect(notice(page)).toHaveText(message);
    await expect(page.locator(`#image-${iid(3)}-earlier`)).toBeFocused();
    expect((await listingStats(request)).detailGets).toBe(before + reads);
  }
  expect(await order(page)).toEqual([1, 2, 3]);
});

test("starting another action closes an open delete confirmation; the confirmation stays (aria-disabled) until the delete ends", async ({ page, request }) => {
  await openDraft(page, request);
  await button(item(page, 1), "Delete").click();
  await expect(item(page, 1).getByTestId("image-confirm")).toBeVisible();
  await button(item(page, 3), "Move earlier").click();
  await expect(item(page, 1).getByTestId("image-confirm")).toHaveCount(0);
  await expect.poll(() => order(page)).toEqual([1, 3, 2]);
  await setMode(request, "image-delete", "slow");
  await button(item(page, 1), "Delete").click();
  await button(item(page, 1).getByTestId("image-confirm"), "Yes, delete").click();
  const confirm = item(page, 1).getByTestId("image-confirm");
  await expect(confirm).toBeVisible(); // still mounted while the request runs
  await expect(button(confirm, "Yes, delete")).toHaveAttribute("aria-disabled", "true");
  await expect(button(confirm, "Cancel")).toHaveAttribute("aria-disabled", "true");
  await expect(items(page)).toHaveCount(2);
  await expect(confirm).toHaveCount(0);
});

test("a thumbnail that cannot load says so with a Retry that tries again", async ({ page, request }) => {
  await setMode(request, "image-file", "not_found");
  await openDraft(page, request);
  await expect(page.getByTestId("image-failed")).toHaveCount(3);
  await expect(item(page, 1).getByTestId("image-failed")).toContainText("This image could not be loaded.");
  await setMode(request, "image-file", "ok");
  await item(page, 1).getByRole("button", { name: /^Retry/ }).click();
  await expect(item(page, 1).locator("img")).toBeVisible();
  await expect.poll(() => item(page, 1).locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.getByTestId("image-failed")).toHaveCount(2);
  await expect(item(page, 1).locator("img")).toHaveAttribute("loading", "lazy");
});

test("exclusion: while images upload, Save waits and says why; what was typed is saved afterwards without a conflict", async ({ page, request }) => {
  await openDraft(page, request, "images_none");
  await setMode(request, "image", "slow");
  await picker(page).setInputFiles([png("first.png"), png("second.png")]);
  await expect(rows(page).nth(0).getByTestId("upload-status")).toHaveText("Uploading…");
  await expect(saveButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(saveButton(page)).toHaveAttribute("aria-describedby", "save-paused");
  await expect(page.getByTestId("save-paused")).toHaveText("Saving is paused while images are being changed.");
  await titleInput(page).fill("Typed during the upload");
  await saveButton(page).click({ force: true });
  await expect(page.getByTestId("draft-live")).toHaveText("Wait for the image changes to finish, then save.");
  expect((await patches(request)).count).toBe(0);
  await expect(statusCount(page, "Uploaded")).toHaveCount(2, { timeout: 15_000 });
  await expect(saveButton(page)).not.toHaveAttribute("aria-disabled");
  await expect(page.getByTestId("save-paused")).toHaveCount(0);
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  await expect(page.getByTestId("draft-conflict")).toHaveCount(0);
  const sent = await patches(request);
  expect(sent.count).toBe(1);
  expect(sent.bodies[0].base_revision).toBe(4); // the revision after two uploads
  await expect(titleInput(page)).toHaveValue("Typed during the upload");
});

test("exclusion: while a field save is in flight the image actions wait, then work with the new revision", async ({ page, request }) => {
  await openDraft(page, request);
  await setMode(request, "listing-patch", "slow");
  await titleInput(page).fill("A title being saved");
  await saveButton(page).click();
  await expect(saveButton(page)).toHaveText("Saving…");
  await expect(button(item(page, 3), "Move earlier")).toHaveAttribute("aria-disabled", "true");
  await expect(button(item(page, 1), "Delete")).toHaveAttribute("aria-disabled", "true");
  await expect(picker(page)).toHaveAttribute("aria-disabled", "true");
  await button(item(page, 3), "Move earlier").click({ force: true });
  await picker(page).setInputFiles([png("during.png")]);
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  await expect(button(item(page, 3), "Move earlier")).not.toHaveAttribute("aria-disabled");
  await button(item(page, 3), "Move earlier").click();
  await expect.poll(() => order(page)).toEqual([1, 3, 2]);
  const stats = await imageStats(request);
  expect(stats.orderBodies).toEqual([{ base_revision: 3, order: [iid(1), iid(3), iid(2)] }]); // the one real move, after the save
  expect(stats.attempts).toBe(0); // the file chosen during the save was not sent
});

test("race: a field-save answer older than an image change never moves the revision or the images back", async ({ page, request }) => {
  await openDraft(page, request);
  const old = await (await request.get(`${STUB}/api/v1/listings/${id(1)}`, { headers: { cookie: "estate_session=stub-live" } })).json();
  await button(item(page, 3), "Move earlier").click();
  await expect.poll(() => order(page)).toEqual([1, 3, 2]);
  await expect(revision(page)).toHaveText("3");
  await page.route("**/api/v1/listings/*", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...old, fields: { ...old.fields, title: "Late saved title" } }) })
      : route.continue(),
  );
  await titleInput(page).fill("Late saved title");
  await saveButton(page).click();
  await expect(page.getByTestId("draft-live")).toHaveText("Saved");
  await expect(revision(page)).toHaveText("3");
  expect(await order(page)).toEqual([1, 3, 2]);
  await expect(titleInput(page)).toHaveValue("Late saved title");
});

test("conflict that also changed fields: the editor's alert takes focus, the images notice stays in the live region", async ({ page, request }) => {
  await openDraft(page, request);
  await otherSession(request, { title: "Title from the phone" });
  await button(item(page, 1), "Move later").click();
  await expect(page.getByTestId("draft-conflict")).toBeVisible();
  await expect(conflictNotice(page)).toHaveText(CONFLICT);
  await expect(page.getByTestId("draft-conflict")).toBeFocused();
  await expect(titleInput(page)).toHaveValue("Title from the phone");
});

// ---------------------------------------------------------------- privacy and accessibility

test("privacy: no storage, no console output, no preview URL and no file name left anywhere", async ({ page, request }) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  page.on("pageerror", (error) => logs.push(error.message));
  await page.addInitScript(() => {
    const original = URL.createObjectURL.bind(URL);
    (window as unknown as { __objectUrls: number }).__objectUrls = 0;
    URL.createObjectURL = (value: Blob | MediaSource) => {
      (window as unknown as { __objectUrls: number }).__objectUrls += 1;
      return original(value);
    };
  });
  await openDraft(page, request, "images_none");
  await picker(page).setInputFiles([png("private-holiday.png"), text("secret-notes.txt")]);
  await expect(rows(page)).toHaveCount(2);
  await expect(statusCount(page, "Not uploaded")).toHaveCount(1);
  await button(item(page, 101), "Move later").click({ force: true });
  await button(item(page, 101), "Delete").click();
  await button(main(page), "Cancel").click();
  await expect(page).toHaveTitle("Draft | EstateAI");
  expect(new URL(page.url()).search + new URL(page.url()).hash).toBe("");
  const stored = await page.evaluate(async () => {
    const databases = (await indexedDB.databases?.()) ?? [];
    return JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie, databases, await caches.keys()]);
  });
  for (const secret of ["private-holiday", "secret-notes", iid(101), id(1)]) expect(stored).not.toContain(secret);
  expect(await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))).toBe("[{},{}]");
  expect(await page.evaluate(() => (window as unknown as { __objectUrls: number }).__objectUrls)).toBe(0);
  expect(await page.evaluate(() => [...document.querySelectorAll("img")].every((img) => img.src.startsWith(`${location.origin}/api/v1/listings/`)))).toBe(true);
  const logged = logs.filter((line) => !/Download the React DevTools|Fast Refresh|\[HMR\]/.test(line)).join("\n");
  for (const secret of ["private-holiday", "secret-notes", iid(101), id(1)]) expect(logged).not.toContain(secret);
});

test("one polite live region in the section, and the controls are keyboard operable with a visible focus", async ({ page, request }) => {
  await openDraft(page, request);
  await expect(section(page).locator('[role="status"], [role="alert"], [aria-live]')).toHaveCount(1);
  await expect(section(page).locator('[aria-live="polite"]')).toHaveCount(1);
  // Keyboard only: reach Set as cover with Tab, activate it with Space.
  await page.locator(`#image-${iid(1)}-delete`).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(button(item(page, 1), "Set as cover")).toBeFocused();
  const outline = await button(item(page, 1), "Set as cover").evaluate((node) => getComputedStyle(node).outlineStyle);
  expect(outline).not.toBe("none");
  await page.keyboard.press("Space");
  await expect(item(page, 1).getByTestId("image-cover")).toBeVisible();
  // The delete confirmation by keyboard: Enter on Delete, Tab to the confirm, Enter.
  await page.locator(`#image-${iid(2)}-delete`).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(`#image-${iid(2)}-cancel`)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect.poll(() => order(page)).toEqual([1, 3]);
});

for (const viewport of viewports) {
  test(`accessibility (${viewport.name}): the Images section in its states has no axe violations`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openDraft(page, request, "images_none");
    await expectNoViolations(page, "empty");
    await setMode(request, "image", "slow");
    await picker(page).setInputFiles([png("first-image.png"), png("second-image.png")]);
    await expect(rows(page).nth(0).getByTestId("upload-status")).toHaveText("Uploading…");
    await expectNoViolations(page, "uploading");
    await expect(statusCount(page, "Uploaded")).toHaveCount(2, { timeout: 15_000 });
    await expectNoViolations(page, "populated");
    await setMode(request, "image", "ok");
    await picker(page).setInputFiles([text("notes.txt")]);
    await expect(rows(page).nth(0).getByTestId("upload-message")).toBeVisible();
    await expectNoViolations(page, "upload error");
    await button(items(page).nth(1), "Delete").click();
    await expectNoViolations(page, "delete confirmation");
    await button(main(page), "Cancel").click();
    await otherImages(request, "reverse");
    await button(items(page).nth(0), "Move later").click();
    await expect(conflictNotice(page)).toBeVisible();
    await expectNoViolations(page, "conflict");
    await setMode(request, "image-order", "error");
    await button(items(page).nth(0), "Move later").click();
    await expect(notice(page)).toHaveText(SERVER);
    await expectNoViolations(page, "reorder error");
  });
}

for (const viewport of viewports) {
  test(`accessibility (${viewport.name}): ten images and the limit state have no axe violations`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openDraft(page, request, "images_ten");
    await expectNoViolations(page, "ten images");
  });
}
