import AxeBuilder from "@axe-core/playwright";
import { deflateSync } from "node:zlib";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Story 2.11, frontend half: the profile picture (Individual) and logo (Agency) sections of the profile pages, against the stub backend,
// which mirrors the backend's upload rules (magic bytes, 5 MB, 6 MiB body, 10 uploads an hour) and serves the stored bytes back.
const STUB = "http://127.0.0.1:4010";
const APP = "http://127.0.0.1:3100";
const PROFILE = "/account/profile";
const AGENCY_ID = "55555555-5555-4555-8555-555555555555";
const SERVER = "Something went wrong on our side. Please try again in a moment.";
const REJECTED = "This request could not be submitted. Please try again.";
const UNKNOWN = "It may have been saved: check the image shown.";
const UNREADABLE = "We could not read the answer.";
const REFRESH_FAILED = "We could not check your image. Reload the page to see the latest.";
const SUSPENDED = "Your account cannot change images right now.";
const CAP = "You have reached your storage limit. Free up space and try again.";
const RELOADED = "We loaded the latest image.";
const BUSY_TEXT = "Images are busy being processed. Try again in 7 seconds.";
const SAVE_WAIT = "Wait for the image changes to finish, then save.";
const SAVE_PAUSED = "Saving is paused while images are being changed.";
const IMAGE_WAIT = "Wait for your changes to be saved, then change the image.";
const FILE_NAME = "canary-holiday-snap.png";

const consoleLines: string[] = [];
test.beforeEach(async ({ request, page }) => {
  await request.get(`${STUB}/__reset`);
  consoleLines.length = 0;
  page.on("console", (message) => consoleLines.push(message.text()));
});

// Privacy on every path (success, 400, 5xx, a lost answer, remove): no file name, preview URL or inline image in the console, the storage or the DOM.
test.afterEach(async ({ page }) => {
  expect(consoleLines.join("\n")).not.toMatch(new RegExp(`${FILE_NAME}|blob:|data:image`));
  try {
    const found = await page.evaluate((name) => {
      const html = document.body?.innerHTML ?? "";
      const stored = JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]);
      return { html: html.includes(name) || html.includes("blob:") || html.includes("data:image"), stored: stored !== "[[],[]]" };
    }, FILE_NAME);
    expect(found).toEqual({ html: false, stored: false });
  } catch {
    // the page is gone (a navigation or a closed test): nothing left to inspect
  }
});

type Kind = "individual" | "agency";
const KINDS: { kind: Kind; page: string; title: string; label: string; alt: string; remove: string; empty: string; updated: string; removed: string; ownerUrl: string; details: string; field: string; ask: string }[] = [
  {
    kind: "individual",
    page: "Profile",
    title: "Profile picture",
    label: "Choose a picture",
    alt: "Your profile picture",
    remove: "Remove picture",
    empty: "No picture yet.",
    updated: "Your picture was updated.",
    removed: "Your picture was removed.",
    ownerUrl: "/api/v1/me/profile/image/file",
    details: "Your details",
    field: "Full name",
    ask: "Remove your profile picture?",
  },
  {
    kind: "agency",
    page: "Business profile",
    title: "Agency logo",
    label: "Choose a logo",
    alt: "Your agency logo",
    remove: "Remove logo",
    empty: "No logo yet.",
    updated: "Your logo was updated.",
    removed: "Your logo was removed.",
    ownerUrl: "/api/v1/me/agency-profile/image/file",
    details: "Business details",
    field: "Agency name",
    ask: "Remove your agency logo?",
  },
];
type Spec = (typeof KINDS)[number];

const setMode = (request: APIRequestContext, kind: string, value: string) => request.get(`${STUB}/__${kind}-mode?value=${value}`);
const stats = async (request: APIRequestContext) => (await request.get(`${STUB}/__profile-image-stats`)).json();
const seed = (request: APIRequestContext, kind: Kind, extra = "") => request.get(`${STUB}/__profile-image-set?kind=${kind}${extra}`);
const patches = async (request: APIRequestContext) => (await request.get(`${STUB}/__last-${"profile"}-patch`)).json();
const agencyPatches = async (request: APIRequestContext) => (await request.get(`${STUB}/__last-agency-profile-patch`)).json();
const waitAttempts = (request: APIRequestContext, count: number) => expect.poll(async () => (await stats(request)).attempts).toBe(count);
const waitHeld = (request: APIRequestContext, count: number) => expect.poll(async () => (await stats(request)).held).toBe(count);
const release = (request: APIRequestContext) => request.get(`${STUB}/__profile-image-release`);

// A real 1x1 PNG (what the stub reads as "image/png" by its magic bytes); padding makes bigger files. Repetitive bytes only.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
/** A real PNG of any size and colour (a solid colour), so two uploads can be told apart by what the browser decodes. */
function makePng(width: number, height: number, shade: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, shade)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const png = (name = FILE_NAME, padding = 0) => ({ name, mimeType: "image/png", buffer: padding > 0 ? Buffer.concat([PNG, Buffer.alloc(padding, 0x41)]) : PNG });
const textFile = () => ({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not an image at all") });

const section = (page: Page) => page.getByTestId("profile-image-section");
const picker = (page: Page, s: Spec) => section(page).getByLabel(s.label, { exact: true });
const shownImage = (page: Page, s: Spec) => section(page).getByRole("img", { name: s.alt, exact: true });
const removeButton = (page: Page, s: Spec) => section(page).getByRole("button", { name: s.remove, exact: true });
const confirmGroup = (page: Page) => page.getByTestId("profile-image-confirm");
const notice = (page: Page) => page.getByTestId("profile-image-notice");
const success = (page: Page) => page.getByTestId("profile-image-success");
const announcement = (page: Page) => page.getByTestId("profile-image-announcement");
const empty = (page: Page) => page.getByTestId("profile-image-empty");
const saveButton = (page: Page) => page.getByRole("button", { name: /^(Save changes|Saving…)$/ });
const detailsRegion = (page: Page, s: Spec) => page.getByRole("region", { name: s.details });
const focusedId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? "");

async function openPage(page: Page, request: APIRequestContext, s: Spec) {
  if (s.kind === "agency") await setMode(request, "me", "agency");
  await request.get(`${STUB}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP }]);
  await page.goto(PROFILE);
  await expect(page.getByRole("heading", { level: 1, name: s.page })).toBeVisible();
  await expect(section(page)).toBeVisible();
  await expect(page.getByLabel(s.field, { exact: true })).toBeVisible();
}

const loaded = (page: Page, s: Spec) => expect.poll(() => shownImage(page, s).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}
const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];
const pageshow = (page: Page) => page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
const quietRead = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("focus")));

for (const s of KINDS) {
  test.describe(s.kind, () => {
    // ------------------------------------------------------------ empty and populated

    test("empty: a neutral placeholder, the labelled picker and its hint, no Remove, before the text form", async ({ page, request }) => {
      await openPage(page, request, s);
      await expect(section(page).getByRole("heading", { level: 2, name: s.title })).toBeVisible();
      await expect(empty(page)).toHaveText(s.empty);
      await expect(page.getByTestId("profile-image-placeholder")).toHaveAttribute("aria-hidden", "true");
      await expect(section(page).getByRole("img")).toHaveCount(0);
      await expect(picker(page, s)).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
      await expect(picker(page, s)).not.toHaveAttribute("multiple");
      await expect(picker(page, s)).not.toHaveAttribute("aria-disabled");
      await expect(picker(page, s)).toHaveAccessibleDescription(/JPEG, PNG or WebP, up to 5 MB\./);
      await expect(removeButton(page, s)).toHaveCount(0);
      await expect(announcement(page)).toHaveText("");
      // The section sits before the text form and never inside it.
      const before = await page.evaluate(() => {
        const a = document.querySelector('[data-testid="profile-image-section"]')!;
        const form = document.querySelector("form")!;
        return Boolean(a.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING) && !form.contains(a);
      });
      expect(before).toBe(true);
      expect((await stats(request)).fileGets).toBe(0);
    });

    test("populated: the current image from the owner route, loaded, with its alt text and a Remove button", async ({ page, request }) => {
      await seed(request, s.kind);
      await openPage(page, request, s);
      await expect(shownImage(page, s)).toHaveAttribute("src", s.ownerUrl);
      await expect(shownImage(page, s)).toHaveAttribute("loading", "lazy");
      await loaded(page, s);
      await expect(empty(page)).toHaveCount(0);
      await expect(removeButton(page, s)).toBeVisible();
      // URLs are never shown as text, and the public identifiers of an Agency are never shown at all.
      const text = await page.evaluate(() => (document.body.innerText ?? "") + " " + (document.body.textContent ?? ""));
      expect(text).not.toContain("/api/v1/");
      expect(text).not.toContain(AGENCY_ID);
    });

    for (const [name, query] of [["JPEG", "&type=image/jpeg"], ["WebP", "&type=image/webp"]] as const) {
      test(`populated: a stored ${name} image is shown`, async ({ page, request }) => {
        await seed(request, s.kind, query);
        await openPage(page, request, s);
        await expect(shownImage(page, s)).toHaveAttribute("src", s.ownerUrl);
        await expect.poll(async () => (await stats(request)).fileGets).toBeGreaterThan(0);
        await loaded(page, s);
        await expect(page.getByTestId("profile-image-failed")).toHaveCount(0);
      });
    }

    // ------------------------------------------------------------ upload and replace

    test("upload: one `file` part, the answer shown, success text, focus stays on the picker, nothing kept", async ({ page, request }) => {
      const consoleText: string[] = [];
      page.on("console", (message) => consoleText.push(message.text()));
      await openPage(page, request, s);
      await picker(page, s).setInputFiles(png());
      await expect(success(page)).toHaveText(s.updated);
      await expect(shownImage(page, s)).toHaveAttribute("src", `${s.ownerUrl}?r=1`);
      await loaded(page, s);
      await expect(empty(page)).toHaveCount(0);
      await expect(removeButton(page, s)).toBeVisible();
      expect(await focusedId(page)).toBe("profile-image-input");
      await expect(picker(page, s)).toHaveValue(""); // the browser keeps nothing of the choice
      const state = await stats(request);
      expect(state.uploads).toHaveLength(1);
      expect(state.uploads[0]).toMatchObject({ kind: s.kind, type: "multipart/form-data", parts: ["file"], sniffed: "image/png", fileSize: PNG.length });
      expect(state.tokens).toEqual(["csrf-0"]);
      expect(state.stored[s.kind]).toEqual({ type: "image/png", bytes: PNG.length });
      // Privacy: no file name, preview URL or storage entry anywhere.
      const body = await page.evaluate(() => document.body.innerHTML);
      expect(body).not.toContain(FILE_NAME);
      expect(body).not.toContain("blob:");
      expect(body).not.toContain("data:image");
      expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []]);
      expect(consoleText.join("\n")).not.toContain(FILE_NAME);
    });

    test("replace: a second upload changes what the page decodes; the old bytes are not shown again", async ({ page, request }) => {
      await openPage(page, request, s);
      await picker(page, s).setInputFiles({ name: "first.png", mimeType: "image/png", buffer: makePng(3, 3, 40) });
      await expect(success(page)).toHaveText(s.updated);
      await expect.poll(() => shownImage(page, s).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(3);
      const before = (await stats(request)).fileGets;
      const second = makePng(5, 4, 200);
      await picker(page, s).setInputFiles({ name: "second.png", mimeType: "image/png", buffer: second });
      await expect(success(page)).toHaveText(s.updated);
      // The owner route is the same, so the shown address carries a counter: the browser asks again instead of reusing the old bytes.
      await expect(shownImage(page, s)).toHaveAttribute("src", `${s.ownerUrl}?r=2`);
      await expect.poll(async () => (await stats(request)).fileGets).toBeGreaterThan(before);
      expect((await stats(request)).stored[s.kind]).toEqual({ type: "image/png", bytes: second.length });
      await expect.poll(() => shownImage(page, s).evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight])).toEqual([5, 4]);
      await expect(shownImage(page, s)).toHaveCount(1);
    });

    test("a file over 6 MiB is refused in the page and never sent; the next valid file goes", async ({ page, request }) => {
      await openPage(page, request, s);
      await picker(page, s).setInputFiles(png("huge.png", 6 * 1024 * 1024 - PNG.length + 1));
      await expect(notice(page)).toHaveText("Images must be 5 MB or smaller.");
      expect(await focusedId(page)).toBe("profile-image-input");
      await picker(page, s).setInputFiles(png());
      await expect(success(page)).toHaveText(s.updated);
      const state = await stats(request);
      expect(state.attempts).toBe(1); // only the valid file reached the server
      expect(state.uploads[0].fileSize).toBe(PNG.length);
    });

    test("a file between 5 MB and 6 MiB is sent and the server's size rule answers", async ({ page, request }) => {
      await openPage(page, request, s);
      await picker(page, s).setInputFiles(png("big.png", 5 * 1024 * 1024 + 100));
      await expect(notice(page)).toHaveText("Images must be 5 MB or smaller.");
      expect((await stats(request)).uploads[0].fileSize).toBeGreaterThan(5 * 1024 * 1024);
      await expect(empty(page)).toBeVisible();
    });

    test("a file that is not an image: the server's code, mapped, and nothing is stored", async ({ page, request }) => {
      await openPage(page, request, s);
      await picker(page, s).setInputFiles(textFile());
      await expect(notice(page)).toHaveText("Only JPEG, PNG and WebP images can be added.");
      expect((await stats(request)).stored[s.kind]).toBeNull();
      expect(await focusedId(page)).toBe("profile-image-input");
    });

    // ------------------------------------------------------------ errors

    for (const [name, mode, text] of [
      ["too small", "too_small", "This image is too small. Each side must be at least 200 pixels."],
      ["too large in pixels", "too_large_dimensions", "This image is too large in pixels. Use one up to 10,000 pixels on each side."],
      ["not readable as an image", "invalid_image", "This file could not be read as an image."],
      ["storage cap (409)", "cap", CAP],
      ["busy with a wait (503)", "busy", "Images are busy being processed. Try again in 7 seconds."],
      ["busy without a wait (503)", "busy_no_retry", "Images are busy being processed. Try again shortly."],
      ["rate limited (429)", "rate_limited", "Too many attempts. Try again in 2 minutes."],
      ["rate limited, no wait (429)", "rate_none", "Too many attempts. Try again later."],
      ["a proxy refusing the size (413)", "payload_too_large", "Images must be 5 MB or smaller."],
      ["not multipart (415)", "unsupported_media", REJECTED],
      ["a refused account (403)", "forbidden", REJECTED],
      ["not found (404)", "not_found", REJECTED],
    ] as const) {
      test(`upload error, ${name}: the mapped text, the image as it was, focus on the picker`, async ({ page, request }) => {
        await openPage(page, request, s);
        await setMode(request, "profile-image", mode);
        await picker(page, s).setInputFiles(png());
        await expect(notice(page)).toHaveText(text);
        await expect(empty(page)).toBeVisible();
        expect(await focusedId(page)).toBe("profile-image-input");
        await expect(section(page).getByRole("img")).toHaveCount(0);
        expect(await page.getByRole("main").innerText()).not.toContain("Internal detail");
        // The 429 and 503 answers are not retried by the page: one attempt.
        await waitAttempts(request, mode === "forbidden" ? 2 : 1);
      });
    }

    test("upload error with a picture shown: the failure keeps the picture and focus goes to Remove", async ({ page, request }) => {
      await seed(request, s.kind);
      await openPage(page, request, s);
      await setMode(request, "profile-image", "too_small");
      await picker(page, s).setInputFiles(png());
      await expect(notice(page)).toBeVisible();
      await expect(shownImage(page, s)).toBeVisible();
      expect(await focusedId(page)).toBe("profile-image-remove");
    });

    test("a server error on upload: the generic text, then the profile is read again", async ({ page, request }) => {
      await openPage(page, request, s);
      await setMode(request, "profile-image", "error");
      await picker(page, s).setInputFiles(png());
      await expect(notice(page)).toHaveText(`${SERVER} ${UNKNOWN}`);
      expect((await request.get(`${STUB}/__last-${s.kind === "agency" ? "agency-profile" : "profile"}`).then((r) => r.json())).gets).toBe(2);
      expect(await focusedId(page)).toBe("profile-image-input");
      expect(await page.getByRole("main").innerText()).not.toContain("Internal detail");
    });

    test("a lost answer after the image was stored: the network text, and the re-read shows the stored image", async ({ page, request }) => {
      await openPage(page, request, s);
      await setMode(request, "profile-image", "lost_once");
      await picker(page, s).setInputFiles(png());
      await expect(notice(page)).toHaveText(`${SERVER} ${UNKNOWN}`);
      await expect(shownImage(page, s)).toHaveAttribute("src", `${s.ownerUrl}?r=1`);
      await loaded(page, s);
      expect((await stats(request)).uploads).toHaveLength(1);
      expect(await focusedId(page)).toBe("profile-image-remove");
    });

    test("a 200 whose answer is not the documented image: not trusted, the profile is read to decide", async ({ page, request }) => {
      await openPage(page, request, s);
      await setMode(request, "profile-image-wire", "bad_url");
      await picker(page, s).setInputFiles(png());
      // The re-read is unreadable too (the same wire fault), so nothing is shown and the person is told.
      await expect(notice(page)).toHaveText(`${UNREADABLE} ${REFRESH_FAILED}`);
      await expect(section(page).getByRole("img")).toHaveCount(0);
      expect(await page.evaluate(() => document.body.innerHTML)).not.toContain("elsewhere.example");
    });

    test("session gone on upload: back to sign-in with the profile as the next page", async ({ page, request }) => {
      await openPage(page, request, s);
      await setMode(request, "profile-image", "session_gone");
      await picker(page, s).setInputFiles(png());
      await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fprofile$/);
    });

    test("CSRF refused once: the token is fetched again and the upload goes through", async ({ page, request }) => {
      await openPage(page, request, s);
      await setMode(request, "profile-image", "csrf_once");
      await picker(page, s).setInputFiles(png());
      await expect(success(page)).toHaveText(s.updated);
      expect((await stats(request)).uploads).toHaveLength(1);
    });

    test("CSRF refused again after the retry: the generic text, nothing stored", async ({ page, request }) => {
      await openPage(page, request, s);
      await setMode(request, "profile-image", "csrf_always");
      await picker(page, s).setInputFiles(png());
      await expect(notice(page)).toHaveText(REJECTED);
      await waitAttempts(request, 2);
      expect((await stats(request)).stored[s.kind]).toBeNull();
    });

    test("a Suspended session: the exact account text on a refusal; an upload is still allowed", async ({ page, request }) => {
      await setMode(request, "signin", "suspended");
      await openPage(page, request, s);
      await picker(page, s).setInputFiles(png());
      await expect(success(page)).toHaveText(s.updated); // the profile's own gate lets a Suspended account change its image
      await setMode(request, "profile-image", "forbidden");
      await picker(page, s).setInputFiles(png());
      await expect(notice(page)).toHaveText(SUSPENDED);
      await setMode(request, "profile-image-delete", "forbidden");
      await removeButton(page, s).click();
      await confirmGroup(page).getByRole("button", { name: "Yes, remove" }).click();
      await expect(notice(page)).toHaveText(SUSPENDED);
    });

    test("an Email-unverified session may change its image too", async ({ page, request }) => {
      await setMode(request, "signin", "unverified");
      await openPage(page, request, s);
      await picker(page, s).setInputFiles(png());
      await expect(success(page)).toHaveText(s.updated);
    });

    test("the eleventh upload in the hour is the stub's rate limit, in minutes", async ({ page, request }) => {
      await openPage(page, request, s);
      for (let n = 1; n <= 10; n++) {
        await picker(page, s).setInputFiles(png(`n${n}.png`, n));
        await expect.poll(async () => (await stats(request)).puts).toBe(n);
        await expect(success(page)).toBeVisible();
        await expect(page.getByTestId("profile-image-live").locator("[data-testid=profile-image-success]")).toHaveText(s.updated);
        // Wait for the section to be idle again before the next choice.
        await expect(picker(page, s)).not.toHaveAttribute("aria-disabled");
      }
      await picker(page, s).setInputFiles(png("eleventh.png"));
      await expect(notice(page)).toHaveText("Too many attempts. Try again in 60 minutes.");
      expect((await stats(request)).stored[s.kind]).toEqual({ type: "image/png", bytes: PNG.length + 10 });
    });

    // ------------------------------------------------------------ remove

    test("remove: asks first, focus on Cancel; Escape keeps the picture and focus returns to Remove", async ({ page, request }) => {
      await seed(request, s.kind);
      await openPage(page, request, s);
      await removeButton(page, s).click();
      await expect(confirmGroup(page)).toBeVisible();
      await expect(confirmGroup(page)).toContainText(s.ask);
      expect(await focusedId(page)).toBe("profile-image-cancel");
      await page.keyboard.press("Escape");
      await expect(confirmGroup(page)).toHaveCount(0);
      expect(await focusedId(page)).toBe("profile-image-remove");
      await removeButton(page, s).click();
      await confirmGroup(page).getByRole("button", { name: "Cancel" }).click();
      await expect(removeButton(page, s)).toBeFocused();
      expect((await stats(request)).deletes).toEqual([]);
      await expect(shownImage(page, s)).toBeVisible();
    });

    test("remove: confirming removes it, shows the placeholder, announces it and moves focus to the picker", async ({ page, request }) => {
      await seed(request, s.kind);
      await openPage(page, request, s);
      await removeButton(page, s).click();
      await confirmGroup(page).getByRole("button", { name: "Yes, remove" }).click();
      await expect(success(page)).toHaveText(s.removed);
      await expect(empty(page)).toHaveText(s.empty);
      await expect(section(page).getByRole("img")).toHaveCount(0);
      await expect(removeButton(page, s)).toHaveCount(0);
      expect(await focusedId(page)).toBe("profile-image-input");
      const state = await stats(request);
      expect(state.deletes).toEqual([s.kind]);
      expect(state.stored[s.kind]).toBeNull();
      expect(state.tokens).toEqual(["csrf-0"]);
    });

    test("remove, keyboard only: Enter asks, Shift+Tab reaches Yes, Enter removes", async ({ page, request }) => {
      await seed(request, s.kind);
      await openPage(page, request, s);
      await removeButton(page, s).focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("#profile-image-cancel")).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(confirmGroup(page).getByRole("button", { name: "Yes, remove" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(success(page)).toHaveText(s.removed);
      await expect(picker(page, s)).toBeFocused();
    });

    for (const [name, mode, text, gone] of [
      ["a server error", "error", `${SERVER} ${UNKNOWN}`, false],
      ["a lost answer after it was removed", "lost_once", `${SERVER} ${UNKNOWN}`, true],
      ["a refused account", "forbidden", REJECTED, false],
      ["rate limited", "rate_limited", "Too many attempts. Try again in 2 minutes.", false],
      ["CSRF refused again", "csrf_always", REJECTED, false],
      ["not found (the page reads the profile again)", "not_found", `${REJECTED} ${RELOADED}`, false],
      ["a conflict (the page reads the profile again)", "conflict", `${REJECTED} ${RELOADED}`, false],
      ["busy (503): not changed, no \"may have been saved\"", "busy", BUSY_TEXT, false],
    ] as const) {
      test(`remove error, ${name}: the text, the picture follows the server, focus lands on a control`, async ({ page, request }) => {
        await seed(request, s.kind);
        await openPage(page, request, s);
        await setMode(request, "profile-image-delete", mode);
        await removeButton(page, s).click();
        await confirmGroup(page).getByRole("button", { name: "Yes, remove" }).click();
        await expect(notice(page)).toHaveText(text);
        await expect(confirmGroup(page)).toHaveCount(0);
        if (gone) {
          await expect(empty(page)).toBeVisible();
          expect(await focusedId(page)).toBe("profile-image-input");
        } else {
          await expect(shownImage(page, s)).toBeVisible();
          expect(await focusedId(page)).toBe("profile-image-remove");
        }
      });
    }

    test("remove: Escape from the Yes button cancels too, and focus returns to Remove", async ({ page, request }) => {
      await seed(request, s.kind);
      await openPage(page, request, s);
      await removeButton(page, s).click();
      await confirmGroup(page).getByRole("button", { name: "Yes, remove" }).focus();
      await page.keyboard.press("Escape");
      await expect(confirmGroup(page)).toHaveCount(0);
      await expect(removeButton(page, s)).toBeFocused();
      expect((await stats(request)).deletes).toEqual([]);
    });

    test("remove, 404 because it was already removed elsewhere: the page adopts the server's state (no picture)", async ({ page, request }) => {
      await seed(request, s.kind);
      await openPage(page, request, s);
      await expect(shownImage(page, s)).toBeVisible();
      await seed(request, s.kind, "&clear=1");
      await setMode(request, "profile-image-delete", "not_found");
      await removeButton(page, s).click();
      await confirmGroup(page).getByRole("button", { name: "Yes, remove" }).click();
      await expect(notice(page)).toHaveText(`${REJECTED} ${RELOADED}`);
      await expect(empty(page)).toBeVisible();
      expect(await focusedId(page)).toBe("profile-image-input");
    });

    test("a double click on Yes sends one request and does not move focus to the picker", async ({ page, request }) => {
      await seed(request, s.kind);
      await openPage(page, request, s);
      await setMode(request, "profile-image-delete", "hold");
      await removeButton(page, s).click();
      await confirmGroup(page).getByRole("button", { name: "Yes, remove" }).dblclick({ force: true });
      await waitHeld(request, 1);
      expect(await focusedId(page)).not.toBe("profile-image-input");
      await expect(notice(page)).toHaveCount(0);
      await release(request);
      await expect(success(page)).toHaveText(s.removed);
      expect((await stats(request)).deletes).toEqual([s.kind]);
    });

    test("remove, session gone: back to sign-in", async ({ page, request }) => {
      await seed(request, s.kind);
      await openPage(page, request, s);
      await setMode(request, "profile-image-delete", "session_gone");
      await removeButton(page, s).click();
      await confirmGroup(page).getByRole("button", { name: "Yes, remove" }).click();
      await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fprofile$/);
    });

    // ------------------------------------------------------------ the busy state

    test("uploading: one announcement, aria-disabled controls, a second choice is refused, leaving asks first", async ({ page, request }) => {
      await seed(request, s.kind);
      await openPage(page, request, s);
      await setMode(request, "profile-image", "hold");
      await picker(page, s).setInputFiles(png("slow.png", 5));
      await waitHeld(request, 1);
      await expect(announcement(page)).toHaveText(s.kind === "agency" ? "Uploading your logo." : "Uploading your picture.");
      await expect(picker(page, s)).toHaveAttribute("aria-disabled", "true");
      // aria-disabled, never the disabled attribute: the controls stay focusable and keep their place.
      expect(await picker(page, s).evaluate((el: HTMLInputElement) => el.disabled)).toBe(false);
      await expect(removeButton(page, s)).toHaveAttribute("aria-disabled", "true");
      expect(await removeButton(page, s).evaluate((el: HTMLButtonElement) => el.disabled)).toBe(false);
      // Choosing again while it runs is refused in the page, quietly (it is this very action running): no notice, focus stays where it was,
      // and neither a second file nor a file over the size limit interrupts it.
      await saveButton(page).focus();
      await picker(page, s).setInputFiles(png("again.png"));
      await picker(page, s).setInputFiles(png("huge.png", 6 * 1024 * 1024));
      await expect(saveButton(page)).toBeFocused();
      await expect(notice(page)).toHaveCount(0);
      // A click on the disabled-looking Remove asks nothing.
      await removeButton(page, s).click({ force: true });
      await expect(confirmGroup(page)).toHaveCount(0);
      // Leaving the page asks first while the upload runs.
      expect(await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      })).toBe(true);
      await release(request);
      await expect(success(page)).toHaveText(s.updated);
      await expect(picker(page, s)).not.toHaveAttribute("aria-disabled");
      expect(await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      })).toBe(false);
      expect((await stats(request)).attempts).toBe(1);
      expect(await focusedId(page)).toBe("profile-image-input");
    });

    test("an upload keeps the text form's Save waiting, in the live words, and sends nothing", async ({ page, request }) => {
      await openPage(page, request, s);
      await setMode(request, "profile-image", "hold");
      await picker(page, s).setInputFiles(png());
      await waitHeld(request, 1);
      await expect(saveButton(page)).toHaveAttribute("aria-disabled", "true");
      await expect(page.getByTestId("save-paused")).toHaveText(SAVE_PAUSED);
      await expect(saveButton(page)).toHaveAccessibleDescription(SAVE_PAUSED);
      // Edit a field so a submit would send something, then press Save.
      const field = page.getByLabel(s.field, { exact: true });
      await field.fill(`${await field.inputValue()} X`);
      await saveButton(page).click({ force: true });
      await expect(detailsRegion(page, s).getByRole("status").filter({ hasText: SAVE_WAIT })).toHaveCount(1);
      await release(request);
      await expect(success(page)).toHaveText(s.updated);
      await expect(page.getByTestId("save-paused")).toHaveCount(0);
      await expect(saveButton(page)).not.toHaveAttribute("aria-disabled");
      const sent = s.kind === "agency" ? await agencyPatches(request) : await patches(request);
      expect(sent.count).toBe(0);
      // And once the picture is done, the same Save goes through.
      await saveButton(page).click();
      await expect(page.getByTestId("details-success")).toBeVisible();
      expect((s.kind === "agency" ? await agencyPatches(request) : await patches(request)).count).toBe(1);
    });

    test("a text save in flight keeps the picture actions waiting; afterwards they work", async ({ page, request }) => {
      await seed(request, s.kind);
      await openPage(page, request, s);
      let let_go!: () => void;
      const gate = new Promise<void>((resolve) => (let_go = resolve));
      let inFlight = false;
      await page.route("**/api/v1/me/**", async (route) => {
        if (route.request().method() !== "PATCH") return route.continue();
        inFlight = true;
        await gate;
        return route.continue();
      });
      const field = page.getByLabel(s.field, { exact: true });
      await field.fill(`${await field.inputValue()} Y`);
      await saveButton(page).click();
      await expect.poll(() => inFlight).toBe(true);
      await expect(picker(page, s)).toHaveAttribute("aria-disabled", "true");
      await expect(removeButton(page, s)).toHaveAttribute("aria-disabled", "true");
      await removeButton(page, s).click({ force: true });
      await expect(confirmGroup(page)).toHaveCount(0);
      await expect(page.getByTestId("profile-image-notice")).toHaveText(IMAGE_WAIT);
      await picker(page, s).setInputFiles(png());
      await expect(page.getByTestId("profile-image-notice")).toHaveText(IMAGE_WAIT);
      let_go();
      await expect(page.getByTestId("details-success")).toBeVisible();
      await expect(picker(page, s)).not.toHaveAttribute("aria-disabled");
      expect((await stats(request)).attempts).toBe(0); // the refused choice never reached the server
      await page.unroute("**/api/v1/me/**");
      await picker(page, s).setInputFiles(png("after.png", 3));
      await expect(success(page)).toHaveText(s.updated);
    });

    test("a text save and an image choice right after it: the choice waits, nothing is sent", async ({ page, request }) => {
      await openPage(page, request, s);
      let let_go!: () => void;
      const gate = new Promise<void>((resolve) => (let_go = resolve));
      await page.route("**/api/v1/me/**", async (route) => {
        if (route.request().method() !== "PATCH") return route.continue();
        await gate;
        return route.continue();
      });
      const field = page.getByLabel(s.field, { exact: true });
      await field.fill(`${await field.inputValue()} Q`);
      // The click and the choice go in the same step: the save lock is taken in the submit itself, not after a render.
      await page.evaluate(() => {
        (document.querySelector("form button[type=submit]") as HTMLButtonElement).click();
        const input = document.getElementById("profile-image-input") as HTMLInputElement;
        const transfer = new DataTransfer();
        transfer.items.add(new File([new Uint8Array([1, 2, 3])], "x.png", { type: "image/png" }));
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await expect(notice(page)).toHaveText(IMAGE_WAIT);
      let_go();
      await expect(page.getByTestId("details-success")).toBeVisible();
      await page.unroute("**/api/v1/me/**");
      expect((await stats(request)).attempts).toBe(0);
    });

    test("the picture and the text save do not disturb each other: the image stays after a save, the text after an upload", async ({ page, request }) => {
      await openPage(page, request, s);
      await picker(page, s).setInputFiles(png());
      await expect(success(page)).toHaveText(s.updated);
      const field = page.getByLabel(s.field, { exact: true });
      await field.fill(`${await field.inputValue()} Z`);
      await picker(page, s).setInputFiles(png("two.png", 2));
      await expect(success(page)).toHaveText(s.updated);
      await expect(field).toHaveValue(/ Z$/); // an unsaved edit survives an upload
      await saveButton(page).click();
      await expect(page.getByTestId("details-success")).toBeVisible();
      await expect(shownImage(page, s)).toBeVisible();
      expect((await stats(request)).stored[s.kind]).toEqual({ type: "image/png", bytes: PNG.length + 2 });
    });

    test("the unmount: leaving mid-upload releases the busy lock, and a new upload works on return", async ({ page, request }) => {
      await openPage(page, request, s);
      await setMode(request, "profile-image", "hold");
      await picker(page, s).setInputFiles(png());
      await waitHeld(request, 1);
      await page.getByRole("banner").getByRole("link", { name: "Change password" }).click();
      await expect(page).toHaveURL(/\/account\/password$/);
      await expect.poll(async () => (await stats(request)).aborted).toBe(1); // the page gave up on the request when it unmounted
      await release(request);
      // The upload was abandoned with the page: the stub never stored it.
      expect((await stats(request)).stored[s.kind]).toBeNull();
      await setMode(request, "profile-image", "ok");
      await page.getByRole("banner").getByRole("link", { name: s.page, exact: true }).click();
      await expect(section(page)).toBeVisible();
      await expect(picker(page, s)).not.toHaveAttribute("aria-disabled");
      await picker(page, s).setInputFiles(png("back.png", 4));
      await expect(success(page)).toHaveText(s.updated);
      expect((await stats(request)).stored[s.kind]).toEqual({ type: "image/png", bytes: PNG.length + 4 });
      const state = await stats(request);
      expect(state.attempts).toBe(2); // the abandoned one and the second
      expect(state.uploads[1].fileSize).toBe(PNG.length + 4);
    });

    // ------------------------------------------------------------ never regress, reads, load failure

    test("an older profile read that arrives after an upload never replaces the newer picture", async ({ page, request }) => {
      await openPage(page, request, s);
      await setMode(request, s.kind === "agency" ? "agency-profile" : "profile", "hold");
      await quietRead(page); // asks the server now; the answer (no picture) is held
      await expect.poll(async () => (await stats(request)).heldReads).toBe(1);
      await setMode(request, s.kind === "agency" ? "agency-profile" : "profile", "ok");
      await picker(page, s).setInputFiles(png());
      await expect(success(page)).toHaveText(s.updated);
      const seen = await section(page).getAttribute("data-read-seen");
      await request.get(`${STUB}/__profile-release`);
      // The positive signal that the old answer reached the page: the section's `data-read-seen` (the stamp of the latest read it was given) moves.
      await expect.poll(() => section(page).getAttribute("data-read-seen")).not.toBe(seen);
      await expect(shownImage(page, s)).toBeVisible();
      await expect(empty(page)).toHaveCount(0);
    });

    test("a newer read shows a change made elsewhere: a removed picture goes, a new one appears", async ({ page, request }) => {
      await seed(request, s.kind);
      await openPage(page, request, s);
      await expect(shownImage(page, s)).toBeVisible();
      await seed(request, s.kind, "&clear=1");
      await quietRead(page);
      await expect(empty(page)).toBeVisible();
      await seed(request, s.kind, "&padding=9");
      const before = (await stats(request)).fileGets;
      await quietRead(page);
      await expect(shownImage(page, s)).toBeVisible();
      await expect.poll(async () => (await stats(request)).fileGets).toBeGreaterThan(before);
    });

    test("a picture that cannot be loaded: the reason and a Retry that loads it again", async ({ page, request }) => {
      await seed(request, s.kind);
      await setMode(request, "profile-image-file", "not_found");
      await openPage(page, request, s);
      const failed = page.getByTestId("profile-image-failed");
      await expect(failed).toContainText("This image could not be loaded.");
      await expect(failed.getByRole("button", { name: /^Retry/ })).toBeVisible();
      await setMode(request, "profile-image-file", "ok");
      await failed.getByRole("button", { name: /^Retry/ }).click();
      await expect(shownImage(page, s)).toBeVisible();
      await loaded(page, s);
      await expect(failed).toHaveCount(0);
    });

    test("restored from the back-forward cache: the session is checked, the picture is read again, an open prompt closes", async ({ page, request }) => {
      await seed(request, s.kind);
      await openPage(page, request, s);
      await removeButton(page, s).click();
      await expect(confirmGroup(page)).toBeVisible();
      await seed(request, s.kind, "&clear=1");
      await pageshow(page);
      await expect(confirmGroup(page)).toHaveCount(0);
      await expect(empty(page)).toBeVisible();
      await seed(request, s.kind);
      await request.get(`${STUB}/__expire-session`);
      await pageshow(page);
      await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fprofile$/);
    });

    // ------------------------------------------------------------ wire shapes fail closed

    for (const mode of s.kind === "agency" ? ["string_image", "bad_url", "other_route", "bad_type", "zero_dims", "bad_agency_id", "bad_logo_url"] : ["string_image", "bad_url", "other_route", "bad_type", "zero_dims"]) {
      test(`wire (${mode}): an unexpected picture shape makes the profile unreadable; nothing is rendered from it`, async ({ page, request }) => {
        await seed(request, s.kind);
        await setMode(request, "profile-image-wire", mode);
        await request.get(`${STUB}/__force-session`);
        if (s.kind === "agency") await setMode(request, "me", "agency");
        await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP }]);
        await page.goto(PROFILE);
        await expect(page.getByRole("heading", { level: 2, name: /^We could not load your/ })).toBeVisible();
        await expect(section(page)).toHaveCount(0);
        expect(await page.evaluate(() => document.body.innerHTML)).not.toContain("elsewhere.example");
        expect((await stats(request)).fileGets).toBe(0);
        // Retry works once the answer is well formed again.
        await setMode(request, "profile-image-wire", "ok");
        await page.getByRole("button", { name: "Retry" }).click();
        await expect(section(page)).toBeVisible();
      });
    }

    if (s.kind === "agency") {
      test("wire: an upper-case agency id and logo address are the same identifier and are accepted", async ({ page, request }) => {
        await seed(request, s.kind);
        await setMode(request, "profile-image-wire", "upper_ids");
        await openPage(page, request, s);
        await expect(shownImage(page, s)).toBeVisible();
      });
    }

    // ------------------------------------------------------------ accessibility

    for (const viewport of viewports) {
      test(`axe is clean at ${viewport.name}: empty, populated, uploading, error and asking`, async ({ page, request }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await openPage(page, request, s);
        await expectNoViolations(page, `${s.kind} empty`);
        await picker(page, s).setInputFiles(png());
        await expect(success(page)).toHaveText(s.updated);
        await loaded(page, s);
        await expectNoViolations(page, `${s.kind} populated`);
        await removeButton(page, s).click();
        await expect(confirmGroup(page)).toBeVisible();
        await expectNoViolations(page, `${s.kind} asking`);
        await page.keyboard.press("Escape");
        await setMode(request, "profile-image", "hold");
        await picker(page, s).setInputFiles(png("x.png", 1));
        await waitHeld(request, 1);
        await expectNoViolations(page, `${s.kind} uploading`);
        await release(request);
        await expect(success(page)).toBeVisible();
        await setMode(request, "profile-image", "too_small");
        await picker(page, s).setInputFiles(png("y.png", 2));
        await expect(notice(page)).toBeVisible();
        await expectNoViolations(page, `${s.kind} error`);
        await setMode(request, "profile-image-file", "not_found");
        await seed(request, s.kind, "&padding=1");
        await page.reload();
        await expect(page.getByTestId("profile-image-failed")).toBeVisible();
        await expectNoViolations(page, `${s.kind} image failed`);
      });
    }
  });
}

// ---------------------------------------------------------------- Agency logo: the public route and its identifiers

test("proxy pass-through (the backend suite owns the rule): the public logo route is served to a Visitor only while the Agency is active, cacheable and cookie-free", async ({ request }) => {
  await seed(request, "agency", "&padding=7");
  const served = await request.get(`${APP}/api/v1/agencies/${AGENCY_ID}/logo`);
  expect(served.status()).toBe(200);
  expect(served.headers()["cache-control"]).toBe("public, max-age=60");
  expect(served.headers()["content-type"]).toBe("image/png");
  expect(served.headers()["set-cookie"]).toBeUndefined();
  expect((await served.body()).length).toBe(PNG.length + 7);
  await setMode(request, "logo", "suspended");
  const hidden = await request.get(`${APP}/api/v1/agencies/${AGENCY_ID}/logo`);
  expect(hidden.status()).toBe(404);
  expect(hidden.headers()["cache-control"]).toContain("no-store");
  await setMode(request, "logo", "active");
  expect((await request.get(`${APP}/api/v1/agencies/${AGENCY_ID}/logo`)).status()).toBe(200);
  expect((await request.get(`${APP}/api/v1/agencies/00000000-0000-4000-8000-000000000000/logo`)).status()).toBe(404);
  expect((await stats(request)).logoRequests.every((entry: { cookie: string | null }) => entry.cookie === null)).toBe(true);
});

test("proxy pass-through (the backend suite owns the rule): an Individual's picture has no public route, a Visitor gets 404 from the owner route", async ({ request }) => {
  await seed(request, "individual");
  expect((await request.get(`${APP}/api/v1/me/profile/image/file`)).status()).toBe(404);
  expect((await request.get(`${APP}/api/v1/me/agency-profile/image/file`)).status()).toBe(404);
});

test("an Agency's page never shows the logo address or the public id; the uploaded logo is public once active", async ({ page, request }) => {
  const s = KINDS[1];
  await openPage(page, request, s);
  await picker(page, s).setInputFiles(png());
  await expect(success(page)).toHaveText(s.updated);
  const outside = await page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("input, textarea, select, script, img").forEach((node) => node.remove());
    return clone.textContent ?? "";
  });
  expect(outside).not.toContain(AGENCY_ID);
  expect(outside).not.toContain("/logo");
  expect((await request.get(`${APP}/api/v1/agencies/${AGENCY_ID}/logo`)).status()).toBe(200);
  await setMode(request, "logo", "suspended");
  expect((await request.get(`${APP}/api/v1/agencies/${AGENCY_ID}/logo`)).status()).toBe(404);
  // The owner still sees their own logo while the public route is hidden.
  await page.reload();
  await expect(shownImage(page, s)).toBeVisible();
  await loaded(page, s);
});

test("proxy pass-through (the backend suite owns the rule): wrong account type, an Agency's owner routes are not the Individual's (403), and the page shows the account's own section", async ({ page, request }) => {
  const s = KINDS[0];
  await setMode(request, "me", "agency");
  await request.get(`${STUB}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP }]);
  const csrf = (await (await request.get(`${APP}/api/v1/csrf`, { headers: { cookie: "estate_session=stub-live" } })).json()).csrf_token;
  const wrong = await request.put(`${APP}/api/v1/me/profile/image`, { multipart: { file: png() }, headers: { cookie: "estate_session=stub-live", "x-csrftoken": csrf } });
  expect(wrong.status()).toBe(403);
  expect((await request.get(`${APP}/api/v1/me/profile/image/file`, { headers: { cookie: "estate_session=stub-live" } })).status()).toBe(404);
  await page.goto(PROFILE);
  await expect(page.getByRole("heading", { level: 2, name: "Agency logo" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: s.title })).toHaveCount(0);
});
