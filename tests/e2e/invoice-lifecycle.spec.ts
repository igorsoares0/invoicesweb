import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { createAccount, createClient, createProduct } from "./support/db";
import { markAsSent, pickClient, startInvoice, waitForSaved } from "./support/invoices";

test("an invoice goes from draft to paid", async ({ page, browser }) => {
  const account = await createAccount();
  await createClient(account.businessId, { name: "Pine & Co.", email: "billing@pineco.com" });
  await createProduct(account.businessId, { name: "UI design — per screen", unitPrice: "320.00", taxRate: "23" });
  await signIn(page, account.email, account.password);

  // Draft: the number is assigned before anything is typed.
  await startInvoice(page);
  const number = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
  expect(number).toMatch(/^INV-\d{4}$/);
  await expect(page.getByText(`${number} is already assigned to this draft`)).toBeVisible();
  await expect(page.getByTestId("send-trigger").filter({ visible: true })).toBeDisabled();

  await pickClient(page, "Pine & Co.");
  await page.getByRole("button", { name: "Add first item" }).click();
  const first = page.getByRole("listitem", { name: "Line 1" });
  await first.getByLabel("Description").fill("Website redesign — discovery & IA");
  await first.getByLabel("Unit price").fill("2400");

  await page.keyboard.press("Control+j");
  await page.getByRole("dialog").getByRole("button", { name: /UI design — per screen/ }).click();
  const second = page.getByRole("listitem", { name: "Line 2" });
  await second.getByLabel("Quantity").fill("12");

  await first.getByRole("button", { name: /^Discount for/ }).click();
  await page.getByLabel("Discount percentage").fill("10");
  await expect(page.getByTestId("line-math")).toHaveText("1 × $2,400 − 10% = $2,160.00 · no VAT");
  await page.keyboard.press("Escape");

  await waitForSaved(page);
  // 2,160.00 + 3,840.00 + 23% VAT on the catalog line (883.20)
  await expect(page.getByTestId("editor-total")).toHaveText("$6,883.20");

  // Validation blocks sending, not editing.
  await page.getByLabel("Due date").fill("2020-01-01");
  await expect(page.getByRole("alert", { name: "Problems to fix before sending" })).toContainText(
    "Due date is before the issue date",
  );
  await expect(page.getByTestId("send-trigger").filter({ visible: true })).toBeDisabled();
  const issueDate = await page.getByLabel("Issue date").inputValue();
  await page.getByLabel("Due date").fill(issueDate);
  await expect(page.getByRole("alert", { name: "Problems to fix before sending" })).toBeHidden();
  await waitForSaved(page);

  // Send: the detail view replaces the editor.
  const publicPath = await markAsSent(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(number);
  await expect(page.getByTestId("amount-due")).toHaveText("$6,883.20");

  // The client opens the link without an account.
  const client = await browser.newContext();
  const clientPage = await client.newPage();
  await clientPage.goto(publicPath);
  await expect(clientPage.getByText("Invoice sent").filter({ visible: true })).toBeVisible();
  await expect(clientPage.getByRole("article", { name: `Invoice ${number}` })).toContainText("$6,883.20");
  await expect(clientPage.getByRole("article", { name: `Invoice ${number}` })).toContainText("Bank transfer — IBAN PT50");
  const download = clientPage.waitForEvent("download");
  await clientPage.getByRole("link", { name: "Download PDF" }).click();
  expect((await download).suggestedFilename()).toBe(`${number}.pdf`);
  await client.close();

  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("region", { name: "History" })).toContainText("Viewed by client", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  // Payments: partial, then the rest.
  await page.getByRole("button", { name: "Record payment" }).first().click();
  await page.getByLabel("Amount").fill("2000");
  await expect(page.getByText("Leaves $4,883.20 open — status becomes Partially paid.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByTestId("amount-due")).toHaveText("$4,883.20");
  await expect(page.getByText("Partially paid").first()).toBeVisible();

  await page.getByRole("button", { name: "Record payment" }).first().click();
  await expect(page.getByLabel("Amount")).toHaveValue("4,883.20");
  await page.getByRole("dialog").getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByTestId("amount-due")).toHaveText("$0.00");
  await expect(page.getByRole("button", { name: "Record payment" })).toHaveCount(0);

  await page.goto("/overview?status=paid");
  await expect(page.getByRole("list", { name: "Invoices list" })).toContainText(number);
});
