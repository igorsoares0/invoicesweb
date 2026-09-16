import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { createAccount } from "./support/db";

test.beforeEach(async ({ page }) => {
  const account = await createAccount();
  await signIn(page, account.email, account.password);
  await page.goto("/products");
});

test("adds an exempt item only with a reason, then edits its price", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Items & services" })).toBeVisible();
  await page.getByRole("button", { name: "New item" }).click();

  const editor = page.getByRole("complementary", { name: "Item editor" });
  await editor.getByLabel("Name").fill("Handoff & QA support");
  await editor.getByLabel("Description").fill("Dev support during build");
  await editor.getByLabel("Unit", { exact: true }).fill("hour");
  await editor.getByLabel("Unit price").fill("140");
  await editor.getByRole("checkbox").check();
  await editor.getByRole("button", { name: "Add item" }).click();

  await expect(editor.getByText("An exemption reason is required — it prints on the PDF")).toBeVisible();

  await editor.getByLabel("Exemption reason").fill("Art. 53 CIVA — small business exemption");
  await editor.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("Handoff & QA support was added")).toBeVisible();

  const row = page.getByRole("list", { name: "Items" }).getByRole("listitem").filter({ hasText: "Handoff & QA support" });
  await expect(row).toContainText("per hour");
  await expect(row).toContainText("$140.00");
  await expect(row).toContainText("Exempt");

  await expect(editor.getByRole("heading", { name: "Edit item" })).toBeVisible();
  await editor.getByLabel("Unit price").fill("1,450.5");
  await editor.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByText("Item saved")).toBeVisible();
  await expect(row).toContainText("$1,450.50");
  await expect(editor.getByText("New invoices pick up $1,450.50.")).toBeVisible();
});

test("duplicates and deletes an item", async ({ page }) => {
  await page.getByRole("button", { name: "New item" }).click();
  const editor = page.getByRole("complementary", { name: "Item editor" });
  await editor.getByLabel("Name").fill("Brand sprint");
  await editor.getByLabel("Unit price").fill("4260");
  await editor.getByLabel("VAT rate").fill("23");
  await editor.getByRole("button", { name: "Add item" }).click();
  await expect(editor.getByRole("heading", { name: "Edit item" })).toBeVisible();

  await editor.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.getByText("Item duplicated")).toBeVisible();
  const items = page.getByRole("list", { name: "Items" }).getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.filter({ hasText: "Brand sprint (copy)" })).toContainText("23%");

  await editor.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(items).toHaveCount(1);
  await expect(items).toContainText("Brand sprint");
});
