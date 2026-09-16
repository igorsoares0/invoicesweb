import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EstimateDto } from "@/lib/api-types";
import { ConvertDialog } from "./convert-dialog";

const api = vi.hoisted(() => ({ post: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  api,
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const estimate = {
  id: "est1",
  number: "EST-0014",
  total: "6996.00",
  currency: "USD",
  notes: null,
  terms: "50% on kickoff",
  items: [{}, {}, {}],
} as unknown as EstimateDto;

function renderDialog() {
  render(
    <ConvertDialog
      open
      onOpenChange={vi.fn()}
      estimate={estimate}
      clientName="Pine & Co."
      nextInvoiceNumber="INV-0045"
      paymentTermsDays={14}
      today="2026-09-12"
    />,
  );
  return userEvent.setup();
}

beforeEach(() => {
  api.post.mockReset();
  router.push.mockReset();
  router.refresh.mockReset();
});

describe("ConvertDialog", () => {
  it("previews the invoice it will create", () => {
    renderDialog();
    const preview = screen.getByRole("region", { name: "New invoice" });
    expect(preview).toHaveTextContent("INV-0045");
    expect(preview).toHaveTextContent("$6,996.00");
    expect(preview).toHaveTextContent("3 lines, prices locked");
    expect(preview).toHaveTextContent("Carried over");
    expect(screen.getByLabelText(/Due date/)).toHaveValue("2026-09-26");
  });

  it("converts and opens the new invoice by default", async () => {
    api.post.mockResolvedValue({ invoice: { id: "inv9", number: "INV-0045" }, estimate });
    const user = renderDialog();

    await user.click(screen.getByRole("button", { name: "Create invoice" }));

    expect(api.post).toHaveBeenCalledWith("/estimates/est1/convert", { issueDate: "2026-09-12", dueDate: "2026-09-26", send: false });
    expect(router.push).toHaveBeenCalledWith("/invoices/inv9");
  });

  it("can send right away and stay on the estimate", async () => {
    api.post.mockResolvedValue({ invoice: { id: "inv9", number: "INV-0045" }, estimate });
    const user = renderDialog();

    await user.click(screen.getByRole("checkbox", { name: "Open the new invoice after converting" }));
    await user.click(screen.getByRole("checkbox", { name: "Mark it as sent right away" }));
    await user.click(screen.getByRole("button", { name: "Create invoice" }));

    expect(api.post).toHaveBeenCalledWith("/estimates/est1/convert", expect.objectContaining({ send: true }));
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });
});
