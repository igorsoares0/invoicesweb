import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { createAccount } from "./support/db";

test.beforeEach(async ({ page }) => {
  const account = await createAccount();
  await signIn(page, account.email, account.password);
  await page.goto("/clients");
});

test("creates, finds, edits and deletes a client", async ({ page }) => {
  await expect(page.getByText("No clients yet")).toBeVisible();

  for (const [name, email] of [
    ["Halcyon Labs", "ana@halcyon.co"],
    ["Pine & Co.", "billing@pineco.com"],
  ]) {
    await page.getByRole("button", { name: "New client", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Billing email").fill(email);
    await dialog.getByLabel("City").fill("Lisbon");
    await dialog.getByLabel("Country").selectOption("PT");
    await dialog.getByRole("button", { name: "Add client" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("complementary", { name: "Client details" }).getByRole("heading", { name })).toBeVisible();
  }

  const list = page.getByRole("list", { name: "Clients" });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("2 clients")).toBeVisible();

  await page.getByRole("searchbox", { name: "Search clients" }).fill("pineco");
  await expect(page).toHaveURL(/q=pineco/);
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("Pine & Co.");

  await list.getByRole("link", { name: /Pine & Co\./ }).click();
  const details = page.getByRole("complementary", { name: "Client details" });
  await expect(details).toContainText("Lisbon, Portugal");
  await details.getByRole("button", { name: "Edit client" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tax ID / VAT").fill("US-88-1234567");
  await dialog.getByRole("button", { name: "Save client" }).click();
  await expect(dialog).toBeHidden();
  await expect(details).toContainText("US-88-1234567");

  await details.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Pine & Co. was deleted")).toBeVisible();
  await expect(page.getByText("No clients match")).toBeVisible();

  await page.getByRole("searchbox", { name: "Search clients" }).fill("");
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("Halcyon Labs");
});

test("shows the API's validation errors in the form", async ({ page }) => {
  await page.getByRole("button", { name: "New client", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Billing email").fill("not-an-email");
  await dialog.getByRole("button", { name: "Add client" }).click();

  await expect(dialog.getByText("Client name is required")).toBeVisible();
  await expect(dialog.getByText("Enter a valid email address")).toBeVisible();
  await expect(dialog.getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
});

test("doesn't reveal another business's client through the URL", async ({ page, browser }) => {
  await page.getByRole("button", { name: "New client", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Secret Client");
  await page.getByRole("dialog").getByRole("button", { name: "Add client" }).click();
  await expect(page).toHaveURL(/client=/);
  const clientId = new URL(page.url()).searchParams.get("client");

  const intruder = await createAccount({ businessName: "Intruder Ltd" });
  const context = await browser.newContext();
  const otherPage = await context.newPage();
  await signIn(otherPage, intruder.email, intruder.password);

  await otherPage.goto(`/clients?client=${clientId}`);
  await expect(otherPage.getByText("No clients yet")).toBeVisible();
  await expect(otherPage.getByText("Secret Client")).toHaveCount(0);

  const response = await otherPage.request.get(`/api/v1/clients/${clientId}`);
  expect(response.status()).toBe(404);
  await context.close();
});
