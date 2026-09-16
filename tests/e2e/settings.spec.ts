import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { createAccount } from "./support/db";

test("updates the business profile and invoice numbering", async ({ page }) => {
  const account = await createAccount({ businessName: "Old Name" });
  await signIn(page, account.email, account.password);
  await page.goto("/settings");

  const profile = page.getByRole("region", { name: "Business profile" });
  await profile.getByLabel("Business name").fill("Alvorada Studio");
  await profile.getByLabel("Tax ID / VAT").fill("PT512334879");
  await profile.getByLabel("Country").selectOption("PT");
  await profile.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Business profile saved")).toBeVisible();
  await expect(page.getByTestId("business-chip")).toContainText("Alvorada Studio");

  const defaults = page.getByRole("region", { name: "Invoice defaults" });
  const preview = defaults.getByTestId("numbering-preview");
  await expect(preview).toContainText("Next invoice will be INV-0001");

  await defaults.getByLabel("Number prefix").fill("AS-");
  await defaults.getByLabel("Next number").fill("45");
  await expect(preview).toContainText("Next invoice will be AS-0045");
  await defaults.getByLabel("Default VAT").fill("23");
  await defaults.getByRole("button", { name: "Save defaults" }).click();
  await expect(page.getByText("Invoice defaults saved")).toBeVisible();

  await page.reload();
  await expect(defaults.getByLabel("Number prefix")).toHaveValue("AS-");
  await expect(defaults.getByLabel("Default VAT")).toHaveValue("23");

  await defaults.getByLabel("Next number").fill("0");
  await defaults.getByRole("button", { name: "Save defaults" }).click();
  await expect(defaults.getByText("Must be 1 or more")).toBeVisible();
});
