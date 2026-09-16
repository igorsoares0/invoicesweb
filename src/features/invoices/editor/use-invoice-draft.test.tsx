import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InvoiceDto } from "@/lib/api-types";
import { AUTOSAVE_DELAY, useInvoiceDraft } from "./use-invoice-draft";

const api = vi.hoisted(() => ({ patch: vi.fn() }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  api,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const invoice: InvoiceDto = {
  id: "inv1",
  number: "INV-0044",
  sequence: 44,
  status: "DRAFT",
  displayStatus: "DRAFT",
  issueDate: "2026-09-12",
  dueDate: "2026-09-26",
  currency: "USD",
  total: "0.00",
  amountDue: "0.00",
  createdAt: "2026-09-12T10:00:00.000Z",
  client: null,
  subtotal: "0.00",
  discount: "0.00",
  tax: "0.00",
  amountPaid: "0.00",
  notes: null,
  terms: null,
  template: "MODERN",
  color: "#1e40af",
  publicToken: null,
  sentAt: null,
  viewedAt: null,
  cancelledAt: null,
  items: [
    {
      id: "line_existing01",
      productId: null,
      position: 0,
      description: "UI design",
      quantity: "12",
      unitPrice: "320.00",
      discountType: null,
      discountValue: null,
      taxRate: "0.00",
      taxExempt: false,
      taxExemptReason: null,
      subtotal: "3840.00",
      discount: "0.00",
      tax: "0.00",
      total: "3840.00",
    },
  ],
  payments: [],
  events: [],
  issues: [],
  updatedAt: "2026-09-12T10:00:00.000Z",
};

beforeEach(() => {
  vi.useFakeTimers();
  api.patch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("useInvoiceDraft", () => {
  it("batches quick edits into one save and computes totals locally meanwhile", async () => {
    api.patch.mockResolvedValue({ ...invoice, notes: "Hi" });
    const { result } = renderHook(() => useInvoiceDraft(invoice));

    act(() => result.current.update((draft) => ({ ...draft, notes: "H" })));
    act(() => result.current.update((draft) => ({ ...draft, notes: "Hi" })));
    act(() =>
      result.current.update((draft) => ({
        ...draft,
        items: draft.items.map((item) => ({ ...item, quantity: "10" })),
      })),
    );

    expect(result.current.status).toBe("pending");
    expect(result.current.totals.total).toBe("3200.00");
    expect(api.patch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
    });

    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(api.patch.mock.calls[0][1]).toMatchObject({
      notes: "Hi",
      items: [{ id: "line_existing01", quantity: "10", unitPrice: "320.00" }],
    });
    expect(result.current.status).toBe("saved");
  });

  it("never sends a save while the previous one is still on its way", async () => {
    const slow = deferred<InvoiceDto>();
    api.patch.mockReturnValueOnce(slow.promise).mockResolvedValueOnce({ ...invoice, notes: "second" });
    const { result } = renderHook(() => useInvoiceDraft(invoice));

    act(() => result.current.update((draft) => ({ ...draft, notes: "first" })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
    });
    act(() => result.current.update((draft) => ({ ...draft, notes: "second" })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY * 3);
    });

    // The second save waits for the first, so the server receives them in order.
    expect(api.patch).toHaveBeenCalledTimes(1);

    await act(async () => {
      slow.resolve({ ...invoice, notes: "first" });
    });

    expect(api.patch).toHaveBeenCalledTimes(2);
    expect(api.patch.mock.calls[1][1]).toMatchObject({ notes: "second" });
    expect(result.current.invoice.notes).toBe("second");
    expect(result.current.status).toBe("saved");
  });

  it("holds back saves while a typed value is invalid", async () => {
    const { result } = renderHook(() => useInvoiceDraft(invoice));

    act(() =>
      result.current.update((draft) => ({
        ...draft,
        items: draft.items.map((item) => ({ ...item, unitPrice: "abc" })),
      })),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
    });

    expect(api.patch).not.toHaveBeenCalled();
    expect(result.current.status).toBe("invalid");
    expect(result.current.errors["items.line_existing01.unitPrice"]).toEqual(["Enter a price like 140 or 140.50"]);
    expect(result.current.issues.map((issue) => issue.path)).toContain("items.line_existing01.unitPrice");
  });

  it("flush saves immediately and returns the server copy", async () => {
    api.patch.mockResolvedValue({ ...invoice, notes: "now" });
    const { result } = renderHook(() => useInvoiceDraft(invoice));

    act(() => result.current.update((draft) => ({ ...draft, notes: "now" })));
    let flushed: InvoiceDto | null = null;
    await act(async () => {
      flushed = await result.current.flush();
    });

    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(flushed).toMatchObject({ notes: "now" });
  });

  it("retries after a network failure", async () => {
    api.patch.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(invoice);
    const { result } = renderHook(() => useInvoiceDraft(invoice));

    act(() => result.current.update((draft) => ({ ...draft, terms: "Net 14" })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
    });
    expect(result.current.status).toBe("error");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(api.patch).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("saved");
  });
});
