import { describe, expect, it } from "vitest";
import { createAccount, createSubscription } from "@tests/setup/db";
import { db } from "@/server/db";
import { billingRepository } from "@/server/repositories/billing-repository";
import { billingService } from "./billing-service";

/** A sent invoice, stamped with an exact `sentAt`. */
async function sentAt(businessId: string, when: string, status: "SENT" | "CANCELLED" | "DRAFT" = "SENT") {
  const sequence = (await db.invoice.count({ where: { businessId } })) + 1;
  await db.invoice.create({
    data: {
      businessId,
      sequence,
      number: `INV-${sequence}`,
      status,
      issueDate: new Date("2026-09-01"),
      dueDate: new Date("2026-09-15"),
      currency: "USD",
      sentAt: status === "DRAFT" ? null : new Date(when),
    },
  });
}

describe("billingRepository.sentThisMonth", () => {
  it("counts sent invoices in the business's calendar month, cancelled ones included", async () => {
    const { business } = await createAccount({ plan: "FREE" });
    await sentAt(business.id, "2026-09-02T10:00:00Z");
    await sentAt(business.id, "2026-09-20T10:00:00Z", "CANCELLED");
    await sentAt(business.id, "2026-09-21T10:00:00Z", "DRAFT");
    await sentAt(business.id, "2026-08-31T10:00:00Z");

    const usage = await billingRepository.sentThisMonth(business.id, new Date("2026-09-25T12:00:00Z"));

    expect(usage).toEqual({ sent: 2, resetsOn: "2026-10-01" });
  });

  it("draws the month boundary in the business's timezone, not UTC", async () => {
    const { business } = await createAccount({ plan: "FREE" });
    await db.business.update({ where: { id: business.id }, data: { timezone: "America/Sao_Paulo" } });
    // 23:30 on Aug 31 in São Paulo is already Sep 1 in UTC: it belongs to August.
    await sentAt(business.id, "2026-09-01T02:30:00Z");
    // 00:30 on Sep 1 in São Paulo.
    await sentAt(business.id, "2026-09-01T03:30:00Z");

    const september = await billingRepository.sentThisMonth(business.id, new Date("2026-09-10T12:00:00Z"));
    const august = await billingRepository.sentThisMonth(business.id, new Date("2026-09-01T02:59:00Z"));

    expect(september).toEqual({ sent: 1, resetsOn: "2026-10-01" });
    expect(august).toEqual({ sent: 1, resetsOn: "2026-09-01" });
  });

  it("stays right across a daylight-saving change", async () => {
    const { business } = await createAccount({ plan: "FREE" });
    await db.business.update({ where: { id: business.id }, data: { timezone: "Europe/Lisbon" } });
    // Lisbon leaves summer time on Oct 25, 2026. 23:30 on Oct 31 local is 23:30 UTC.
    await sentAt(business.id, "2026-10-31T23:30:00Z");
    // 00:30 on Nov 1 local.
    await sentAt(business.id, "2026-11-01T00:30:00Z");

    const october = await billingRepository.sentThisMonth(business.id, new Date("2026-10-15T12:00:00Z"));
    const november = await billingRepository.sentThisMonth(business.id, new Date("2026-11-15T12:00:00Z"));

    expect(october).toEqual({ sent: 1, resetsOn: "2026-11-01" });
    expect(november).toEqual({ sent: 1, resetsOn: "2026-12-01" });
  });
});

describe("billingService.summary", () => {
  it("resolves test accounts to the trial by default, so the gate is never silently skipped", async () => {
    const { context } = await createAccount();
    expect(await billingService.summary(context)).toMatchObject({ plan: "PRO", source: "trial" });
  });

  it("falls back to Free once the trial is over", async () => {
    const { context, user } = await createAccount();
    await db.user.update({ where: { id: user.id }, data: { trialEndsAt: new Date(Date.now() - 1000) } });
    expect(await billingService.summary(context)).toMatchObject({ plan: "FREE", source: "free", trialEndsAt: null });
  });

  it("reports usage as it is, even above the limit after a downgrade", async () => {
    const { context, business } = await createAccount({ plan: "FREE" });
    for (let i = 0; i < 5; i += 1) await sentAt(business.id, new Date().toISOString());
    expect((await billingService.summary(context)).usage).toMatchObject({ sent: 5, limit: 3 });
  });

  it("describes a scheduled cancellation and the next charge", async () => {
    const { context, user } = await createAccount({ plan: "FREE" });
    const end = new Date(Date.now() + 10 * 86_400_000);
    await createSubscription(user.id, { cancelAtPeriodEnd: true, currentPeriodEnd: end, nextBilledAt: null, interval: "YEAR" });
    expect(await billingService.summary(context)).toMatchObject({
      plan: "PRO",
      interval: "YEAR",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: end.toISOString(),
      nextBilledAt: null,
      canManage: true,
    });
  });

  it("never restarts a trial that already ran", async () => {
    const { user } = await createAccount({ plan: "FREE" });
    const ended = new Date(Date.now() - 86_400_000);
    await db.user.update({ where: { id: user.id }, data: { trialEndsAt: ended } });

    await billingService.startTrial(user.id);

    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).trialEndsAt).toEqual(ended);
  });
});
