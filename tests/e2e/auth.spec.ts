import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { createAccount, TEST_PASSWORD, uniqueEmail } from "./support/db";

test.describe("authentication", () => {
  test("sends visitors to sign-in and back to where they were going", async ({ page }) => {
    const account = await createAccount();

    await page.goto("/clients?q=pine");
    await expect(page).toHaveURL(/\/sign-in\?callbackUrl=%2Fclients%3Fq%3Dpine$/);

    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/clients\?q=pine$/);
    await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
  });

  test("signs up, sets up the business and signs out", async ({ page }) => {
    const email = uniqueEmail("signup");

    await page.goto("/sign-up");
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
    await expect(page.getByText(/^Very strong/)).toBeVisible();
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByLabel("Business name").fill("Halcyon Labs");
    await page.getByLabel("Country").selectOption("PT");
    await page.getByLabel("Default currency").selectOption("EUR");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByTestId("business-chip")).toContainText("Halcyon Labs");
    await expect(page.getByText("No invoices yet")).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("new accounts without a business land on onboarding", async ({ page }) => {
    const account = await createAccount({ businessName: null });

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
    await page.goto("/clients");
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("rejects a wrong password without saying which field was wrong", async ({ page }) => {
    const account = await createAccount();

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("That email and password don't match.")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Email")).toHaveValue(account.email);

    await signIn(page, account.email, account.password);
    await expect(page.getByTestId("business-chip")).toContainText("Alvorada Studio");
  });

  test("refuses to sign up an email that already has an account", async ({ page }) => {
    const account = await createAccount();

    await page.goto("/sign-up");
    await page.getByLabel("Work email").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("An account with this email already exists. Sign in instead.")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up$/);
  });
});
