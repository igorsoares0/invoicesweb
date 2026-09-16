import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClientDetails } from "./client-details";

const push = vi.hoisted(() => vi.fn());
const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  api,
}));

const client = {
  id: "c1",
  name: "Halcyon Labs",
  email: "ana@halcyon.co",
  phone: "+351 912 004 118",
  company: null,
  taxId: "PT509887412",
  address: "Rua do Século 44",
  city: "Lisbon",
  state: null,
  country: "PT",
  postalCode: null,
  currency: null,
  notes: "Pays on the 1st.",
  createdAt: "2026-03-14T10:00:00.000Z",
  updatedAt: "2026-03-14T10:00:00.000Z",
};

describe("ClientDetails", () => {
  it("shows the client's details with fallbacks for empty values", () => {
    render(<ClientDetails client={client} defaultCurrency="USD" onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Halcyon Labs" })).toBeInTheDocument();
    expect(screen.getByText("Client since Mar 2026")).toBeInTheDocument();
    expect(screen.getByText("PT509887412")).toBeInTheDocument();
    expect(screen.getByText("Rua do Século 44, Lisbon, Portugal")).toBeInTheDocument();
    expect(screen.getByText("USD (default)")).toBeInTheDocument();
    expect(screen.getByText("Pays on the 1st.")).toBeInTheDocument();
  });

  it("starts an invoice or an estimate for this client", async () => {
    api.post.mockResolvedValue({ id: "est1" });
    const user = userEvent.setup();
    render(<ClientDetails client={client} defaultCurrency="USD" onEdit={vi.fn()} onDelete={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "New estimate" }));

    expect(api.post).toHaveBeenCalledWith("/estimates", { clientId: "c1" });
    expect(push).toHaveBeenCalledWith("/estimates/est1");
  });

  it("wires the edit and delete actions", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<ClientDetails client={client} defaultCurrency="USD" onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "Edit client" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
