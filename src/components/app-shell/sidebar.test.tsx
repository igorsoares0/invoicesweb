import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomTabs } from "./sidebar";

const pathname = vi.hoisted(() => ({ current: "/overview" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));
vi.mock("@/features/auth/actions", () => ({ signOutAction: vi.fn() }));

function renderTabs(path: string) {
  pathname.current = path;
  render(<BottomTabs />);
}

describe("BottomTabs", () => {
  it("marks the section you are in", () => {
    renderTabs("/invoices");

    expect(screen.getByRole("link", { name: /Invoices/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Clients/ })).not.toHaveAttribute("aria-current");
  });

  it("gets out of the way on a document screen, whose own bottom bar holds the send button", () => {
    renderTabs("/invoices/inv_123");
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();

    renderTabs("/estimates/est_123");
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
  });

  it("stays on the list screens", () => {
    renderTabs("/estimates");
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });
});
