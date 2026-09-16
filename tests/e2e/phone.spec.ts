import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { createAccount } from "./support/db";

test("works at phone width: tab bar, bottom sheets and card rows", async ({ page }) => {
  const account = await createAccount();
  await signIn(page, account.email, account.password);

  const tabs = page.getByRole("navigation", { name: "Main" });
  await tabs.getByRole("link", { name: "Clients" }).click();
  await expect(page).toHaveURL(/\/clients$/);
  await expect(tabs.getByRole("link", { name: "Clients" })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "New client", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "New client" });
  await expect(sheet).toBeVisible();
  // The sheet slides in from the bottom; once settled it is anchored to the bottom edge.
  await expect.poll(async () => {
    const box = await sheet.boundingBox();
    return box && Math.round(box.y + box.height);
  }).toBe(844);

  await sheet.getByLabel("Name").fill("Northwind Café");
  await sheet.getByLabel("Billing email").fill("maria@northwind.cafe");
  await sheet.getByRole("button", { name: "Add client" }).click();

  const details = page.getByRole("dialog", { name: "Client details" });
  await expect(details.getByRole("heading", { name: "Northwind Café" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();

  await expect(page.getByText("Location", { exact: true })).toBeHidden();
  await expect(page.getByRole("list", { name: "Clients" })).toContainText("maria@northwind.cafe");

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

test("edits an invoice on a phone with cards and a bottom sheet", async ({ page }) => {
  const account = await createAccount();
  await signIn(page, account.email, account.password);

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Invoices" }).click();
  await page.getByRole("button", { name: "New invoice" }).first().click();
  await expect(page).toHaveURL(/\/invoices\/[\w-]+$/);

  await page.getByRole("button", { name: "+ Add item" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit item" });
  await sheet.getByLabel("Description").fill("Handoff & QA support");
  await sheet.getByRole("button", { name: "Increase quantity" }).click();
  await sheet.getByLabel("Unit price").fill("140");
  await sheet.getByRole("button", { name: "Save item" }).click();
  await expect(sheet).toBeHidden();

  const card = page.getByRole("listitem", { name: "Line 1" });
  await expect(card).toContainText("2 × $140.00");
  await expect(card).toContainText("$280.00");
  await expect(page.getByText("Total due").last()).toBeVisible();

  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByRole("article")).toContainText("Handoff & QA support");

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});
