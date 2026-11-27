import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { APP_URL, STUB_URL } from "./ports";

// Stories 5.14 and 5.15: coming back to a conversation, repeating a message and working on without the assistant.
const DRAFT = "/account/listings/00000000-0000-4000-9000-000000000001";
const setMode = (request: APIRequestContext, value: string) => request.get(`${STUB_URL}/__assistant-mode?value=${value}`);
const sent = async (request: APIRequestContext) => (await (await request.get(`${STUB_URL}/__assistant-requests`)).json()).requests;
const turns = (page: Page) => page.getByTestId("chat-turn");
const message = (page: Page) => page.getByLabel("Your message");
const send = (page: Page) => page.getByRole("button", { name: "Send" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

async function open(page: Page, request: APIRequestContext, page_: "assistant" | "review") {
  await request.get(`${STUB_URL}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
  await request.get(`${STUB_URL}/__listings-preset?value=publish_ai_price`);
  await page.goto(`${DRAFT}/${page_}`);
}

async function sayFirst(page: Page, text: string) {
  await message(page).fill(text);
  await send(page).click();
  await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
}

test("@smoke a lost answer is repeated with the same id, shows once and is still there on return", async ({ page, request }) => {
  await open(page, request, "assistant");
  await setMode(request, "lost");
  await sayFirst(page, "Five bedrooms");
  await expect(page.getByTestId("chat-problem")).toContainText("Something went wrong");
  await expect(message(page)).toHaveValue("Five bedrooms");
  await setMode(request, "ok");
  await send(page).click();
  await expect(turns(page)).toHaveCount(1);
  await expect(page.getByTestId("chat-reply")).toBeVisible();
  const ids = (await sent(request)).map((body: { client_turn_id: string }) => body.client_turn_id);
  expect(ids).toHaveLength(2);
  expect(new Set(ids).size).toBe(1);

  await page.goto(DRAFT);
  await page.getByRole("link", { name: "Continue with the AI assistant" }).click();
  await expect(turns(page)).toHaveCount(1);
  await expect(turns(page)).toContainText("Five bedrooms");
  await expect(page.getByTestId("chat-next")).toContainText("What is the area");
});

test("an unavailable assistant says so and leads to the manual form", async ({ page, request }) => {
  await open(page, request, "assistant");
  await setMode(request, "fallback");
  await sayFirst(page, "Five bedrooms");
  await expect(page.getByTestId("chat-problem")).toContainText("unavailable right now");
  await expect(turns(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Continue in the manual form" }).click();
  await expect(page).toHaveURL(`${APP_URL}${DRAFT}`);
});

test("a description the assistant cannot write can be written by hand", async ({ page, request }) => {
  await open(page, request, "review");
  const status = page.getByTestId("review-status");
  const write = page.getByRole("button", { name: "Write it with AI" });
  await setMode(request, "timeout");
  await write.click();
  await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
  await expect(status).toContainText("took too long. Write the description yourself");
  for (const [mode, text] of [
    ["budget_exhausted", "capacity is used up"],
    ["rate_limited", "Try again in 2 minutes. You can write the description yourself."],
  ]) {
    await setMode(request, mode);
    await write.click();
    await expect(status).toContainText(text);
  }
  await page.getByLabel("Your description").fill("My own words about the house.");
  await page.getByRole("button", { name: "Save description" }).click();
  await expect(status).toContainText("Your description was saved.");
});
