import { describe, expect, it } from "vitest";
import { listInvoicesQuerySchema, recordPaymentSchema, updateInvoiceSchema } from "./invoice";

const item = {
  id: "line_0001",
  description: "UI design — 12 screens",
  quantity: "12",
  unitPrice: "320",
  discountType: null,
  discountValue: null,
  taxRate: "23",
  taxExempt: false,
};

describe("updateInvoiceSchema", () => {
  it("normalizes lines", () => {
    const parsed = updateInvoiceSchema.parse({ items: [item] });
    expect(parsed.items?.[0]).toMatchObject({ unitPrice: "320.00", taxRate: "23.00", quantity: "12" });
  });

  it("lets a draft line have no price or description yet", () => {
    expect(updateInvoiceSchema.safeParse({ items: [{ ...item, unitPrice: null, description: "" }] }).success).toBe(true);
  });

  it("rejects zero quantities, >100% discounts and duplicate ids", () => {
    const result = updateInvoiceSchema.safeParse({
      items: [
        { ...item, quantity: "0" },
        { ...item, discountType: "PERCENT", discountValue: "120" },
      ],
    });
    const paths = result.error?.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["items.0.quantity", "items.1.discountValue", "items.1.id"]));
  });

  it("validates calendar dates, templates and colors", () => {
    const result = updateInvoiceSchema.safeParse({ dueDate: "2026-02-30", template: "FANCY", color: "blue" });
    expect(result.error?.issues.map((issue) => issue.path[0]).sort()).toEqual(["color", "dueDate", "template"]);
  });
});

describe("recordPaymentSchema", () => {
  it("requires a positive amount", () => {
    expect(recordPaymentSchema.safeParse({ amount: "0", paymentDate: "2026-09-12", method: "CASH" }).success).toBe(false);
    expect(recordPaymentSchema.parse({ amount: "2000", paymentDate: "2026-09-12", method: "CASH" }).amount).toBe("2000.00");
  });
});

describe("listInvoicesQuerySchema", () => {
  it("defaults to newest numbers first and all statuses", () => {
    expect(listInvoicesQuerySchema.parse({})).toMatchObject({ status: "all", sort: "number", order: "desc" });
  });
});
