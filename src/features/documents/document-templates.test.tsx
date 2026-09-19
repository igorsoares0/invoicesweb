import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildDocumentView } from "@/lib/documents/view";
import { PrintedDocument } from "./document-templates";

const TEMPLATES = ["MODERN", "CLASSIC", "MINIMAL", "PROFESSIONAL", "BOLD"] as const;

function view(branded: boolean) {
  return buildDocumentView({
    number: "INV-0044",
    currency: "USD",
    issueDate: "2026-09-12",
    endDate: "2026-09-26",
    issuer: { name: "Alvorada Studio", email: null, taxId: null, address: null, city: null, state: null, postalCode: null, country: null },
    billTo: null,
    lines: [],
    subtotal: "0.00",
    discount: "0.00",
    tax: "0.00",
    total: "0.00",
    amountPaid: "0.00",
    amountDue: "0.00",
    notes: null,
    terms: null,
    color: "#1e40af",
    branded,
  });
}

describe("PrintedDocument", () => {
  it("prints the Made with mark on every template when the document is branded", () => {
    for (const template of TEMPLATES) {
      const { unmount } = render(<PrintedDocument view={view(true)} template={template} />);
      expect(screen.getByText("Made with Invoice Maker")).toBeInTheDocument();
      unmount();
    }
  });

  it("leaves it off otherwise", () => {
    render(<PrintedDocument view={view(false)} template="MODERN" />);
    expect(screen.queryByText("Made with Invoice Maker")).not.toBeInTheDocument();
  });
});
