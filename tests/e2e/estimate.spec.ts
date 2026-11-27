import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import ts from "typescript";
import { APP_URL, STUB_URL } from "./ports";

// Story 4.4, frontend half: "Get estimate" on the Draft page, the shared info popover, the About page, the preview and the wording scan.
const STUB = STUB_URL;
const ID = "00000000-0000-4000-9000-000000000001";
const DRAFT = `/account/listings/${ID}`;
const NOTE = "AI-generated approximation from the listing’s attributes. It is not a verified market valuation or a guaranteed return.";
const SAVE_FIRST = "Save your changes first. The estimate uses the saved details.";

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB}/__reset`);
  await request.get(`${STUB}/__listings-preset?value=preview_rich`);
});

async function open(page: Page, request: APIRequestContext, to = DRAFT) {
  await request.get(`${STUB}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
  await page.goto(to);
}
const posts = async (request: APIRequestContext) => (await (await request.get(`${STUB}/__estimate-stats`)).json()).posts as string[];
const section = (page: Page) => page.getByTestId("estimate-section");
const getEstimate = (page: Page) => section(page).getByRole("button", { name: "Get estimate" });
const info = (page: Page) => page.getByRole("button", { name: "About this estimate" });

async function expectNoViolations(page: Page) {
  await expect(page).toHaveTitle(/.+/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
}

test("estimate: asked only by the button, never changes the asking price, and shows in the preview @smoke", async ({ page, request }) => {
  await open(page, request);
  const price = page.getByLabel("Asking price", { exact: false }).first();
  await expect(price).toHaveValue("1500000.00");
  await expect(info(page)).toHaveCount(0);

  // Unsaved edits: disabled with the reason, and nothing is sent.
  const title = page.getByLabel("Title", { exact: true });
  await title.fill("Corner house, edited");
  await expect(page.getByTestId("estimate-reason")).toHaveText(SAVE_FIRST);
  await expect(getEstimate(page)).toHaveAttribute("aria-disabled", "true");
  await getEstimate(page).click({ force: true });
  await title.fill("Corner house with garden");
  expect(await posts(request)).toEqual([]);

  await getEstimate(page).click();
  await expect(page.getByTestId("estimate-value")).toHaveText("PKR 24,500,000.00");
  await expect(page.getByTestId("estimate-status")).toHaveText("The estimate is ready.");
  await expect(price).toHaveValue("1500000.00");
  await expect(info(page)).toHaveCount(1);
  expect(await posts(request)).toEqual([ID]);

  await page.getByTestId("draft-preview-link").click();
  await expect(page.getByTestId("preview-estimate-value")).toHaveText("PKR 24,500,000.00");
  await expect(info(page)).toHaveCount(1);
});

test("estimate: the popover works by keyboard, is a live region and links to the About page", async ({ page, request }) => {
  await open(page, request);
  await getEstimate(page).click();
  const note = page.getByTestId("estimate-note");
  await expect(note).toHaveAttribute("role", "status");
  await expect(note).toBeEmpty();
  await info(page).focus();
  await page.keyboard.press("Enter");
  await expect(info(page)).toHaveAttribute("aria-expanded", "true");
  await expect(note).toContainText(NOTE);
  await expectNoViolations(page);
  const link = note.getByRole("link", { name: /About AI Price Estimates/ });
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(note).toBeEmpty();
  await expect(info(page)).toBeFocused();

  await page.keyboard.press("Space");
  const [about] = await Promise.all([page.context().waitForEvent("page"), link.click()]);
  await expect(about.getByRole("heading", { level: 1, name: "About AI Price Estimates" })).toBeVisible();
});

for (const [mode, text] of [
  ["unavailable", "Estimate unavailable. This locality is not covered yet."],
  ["rate_limited", "Too many attempts. Try again in 2 minutes."],
  ["error", "Something went wrong on our side. Please try again in a moment."],
] as const) {
  test(`estimate: ${mode} shows its reason, no figure, and publishing stays available`, async ({ page, request }) => {
    await request.get(`${STUB}/__estimate-mode?value=${mode}`);
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, request);
    await getEstimate(page).click();
    await expect(page.getByTestId("estimate-status")).toHaveText(text);
    await expect(page.getByTestId("estimate-value")).toHaveCount(0);
    await expect(info(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Publish/ })).toBeVisible();
    if (mode === "unavailable") await expectNoViolations(page);
  });
}

test("axe: the About page states the source, inputs and limitations", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/about-estimates");
  const main = page.getByRole("main");
  await expect(main).toContainText("trained on synthetic data about Karachi");
  await expect(main).toContainText("What an estimate uses");
  await expect(main).toContainText("Estimates approximate asking prices, not transaction prices.");
  await expectNoViolations(page);
});

// SM-4c: string literals and JSX text of `src` (comments are not user-facing), the API contract labels and any public files.
const BANNED = /(?<![a-z])(demos?|demonstrat[a-z]*)(?![a-z])/i;

function userStrings(file: string): string[] {
  const text = fs.readFileSync(file, "utf8");
  if (!/\.(ts|tsx|js|mjs)$/.test(file)) return [text];
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) found.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true));
  return found;
}

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? filesUnder(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
}

test('wording: no user-facing string says "demo" or "demonstration" @smoke', () => {
  const root = path.resolve(__dirname, "../..");
  const files = [...filesUnder(path.join(root, "src")), ...filesUnder(path.join(root, "public"))].filter((file) => /\.(ts|tsx|js|mjs|yaml|json|html|txt|svg)$/.test(file));
  expect(files.length).toBeGreaterThan(50);
  expect(files.filter((file) => userStrings(file).some((value) => BANNED.test(value)))).toEqual([]);
});
