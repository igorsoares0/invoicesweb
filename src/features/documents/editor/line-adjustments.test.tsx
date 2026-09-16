import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { blankItem, type DraftItem } from "./draft-state";
import { LineAdjustments } from "./line-adjustments";

function Harness({ initial, onItem }: { initial: DraftItem; onItem?: (item: DraftItem) => void }) {
  const [item, setItem] = useState(initial);
  return (
    <LineAdjustments
      item={item}
      currency="USD"
      errors={{}}
      onChange={(patch) => {
        const next = { ...item, ...patch };
        setItem(next);
        onItem?.(next);
      }}
    />
  );
}

describe("LineAdjustments", () => {
  it("spells out the math as the discount and VAT change", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...blankItem("23"), quantity: "6", unitPrice: "140" }} />);

    expect(screen.getByTestId("line-math")).toHaveTextContent("6 × $140 = $840.00 · + 23% VAT $193.20");

    await user.type(screen.getByLabelText("Discount percentage"), "10");
    expect(screen.getByTestId("line-math")).toHaveTextContent("6 × $140 − 10% = $756.00 · + 23% VAT $173.88");

    await user.click(screen.getByRole("button", { name: "0%" }));
    expect(screen.getByTestId("line-math")).toHaveTextContent("= $756.00 · no VAT");
  });

  it("switches to a fixed discount in the invoice currency", async () => {
    const user = userEvent.setup();
    let latest: DraftItem | undefined;
    render(<Harness initial={{ ...blankItem("0"), quantity: "2", unitPrice: "100" }} onItem={(item) => (latest = item)} />);

    await user.click(screen.getByRole("button", { name: "$ fixed" }));
    await user.type(screen.getByLabelText("Discount amount"), "30");

    expect(latest).toMatchObject({ discountType: "FIXED", discountValue: "30" });
    expect(screen.getByTestId("line-math")).toHaveTextContent("2 × $100 − $30.00 = $170.00");
  });

  it("asks for an exemption reason and zeroes the rate", async () => {
    const user = userEvent.setup();
    let latest: DraftItem | undefined;
    render(<Harness initial={{ ...blankItem("23"), unitPrice: "100" }} onItem={(item) => (latest = item)} />);

    expect(screen.queryByLabelText("Exemption reason")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Exemption reason"), { target: { value: "Art. 53 CIVA" } });

    expect(latest).toMatchObject({ taxExempt: true, taxRate: "0", taxExemptReason: "Art. 53 CIVA" });
    expect(screen.getByTestId("line-math")).toHaveTextContent("no VAT");
  });
});
