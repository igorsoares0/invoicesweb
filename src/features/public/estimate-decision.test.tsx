import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EstimateDecision } from "./estimate-decision";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EstimateDecision", () => {
  it("reassures the client and accepts in one click", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: { state: "accepted" } }));
    const user = userEvent.setup();
    render(<EstimateDecision token="est_TOKEN" issuerName="Alvorada Studio" />);

    expect(screen.getByText(/Accepting doesn't charge you — Alvorada Studio will send an invoice/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Accept estimate" }));

    expect(fetchMock).toHaveBeenCalledWith("/e/est_TOKEN/accept", { method: "POST" });
    expect(refresh).toHaveBeenCalled();
  });

  it("asks before declining", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: { state: "declined" } }));
    const user = userEvent.setup();
    render(<EstimateDecision token="est_TOKEN" issuerName="Alvorada Studio" />);

    await user.click(screen.getByRole("button", { name: "Decline" }));
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Decline estimate" }));

    expect(fetchMock).toHaveBeenCalledWith("/e/est_TOKEN/decline", { method: "POST" });
  });

  it("shows the server's explanation when a reply is refused", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: { code: "INVALID_STATUS_TRANSITION", message: "This estimate has expired and can no longer be answered." } }, { status: 409 }),
    );
    const user = userEvent.setup();
    render(<EstimateDecision token="est_TOKEN" issuerName="Alvorada Studio" />);

    await user.click(screen.getByRole("button", { name: "Accept estimate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This estimate has expired and can no longer be answered.");
    expect(refresh).not.toHaveBeenCalled();
  });
});
