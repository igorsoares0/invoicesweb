import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SendDialog, type SendEmailInput } from "./send-dialog";

const base = {
  open: true,
  onOpenChange: vi.fn(),
  number: "INV-0044",
  total: "6996.00",
  currency: "USD",
  endDate: "2026-09-26",
  kind: "invoice" as const,
  clientName: "Ana Ruiz",
  clientEmail: "billing@pineco.com",
  businessName: "Alvorada Studio",
  emailEnabled: true,
};

function setup(overrides: Partial<React.ComponentProps<typeof SendDialog>> = {}) {
  const onSendEmail = vi.fn<(input: SendEmailInput) => Promise<{ status: "SENT" | "FAILED"; error: string | null }>>(
    async () => ({ status: "SENT", error: null }),
  );
  const onMarkSent = vi.fn(async () => null);
  const onOpenChange = vi.fn();
  render(<SendDialog {...base} onOpenChange={onOpenChange} onSendEmail={onSendEmail} onMarkSent={onMarkSent} {...overrides} />);
  return { onSendEmail, onMarkSent, onOpenChange, user: userEvent.setup() };
}

describe("SendDialog", () => {
  it("prefills the client, the subject and the message", () => {
    setup();

    expect(screen.getByText("billing@pineco.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toHaveValue("Invoice INV-0044 from Alvorada Studio");
    expect(screen.getByLabelText<HTMLTextAreaElement>("Message").value).toContain("Hi Ana,");
    expect(screen.getByText("INV-0044 · $6,996.00 · due Sep 26")).toBeInTheDocument();
  });

  it("sends what the user filled in, with the PDF and the copy on by default", async () => {
    const { onSendEmail, user } = setup();

    await user.click(screen.getByTestId("send-email"));

    await waitFor(() => expect(onSendEmail).toHaveBeenCalledTimes(1));
    expect(onSendEmail.mock.calls[0][0]).toMatchObject({
      to: ["billing@pineco.com"],
      subject: "Invoice INV-0044 from Alvorada Studio",
      attachPdf: true,
      sendCopy: true,
    });
  });

  it("adds and removes recipients", async () => {
    const { onSendEmail, user } = setup();

    await user.type(screen.getByLabelText("To"), "ops@pineco.com{Enter}");
    await user.click(screen.getByRole("button", { name: "Remove billing@pineco.com" }));
    await user.click(screen.getByTestId("send-email"));

    await waitFor(() => expect(onSendEmail).toHaveBeenCalled());
    expect(onSendEmail.mock.calls[0][0].to).toEqual(["ops@pineco.com"]);
  });

  it("refuses an invalid or repeated address", async () => {
    const { onSendEmail, user } = setup();

    await user.type(screen.getByLabelText("To"), "not-an-email{Enter}");
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("To"));
    await user.type(screen.getByLabelText("To"), "billing@pineco.com{Enter}");
    expect(await screen.findByText("That address is already on the list")).toBeInTheDocument();
    expect(onSendEmail).not.toHaveBeenCalled();
  });

  it("asks for a recipient instead of sending with none", async () => {
    const { onSendEmail, user } = setup({ clientEmail: null });

    expect(screen.getByText(/has no email on file/)).toBeInTheDocument();
    await user.click(screen.getByTestId("send-email"));

    expect(await screen.findByText("Add at least one recipient")).toBeInTheDocument();
    expect(onSendEmail).not.toHaveBeenCalled();
  });

  it("shows the reminder toggle as a disabled Pro feature, per the design", () => {
    setup();

    const reminder = screen.getByRole("switch", { name: "Remind me if unpaid after the due date" });
    expect(reminder).toBeDisabled();
    expect(reminder).not.toBeChecked();
    expect(screen.getByText("PRO")).toBeInTheDocument();
  });

  it("keeps the dialog open and stays honest when the email fails after sending", async () => {
    const { onOpenChange, user } = setup({
      onSendEmail: async () => ({ status: "FAILED", error: "the address was rejected" }),
    });

    await user.click(screen.getByTestId("send-email"));

    expect(await screen.findByText(/marked as sent, but the email didn't go out/)).toBeInTheDocument();
    expect(screen.getByText(/the address was rejected/)).toBeInTheDocument();
    expect(screen.getByTestId("send-email")).toHaveTextContent("Try again");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("closes on success", async () => {
    const { onOpenChange, user } = setup();

    await user.click(screen.getByTestId("send-email"));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("keeps the no-email path for documents delivered by hand", async () => {
    const { onMarkSent, onSendEmail, user } = setup();

    await user.click(screen.getByTestId("mark-as-sent"));

    await waitFor(() => expect(onMarkSent).toHaveBeenCalled());
    expect(onSendEmail).not.toHaveBeenCalled();
  });

  it("falls back to marking as sent when email isn't configured", () => {
    setup({ emailEnabled: false });

    expect(screen.queryByLabelText("Subject")).not.toBeInTheDocument();
    expect(screen.getByTestId("mark-as-sent")).toHaveTextContent("Mark as sent");
    expect(screen.queryByTestId("send-email")).not.toBeInTheDocument();
  });

  it("speaks estimate language and hides the payment reminder", () => {
    setup({ kind: "estimate", number: "EST-0014", clientEmail: "ana@pineco.com" });

    expect(screen.getByRole("heading", { name: "Send estimate" })).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toHaveValue("Estimate EST-0014 from Alvorada Studio");
    expect(screen.getByText(/valid until/)).toBeInTheDocument();
    expect(screen.queryByText("PRO")).not.toBeInTheDocument();
  });

  it("tells a re-send apart from a first send", () => {
    setup({ alreadySent: true });

    expect(screen.getByText(/already marked as sent/)).toBeInTheDocument();
    // Nothing left to mark: the secondary action disappears.
    expect(screen.queryByTestId("mark-as-sent")).not.toBeInTheDocument();
  });
});
