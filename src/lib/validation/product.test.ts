import { describe, expect, it } from "vitest";
import { checkTaxExemption, createProductSchema } from "./product";

describe("createProductSchema", () => {
  it("defaults VAT to 0% and not exempt", () => {
    expect(createProductSchema.parse({ name: "Retainer", unitPrice: "5200" })).toMatchObject({
      name: "Retainer",
      unitPrice: "5200.00",
      taxRate: "0.00",
      taxExempt: false,
    });
  });

  it("requires a reason when the item is VAT exempt", () => {
    const result = createProductSchema.safeParse({ name: "Retainer", unitPrice: "10", taxExempt: true });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("taxExemptReason");
  });

  it("accepts an exemption with a reason", () => {
    const result = createProductSchema.safeParse({
      name: "Retainer",
      unitPrice: "10",
      taxExempt: true,
      taxExemptReason: "Art. 53 CIVA — small business exemption",
    });
    expect(result.success).toBe(true);
  });

  it("requires a name and a price", () => {
    const result = createProductSchema.safeParse({ name: "  " });
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["name", "unitPrice"]),
    );
  });
});

describe("checkTaxExemption", () => {
  it("passes non-exempt items regardless of reason", () => {
    expect(checkTaxExemption({ taxExempt: false, taxRate: "23.00", taxExemptReason: null })).toBeNull();
  });

  it("rejects an exempt item that still carries VAT", () => {
    expect(checkTaxExemption({ taxExempt: true, taxRate: "23.00", taxExemptReason: "Reason" })).toEqual({
      taxRate: ["Exempt items can't carry VAT"],
    });
  });
});
