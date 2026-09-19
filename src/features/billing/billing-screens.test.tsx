import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanSummaryDto } from "@/lib/api-types";
import { BillingSection } from "@/features/settings/billing-section";
import { Pricing } from "./pricing";

const api = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  api,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const features = {
  templates: ["MODERN", "CLASSIC"],
  canUseCustomBranding: false,
  hasBrandingMark: true,
  canSendReminders: false,
  canExportCsv: false,
};

function plan(overrides: Partial<PlanSummaryDto> = {}): PlanSummaryDto {
  return {
    plan: "FREE",
    source: "free",
    status: null,
    interval: null,
    trialEndsAt: null,
    nextBilledAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canManage: false,
    usage: { sent: 1, limit: 3, resetsOn: "2026-10-01" },
    entitlements: { plan: "FREE", limits: { invoicesPerMonth: 3 }, features },
    ...overrides,
  };
}

const pro = (overrides: Partial<PlanSummaryDto> = {}) =>
  plan({
    plan: "PRO",
    source: "subscription",
    status: "ACTIVE",
    interval: "MONTH",
    nextBilledAt: "2026-10-12T12:00:00.000Z",
    currentPeriodEnd: "2026-10-12T12:00:00.000Z",
    canManage: true,
    usage: { sent: 23, limit: null, resetsOn: "2026-10-01" },
    ...overrides,
  });

beforeEach(() => {
  api.post.mockReset();
});

describe("Pricing", () => {
  it("shows yearly by default, and monthly on request", async () => {
    render(<Pricing plan={plan()} />);
    const proCard = screen.getByRole("region", { name: "Pro" });

    expect(within(proCard).getByText("$7.50")).toBeInTheDocument();
    expect(within(proCard).getByText(/\$90 billed yearly/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Monthly" }));
    expect(within(proCard).getByText("$9")).toBeInTheDocument();
  });

  it("marks Free as the current plan on Free, and only lists what exists", () => {
    render(<Pricing plan={plan()} />);

    expect(within(screen.getByRole("region", { name: "Free" })).getByText("Your current plan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upgrade to Pro" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Estimates Unlimited Unlimited/ })).toBeInTheDocument();
    expect(screen.queryByText(/reminders/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CSV/)).not.toBeInTheDocument();
  });

  it("offers keeping Pro during the trial", () => {
    render(<Pricing plan={plan({ plan: "PRO", source: "trial", trialEndsAt: "2026-09-27T00:00:00.000Z" })} />);
    expect(screen.getByRole("button", { name: "Keep Pro after the trial" })).toBeInTheDocument();
  });

  it("points subscribers to the subscription instead of a second checkout", () => {
    render(<Pricing plan={pro()} />);

    expect(within(screen.getByRole("region", { name: "Pro" })).getByText("Your current plan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage subscription" })).toHaveAttribute("href", "/settings#billing");
    expect(screen.queryByRole("button", { name: /Upgrade/ })).not.toBeInTheDocument();
  });
});

describe("BillingSection", () => {
  it("shows usage and the way to Pro on Free", () => {
    render(<BillingSection plan={plan()} />);

    expect(screen.getByText("You're on the free plan.")).toBeInTheDocument();
    expect(screen.getByText("1 of 3 invoices sent")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See plans" })).toHaveAttribute("href", "/pricing");
  });

  it("shows the next charge on Pro and opens the portal", async () => {
    api.post.mockResolvedValue({ overview: "https://portal/overview", updatePaymentMethod: "https://portal/card", cancel: "https://portal/cancel" });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<BillingSection plan={pro()} />);

    expect(screen.getByText("You're on Pro, renewing monthly.")).toBeInTheDocument();
    expect(screen.getByText("Oct 12, 2026")).toBeInTheDocument();
    expect(screen.getByText("$9/mo + tax")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Update payment method" }));
    expect(open).toHaveBeenCalledWith("https://portal/card", "_blank", "noopener");
  });

  it("says when Pro ends after a cancellation, and stops offering to cancel", () => {
    render(<BillingSection plan={pro({ cancelAtPeriodEnd: true, nextBilledAt: null })} />);

    expect(screen.getByText("Pro until")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel subscription" })).not.toBeInTheDocument();
  });

  it("warns when a payment is being retried", () => {
    render(<BillingSection plan={pro({ status: "PAST_DUE" })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The last payment didn't go through");
  });
});
