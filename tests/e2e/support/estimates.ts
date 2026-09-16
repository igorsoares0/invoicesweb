import { expect, type Page } from "@playwright/test";
import { pickClient, waitForSaved } from "./invoices";

/** A one-line estimate, sent, ending on its detail page. Returns its number and public path. */
export async function sentEstimate(page: Page, client: string, description = "Brand sprint", price = "4260") {
  await page.goto("/estimates");
  await page.getByRole("button", { name: "New estimate" }).first().click();
  await expect(page).toHaveURL(/\/estimates\/[\w-]+$/);
  await expect(page.getByText("No items yet")).toBeVisible();
  const number = (await page.getByRole("heading", { level: 1 }).innerText()).trim();

  await pickClient(page, client, "Estimate for");
  await page.getByRole("button", { name: "Add first item" }).click();
  const line = page.getByRole("listitem", { name: "Line 1" });
  await line.getByLabel("Description").fill(description);
  await line.getByLabel("Unit price").fill(price);
  await page.getByLabel("Scope & terms").fill("50% due on kickoff, balance on delivery.");
  await waitForSaved(page);

  await page.getByRole("button", { name: "Send estimate" }).click();
  await page.getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByTestId("public-link")).toBeVisible();
  const publicPath = (await page.getByTestId("public-link").getAttribute("href"))!;
  return { number, publicPath };
}
