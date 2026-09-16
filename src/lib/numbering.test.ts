import { describe, expect, it } from "vitest";
import { formatDocumentNumber } from "./numbering";

describe("formatDocumentNumber", () => {
  it("pads to four digits", () => {
    expect(formatDocumentNumber("INV-", 44)).toBe("INV-0044");
    expect(formatDocumentNumber("EST-", 1)).toBe("EST-0001");
  });

  it("keeps growing past four digits instead of wrapping", () => {
    expect(formatDocumentNumber("INV-", 12345)).toBe("INV-12345");
  });

  it("supports an empty prefix", () => {
    expect(formatDocumentNumber("", 7)).toBe("0007");
  });
});
