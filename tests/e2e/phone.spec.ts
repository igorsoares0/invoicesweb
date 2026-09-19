import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { createAccount, createClient, emailsFor } from "./support/db";
import { sentEstimate } from "./support/estimates";
import { markAsSent, readyDraft } from "./support/invoices";

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

test("a client accepts an estimate on a phone", async ({ page, browser }) => {
  const account = await createAccount();
  await createClient(account.businessId, { name: "Vale Coffee", email: "ops@valecoffee.com" });
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await signIn(desktop, account.email, account.password);
  const { number, publicPath } = await sentEstimate(desktop, "Vale Coffee", "Packaging refresh", "3150");
  await desktop.close();

  await page.goto(publicPath);
  await expect(page.getByText("Estimate total", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(number).filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Accept estimate" }).filter({ visible: true }).click();
  await expect(page.getByRole("status").filter({ visible: true })).toContainText(/^Accepted on/);

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

test("emails an invoice from a phone", async ({ page }) => {
  const account = await createAccount({ businessName: "Alvorada Studio" });
  await createClient(account.businessId, { name: "Ana Ruiz", email: "billing@pineco.com" });
  await signIn(page, account.email, account.password);

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Invoices" }).click();
  await page.getByRole("button", { name: "New invoice" }).first().click();
  await expect(page).toHaveURL(/\/invoices\/[\w-]+$/);
  const number = (await page.getByRole("heading", { level: 1 }).innerText()).trim();

  await page.getByRole("combobox", { name: "Bill to" }).click();
  await page.getByRole("option", { name: /Ana Ruiz/ }).click();
  await page.getByRole("button", { name: "+ Add item" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit item" });
  await sheet.getByLabel("Description").fill("Website redesign");
  await sheet.getByLabel("Unit price").fill("2400");
  await sheet.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Saved/ })).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("send-trigger").filter({ visible: true }).click();
  const dialog = page.getByRole("dialog", { name: "Send invoice" });
  await expect(dialog.getByText("billing@pineco.com")).toBeVisible();
  await dialog.getByRole("switch", { name: "Attach the PDF" }).click();
  await dialog.getByTestId("send-email").click();

  await expect(page.getByTestId("public-link")).toBeVisible();
  expect((await emailsFor(account.businessId, number))[0].status).toBe("SENT");

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

test("a Free invoice shows the Made with mark on the phone page", async ({ page, browser }) => {
  const account = await createAccount({ plan: "FREE" });
  await createClient(account.businessId, { name: "Vale Coffee", email: "ops@valecoffee.com" });
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await signIn(desktop, account.email, account.password);
  await readyDraft(desktop, "Vale Coffee");
  const publicPath = await markAsSent(desktop);
  await desktop.close();

  await page.goto(publicPath);

  await expect(page.getByText("Made with Invoice Maker").filter({ visible: true })).toBeVisible();
});
