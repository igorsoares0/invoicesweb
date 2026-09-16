import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import type { ProductDto } from "@/lib/api-types";
import { ProductEditor } from "./product-editor";

const api = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn() }));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  api,
}));

const retainer: ProductDto = {
  id: "p1",
  name: "Design retainer — monthly",
  description: "Ongoing design partnership",
  unit: "month",
  unitPrice: "5200.00",
  currency: null,
  taxRate: "23.00",
  taxExempt: false,
  taxExemptReason: null,
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
};

beforeEach(() => {
  api.post.mockReset();
  api.patch.mockReset();
});

function renderEditor(product: ProductDto | null, onDone = vi.fn()) {
  render(
    <ProductEditor product={product} defaultCurrency="USD" defaultTaxRate="23.00" onDone={onDone} onDelete={vi.fn()} />,
  );
  return { onDone, user: userEvent.setup() };
}

describe("ProductEditor", () => {
  it("prefills the business default VAT for new items", () => {
    renderEditor(null);
    expect(screen.getByRole("heading", { name: "New item" })).toBeInTheDocument();
    expect(screen.getByLabelText("VAT rate")).toHaveValue("23");
    expect(screen.queryByText("Changing the price is safe")).not.toBeInTheDocument();
  });

  it("tells the user a price change doesn't touch issued invoices", () => {
    renderEditor(retainer);
    expect(screen.getByText(/New invoices pick up \$5,200\.00\./)).toBeInTheDocument();
  });

  it("asks for an exemption reason and zeroes the VAT when exempt", async () => {
    api.patch.mockResolvedValue({ ...retainer, taxExempt: true, taxRate: "0.00", taxExemptReason: "Art. 53 CIVA" });
    const { user, onDone } = renderEditor(retainer);

    expect(screen.queryByLabelText("Exemption reason")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByLabelText("VAT rate")).toBeDisabled();
    await user.type(screen.getByLabelText("Exemption reason"), "Art. 53 CIVA");
    await user.click(screen.getByRole("button", { name: "Save item" }));

    expect(api.patch).toHaveBeenCalledWith(
      "/products/p1",
      expect.objectContaining({ taxExempt: true, taxRate: "0", taxExemptReason: "Art. 53 CIVA" }),
    );
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ kind: "saved" }));
  });

  it("strips thousands separators from the price before sending", async () => {
    api.post.mockResolvedValue(retainer);
    const { user } = renderEditor(null);

    await user.type(screen.getByLabelText("Name"), "Retainer");
    await user.type(screen.getByLabelText("Unit price"), "5,200.00");
    await user.click(screen.getByRole("button", { name: "Add item" }));

    expect(api.post).toHaveBeenCalledWith("/products", expect.objectContaining({ unitPrice: "5200.00" }));
  });

  it("duplicates with a (copy) suffix", async () => {
    api.post.mockResolvedValue({ ...retainer, id: "p2" });
    const { user, onDone } = renderEditor(retainer);

    await user.click(screen.getByRole("button", { name: "Duplicate" }));

    expect(api.post).toHaveBeenCalledWith("/products", expect.objectContaining({ name: "Design retainer — monthly (copy)" }));
    expect(onDone).toHaveBeenCalledWith({ kind: "duplicated", product: expect.objectContaining({ id: "p2" }) });
  });

  it("shows server errors on the fields", async () => {
    api.post.mockRejectedValue(
      new ApiClientError(422, "VALIDATION_ERROR", "Invalid", { unitPrice: ["Enter an amount like 1200 or 1200.50"] }),
    );
    const { user } = renderEditor(null);

    await user.click(screen.getByRole("button", { name: "Add item" }));

    expect(await screen.findByText("Enter an amount like 1200 or 1200.50")).toBeInTheDocument();
    expect(screen.getByLabelText("Unit price")).toHaveAttribute("aria-invalid", "true");
  });
});
