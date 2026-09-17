import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { createAccount, createClient, emailsFor } from "./support/db";
import { estimateDraft } from "./support/estimates";
import { readyDraft } from "./support/invoices";

/** The dialog's primary shares its name with the button that opens it, so scope to the dialog. */
const confirm = (page: import("@playwright/test").Page) => page.getByRole("dialog").getByTestId("send-email");

test("an invoice goes out by email, and can be emailed again", async ({ page }) => {
  const account = await createAccount({ businessName: "Alvorada Studio" });
  await createClient(account.businessId, { name: "Ana Ruiz", email: "billing@pineco.com" });
  await signIn(page, account.email, account.password);

  await readyDraft(page, "Ana Ruiz");
  const number = (await page.getByRole("heading", { level: 1 }).innerText()).trim();

  await page.getByTestId("send-trigger").filter({ visible: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("billing@pineco.com")).toBeVisible();
  await expect(dialog.getByLabel("Subject")).toHaveValue(`Invoice ${number} from Alvorada Studio`);
  // The PDF is heavy to render on every run; the attachment itself is covered in integration.
  await dialog.getByRole("switch", { name: "Attach the PDF" }).click();
  await confirm(page).click();

  // The editor is replaced by the detail view, with the email in its history.
  await expect(page.getByTestId("public-link")).toBeVisible();
  await expect(page.getByRole("region", { name: "History" }).getByText("Emailed to billing@pineco.com")).toBeVisible();

  const [first] = await emailsFor(account.businessId, number);
  expect(first).toMatchObject({
    recipients: ["billing@pineco.com"],
    subject: `Invoice ${number} from Alvorada Studio`,
    status: "SENT",
    attachedPdf: false,
    copyToSelf: true,
  });

  // Re-send from the detail page, to a second address.
  await page.getByRole("button", { name: "Email invoice" }).click();
  await page.getByRole("dialog").getByLabel("To").fill("ops@pineco.com");
  await page.getByRole("dialog").getByRole("switch", { name: "Attach the PDF" }).click();
  await confirm(page).click();

  await expect(page.getByRole("region", { name: "History" }).getByText(/Emailed to billing@pineco.com \+1/)).toBeVisible();
  const logged = await emailsFor(account.businessId, number);
  expect(logged).toHaveLength(2);
  expect(logged[1].recipients).toEqual(["billing@pineco.com", "ops@pineco.com"]);
});

test("marking as sent by hand emails nobody", async ({ page }) => {
  const account = await createAccount();
  await createClient(account.businessId, { name: "Pine & Co.", email: "billing@pineco.com" });
  await signIn(page, account.email, account.password);

  await readyDraft(page, "Pine & Co.");
  const number = (await page.getByRole("heading", { level: 1 }).innerText()).trim();

  await page.getByTestId("send-trigger").filter({ visible: true }).click();
  await page.getByRole("dialog").getByTestId("mark-as-sent").click();

  await expect(page.getByTestId("public-link")).toBeVisible();
  await expect(page.getByRole("region", { name: "History" }).getByText("Marked as sent")).toBeVisible();
  expect(await emailsFor(account.businessId, number)).toHaveLength(0);
});

test("a failed email leaves the invoice sent and says so", async ({ page }) => {
  const account = await createAccount();
  await createClient(account.businessId, { name: "Pine & Co.", email: "billing@pineco.com" });
  await signIn(page, account.email, account.password);

  await readyDraft(page, "Pine & Co.");
  const number = (await page.getByRole("heading", { level: 1 }).innerText()).trim();

  await page.getByTestId("send-trigger").filter({ visible: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Remove billing@pineco.com" }).click();
  // The capture transport refuses this address on purpose.
  await dialog.getByLabel("To").fill("fail@capture.test");
  await dialog.getByRole("switch", { name: "Attach the PDF" }).click();
  await confirm(page).click();

  await expect(dialog.getByText(/is marked as sent, but the email didn't go out/)).toBeVisible();
  await expect(confirm(page)).toHaveText("Try again");

  const [attempt] = await emailsFor(account.businessId, number);
  expect(attempt.status).toBe("FAILED");
});

test("an estimate goes out by email", async ({ page }) => {
  const account = await createAccount({ businessName: "Alvorada Studio" });
  await createClient(account.businessId, { name: "Vale Coffee", email: "hello@valecoffee.com" });
  await signIn(page, account.email, account.password);

  const number = await estimateDraft(page, "Vale Coffee", "Motion identity", "5400");

  await page.getByTestId("send-trigger").filter({ visible: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Subject")).toHaveValue(`Estimate ${number} from Alvorada Studio`);
  await dialog.getByRole("switch", { name: "Attach the PDF" }).click();
  await dialog.getByTestId("send-email").click();

  await expect(page.getByTestId("public-link")).toBeVisible();
  await expect(page.getByRole("list", { name: "Status history" }).getByText("Emailed to hello@valecoffee.com")).toBeVisible();
  expect((await emailsFor(account.businessId, number))[0]).toMatchObject({
    recipients: ["hello@valecoffee.com"],
    status: "SENT",
  });
});
