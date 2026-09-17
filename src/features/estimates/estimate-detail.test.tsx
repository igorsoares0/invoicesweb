import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EstimateDto } from "@/lib/api-types";
import { buildDocumentView } from "@/lib/documents/view";
import { EstimateDetail } from "./estimate-detail";

const api = vi.hoisted(() => ({ post: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  api,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const base: EstimateDto = {
  id: "est1",
  number: "EST-0014",
  sequence: 14,
  status: "SENT",
  displayStatus: "SENT",
  issueDate: "2026-09-08",
  expiryDate: "2026-09-22",
  currency: "USD",
  total: "6996.00",
  acceptedAt: null,
  createdAt: "2026-09-08T10:00:00.000Z",
  client: { id: "c1", name: "Pine & Co.", email: "billing@pineco.com", deleted: false },
  subtotal: "6996.00",
  discount: "0.00",
  tax: "0.00",
  notes: null,
  terms: null,
  template: "MODERN",
  color: "#1e40af",
  publicToken: "est_7QM4XF29KD7QM4XF29KD",
  sentAt: "2026-09-08T11:05:00.000Z",
  viewedAt: null,
  declinedAt: null,
  convertedAt: null,
  respondedBy: null,
  convertedInvoice: null,
  emails: [],
  items: [],
  events: [{ id: "e1", type: "SENT", metadata: null, createdAt: "2026-09-08T11:05:00.000Z" }],
  issues: [],
  updatedAt: "2026-09-08T11:05:00.000Z",
};

const view = buildDocumentView({
  kind: "estimate",
  number: "EST-0014",
  currency: "USD",
  issueDate: "2026-09-08",
  endDate: "2026-09-22",
  issuer: { name: "Alvorada Studio", email: null, taxId: null, address: null, city: null, state: null, postalCode: null, country: null },
  billTo: null,
  lines: [],
  subtotal: "6996.00",
  discount: "0.00",
  tax: "0.00",
  total: "6996.00",
  amountPaid: "0.00",
  amountDue: "6996.00",
  notes: null,
  terms: null,
  color: "#1e40af",
});

function renderDetail(estimate: Partial<EstimateDto>, today = "2026-09-12", emailEnabled = true) {
  render(
    <EstimateDetail
      estimate={{ ...base, ...estimate }}
      view={view}
      timezone="UTC"
      today={today}
      nextInvoiceNumber="INV-0045"
      paymentTermsDays={14}
      openConvert={false}
      businessName="Alvorada Studio"
      emailEnabled={emailEnabled}
    />,
  );
  return userEvent.setup();
}

beforeEach(() => {
  api.post.mockReset();
});

describe("EstimateDetail", () => {
  it("waits for a reply and lets you record it yourself", async () => {
    api.post.mockResolvedValue({ ...base, status: "ACCEPTED", displayStatus: "ACCEPTED", respondedBy: "you", acceptedAt: "2026-09-12T09:00:00.000Z" });
    const user = renderDetail({});

    expect(screen.getByText("Waiting for a reply")).toBeInTheDocument();
    expect(screen.getByText(/expires in 10 days/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convert to invoice" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark accepted" }));

    expect(api.post).toHaveBeenCalledWith("/estimates/est1/accept", {});
    expect(await screen.findByText("Marked accepted")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Convert to invoice" })).toHaveLength(2);
  });

  it("offers conversion once accepted by the client", async () => {
    const user = renderDetail({ status: "ACCEPTED", displayStatus: "ACCEPTED", respondedBy: "client", acceptedAt: "2026-09-10T09:22:00.000Z" });

    expect(screen.getByText("Accepted by client")).toBeInTheDocument();
    expect(screen.getByText(/Pine & Co. replied on the public page on Sep 10/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark accepted" })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Convert to invoice" })[0]);
    expect(screen.getByRole("dialog", { name: "Convert to invoice" })).toBeInTheDocument();
  });

  it("explains expired and converted estimates", () => {
    renderDetail({ displayStatus: "EXPIRED", expiryDate: "2026-09-01" });
    expect(screen.getByText("Expired on September 1, 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark accepted" })).not.toBeInTheDocument();
  });

  it("links a converted estimate to its invoice", () => {
    renderDetail({ status: "CONVERTED", displayStatus: "CONVERTED", convertedInvoice: { id: "inv9", number: "INV-0045" } });
    expect(screen.getByText("Converted to INV-0045")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open invoice" })).toHaveAttribute("href", "/invoices/inv9");
  });

  it("emails the estimate again from the actions menu", async () => {
    api.post.mockResolvedValue({ email: { status: "SENT", error: null }, estimate: base });
    const user = renderDetail({});

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Email estimate" }));
    await user.click(screen.getByTestId("send-email"));

    expect(api.post).toHaveBeenCalledWith(
      "/estimates/est1/email",
      expect.objectContaining({ to: ["billing@pineco.com"], attachPdf: true }),
    );
  });

  it("hides the email action when email isn't configured or the estimate expired", async () => {
    const user = renderDetail({}, "2026-09-12", false);
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.queryByRole("menuitem", { name: "Email estimate" })).not.toBeInTheDocument();
  });

  it("shows email activity in the status timeline", () => {
    renderDetail({
      events: [
        { id: "e2", type: "EMAIL_FAILED", metadata: { reason: "the address was rejected" }, createdAt: "2026-09-08T17:05:00.000Z" },
        { id: "e1", type: "SENT", metadata: { channel: "email", to: ["billing@pineco.com"] }, createdAt: "2026-09-08T17:02:00.000Z" },
      ],
    });

    expect(screen.getByText("Emailed to billing@pineco.com")).toBeInTheDocument();
    expect(screen.getByText("Email failed — the address was rejected")).toBeInTheDocument();
  });
});
