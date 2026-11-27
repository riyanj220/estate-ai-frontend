import AxeBuilder from "@axe-core/playwright";
import { STUB_URL } from "./ports";
import { expect, test, type Page } from "@playwright/test";

// Story 6.3 (and the voice half of 6.4): speak a search on /listings. The microphone and the recorder are replaced in the page;
// the transcription is the stub's.
const HEARD = "house for sale near a park";
const TYPED = "a flat in Clifton";

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

type Browser = "ok" | "denied" | "no-microphone" | "no-recorder" | "no-media-devices" | "silent";

async function fakeMicrophone(page: Page, kind: Browser = "ok") {
  await page.addInitScript((kind) => {
    const state = { asked: 0, released: 0 };
    Object.assign(window, { __mic: state });
    const stream = { getTracks: () => [{ stop: () => (state.released += 1) }] };
    const mediaDevices = {
      getUserMedia: async () => {
        state.asked += 1;
        if (kind === "denied") throw new DOMException("no", "NotAllowedError");
        if (kind === "no-microphone") throw new DOMException("no", "NotFoundError");
        return stream;
      },
    };
    class Recorder {
      static isTypeSupported = (type: string) => type.startsWith("audio/webm");
      state = "inactive";
      mimeType = "audio/webm;codecs=opus";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        setTimeout(() => {
          this.ondataavailable?.({ data: new Blob(kind === "silent" ? [] : ["FAKE-RECORDING"]) });
          this.onstop?.();
        });
      }
    }
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: kind === "no-media-devices" ? undefined : mediaDevices });
    Object.defineProperty(window, "MediaRecorder", { configurable: true, writable: true, value: kind === "no-recorder" ? undefined : Recorder });
  }, kind);
}

const box = (page: Page) => page.getByTestId("search-box");
const input = (page: Page) => page.getByLabel("Describe what you are looking for");
const speak = (page: Page) => box(page).getByRole("button", { name: "Speak your request" });
const stop = (page: Page) => box(page).getByRole("button", { name: "Stop recording" });
const status = (page: Page) => page.getByTestId("voice-status");
const mic = (page: Page) => page.evaluate(() => (window as unknown as { __mic: { asked: number; released: number } }).__mic);
const sent = async (page: Page, path: "voice" | "search") => (await (await page.request.get(`${STUB_URL}/__${path}-requests`)).json()).requests;

async function expectNoViolations(page: Page, label: string) {
  await expect(page).toHaveTitle(/.+/);
  expect((await new AxeBuilder({ page }).analyze()).violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}

/** The notice comes before the first voice use, and before the microphone is asked for. */
async function record(page: Page) {
  await speak(page).click();
  await page.getByTestId("ai-notice").getByRole("button", { name: "Continue" }).click();
}

test("a spoken request fills the box, is edited and then searched as text @smoke", async ({ page, request }) => {
  await request.get(`${STUB_URL}/__voice-mode?value=slow`);
  await fakeMicrophone(page);
  await page.setViewportSize({ width: 375, height: 800 });
  const response = await page.goto("/listings");
  // Nothing in the page's own headers may switch the microphone off.
  expect(response?.headers()["permissions-policy"] ?? "").not.toContain("microphone=()");
  await speak(page).click();
  await expect(page.getByTestId("ai-notice")).toContainText("say to an AI feature");
  expect((await mic(page)).asked).toBe(0);
  await page.getByTestId("ai-notice").getByRole("button", { name: "Continue" }).click();
  await expect(status(page)).toContainText("Recording.");
  await expectNoViolations(page, "recording");
  await stop(page).click();
  await expect(status(page)).toContainText("Writing down your words");
  await expect(input(page)).toHaveValue(HEARD);
  await expect(input(page)).toBeFocused();
  await expect(status(page)).toContainText("then press Search");
  await expectNoViolations(page, "transcribed");
  expect((await mic(page)).released).toBe(1);
  expect(await sent(page, "voice")).toEqual([{ url: "/api/v1/public/search/transcription", multipart: true, parts: ["audio"], audio: true }]);
  expect(await sent(page, "search")).toHaveLength(0); // nothing is searched until asked

  await input(page).fill(`${HEARD} under 2 crore`);
  await box(page).getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByTestId("search-understood")).toBeVisible();
  await expect(page.getByTestId("ai-notice")).toBeHidden();
  expect((await sent(page, "search"))[0].body).toEqual({ query: `${HEARD} under 2 crore` });
  await expect(input(page)).toHaveValue(`${HEARD} under 2 crore`);
});

test("cancelling a recording releases the microphone and sends nothing", async ({ page }) => {
  await fakeMicrophone(page);
  await page.goto("/listings");
  await input(page).fill(TYPED);
  await record(page);
  await box(page).getByRole("button", { name: "Cancel" }).click();
  await expect(speak(page)).toBeFocused();
  await expect.poll(async () => (await mic(page)).released).toBe(1);
  expect(await sent(page, "voice")).toHaveLength(0);
  await expect(input(page)).toHaveValue(TYPED);
});

test("declining the notice does not touch the microphone", async ({ page }) => {
  await fakeMicrophone(page);
  await page.goto("/listings");
  await speak(page).click();
  await page.getByTestId("ai-notice").getByRole("button", { name: "Not now" }).click();
  expect((await mic(page)).asked).toBe(0);
});

for (const [kind, message] of [
  ["denied", "Microphone access is blocked."],
  ["no-microphone", "No microphone was found."],
] as const) {
  test(`${kind}: the text box is offered and its text is kept`, async ({ page }) => {
    await fakeMicrophone(page, kind);
    await page.goto("/listings");
    await input(page).fill(TYPED);
    await record(page);
    await expect(status(page)).toContainText(message);
    await expect(status(page)).toContainText("Type your search instead");
    await expect(input(page)).toHaveValue(TYPED);
    await expect(speak(page)).toBeVisible();
    await expectNoViolations(page, kind);
  });
}

for (const kind of ["no-recorder", "no-media-devices"] as const) {
  test(`${kind}: no voice button, the text box instead`, async ({ page }) => {
    await fakeMicrophone(page, kind);
    await page.goto("/listings");
    await expect(page.getByTestId("voice-unsupported")).toContainText("Type your search");
    await expect(speak(page)).toHaveCount(0);
    await expect(input(page)).toBeEditable();
    await expectNoViolations(page, kind);
  });
}

for (const [mode, browser, message] of [
  ["fallback", "ok", "Voice search is unavailable right now."],
  ["rate_limited", "ok", "Too many attempts."],
  ["error", "ok", "Something went wrong on our side."],
  ["ok", "silent", "Nothing was recorded."],
] as const) {
  test(`${mode}/${browser}: the failure is told, the text is kept and the filters work`, async ({ page, request }) => {
    await request.get(`${STUB_URL}/__voice-mode?value=${mode}`);
    await fakeMicrophone(page, browser);
    await page.goto("/listings");
    await input(page).fill(TYPED);
    await record(page);
    await stop(page).click();
    await expect(status(page)).toContainText(message);
    await expect(status(page)).toContainText("Type your search instead");
    await expect(box(page)).not.toContainText("Internal detail");
    await expect(input(page)).toHaveValue(TYPED);
    await expect(speak(page)).toBeVisible();
    await expect(page.getByTestId("filter-panel")).toBeVisible();
    await expect(page.getByTestId("browse-card")).toHaveCount(2);
    await expectNoViolations(page, mode);
  });
}
