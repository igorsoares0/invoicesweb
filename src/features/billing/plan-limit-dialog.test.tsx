import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PlanSummaryDto } from "@/lib/api-types";
import { gateFromError, PlanLimitDialog } from "./plan-limit-dialog";

const plan = {
  plan: "FREE",
  source: "free",
  usage: { sent: 3, limit: 3, resetsOn: "2026-10-01" },
} as PlanSummaryDto;

describe("PlanLimitDialog", () => {
  it("explains the monthly limit with the reset date, and keeps the draft", async () => {
    const onOpenChange = vi.fn();
    render(<PlanLimitDialog open onOpenChange={onOpenChange} gate={{ reason: "limit" }} plan={plan} />);

    expect(screen.getByRole("heading", { name: "You've used all 3 invoices this month" })).toBeInTheDocument();
    expect(screen.getByText(/This draft is safe and stays editable/)).toBeInTheDocument();
    expect(screen.getByText("October 1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Upgrade to Pro" })).toHaveAttribute("href", "/pricing");

    await userEvent.click(screen.getByRole("button", { name: "Keep as draft" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("names the Pro options in the way, and offers the free version", async () => {
    const onUseFreeOptions = vi.fn(async () => undefined);
    render(
      <PlanLimitDialog
        open
        onOpenChange={vi.fn()}
        gate={{ reason: "pro-options", options: ["template", "color"] }}
        plan={plan}
        onUseFreeOptions={onUseFreeOptions}
      />,
    );

    expect(screen.getByRole("heading", { name: "This draft uses Pro options" })).toBeInTheDocument();
    expect(screen.getByText(/a Pro template and a custom accent colour/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Use free options" }));
    await waitFor(() => expect(onUseFreeOptions).toHaveBeenCalled());
  });

  it("offers converting without sending when there is no draft yet", async () => {
    const onConvertWithoutSending = vi.fn(async () => undefined);
    render(
      <PlanLimitDialog
        open
        onOpenChange={vi.fn()}
        gate={{ reason: "limit" }}
        plan={plan}
        flow="convert"
        onConvertWithoutSending={onConvertWithoutSending}
      />,
    );

    expect(screen.getByText(/nothing was converted/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Keep as draft" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Convert without sending" }));
    await waitFor(() => expect(onConvertWithoutSending).toHaveBeenCalled());
  });
});

describe("gateFromError", () => {
  it("tells the two refusals apart and ignores other errors", () => {
    expect(gateFromError({ code: "PLAN_LIMIT_REACHED", details: {} })).toEqual({ reason: "limit" });
    expect(gateFromError({ code: "SUBSCRIPTION_REQUIRED", details: { color: ["x"] } })).toEqual({
      reason: "pro-options",
      options: ["color"],
    });
    expect(gateFromError({ code: "VALIDATION_ERROR", details: {} })).toBeNull();
  });
});
