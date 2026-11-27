import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { APP_URL, STUB_URL } from "./ports";

// Story 5.8: "Create with AI", the chat of a Draft and the way back to the manual form (AI_FEATURES=1, stub backend).
const NEW = "/account/listings/new";
const ID = /\/account\/listings\/([0-9a-f-]{36})\/assistant$/;

const message = (page: Page) => page.getByLabel("Your message");
const send = (page: Page) => page.getByRole("button", { name: "Send" });
const turns = (page: Page) => page.getByTestId("chat-turn");
const problem = (page: Page) => page.getByTestId("chat-problem");
const progress = (page: Page) => page.getByTestId("chat-progress");
const setMode = (request: APIRequestContext, value: string) => request.get(`${STUB_URL}/__assistant-mode?value=${value}`);
const sent = async (request: APIRequestContext) => (await (await request.get(`${STUB_URL}/__assistant-requests`)).json()).requests;

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

/** Signs in and starts a Draft with "Create with AI", accepting the notice. */
async function start(page: Page, request: APIRequestContext) {
  await request.get(`${STUB_URL}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
  await page.goto(NEW);
  await page.getByRole("radio", { name: "Sale", exact: true }).check();
  await page.getByLabel("Category", { exact: true }).selectOption("house");
  await page.getByLabel("Subtype", { exact: true }).selectOption("house");
  await page.getByRole("button", { name: "Create with AI" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(ID);
  await expect(message(page)).toBeVisible();
}

async function say(page: Page, text: string) {
  await message(page).fill(text);
  await send(page).click();
}

test("@smoke Create with AI opens the chat; a reply is plain text; history and the manual form are there", async ({ page, request }) => {
  await start(page, request);
  const id = ID.exec(page.url())![1];
  await setMode(request, "sources");
  await say(page, "What is a marla?");
  await expect(turns(page)).toHaveCount(1);
  await expect(page.getByTestId("chat-reply")).toContainText("Stub reply <b>not bold</b>");
  await expect(page.getByTestId("chat-reply").locator("b")).toHaveCount(0);
  await expect(page.getByTestId("chat-sources")).toContainText("Marla (Measures)");
  await expect(page.getByTestId("chat-sources")).toContainText("does not verify any approval");
  await expect(message(page)).toHaveValue("");

  await page.getByRole("link", { name: "Switch to the manual form" }).click();
  await expect(page).toHaveURL(`${APP_URL}/account/listings/${id}`);
  await page.getByRole("link", { name: "Continue with the AI assistant" }).click();
  await expect(turns(page)).toContainText("What is a marla?");
});

test("while a reply is on its way progress shows, nothing is sent twice and the manual link stays", async ({ page, request }) => {
  await start(page, request);
  await setMode(request, "hold");
  await say(page, "Five bedrooms");
  await expect(progress(page)).toHaveText("The assistant is replying…");
  await send(page).click({ force: true });
  await expect(page.getByRole("link", { name: "Switch to the manual form" })).toBeVisible();
  await expect.poll(async () => (await sent(request)).length).toBe(1);
  await request.get(`${STUB_URL}/__assistant-release`);
  await expect(page.getByTestId("chat-reply")).toBeVisible();
  await expect(progress(page)).toHaveText("");
});

test("failures keep the message, show fixed text and a repeat uses the same turn id", async ({ page, request }) => {
  await start(page, request);
  await send(page).click();
  await expect(problem(page)).toHaveText("Type a message first.");
  for (const [mode, text] of [
    ["error", "The assistant is unavailable right now."],
    ["timeout", "The assistant took too long."],
    ["budget_exhausted", "Today's AI capacity is used up."],
    ["rate_limited", "Too many attempts. Try again in 2 minutes."],
    ["conflict", "Your message was not sent."],
  ]) {
    await setMode(request, mode);
    await say(page, "Hello");
    await expect(problem(page)).toContainText(text);
    await expect(message(page)).toHaveValue("Hello");
  }
  await expect(page.getByRole("main")).not.toContainText("Raw server text");
  await expect(turns(page)).toHaveCount(0);
  await setMode(request, "no_explanations");
  await send(page).click();
  await expect(turns(page)).toHaveCount(1);
  await expect(progress(page)).toContainText("Explanations are unavailable");
  const ids = (await sent(request)).map((body: { client_turn_id: string }) => body.client_turn_id);
  expect(new Set(ids).size).toBe(1);
  expect(ids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test("a first message from a direct visit shows the external-service notice before anything is sent", async ({ page, request }) => {
  await start(page, request);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await say(page, "Hello");
  await expect(page.getByRole("dialog", { name: "AI features use an external service" })).toBeVisible();
  expect(await sent(request)).toHaveLength(0);
  await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
  await expect(turns(page)).toHaveCount(1);
});

test("a listing that takes no assistant says why; an unknown one is not found", async ({ page, request }) => {
  await start(page, request);
  const url = page.url();
  await setMode(request, "open_conflict");
  await page.reload();
  await expect(page.getByTestId("assistant-refusal")).toHaveText("The assistant is only available while a listing is a draft.");
  await page.goto(url.replace(ID, "/account/listings/00000000-0000-4000-9000-000000000999/assistant"));
  await expect(page.getByTestId("assistant-refusal")).toHaveText("We could not find that listing.");
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 360, height: 740 },
]) {
  test(`axe: the chat has no violations (${viewport.name})`, async ({ page, request }) => {
    await page.setViewportSize(viewport);
    await start(page, request);
    await setMode(request, "sources");
    await say(page, "What is a marla?");
    await expect(page.getByTestId("chat-sources")).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(violations).toEqual([]);
  });
}
