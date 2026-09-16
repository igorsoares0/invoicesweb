import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { createAccount, createClient } from "./support/db";
import { markAsSent, readyDraft } from "./support/invoices";

test.beforeEach(async ({ page }) => {
  const account = await createAccount();
  await createClient(account.businessId, { name: "Halcyon Labs", email: "ana@halcyon.co" });
  await signIn(page, account.email, account.password);
});

test("cancelling kills the public link", async ({ page, browser }) => {
  await readyDraft(page, "Halcyon Labs");
  const publicPath = await markAsSent(page);

  await page.getByRole("button", { name: "Cancel invoice" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel invoice" }).click();
  await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText("Cancelled");

  const visitor = await browser.newPage();
  await visitor.goto(publicPath);
  await expect(visitor.getByRole("heading", { name: "This link no longer works" })).toBeVisible();
  const pdf = await visitor.request.get(`${publicPath}/pdf`);
  expect(pdf.status()).toBe(404);
  await visitor.close();
});

test("revoking a link and issuing a new one", async ({ page, browser }) => {
  await readyDraft(page, "Halcyon Labs");
  const oldPath = await markAsSent(page);

  const links = page.getByRole("region", { name: "Public link" });
  await links.getByRole("button", { name: "Revoke" }).click();
  await expect(links).toContainText("The link was revoked");
  await links.getByRole("button", { name: "Create a new link" }).click();
  await expect(page.getByTestId("public-link")).toBeVisible();
  const newPath = (await page.getByTestId("public-link").getAttribute("href"))!;
  expect(newPath).not.toBe(oldPath);

  const visitor = await browser.newPage();
  await visitor.goto(oldPath);
  await expect(visitor.getByText("This link no longer works")).toBeVisible();
  await visitor.goto(newPath);
  await expect(visitor.getByText("Invoice sent").filter({ visible: true })).toBeVisible();
  await visitor.close();
});

test("duplicating a sent invoice opens a new numbered draft", async ({ page }) => {
  await readyDraft(page, "Halcyon Labs", "Brand sprint", "4260");
  await markAsSent(page);
  const original = (await page.getByRole("heading", { level: 1 }).innerText()).trim();

  await page.getByRole("region", { name: "Actions" }).getByRole("button", { name: "Duplicate" }).click();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(original);
  await expect(page.getByRole("listitem", { name: "Line 1" }).getByLabel("Description")).toHaveValue("Brand sprint");
  await expect(page.getByRole("combobox", { name: "Bill to" })).toContainText("Halcyon Labs");
});

test("deleting a draft from the list", async ({ page }) => {
  await readyDraft(page, "Halcyon Labs");
  const number = (await page.getByRole("heading", { level: 1 }).innerText()).trim();

  await page.goto("/invoices");
  await page.getByRole("button", { name: `Actions for ${number}` }).click();
  await page.getByRole("menuitem", { name: "Delete draft" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();

  await expect(page.getByText("No invoices yet")).toBeVisible();
});
