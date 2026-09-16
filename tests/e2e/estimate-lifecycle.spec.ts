import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { createAccount, createClient } from "./support/db";
import { sentEstimate } from "./support/estimates";

test("an estimate is accepted by the client and becomes an invoice", async ({ page, browser }) => {
  const account = await createAccount();
  await createClient(account.businessId, { name: "Pine & Co.", email: "billing@pineco.com" });
  await signIn(page, account.email, account.password);

  const { number, publicPath } = await sentEstimate(page, "Pine & Co.");
  expect(number).toMatch(/^EST-\d{4}$/);
  await expect(page.getByRole("status").filter({ hasText: "Waiting for a reply" })).toBeVisible();

  // Locked once sent: the detail view has no editor.
  await expect(page.getByLabel("Description")).toHaveCount(0);

  // The client decides without an account.
  const client = await browser.newContext();
  const clientPage = await client.newPage();
  await clientPage.goto(publicPath);
  const decision = clientPage.getByRole("region", { name: "Your decision" });
  await expect(decision).toContainText("Accepting doesn't charge you");
  await expect(clientPage.getByRole("article", { name: `Estimate ${number}` })).toContainText("$4,260.00");
  await expect(clientPage.getByRole("article", { name: `Estimate ${number}` })).toContainText("50% due on kickoff");
  await decision.getByRole("button", { name: "Accept estimate" }).click();
  await expect(clientPage.locator("main").getByRole("status")).toContainText("will send an invoice with these prices");
  await expect(decision).toHaveCount(0);
  await client.close();

  // The owner converts it.
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Accepted by client" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Status history" })).toContainText("Accepted by client");

  await page.getByRole("button", { name: "Convert to invoice" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Convert to invoice" });
  await expect(dialog).toContainText(`${number} stays untouched`);
  await expect(dialog).toContainText("1 line, prices locked");
  await dialog.getByRole("button", { name: "Create invoice" }).click();

  await expect(page).toHaveURL(/\/invoices\/[\w-]+$/);
  await expect(page.getByRole("link", { name: `Converted from ${number}` })).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Line 1" }).getByLabel("Description")).toHaveValue("Brand sprint");
  await expect(page.getByRole("combobox", { name: "Bill to" })).toContainText("Pine & Co.");

  await page.getByRole("link", { name: `Converted from ${number}` }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Converted to INV-/ })).toBeVisible();

  await page.goto("/estimates?status=converted");
  await expect(page.getByRole("list", { name: "Estimates list" })).toContainText(number);
});
