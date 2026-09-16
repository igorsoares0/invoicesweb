import type { DocumentTemplate, InvoiceItemDto } from "@/lib/api-types";
import type { DocumentKind } from "@/lib/documents/view";

/** The fields every editable document shares, whatever its type. */
export interface EditableDocument {
  id: string;
  number: string;
  issueDate: string;
  /** Due date (invoice) or expiry date (estimate). */
  endDate: string;
  currency: string;
  notes: string | null;
  terms: string | null;
  template: DocumentTemplate;
  color: string;
  client: { id: string; deleted: boolean } | null;
  items: InvoiceItemDto[];
}

export interface DocumentKindConfig {
  kind: DocumentKind;
  apiBase: string;
  listHref: string;
  /** Name of the end-date field in the API. */
  endDateField: "dueDate" | "expiryDate";
  labels: {
    noun: string;
    list: string;
    client: string;
    endDate: string;
    notes: string;
    terms: string;
    total: string;
    send: string;
    notesPlaceholder: string;
    termsPlaceholder: string;
  };
}

export const DOCUMENT_KINDS: Record<DocumentKind, DocumentKindConfig> = {
  invoice: {
    kind: "invoice",
    apiBase: "/invoices",
    listHref: "/invoices",
    endDateField: "dueDate",
    labels: {
      noun: "invoice",
      list: "Invoices",
      client: "Bill to",
      endDate: "Due date",
      notes: "Notes",
      terms: "Terms",
      total: "Total due",
      send: "Send invoice",
      notesPlaceholder: "Thanks for your business. Bank details are below.",
      termsPlaceholder: "Late payments accrue 1% per month.",
    },
  },
  estimate: {
    kind: "estimate",
    apiBase: "/estimates",
    listHref: "/estimates",
    endDateField: "expiryDate",
    labels: {
      noun: "estimate",
      list: "Estimates",
      client: "Estimate for",
      endDate: "Expires",
      notes: "Notes",
      terms: "Scope & terms",
      total: "Estimate total",
      send: "Send estimate",
      notesPlaceholder: "Anything the client should know before deciding.",
      termsPlaceholder: "Valid for 14 days. 50% due on kickoff, balance on delivery.",
    },
  },
};

/** Reads an invoice or estimate DTO as an editable document. */
export function toEditable(
  dto: Omit<EditableDocument, "endDate"> & ({ dueDate: string } | { expiryDate: string }),
): EditableDocument {
  const endDate = "dueDate" in dto ? dto.dueDate : dto.expiryDate;
  return {
    id: dto.id,
    number: dto.number,
    issueDate: dto.issueDate,
    endDate,
    currency: dto.currency,
    notes: dto.notes,
    terms: dto.terms,
    template: dto.template,
    color: dto.color,
    client: dto.client ? { id: dto.client.id, deleted: dto.client.deleted } : null,
    items: dto.items,
  };
}
