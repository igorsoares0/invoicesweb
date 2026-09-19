import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PlanSummaryDto } from "@/lib/api-types";
import { planLabel, UsageCard } from "./usage-card";

const now = new Date("2026-09-18T12:00:00.000Z");

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
    usage: { sent: 2, limit: 3, resetsOn: "2026-10-01" },
    entitlements: {
      plan: "FREE",
      limits: { invoicesPerMonth: 3 },
      features: {
        templates: ["MODERN", "CLASSIC"],
        canUseCustomBranding: false,
        hasBrandingMark: true,
        canSendReminders: false,
        canExportCsv: false,
      },
    },
    ...overrides,
  };
}

describe("UsageCard", () => {
  it("shows the month's usage on Free, with the reset date and an upgrade link", () => {
    render(<UsageCard plan={plan()} now={now} />);

    expect(screen.getByText("2 of 3 invoices sent")).toBeInTheDocument();
    expect(screen.getByText("Resets Oct 1")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Invoices sent this month" })).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByRole("link", { name: "Upgrade to Pro" })).toHaveAttribute("href", "/pricing");
  });

  it("switches to the warning state at the limit", () => {
    render(<UsageCard plan={plan({ usage: { sent: 3, limit: 3, resetsOn: "2026-10-01" } })} now={now} />);

    expect(screen.getByRole("region", { name: "Plan usage" })).toHaveClass("bg-warning-tint");
    expect(screen.getByRole("link", { name: "See Pro" })).toBeInTheDocument();
  });

  it("never reads past the limit after a downgrade", () => {
    render(<UsageCard plan={plan({ usage: { sent: 7, limit: 3, resetsOn: "2026-10-01" } })} now={now} />);
    expect(screen.getByText("3 of 3 invoices sent")).toBeInTheDocument();
  });

  it("counts the trial down, a partial day counting as one", () => {
    const trial = plan({ plan: "PRO", source: "trial", trialEndsAt: "2026-09-26T18:00:00.000Z", usage: { sent: 9, limit: null, resetsOn: "2026-10-01" } });
    render(<UsageCard plan={trial} now={now} />);

    expect(screen.getByText("Pro trial · 9 days left")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Keep Pro" })).toBeInTheDocument();
  });

  it("stays out of the way on Pro", () => {
    const { container } = render(
      <UsageCard plan={plan({ plan: "PRO", source: "subscription", usage: { sent: 40, limit: null, resetsOn: "2026-10-01" } })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("planLabel", () => {
  it("names the plan the way the business chip shows it", () => {
    expect(planLabel(plan())).toBe("Free plan");
    expect(planLabel(plan({ plan: "PRO", source: "trial" }))).toBe("Pro trial");
    expect(planLabel(plan({ plan: "PRO", source: "subscription" }))).toBe("Pro");
  });
});
