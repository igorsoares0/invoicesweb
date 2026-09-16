import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { createAccount, createClient, expireEstimate } from "./support/db";
import { sentEstimate } from "./support/estimates";

let businessId: string;

test.beforeEach(async ({ page }) => {
  const account = await createAccount();
  businessId = account.businessId;
  await createClient(account.businessId, { name: "Northwind Café", email: "maria@northwind.cafe" });
  await signIn(page, account.email, account.password);
});

test("the client declines, and the owner reopens it", async ({ page, browser }) => {
  const { publicPath } = await sentEstimate(page, "Northwind Café");

  const visitor = await browser.newPage();
  await visitor.goto(publicPath);
  await visitor.getByRole("region", { name: "Your decision" }).getByRole("button", { name: "Decline" }).click();
  await visitor.getByRole("alertdialog").getByRole("button", { name: "Decline estimate" }).click();
  await expect(visitor.locator("main").getByRole("status")).toContainText(/^Declined on/);
  await visitor.close();

  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Declined by client" })).toBeVisible();
  await page.getByRole("button", { name: "Reopen for a reply" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Waiting for a reply" })).toBeVisible();
});

test("the owner records a reply that came by phone", async ({ page }) => {
  await sentEstimate(page, "Northwind Café");

  await page.getByRole("region", { name: "Record the reply yourself" }).getByRole("button", { name: "Mark accepted" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Marked accepted" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Status history" })).toContainText("Marked accepted by you");
  await expect(page.getByRole("button", { name: "Convert to invoice" }).first()).toBeEnabled();
});

test("an expired estimate can't be accepted from its link", async ({ page, browser }) => {
  const { number, publicPath } = await sentEstimate(page, "Northwind Café");
  await expireEstimate(number, businessId);

  const visitor = await browser.newPage();
  await visitor.goto(publicPath);
  await expect(visitor.getByRole("heading", { name: "This estimate has expired" })).toBeVisible();
  await expect(visitor.getByText(`${number} was valid until January 1, 2020`)).toBeVisible();
  await expect(visitor.getByRole("button", { name: "Accept estimate" })).toHaveCount(0);
  const refused = await visitor.request.post(`${publicPath}/accept`);
  expect(refused.status()).toBe(409);
  await visitor.close();

  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Expired on January 1, 2020" })).toBeVisible();
  await page.goto("/estimates?status=expired");
  await expect(page.getByRole("list", { name: "Estimates list" })).toContainText(number);
});

test("the list shows accepted work that hasn't been invoiced", async ({ page }) => {
  const { number } = await sentEstimate(page, "Northwind Café", "Menu system", "1980");
  await page.getByRole("button", { name: "Mark accepted" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Marked accepted" })).toBeVisible();

  await page.goto("/estimates");
  await expect(page.getByText(`Northwind Café accepted ${number}`)).toBeVisible();
  await page.getByRole("link", { name: "Convert to invoice" }).click();
  await expect(page.getByRole("dialog", { name: "Convert to invoice" })).toBeVisible();

  await page.goto("/overview");
  await expect(page.getByText(`Northwind Café accepted ${number}`)).toBeVisible();
});
