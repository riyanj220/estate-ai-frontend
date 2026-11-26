import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Story 2.19, frontend half: the one-time correction of the locality and area of a recently published Listing, against the stub backend,
// which mirrors the backend's window (24 hours after the last counted publication, once), its order of refusals and its rules.
const STUB = STUB_URL;
const id = (seq: number) => `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`;
const locality = (seq: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(seq).padStart(12, "0")}`;
const NOTE = "To change the locality or area, archive this listing and republish it.";

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
});

const mode = (request: APIRequestContext, value: string) => request.get(`${STUB}/__correction-mode?value=${value}`);
type Stats = { gets: number; attempts: { token: string | null; body: { base_revision: number; fields: Record<string, unknown> } }[] };
const stats = async (request: APIRequestContext): Promise<Stats> => (await request.get(`${STUB}/__correction-stats`)).json();

async function open(page: Page, request: APIRequestContext, preset = "published_counted") {
  await request.get(`${STUB}/__listings-preset?value=${preset}`);
  await request.get(`${STUB}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
  await page.goto(`/account/listings/${id(1)}`);
  await expect(page.getByTestId("draft-status")).toHaveText("Published");
}
const section = (page: Page) => page.getByTestId("correction-section");
const button = (page: Page) => page.getByTestId("correction-button");
const dialog = (page: Page) => page.getByTestId("correction-dialog");
const live = (page: Page) => page.getByTestId("status-live");
const areaInput = (page: Page) => page.getByLabel("Corrected area value");
const localitySelect = (page: Page) => page.getByLabel("Corrected locality");
const ready = async (page: Page) => {
  await expect(localitySelect(page).locator("option", { hasText: "Gulshan-e-Iqbal" })).toHaveCount(1);
};
const send = async (page: Page) => {
  await button(page).click();
  await page.getByTestId("correction-confirm").click();
};

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
]) {
  test(`correct once: prefilled form, only the changes are sent after the dialog, then the note (${viewport.name}) @smoke`, async ({ page, request }) => {
    await page.setViewportSize(viewport);
    await open(page, request);
    await expect(section(page).getByRole("heading", { level: 2, name: "Correct locality or area" })).toBeVisible();
    await expect(page.getByTestId("correction-until")).toHaveText(/^You can do this until \d{1,2} \w+ \d{4} at \d{2}:\d{2} \(Karachi time\), about 23 hours left\.$/);
    await ready(page);
    await expect(localitySelect(page)).toHaveValue(locality(1));
    await expect(areaInput(page)).toHaveValue("10.0000");
    await expect(page.getByLabel("Corrected unit")).toHaveValue("marla");
    await expect(page.getByLabel("Corrected marla basis")).toHaveValue("272.25");
    await expectNoViolations(page, `section ${viewport.name}`);

    await localitySelect(page).selectOption(locality(2));
    await areaInput(page).fill("12");
    await button(page).click();
    await expect(dialog(page)).toContainText("This can be done only once for this publication.");
    await expect(page.getByTestId("correction-cancel")).toBeFocused();
    await expectNoViolations(page, `dialog ${viewport.name}`);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(button(page)).toBeFocused();
    expect((await stats(request)).attempts).toHaveLength(0);

    await send(page);
    await expect(live(page)).toHaveText("The locality and area were corrected. No publication was used.");
    await expect(live(page)).toBeFocused();
    await expect(page.getByTestId("draft-revision")).toHaveText("5");
    await expect(page.getByTestId("draft-area")).toContainText("12 Marla");
    await expect(page.getByTestId("correction-note")).toHaveText(NOTE);
    await expect(section(page)).toHaveCount(0);
    const { attempts } = await stats(request);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].token).toBeTruthy();
    expect(attempts[0].body).toEqual({ base_revision: 4, fields: { locality: locality(2), area_value: "12" } });
    await expectNoViolations(page, `corrected ${viewport.name}`);
  });
}

test("no window: only the note; a Draft and a restricted Listing show neither", async ({ page, request }) => {
  await open(page, request, "published_one");
  await expect(page.getByTestId("correction-note")).toHaveText(NOTE);
  await expect(section(page)).toHaveCount(0);
  await request.get(`${STUB}/__listing-lifecycle?id=${id(1)}&restricted=1`);
  await page.reload();
  await expect(page.getByTestId("draft-not-editable")).toBeVisible();
  await expect(page.getByTestId("correction-note")).toHaveCount(0);
});

test("a failed check offers Retry", async ({ page, request }) => {
  await mode(request, "read_error");
  await open(page, request);
  await expect(page.getByTestId("correction-check-failed")).toBeVisible();
  await mode(request, "ok");
  await page.getByRole("button", { name: "Retry the correction check" }).click();
  await expect(section(page)).toBeVisible();
});

test("nothing changed or only the marla size: said without a dialog; unsaved changes in the main form disable the button", async ({ page, request }) => {
  await open(page, request);
  await ready(page);
  await button(page).click();
  await expect(section(page).getByRole("group", { name: "There is a problem" })).toContainText("Nothing would change. Enter a different locality or area.");
  await page.getByLabel("Corrected marla basis").selectOption("225");
  await button(page).click();
  await expect(page.locator("#correction-marla_basis-error")).toContainText("To change only the marla size, use the Edit details form above.");
  await expect(dialog(page)).toBeHidden();
  await page.getByLabel("Title", { exact: true }).fill("Corner house with a bigger garden");
  await expect(button(page)).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("correction-reason")).toHaveText("Save your changes before you correct the locality or area.");
  await button(page).click({ force: true });
  await expect(dialog(page)).toBeHidden();
  expect((await stats(request)).attempts).toHaveLength(0);
});

test("field errors show next to the fields and the correction is not used", async ({ page, request }) => {
  await mode(request, "invalid");
  await open(page, request);
  await ready(page);
  await areaInput(page).fill("0");
  await send(page);
  await expect(section(page).getByRole("group", { name: "There is a problem" })).toBeFocused();
  await expect(page.locator("#correction-area_value-error")).toContainText("Enter an area above zero");
  await expect(page.locator("#correction-locality-error")).toBeVisible();
  await expect(areaInput(page)).toHaveValue("0");
  await expectNoViolations(page, "errors");
});

test("while it runs Save and the status actions wait and the dialog stays", async ({ page, request }) => {
  await mode(request, "hold");
  await open(page, request);
  await ready(page);
  await areaInput(page).fill("12");
  await send(page);
  await expect(page.getByTestId("correction-confirm")).toHaveText("Working…");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes", includeHidden: true })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("status-archived")).toHaveAttribute("aria-disabled", "true");
  await request.get(`${STUB}/__correction-release`);
  await expect(live(page)).toContainText("corrected");
  expect((await stats(request)).attempts).toHaveLength(1);
});

for (const [value, text, status] of [
  ["stale", "This listing was changed in another session.", "Published"],
  ["conflict", "This listing has changed, so it cannot be corrected now.", "Archived"],
  ["unavailable", "The correction window is closed. Archive the listing to change these details.", "Published"],
  ["restricted_race", "This listing is now restricted", "Published"],
] as const) {
  test(`refused (${value}): the Listing and the window are read again`, async ({ page, request }) => {
    await open(page, request);
    await ready(page);
    await mode(request, value);
    await areaInput(page).fill("12");
    const before = (await stats(request)).gets;
    await send(page);
    await expect(live(page)).toContainText(text);
    await expect(page.getByTestId("draft-status")).toHaveText(status);
    if (value === "stale") {
      await expect(areaInput(page)).toHaveValue("12"); // the saved area did not move, so what was typed stays
      await expect.poll(async () => (await stats(request)).gets).toBeGreaterThan(before);
    }
    if (value === "unavailable") await expect(page.getByTestId("correction-note")).toHaveText(NOTE);
    if (value === "conflict" || value === "restricted_race") await expect(section(page)).toHaveCount(0);
  });
}

test("a server error is shown and the form stays", async ({ page, request }) => {
  await open(page, request);
  await ready(page);
  await mode(request, "error");
  await areaInput(page).fill("12");
  await send(page);
  await expect(page.getByTestId("correction-alert")).toBeFocused();
  await expect(page.getByTestId("correction-alert")).toContainText("Something went wrong on our side.");
  await expect(areaInput(page)).toHaveValue("12");
});

test("a session that ended goes to sign-in", async ({ page, request }) => {
  await open(page, request);
  await ready(page);
  await mode(request, "session_gone");
  await areaInput(page).fill("12");
  await send(page);
  await expect(page).toHaveURL(/\/sign-in/);
});
