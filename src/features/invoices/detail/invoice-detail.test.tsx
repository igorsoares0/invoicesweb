import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvoiceDto } from "@/lib/api-types";
import { buildDocumentView } from "@/lib/documents/view";
import { InvoiceDetail } from "./invoice-detail";

const api = vi.hoisted(() => ({ post: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  api,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const base: InvoiceDto = {
  id: "inv1",
  number: "INV-0040",
  sequence: 40,
  status: "SENT",
  displayStatus: "SENT",
  issueDate: "2026-08-20",
  dueDate: "2026-09-03",
  currency: "USD",
  total: "4260.00",
  amountDue: "4260.00",
  amountPaid: "0.00",
  createdAt: "2026-08-20T10:00:00.000Z",
  client: { id: "c1", name: "Mercado Vivo", email: "paulo@mercadovivo.br", deleted: false },
  subtotal: "4260.00",
  discount: "0.00",
  tax: "0.00",
  notes: null,
  terms: null,
  template: "MODERN",
  color: "#1e40af",
  publicToken: "inv_4K92MX7QF3ABCDEFGHJK",
  sentAt: "2026-08-20T17:02:00.000Z",
  viewedAt: null,
  cancelledAt: null,
  items: [],
  payments: [],
  events: [],
  issues: [],
  fromEstimate: null,
  emails: [],
  updatedAt: "2026-08-20T17:02:00.000Z",
};

const view = buildDocumentView({
  kind: "invoice",
  number: base.number,
  currency: "USD",
  issueDate: base.issueDate,
  endDate: base.dueDate,
  issuer: { name: "Alvorada Studio", email: "hello@alvorada.studio", taxId: null, address: null, city: null, state: null, postalCode: null, country: null },
  billTo: { name: "Mercado Vivo", email: "paulo@mercadovivo.br", taxId: null, address: null, city: null, state: null, postalCode: null, country: null },
  lines: [],
  subtotal: "4260.00",
  discount: "0.00",
  tax: "0.00",
  total: "4260.00",
  amountPaid: "0.00",
  amountDue: "4260.00",
  notes: null,
  terms: null,
  color: "#1e40af",
});

function renderDetail(invoice: Partial<InvoiceDto> = {}, emailEnabled = true) {
  render(
    <InvoiceDetail
      invoice={{ ...base, ...invoice }}
      view={view}
      timezone="UTC"
      today="2026-08-28"
      businessName="Alvorada Studio"
      emailEnabled={emailEnabled}
    />,
  );
  return userEvent.setup();
}

beforeEach(() => {
  api.post.mockReset();
  api.delete.mockReset();
});

describe("InvoiceDetail", () => {
  it("emails the invoice again from the Actions card", async () => {
    api.post.mockResolvedValue({ email: { status: "SENT", error: null }, invoice: base });
    const user = renderDetail();

    await user.click(screen.getByRole("button", { name: "Email invoice" }));
    await user.click(screen.getByTestId("send-email"));

    expect(api.post).toHaveBeenCalledWith(
      "/invoices/inv1/email",
      expect.objectContaining({ to: ["paulo@mercadovivo.br"], attachPdf: true, sendCopy: true }),
    );
  });

  it("says the invoice is still sent when the email fails", async () => {
    api.post.mockResolvedValue({
      email: { status: "FAILED", error: "the address was rejected" },
      invoice: base,
    });
    const user = renderDetail();

    await user.click(screen.getByRole("button", { name: "Email invoice" }));
    await user.click(screen.getByTestId("send-email"));

    expect(await screen.findByText(/marked as sent, but the email didn't go out/)).toBeInTheDocument();
  });

  it("disables emailing when no transport is configured", () => {
    renderDetail({}, false);

    expect(screen.getByRole("button", { name: "Email invoice" })).toBeDisabled();
  });

  it("keeps the design's reminder button visible but gated behind Pro", () => {
    renderDetail();

    expect(screen.getByRole("button", { name: "Send reminder" })).toBeDisabled();
    expect(screen.getByText("PRO")).toBeInTheDocument();
  });

  it("reads email activity in the History timeline", () => {
    renderDetail({
      events: [
        { id: "e2", type: "EMAIL_SENT", metadata: { to: ["paulo@mercadovivo.br", "ana@mercadovivo.br"] }, createdAt: "2026-08-22T09:00:00.000Z" },
        { id: "e1", type: "SENT", metadata: { channel: "email", to: ["paulo@mercadovivo.br"] }, createdAt: "2026-08-20T17:02:00.000Z" },
      ],
    });

    expect(screen.getByText("Emailed to paulo@mercadovivo.br +1")).toBeInTheDocument();
    expect(screen.getByText("Emailed to paulo@mercadovivo.br")).toBeInTheDocument();
  });

  it("hides emailing for a cancelled invoice", () => {
    renderDetail({ status: "CANCELLED", displayStatus: "CANCELLED", publicToken: null });

    expect(screen.queryByRole("button", { name: "Email invoice" })).not.toBeInTheDocument();
  });
});
