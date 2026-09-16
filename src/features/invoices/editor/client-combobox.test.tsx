import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ClientDto } from "@/lib/api-types";
import { ClientCombobox } from "./client-combobox";

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  api,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const client = (id: string, name: string, email: string | null): ClientDto =>
  ({ id, name, email, company: null, currency: null }) as ClientDto;

const clients = [client("c1", "Northwind Café", null), client("c2", "Pine & Co.", "billing@pineco.com")];

describe("ClientCombobox", () => {
  it("flags a selected client without an email", () => {
    render(<ClientCombobox id="bill-to" clients={clients} value="c1" onChange={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Northwind Café");
    expect(screen.getByRole("combobox")).toHaveTextContent("no email");
  });

  it("filters and picks a client", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ClientCombobox id="bill-to" clients={clients} value={null} onChange={onChange} onCreated={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByLabelText("Search clients"), "pine");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.click(screen.getByRole("option", { name: /Pine & Co/ }));

    expect(onChange).toHaveBeenCalledWith(clients[1]);
  });

  it("creates a client from the search text", async () => {
    const user = userEvent.setup();
    const created = client("c3", "Vale Coffee", null);
    api.post.mockResolvedValue(created);
    const onChange = vi.fn();
    const onCreated = vi.fn();
    render(<ClientCombobox id="bill-to" clients={clients} value={null} onChange={onChange} onCreated={onCreated} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByLabelText("Search clients"), "Vale Coffee");
    await user.click(screen.getByRole("button", { name: "Create “Vale Coffee”" }));

    expect(api.post).toHaveBeenCalledWith("/clients", { name: "Vale Coffee" });
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(onChange).toHaveBeenCalledWith(created);
  });
});
