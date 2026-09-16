import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import type { ClientDto } from "@/lib/api-types";
import { ClientForm } from "./client-form";

const api = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn() }));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  api,
}));

const pine: ClientDto = {
  id: "c1",
  name: "Pine & Co.",
  email: "billing@pineco.com",
  phone: null,
  company: null,
  taxId: null,
  address: "490 Alder St",
  city: "Portland",
  state: "OR",
  country: "US",
  postalCode: null,
  currency: null,
  notes: null,
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
};

beforeEach(() => {
  api.post.mockReset();
  api.patch.mockReset();
});

describe("ClientForm", () => {
  it("creates a client and reports it back", async () => {
    api.post.mockResolvedValue(pine);
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<ClientForm defaultCurrency="USD" onSaved={onSaved} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText("Name"), "Pine & Co.");
    await user.type(screen.getByLabelText("Billing email"), "billing@pineco.com");
    await user.selectOptions(screen.getByLabelText("Country"), "US");
    await user.click(screen.getByRole("button", { name: "Add client" }));

    expect(api.post).toHaveBeenCalledWith(
      "/clients",
      expect.objectContaining({ name: "Pine & Co.", email: "billing@pineco.com", country: "US", phone: "" }),
    );
    expect(onSaved).toHaveBeenCalledWith(pine);
  });

  it("shows the API's validation errors on the matching fields", async () => {
    api.post.mockRejectedValue(
      new ApiClientError(422, "VALIDATION_ERROR", "Invalid", {
        name: ["Client name is required"],
        email: ["Enter a valid email address"],
      }),
    );
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<ClientForm defaultCurrency="USD" onSaved={onSaved} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Add client" }));

    expect(await screen.findByText("Client name is required")).toBeInTheDocument();
    expect(screen.getByLabelText("Billing email")).toHaveAttribute("aria-invalid", "true");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("edits an existing client with a PATCH, sending cleared fields as empty strings", async () => {
    api.patch.mockResolvedValue({ ...pine, city: null });
    const user = userEvent.setup();
    render(<ClientForm client={pine} defaultCurrency="EUR" onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText("Name")).toHaveValue("Pine & Co.");
    expect(screen.getByRole("option", { name: "Business default (EUR)" })).toBeInTheDocument();
    await user.clear(screen.getByLabelText("City"));
    await user.click(screen.getByRole("button", { name: "Save client" }));

    expect(api.patch).toHaveBeenCalledWith("/clients/c1", expect.objectContaining({ city: "", name: "Pine & Co." }));
  });

  it("shows a banner for errors that aren't about a field", async () => {
    api.post.mockRejectedValue(new ApiClientError(0, "NETWORK_ERROR", "Can't reach the server."));
    const user = userEvent.setup();
    render(<ClientForm defaultCurrency="USD" onSaved={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText("Name"), "Vale Coffee");
    await user.click(screen.getByRole("button", { name: "Add client" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server.");
  });
});
