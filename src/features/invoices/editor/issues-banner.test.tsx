import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IssuesBanner } from "./issues-banner";

describe("IssuesBanner", () => {
  it("counts the problems and lists each with its fix", () => {
    render(
      <IssuesBanner
        issues={[
          { path: "items.a.unitPrice", summary: "Line 2 has no unit price", fix: "Set a price, or remove the line", message: "" },
          { path: "dueDate", summary: "Due date is before the issue date", fix: "Sep 5 comes before Sep 12", message: "" },
        ]}
      />,
    );

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Two things to fix before sending");
    expect(banner).toHaveTextContent("The draft is saved — nothing is lost");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Line 2 has no unit price — Set a price, or remove the line",
      "Due date is before the issue date — Sep 5 comes before Sep 12",
    ]);
  });

  it("renders nothing when the invoice is ready", () => {
    const { container } = render(<IssuesBanner issues={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
