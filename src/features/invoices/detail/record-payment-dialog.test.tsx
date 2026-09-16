import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { InvoiceDto } from "@/lib/api-types";
import { RecordPaymentDialog } from "./record-payment-dialog";

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  api,
}));

const invoice = { id: "inv1", number: "INV-0040", currency: "USD", amountDue: "2260.00" } as InvoiceDto;

function renderDialog(onRecorded = vi.fn()) {
  render(
    <RecordPaymentDialog open onOpenChange={vi.fn()} invoice={invoice} clientName="Mercado Vivo" today="2026-09-12" onRecorded={onRecorded} />,
  );
  return { onRecorded, user: userEvent.setup() };
}

describe("RecordPaymentDialog", () => {
  it("prefills the open balance and predicts the status", async () => {
    const { user } = renderDialog();

    expect(screen.getByText("INV-0040 · Mercado Vivo · $2,260.00 open")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toHaveValue("2,260.00");
    expect(screen.getByText("This closes the balance — status becomes Paid.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "2000");
    expect(screen.getByText("Leaves $260.00 open — status becomes Partially paid.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "3000");
    expect(screen.getByText("That's more than the $2,260.00 still open.")).toBeInTheDocument();
  });

  it("posts the payment with a stable idempotency key", async () => {
    const updated = { ...invoice, status: "PAID" } as InvoiceDto;
    api.post.mockResolvedValue(updated);
    const { user, onRecorded } = renderDialog();

    await user.click(screen.getByRole("radio", { name: "Card" }));
    await user.type(screen.getByLabelText("Reference (optional)"), "CH-1");
    await user.click(screen.getByRole("button", { name: "Record payment" }));

    expect(api.post).toHaveBeenCalledWith(
      "/invoices/inv1/payments",
      { amount: "2260.00", paymentDate: "2026-09-12", method: "CARD", reference: "CH-1" },
      { headers: { "idempotency-key": expect.stringMatching(/^[\w-]{36}$/) } },
    );
    expect(onRecorded).toHaveBeenCalledWith(updated);
  });
});
