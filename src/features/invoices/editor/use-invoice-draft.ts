"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import type { InvoiceDto } from "@/lib/api-types";
import { findIssueProblems } from "@/lib/invoices/issues";
import { calculateLine, calculateTotals } from "@/lib/invoices/math";
import type { FieldErrors } from "@/lib/validation/errors";
import { lineInput, toDraft, toPayload, type DraftState } from "./draft-state";

export const AUTOSAVE_DELAY = 800;
const RETRY_DELAY = 4000;

export type SaveStatus = "saved" | "pending" | "saving" | "invalid" | "error";

/**
 * Holds the editor's draft and autosaves it. Every change schedules one PATCH after a pause;
 * responses that arrive after a newer save started are ignored, so the screen never jumps back.
 */
export function useInvoiceDraft(initial: InvoiceDto) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftState>(() => toDraft(initial));
  const [invoice, setInvoice] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});

  const draftRef = useRef(draft);
  const latest = useRef(initial);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Saves run one after another. Concurrent PATCHes could reach the server out of order and let
  // an older draft overwrite a newer one.
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const retry = useRef<() => void>(() => {});

  const { errors: localErrors } = useMemo(() => toPayload(draft), [draft]);

  const performSave = useCallback(async (): Promise<InvoiceDto | null> => {
    if (!dirty.current) return latest.current;
    const { payload, errors } = toPayload(draftRef.current);
    if (Object.keys(errors).length) {
      setStatus("invalid");
      return null;
    }
    dirty.current = false;
    setStatus("saving");
    try {
      const saved = await api.patch<InvoiceDto>(`/invoices/${initial.id}`, payload);
      latest.current = saved;
      setInvoice(saved);
      setServerErrors({});
      setSavedAt(Date.now());
      setStatus(dirty.current ? "pending" : "saved");
      return saved;
    } catch (error) {
      dirty.current = true;
      if (error instanceof ApiClientError && error.code === "INVALID_STATUS_TRANSITION") {
        // Sent from another tab: show the read-only detail instead.
        router.refresh();
        return null;
      }
      if (error instanceof ApiClientError && error.code === "VALIDATION_ERROR") {
        setServerErrors(error.details);
        setStatus("invalid");
        return null;
      }
      setStatus("error");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => retry.current(), RETRY_DELAY);
      return null;
    }
  }, [initial.id, router]);

  const save = useCallback((): Promise<InvoiceDto | null> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const run = chain.current.then(performSave);
    chain.current = run.catch(() => null);
    return run;
  }, [performSave]);

  useEffect(() => {
    retry.current = () => void save();
  }, [save]);

  const update = useCallback(
    (recipe: (current: DraftState) => DraftState) => {
      setDraft((current) => {
        const next = recipe(current);
        draftRef.current = next;
        return next;
      });
      dirty.current = true;
      setStatus("pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), AUTOSAVE_DELAY);
    },
    [save],
  );

  /** Waits for pending saves, saves anything left, and resolves with the server's latest copy. */
  const flush = useCallback((): Promise<InvoiceDto | null> => save(), [save]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Local math mirrors the server between saves; the server's numbers win when they arrive.
  const lines = useMemo(() => draft.items.map((item) => calculateLine(lineInput(item))), [draft.items]);
  const totals = useMemo(() => calculateTotals(draft.items.map(lineInput)), [draft.items]);
  const issues = useMemo(
    () =>
      findIssueProblems({
        clientId: draft.clientId,
        issueDate: draft.issueDate,
        dueDate: draft.dueDate,
        items: draft.items.map((item) => ({ ...item, unitPrice: lineInput(item).unitPrice })),
      }),
    [draft],
  );

  return {
    draft,
    update,
    invoice,
    status,
    savedAt,
    errors: { ...serverErrors, ...localErrors },
    issues,
    lines,
    totals,
    flush,
  };
}
