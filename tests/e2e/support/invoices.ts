import { expect, type Page } from "@playwright/test";

/** Opens a new draft from the Overview and waits for the editor. */
export async function startInvoice(page: Page) {
  await page.goto("/overview");
  await page.getByRole("button", { name: "New invoice" }).first().click();
  await expect(page).toHaveURL(/\/invoices\/[\w-]+$/);
  await expect(page.getByText("No items yet")).toBeVisible();
}

export async function waitForSaved(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: /^Saved/ })).toBeVisible({ timeout: 20_000 });
}

export async function pickClient(page: Page, name: string) {
  await page.getByRole("combobox", { name: "Bill to" }).click();
  await page.getByRole("option", { name: new RegExp(name.replace(/[.&]/g, ".")) }).click();
}

/** A one-line draft that is ready to send, ending on the editor. */
export async function readyDraft(page: Page, client: string, description = "Website redesign", price = "2400") {
  await startInvoice(page);
  await pickClient(page, client);
  await page.getByRole("button", { name: "Add first item" }).click();
  const line = page.getByRole("listitem", { name: "Line 1" });
  await line.getByLabel("Description").fill(description);
  await line.getByLabel("Unit price").fill(price);
  await waitForSaved(page);
}

export async function markAsSent(page: Page) {
  await page.getByRole("button", { name: "Send invoice" }).click();
  await page.getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByTestId("public-link")).toBeVisible();
  return (await page.getByTestId("public-link").getAttribute("href"))!;
}
