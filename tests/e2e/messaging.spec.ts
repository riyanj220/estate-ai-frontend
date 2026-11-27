import AxeBuilder from "@axe-core/playwright";
import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Epic 7, frontend: "Message seller" on a public Listing, the Conversation page and the inbox.
const LISTING = "00000000-0000-4000-b000-000000000001";
const THREAD = "/messages/00000000-0000-4000-f000-000000000001";
const INBOX = "/messages";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
});

async function startSession(page: Page, request: APIRequestContext, kind: "user" | "admin" = "user") {
  await request.get(`${STUB_URL}/__force-session${kind === "admin" ? "?kind=admin" : ""}`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
}

async function expectNoViolations(page: Page, label: string) {
  await expect(page).toHaveTitle(/.+/);
  expect((await new AxeBuilder({ page }).analyze()).violations, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${label} overflow`).toBe(false);
}

const mode = (request: APIRequestContext, value: string) => request.get(`${STUB_URL}/__messaging-mode?value=${value}`);
const sent = async (request: APIRequestContext) => (await (await request.get(`${STUB_URL}/__messaging-requests`)).json()).requests;
const open = (page: Page) => page.getByRole("button", { name: "Message seller" }).click();
const send = (page: Page) => page.getByRole("button", { name: "Send" }).click();

test("a Visitor is prompted to sign in, and a Conversation address sends them to sign in", async ({ page, request }) => {
  await page.goto(`/listings/${LISTING}`);
  await open(page);
  const prompt = page.getByTestId("message-prompt");
  await expect(prompt).toHaveText("Sign in or create an account to message the seller.");
  await expect(prompt.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", `/sign-in?next=%2Flistings%2F${LISTING}`);
  await expectNoViolations(page, "visitor prompt");
  await page.goto(THREAD);
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=${encodeURIComponent(THREAD)}`));
  expect(await sent(request)).toEqual([]);
});

test("send an inquiry, see it, reply, receive and open it again @smoke", async ({ page, request }) => {
  await startSession(page, request);
  await page.goto(`/listings/${LISTING}`);
  await open(page);
  const box = page.getByLabel("Your message to the seller");
  await expect(box).toBeFocused();
  await send(page);
  await expect(page.locator("form").getByRole("alert")).toHaveText("Write a message.");
  await box.fill("x".repeat(2001));
  await send(page);
  await expect(page.locator("form").getByRole("alert")).toHaveText("Use at most 2,000 characters.");
  await expectNoViolations(page, "inquiry form");
  await box.fill("Is it still available?");
  await send(page);
  await expect(page).toHaveURL(`${APP_URL}${THREAD}`);
  await expect(page.getByRole("heading", { level: 1, name: "Corner house with garden" })).toBeVisible();
  await expect(page.getByTestId("conversation-with")).toHaveText("Conversation with Sunrise Estates");
  const messages = page.getByTestId("messages").getByRole("listitem");
  await expect(messages).toHaveCount(1);
  await expect(messages.first()).toContainText("Is it still available?");

  await page.getByLabel("Reply").fill("When can I visit?");
  await send(page);
  await expect(page.getByTestId("conversation-status")).toHaveText("Message sent.");
  await expect(messages).toHaveCount(2);
  await expect(page.getByLabel("Reply")).toHaveValue("");

  await request.get(`${STUB_URL}/__messaging-reply?body=Tomorrow`);
  await page.getByRole("button", { name: "Check for new messages" }).click();
  await expect(messages).toHaveCount(3);
  await expect(messages.last()).toContainText("Sunrise Estates");
  for (const size of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(size);
    await expectNoViolations(page, `conversation ${size.width}`);
  }

  await page.getByRole("link", { name: "View listing" }).click();
  await open(page);
  await expect(page).toHaveURL(`${APP_URL}${THREAD}`);
  await expect(messages).toHaveCount(3);
});

test("a lost answer is retried with the same key and nothing is sent twice", async ({ page, request }) => {
  await startSession(page, request);
  await mode(request, "lost");
  await page.goto(`/listings/${LISTING}`);
  await open(page);
  await page.getByLabel("Your message to the seller").fill("Hello");
  await send(page);
  await expect(page.locator("form").getByRole("alert")).not.toBeEmpty();
  await expect(page.locator("main")).not.toContainText("Internal detail");
  await expect(page.getByLabel("Your message to the seller")).toHaveValue("Hello");
  await send(page);
  await expect(page.getByTestId("messages").getByRole("listitem")).toHaveCount(1);
  const requests = await sent(request);
  expect(requests).toHaveLength(2);
  expect(requests[0].key).toBe(requests[1].key);
});

test("refusals keep the draft and say why", async ({ page, request }) => {
  await startSession(page, request);
  await page.goto(`/listings/${LISTING}`);
  await open(page);
  await page.getByLabel("Your message to the seller").fill("Hello");
  for (const [value, text] of [
    ["own", "You cannot message your own listing."],
    ["unverified", "Verify your email address to send messages."],
    ["rate_limited", "Too many attempts. Try again later."],
  ]) {
    await mode(request, value);
    await send(page);
    await expect(page.locator("form").getByRole("alert")).toHaveText(text);
  }
  await expect(page.getByLabel("Your message to the seller")).toHaveValue("Hello");
});

test("a read-only thread, and a Conversation that is not mine", async ({ page, request }) => {
  await startSession(page, request);
  await page.goto(`/listings/${LISTING}`);
  await open(page);
  await page.getByLabel("Your message to the seller").fill("Hello");
  await send(page);
  await expect(page).toHaveURL(`${APP_URL}${THREAD}`);
  await mode(request, "sold");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Sold" })).toBeVisible();
  await expect(page.getByTestId("conversation-read-only")).toHaveText("This listing is no longer available, so you cannot send messages about it.");
  await expect(page.getByLabel("Reply")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "View listing" })).toHaveCount(0);
  await mode(request, "read_only");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Listing no longer available" })).toBeVisible();
  await expectNoViolations(page, "read only");
  await page.goto("/messages/00000000-0000-4000-f000-000000000099");
  await expect(page.getByTestId("conversation-missing")).toContainText("Conversation not found.");
  await expectNoViolations(page, "missing");
});

test("an administrator has no button", async ({ page, request }) => {
  await startSession(page, request, "admin");
  await page.goto(`/listings/${LISTING}`);
  await expect(page.getByRole("heading", { level: 1, name: "Corner house with garden" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Message seller" })).toHaveCount(0);
});

// Story 7.3: live delivery over the stub's fake `/ws`, through the Next.js proxy.
const liveStats = async (request: APIRequestContext) => (await (await request.get(`${STUB_URL}/__live-stats`)).json()) as { opened: number; open: number; fromClient: number };

async function openThread(page: Page, request: APIRequestContext) {
  await startSession(page, request);
  await page.goto(`/listings/${LISTING}`);
  await open(page);
  await page.getByLabel("Your message to the seller").fill("Hello");
  await send(page);
  await expect(page).toHaveURL(`${APP_URL}${THREAD}`);
}

test("a new message appears without refreshing, once, and nothing is sent on the socket @smoke", async ({ page, request }) => {
  await openThread(page, request);
  const messages = page.getByTestId("messages").getByRole("listitem");
  await expect(page.getByTestId("live-status")).toHaveText("New messages appear as they arrive.");
  await request.get(`${STUB_URL}/__messaging-reply?body=Tomorrow&announce=1`);
  await expect(messages).toHaveCount(2);
  await expect(messages.last()).toContainText("Tomorrow");
  await expect(page.getByTestId("conversation-status")).toHaveText("New message.");
  await page.getByLabel("Reply").fill("See you");
  await send(page);
  await expect(messages).toHaveCount(3);
  await expectNoViolations(page, "live conversation");
  expect((await liveStats(request)).fromClient).toBe(0);
  // Leaving the page closes the socket.
  await page.getByRole("link", { name: "View listing" }).click();
  await expect.poll(async () => (await liveStats(request)).open).toBe(0);
});

test("after a drop it reconnects and reads what it missed", async ({ page, request }) => {
  await openThread(page, request);
  const messages = page.getByTestId("messages").getByRole("listitem");
  const status = page.getByTestId("live-status");
  await expect(status).toHaveText("New messages appear as they arrive.");
  await request.get(`${STUB_URL}/__live-mode?value=off`);
  await request.get(`${STUB_URL}/__live-drop`);
  await expect(status).toHaveText("Live updates are paused. Check for new messages below.");
  await request.get(`${STUB_URL}/__messaging-reply?body=One`);
  await request.get(`${STUB_URL}/__messaging-reply?body=Two`);
  // The button still works while there is no live connection.
  await page.getByRole("button", { name: "Check for new messages" }).click();
  await expect(messages).toHaveCount(3);
  await request.get(`${STUB_URL}/__messaging-reply?body=Three`);
  await request.get(`${STUB_URL}/__live-mode?value=ok`);
  await expect(messages).toHaveCount(4, { timeout: 20_000 });
  await expect(messages.last()).toContainText("Three");
  await expect(status).toHaveText("New messages appear as they arrive.");
  expect((await liveStats(request)).opened).toBe(2);
});

test("a socket closed because the session ended is not reopened, and the page asks to sign in", async ({ page, request }) => {
  await openThread(page, request);
  await expect(page.getByTestId("live-status")).toHaveText("New messages appear as they arrive.");
  await request.get(`${STUB_URL}/__expire-session`);
  await request.get(`${STUB_URL}/__live-close?code=4401`);
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=${encodeURIComponent(THREAD)}`));
  expect((await liveStats(request)).opened).toBe(1);
});

// Stories 7.5 and 7.6: the inbox, unread state and what a Listing that moved on looks like.
const messagesLink = (page: Page) => page.getByRole("banner").getByRole("link", { name: /^Messages/ });

test("the inbox names each listing, shows what is unread and clears it on opening @smoke", async ({ page, request }) => {
  await startSession(page, request);
  await page.goto(INBOX);
  await expect(page.getByTestId("inbox-empty")).toContainText("You have no conversations yet.");
  await expect(messagesLink(page)).toHaveAccessibleName("Messages");
  await expectNoViolations(page, "empty inbox");

  await request.get(`${STUB_URL}/__messaging-seed`);
  await page.reload();
  const rows = page.getByTestId("inbox").getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(messagesLink(page)).toHaveAccessibleName("Messages, 1 unread");
  await expect(rows.nth(0).getByRole("heading")).toHaveText("Sold");
  await expect(rows.nth(0)).toContainText("With Sunrise Estates");
  await expect(rows.nth(0)).toContainText("1 unread");
  await expect(rows.nth(1).getByRole("heading")).toHaveText("Listing no longer available");
  await expect(rows.nth(1)).not.toContainText("unread");
  await expect(page.locator("main")).not.toContainText("Seeded message");
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(2).getByRole("heading")).toHaveText("Corner house with garden");
  await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);
  for (const size of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(size);
    await expectNoViolations(page, `inbox ${size.width}`);
  }
  await page.setViewportSize({ width: 1280, height: 800 });

  // The history of a sold listing is readable, and nothing can be sent.
  await rows.nth(0).getByRole("link", { name: "Sold" }).click();
  await expect(page.getByTestId("messages").getByRole("listitem")).toContainText("Seeded message");
  await expect(page.getByTestId("conversation-read-only")).toBeVisible();
  await expect(messagesLink(page)).toHaveAccessibleName("Messages");
  await page.getByRole("link", { name: "All messages" }).click();
  await expect(rows.nth(0).getByRole("heading")).toHaveText("Sold");
  await expect(page.getByTestId("inbox")).not.toContainText("unread");
});

test("a message arriving on the inbox shows as unread, and one on the open thread does not", async ({ page, request }) => {
  await openThread(page, request);
  await expect(page.getByTestId("live-status")).toHaveText("New messages appear as they arrive.");
  await request.get(`${STUB_URL}/__messaging-reply?body=Tomorrow&announce=1`);
  await expect(page.getByTestId("messages").getByRole("listitem")).toHaveCount(2);
  await page.getByRole("link", { name: "All messages" }).click();
  const rows = page.getByTestId("inbox").getByRole("listitem");
  await expect(rows).toHaveCount(1);
  await expect(rows).not.toContainText("unread");
  await expect.poll(async () => (await liveStats(request)).open).toBe(1);
  await request.get(`${STUB_URL}/__messaging-reply?body=Later&announce=1`);
  await expect(rows).toContainText("1 unread");
  await expect(messagesLink(page)).toHaveAccessibleName("Messages, 1 unread");
});

test("a Visitor is sent to sign in from the inbox, and an administrator has no link to it", async ({ page, request }) => {
  await page.goto(INBOX);
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=${encodeURIComponent(INBOX)}`));
  await startSession(page, request, "admin");
  await page.goto(`/listings/${LISTING}`);
  await expect(page.getByRole("heading", { level: 1, name: "Corner house with garden" })).toBeVisible();
  await expect(messagesLink(page)).toHaveCount(0);
});
