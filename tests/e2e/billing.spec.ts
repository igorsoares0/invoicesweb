import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { subscribeViaWebhook } from "./support/billing";
import { alreadySent, createAccount, createClient, setTemplate } from "./support/db";
import { markAsSent, readyDraft } from "./support/invoices";

test("a Free account hits the monthly limit on the fourth invoice, and the draft stays", async ({ page }) => {
  const account = await createAccount({ plan: "FREE" });
  await createClient(account.businessId, { name: "Pine & Co.", email: "billing@pineco.com" });
  await alreadySent(account.businessId, 3);
  await signIn(page, account.email, account.password);

  const usage = page.getByRole("region", { name: "Plan usage" });
  await expect(usage).toContainText("3 of 3 invoices sent");
  await expect(usage.getByRole("link", { name: "See Pro" })).toBeVisible();

  await readyDraft(page, "Pine & Co.");
  await page.getByTestId("send-trigger").filter({ visible: true }).click();
  await page.getByRole("dialog", { name: "Send invoice" }).getByTestId("mark-as-sent").click();

  const limit = page.getByRole("dialog", { name: "You've used all 3 invoices this month" });
  await expect(limit).toBeVisible();
  await expect(limit.getByRole("link", { name: "Upgrade to Pro" })).toHaveAttribute("href", "/pricing");
  await limit.getByRole("button", { name: "Keep as draft" }).click();

  await expect(limit).toBeHidden();
  // Still the editor: the draft was never sent.
  await expect(page.getByTestId("send-trigger").filter({ visible: true })).toBeEnabled();
  await expect(page.getByTestId("public-link")).toBeHidden();
});

test("a Pro template on Free can be swapped for a free one and sent", async ({ page }) => {
  const account = await createAccount({ plan: "FREE" });
  await createClient(account.businessId, { name: "Pine & Co.", email: "billing@pineco.com" });
  await signIn(page, account.email, account.password);

  await readyDraft(page, "Pine & Co.");
  const number = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
  await setTemplate(account.businessId, number, "BOLD");
  await page.reload();

  await page.getByTestId("send-trigger").filter({ visible: true }).click();
  await page.getByRole("dialog", { name: "Send invoice" }).getByTestId("mark-as-sent").click();
  const gate = page.getByRole("dialog", { name: "This draft uses Pro options" });
  await expect(gate).toContainText("a Pro template");

  await gate.getByRole("button", { name: "Use free options" }).click();
  await expect(gate).toBeHidden();
  // The send dialog kept its place underneath; this time the send goes through.
  await page.getByRole("dialog", { name: "Send invoice" }).getByTestId("mark-as-sent").click();
  await expect(page.getByTestId("public-link")).toBeVisible();
});

test("Free documents carry the mark until the account goes Pro", async ({ page, browser, request }) => {
  const account = await createAccount({ plan: "FREE" });
  await createClient(account.businessId, { name: "Pine & Co.", email: "billing@pineco.com" });
  await signIn(page, account.email, account.password);
  await expect(page.getByTestId("business-chip")).toContainText("Free plan");

  await readyDraft(page, "Pine & Co.");
  const publicPath = await markAsSent(page);

  const visitor = await browser.newPage();
  await visitor.goto(publicPath);
  await expect(visitor.getByText("Made with Invoice Maker").filter({ visible: true }).first()).toBeVisible();

  // The Free PDF keeps to one page with the mark on it.
  const pdf = await (await request.get(`${publicPath}/pdf`)).body();
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1);

  await subscribeViaWebhook(request, account.userId);

  await visitor.reload();
  await expect(visitor.getByText("Made with Invoice Maker")).toHaveCount(0);
  await page.goto("/overview");
  await expect(page.getByTestId("business-chip")).toContainText("Pro");
  await expect(page.getByRole("region", { name: "Plan usage" })).toHaveCount(0);
  await visitor.close();
});

test("the trial sends a Pro template without a gate", async ({ page }) => {
  const account = await createAccount();
  await createClient(account.businessId, { name: "Pine & Co.", email: "billing@pineco.com" });
  await signIn(page, account.email, account.password);
  await expect(page.getByRole("region", { name: "Plan usage" })).toContainText(/Pro trial · 1[34] days left/);

  await readyDraft(page, "Pine & Co.");
  const number = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
  await setTemplate(account.businessId, number, "BOLD");
  await page.reload();

  await markAsSent(page);
});

test("the plans page shows both plans and the current one", async ({ page }) => {
  const account = await createAccount({ plan: "FREE" });
  await signIn(page, account.email, account.password);

  await page.getByRole("region", { name: "Plan usage" }).getByRole("link", { name: "Upgrade to Pro" }).click();

  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByRole("heading", { name: "One price, everything unlocked" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Free" })).toContainText("Your current plan");
  await page.getByRole("radio", { name: "Monthly" }).click();
  await expect(page.getByRole("region", { name: "Pro" })).toContainText("$9");
  // No Paddle keys in test runs: the page says so rather than opening a broken checkout.
  await expect(page.getByText(/Billing isn't configured on this server/)).toBeVisible();
});
