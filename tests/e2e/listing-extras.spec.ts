import { APP_URL, STUB_URL } from "./ports";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Stories 11.3 and 11.4, frontend half: the deferred fields and the tour link in the Draft form, the floor plan section, and what the
// public page shows of them, against the stub backend (preset `deferred`).
const ID = "00000000-0000-4000-9000-000000000001";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test.beforeEach(async ({ request }) => {
  await request.get(`${STUB_URL}/__reset`);
  await request.get(`${STUB_URL}/__registry-fields?value=deferred`);
});

async function openDraft(page: Page, request: APIRequestContext) {
  await request.get(`${STUB_URL}/__listings-preset?value=images_one`);
  await request.get(`${STUB_URL}/__force-session`);
  await page.context().addCookies([{ name: "estate_session", value: "stub-live", url: APP_URL }]);
  await page.goto(`/account/listings/${ID}`);
  await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
}

test("floor plan: add, then remove, apart from the photos @smoke", async ({ page, request }) => {
  await openDraft(page, request);
  const section = page.getByTestId("floor-plan");
  await section.getByLabel("Add a floor plan").setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByTestId("floor-plan-status")).toHaveText("Floor plan saved.");
  await expect(section.getByRole("img", { name: "Floor plan" })).toBeVisible();
  await expect(page.getByTestId("images-count")).toHaveText("1 of 10 images");
  await section.getByRole("button", { name: "Remove floor plan" }).click();
  await expect(page.getByTestId("floor-plan-status")).toHaveText("Floor plan removed.");
  await expect(section.getByRole("img")).toHaveCount(0);
});

test("form: the payment type and the tour link save, and a link that is not https is refused", async ({ page, request }) => {
  await openDraft(page, request);
  const link = page.getByLabel("Video or virtual tour link");
  await link.fill("http://example.com/tour");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator("#video_tour_url-error")).toContainText("https://");
  await link.fill("https://example.com/tour");
  await page.getByLabel("Payment type").selectOption("installments");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("draft-detail-payment_type")).toHaveText("Installments");
  await expect(page.getByTestId("draft-detail-video_tour_url")).toHaveText("https://example.com/tour");
});

test("public page: the floor plan, the tour as a plain link and the seller-declared label @smoke", async ({ page }) => {
  await page.goto("/listings");
  await page.getByRole("link", { name: "Corner house with garden" }).click();
  await expect(page.getByTestId("listing-floor-plan").getByRole("img", { name: "Floor plan" })).toBeVisible();
  const tour = page.getByTestId("listing-detail-video_tour_url").getByRole("link");
  await expect(tour).toHaveAttribute("href", "https://example.com/tour");
  await expect(tour).toHaveAttribute("rel", "noopener noreferrer nofollow ugc");
  await expect(page.locator("iframe, video")).toHaveCount(0);
  await expect(page.getByTestId("listing-detail-mortgage_declaration")).toContainText("Seller-declared");
});
