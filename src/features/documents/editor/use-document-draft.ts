"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import { findIssueProblems } from "@/lib/documents/issues";
import { calculateLine, calculateTotals } from "@/lib/documents/math";
import type { FieldErrors } from "@/lib/validation/errors";
import { lineInput, toDraft, toPayload, type DraftState } from "./draft-state";
import { DOCUMENT_KINDS, toEditable, type DocumentKindConfig, type EditableDocument } from "./kinds";

export const AUTOSAVE_DELAY = 800;
const RETRY_DELAY = 4000;

export type SaveStatus = "saved" | "pending" | "saving" | "invalid" | "error";

/**
 * Holds the editor's draft and autosaves it. Every change schedules one PATCH after a pause;
 * responses that arrive after a newer save started are ignored, so the screen never jumps back.
 */
export function useDocumentDraft(initial: EditableDocument, config: DocumentKindConfig = DOCUMENT_KINDS.invoice) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftState>(() => toDraft(initial));
  const [document, setDocument] = useState(initial);
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

  const { errors: localErrors } = useMemo(() => toPayload(draft, config.endDateField), [draft, config.endDateField]);

  const performSave = useCallback(async (): Promise<EditableDocument | null> => {
    if (!dirty.current) return latest.current;
    const { payload, errors } = toPayload(draftRef.current, config.endDateField);
    if (Object.keys(errors).length) {
      setStatus("invalid");
      return null;
    }
    dirty.current = false;
    setStatus("saving");
    try {
      const saved = toEditable(await api.patch<Parameters<typeof toEditable>[0]>(`${config.apiBase}/${initial.id}`, payload));
      latest.current = saved;
      setDocument(saved);
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
  }, [config.apiBase, config.endDateField, initial.id, router]);

  const save = useCallback((): Promise<EditableDocument | null> => {
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
  const flush = useCallback((): Promise<EditableDocument | null> => save(), [save]);

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
        endDate: draft.endDate,
        items: draft.items.map((item) => ({ ...item, unitPrice: lineInput(item).unitPrice })),
      }, { endPath: config.endDateField, endLabel: config.kind === "estimate" ? "Expiry date" : "Due date" }),
    [config.endDateField, config.kind, draft],
  );

  return {
    draft,
    update,
    document,
    status,
    savedAt,
    errors: { ...serverErrors, ...localErrors },
    issues,
    lines,
    totals,
    flush,
  };
}
