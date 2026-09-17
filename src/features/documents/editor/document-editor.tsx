"use client";

import { cn } from "cn";
import { ChevronLeftIcon, EyeIcon, MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/documents/status-badge";
import { ConfirmDeleteDialog } from "@/components/list/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { PHONE_LAYOUT, useMediaQuery, WIDE_LAYOUT } from "@/hooks/use-media-query";
import { api, ApiClientError } from "@/lib/api-client";
import type { ClientDto, ProductDto } from "@/lib/api-types";
import { COMMON_CURRENCIES, currencyOptions, currencySymbol } from "@/lib/currencies";
import { buildDocumentView, type DocumentKind, type PartyInput } from "@/lib/documents/view";
import { formatDate } from "@/lib/dates";
import { formatMoney, formatQuantity } from "@/lib/money";
import { DocumentStyles, PrintedDocument } from "@/features/documents/document-templates";
import { FittedDocument } from "@/features/documents/fitted-document";
import { blankItem, lineInput, newLineId, type DraftItem } from "./draft-state";
import { CatalogDialog } from "./catalog-dialog";
import { ClientCombobox } from "./client-combobox";
import { IssuesBanner } from "./issues-banner";
import { LineGrid } from "./line-grid";
import { PhoneLineSheet } from "./phone-line-sheet";
import { SaveStatusText } from "./save-status";
import { SendDialog, type SendEmailInput, type SendEmailOutcome } from "./send-dialog";
import { AccentSwatches, TemplatePicker } from "./template-picker";
import { DOCUMENT_KINDS, type EditableDocument } from "./kinds";
import { useDocumentDraft } from "./use-document-draft";

const currencies = currencyOptions();

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-[12.5px] text-destructive">{message}</p> : null;
}

export function DocumentEditor({
  kind,
  initial,
  issuer,
  clients: initialClients,
  products,
  defaultTaxRate,
  emailEnabled,
  origin,
}: {
  /** Where this document came from, e.g. the estimate an invoice was converted from. */
  origin?: { href: string; label: string };
  kind: DocumentKind;
  initial: EditableDocument;
  issuer: PartyInput;
  clients: ClientDto[];
  products: ProductDto[];
  defaultTaxRate: string | null;
  /** False when no email transport is configured: the dialog then only marks as sent. */
  emailEnabled: boolean;
}) {
  const router = useRouter();
  const config = DOCUMENT_KINDS[kind];
  const { labels, apiBase, endDateField } = config;
  const { draft, update, document: invoice, status, savedAt, errors, issues, lines, totals, flush } = useDocumentDraft(
    initial,
    config,
  );
  const [clients, setClients] = useState(initialClients);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [phoneTab, setPhoneTab] = useState<"edit" | "preview">("edit");
  const [sheetItemId, setSheetItemId] = useState<string | null>(null);
  const wide = useMediaQuery(WIDE_LAYOUT);
  const phone = useMediaQuery(PHONE_LAYOUT);

  const client = clients.find((option) => option.id === draft.clientId) ?? null;
  const ready = issues.length === 0;
  // The banner waits until there's something to check; an empty draft shows its empty state instead.
  const showIssues = !ready && (draft.items.length > 0 || draft.clientId !== null);
  const fieldErrors = useMemo(() => {
    const merged: Record<string, string[]> = { ...errors };
    if (showIssues) for (const issue of issues) merged[issue.path] ??= [issue.message];
    return merged;
  }, [errors, issues, showIssues]);

  const view = useMemo(
    () =>
      buildDocumentView({
        kind,
        number: invoice.number,
        currency: draft.currency,
        issueDate: draft.issueDate,
        endDate: draft.endDate >= draft.issueDate ? draft.endDate : draft.issueDate,
        issuer,
        billTo: client,
        lines: draft.items.map((item, index) => ({
          ...lineInput(item),
          description: item.description,
          taxExemptReason: item.taxExemptReason || null,
          total: lines[index].total,
        })),
        ...totals,
        amountPaid: "0.00",
        amountDue: totals.total,
        notes: draft.notes || null,
        terms: draft.terms || null,
        color: draft.color,
      }),
    [client, draft, invoice.number, issuer, kind, lines, totals],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setCatalogOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const changeItem = (id: string, patch: Partial<DraftItem>) =>
    update((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  const removeItem = (id: string) =>
    update((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
  const addItem = () => {
    const item = blankItem(defaultTaxRate);
    update((current) => ({ ...current, items: [...current.items, item] }));
    if (phone) setSheetItemId(item.id);
    else requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[aria-label="Line ${draft.items.length + 1}"] input`)?.focus());
  };
  const addProduct = (product: ProductDto) => {
    update((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: newLineId(),
          productId: product.id,
          description: product.name,
          quantity: "1",
          unitPrice: product.unitPrice,
          discountType: null,
          discountValue: "",
          taxRate: product.taxRate.replace(/\.00$/, ""),
          taxExempt: product.taxExempt,
          taxExemptReason: product.taxExemptReason ?? "",
        },
      ],
    }));
    setCatalogOpen(false);
    toast.success(`${product.name} added`);
  };

  async function downloadPdf() {
    const saved = await flush();
    if (!saved) return;
    const link = document.createElement("a");
    link.href = `/api/v1${apiBase}/${invoice.id}/pdf?download=1`;
    link.click();
  }

  async function markSent(): Promise<string | null> {
    const saved = await flush();
    if (!saved) return "Save the draft first — some fields need fixing.";
    try {
      await api.post(`${apiBase}/${invoice.id}/send`, {});
      toast.success(`${invoice.number} marked as sent`);
      setSendOpen(false);
      router.refresh();
      return null;
    } catch (error) {
      return error instanceof ApiClientError ? error.message : `Couldn't send the ${labels.noun}`;
    }
  }

  /** Returns the attempt's outcome, or a message when the request itself was refused. */
  async function sendEmail(input: SendEmailInput): Promise<SendEmailOutcome | string> {
    const saved = await flush();
    if (!saved) return "Save the draft first — some fields need fixing.";
    try {
      const { email } = await api.post<{ email: SendEmailOutcome }>(`${apiBase}/${invoice.id}/email`, input);
      // Refreshing now would swap the editor for the detail view and take the dialog — and its
      // "sent, but the email failed" message — with it. On failure the dialog stays for a retry;
      // closing it refreshes instead.
      if (email.status === "SENT") {
        toast.success(`${invoice.number} emailed to ${input.to[0]}`);
        router.refresh();
      }
      return email;
    } catch (error) {
      return error instanceof ApiClientError ? error.message : `Couldn't email the ${labels.noun}`;
    }
  }

  async function duplicate() {
    const saved = await flush();
    if (!saved) return;
    const copy = await api.post<{ id: string; number: string }>(`${apiBase}/${invoice.id}/duplicate`, {});
    toast.success(`${copy.number} was created from ${invoice.number}`);
    router.push(`${config.listHref}/${copy.id}`);
  }

  const preview = (
    <div className="overflow-hidden rounded-md border bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <FittedDocument>
        <PrintedDocument view={view} template={draft.template} />
      </FittedDocument>
    </div>
  );

  const headerFields = (
    <section className="grid gap-4 rounded-lg border bg-card px-5 py-4 md:grid-cols-[minmax(0,1fr)_148px_148px]">
      <div>
        <Label htmlFor="bill-to" className={cn("mb-1.5", fieldErrors.clientId && "text-destructive")}>
          {labels.client}
        </Label>
        <ClientCombobox
          id="bill-to"
          clients={clients}
          value={draft.clientId}
          invalid={Boolean(fieldErrors.clientId)}
          onChange={(selected) =>
            update((current) => ({
              ...current,
              clientId: selected.id,
              // A client's usual currency only applies while the draft has no lines priced in another.
              currency: current.items.length === 0 && selected.currency ? selected.currency : current.currency,
            }))
          }
          onCreated={(created) => setClients((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)))}
        />
        {fieldErrors.clientId ? (
          <FieldError message={fieldErrors.clientId[0]} />
        ) : client && !client.email ? (
          <p className="mt-1 text-[12.5px] text-muted-foreground">No email on file — you&apos;ll share the link yourself.</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="issue-date" className="mb-1.5">
          Issue date
        </Label>
        <Input
          id="issue-date"
          type="date"
          value={draft.issueDate}
          aria-invalid={fieldErrors.issueDate ? true : undefined}
          onChange={(event) => update((current) => ({ ...current, issueDate: event.target.value }))}
        />
        <FieldError message={fieldErrors.issueDate?.[0]} />
      </div>
      <div>
        <Label htmlFor="due-date" className={cn("mb-1.5", fieldErrors[endDateField] && "text-destructive")}>
          {labels.endDate}
        </Label>
        <Input
          id="due-date"
          type="date"
          value={draft.endDate}
          aria-invalid={fieldErrors[endDateField] ? true : undefined}
          onChange={(event) => update((current) => ({ ...current, endDate: event.target.value }))}
        />
        <FieldError message={fieldErrors[endDateField]?.[0]} />
      </div>
    </section>
  );

  const addActions = (
    <div className="flex h-[46px] items-center gap-3 px-4 text-[13px]">
      <button type="button" onClick={addItem} className="font-semibold text-primary">
        + Add item
      </button>
      <span className="text-line-strong">|</span>
      <button type="button" onClick={() => setCatalogOpen(true)} className="text-muted-foreground hover:text-foreground">
        + From catalog
      </button>
    </div>
  );

  const emptyItems = (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div aria-hidden className="mb-5 flex w-64 flex-col gap-2 opacity-55">
        <span className="h-2 rounded-full bg-divider" />
        <span className="h-2 w-4/5 rounded-full bg-divider" />
      </div>
      <p className="text-[15px] font-semibold">No items yet</p>
      <p className="mt-1 max-w-sm text-[13.5px] text-muted-foreground">
        Type a line by hand, or pull one from your catalog with its price and VAT already set.
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={addItem}>Add first item</Button>
        <Button variant="outline" onClick={() => setCatalogOpen(true)}>
          From catalog <kbd className="ml-1 font-sans text-muted-2">⌘J</kbd>
        </Button>
      </div>
      <p className="mt-5 max-w-md text-[12.5px] text-muted-foreground">
        {invoice.number} is already assigned to this draft — deleting it leaves a gap in the sequence.
      </p>
    </div>
  );

  const totalsBlock = (
    <dl className="flex flex-col gap-1 text-[14px]" aria-label="Totals">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd>{formatMoney(totals.subtotal, draft.currency)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Discount</dt>
        <dd className={totals.discount !== "0.00" ? "text-warning" : undefined}>
          {totals.discount !== "0.00" ? "−" : ""}
          {formatMoney(totals.discount, draft.currency)}
        </dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">VAT</dt>
        <dd>{formatMoney(totals.tax, draft.currency)}</dd>
      </div>
      <div className="mt-2 flex items-baseline justify-between border-t pt-3">
        <dt className="font-semibold">{labels.total}</dt>
        <dd className="text-[22px] font-bold" data-testid="editor-total">
          {formatMoney(totals.total, draft.currency)}
        </dd>
      </div>
      <div className="flex items-center justify-between">
        <dt className="text-muted-foreground">
          <label htmlFor="currency">Currency</label>
        </dt>
        <dd>
          <NativeSelect
            id="currency"
            className="h-8 w-[112px] text-right"
            value={draft.currency}
            onChange={(event) => update((current) => ({ ...current, currency: event.target.value }))}
          >
            {[...COMMON_CURRENCIES, ...currencies.map((option) => option.code).filter((code) => !(COMMON_CURRENCIES as readonly string[]).includes(code))].map(
              (code) => (
                <option key={code} value={code}>
                  {code} {currencySymbol(code)}
                </option>
              ),
            )}
          </NativeSelect>
        </dd>
      </div>
    </dl>
  );

  const notesFields = (
    <div className="flex flex-col gap-3">
      <div>
        <Label htmlFor="notes" className="mb-1.5">
          {labels.notes}
        </Label>
        <Textarea
          id="notes"
          rows={3}
          placeholder={labels.notesPlaceholder}
          value={draft.notes}
          onChange={(event) => update((current) => ({ ...current, notes: event.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="terms" className="mb-1.5">
          {labels.terms}
        </Label>
        <Textarea
          id="terms"
          rows={2}
          placeholder={labels.termsPlaceholder}
          value={draft.terms}
          onChange={(event) => update((current) => ({ ...current, terms: event.target.value }))}
        />
      </div>
    </div>
  );

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="More actions">
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={duplicate}>Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
          Delete draft
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const sheetItem = draft.items.find((item) => item.id === sheetItemId) ?? null;

  return (
    <>
      <DocumentStyles />
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5 text-[13px]">
          <Link href={config.listHref} className="hidden font-medium text-muted-2 hover:text-foreground sm:inline">
            {labels.list}
          </Link>
          <Link href={config.listHref} className="text-muted-2 sm:hidden" aria-label={`Back to ${labels.list.toLowerCase()}`}>
            <ChevronLeftIcon className="size-5" />
          </Link>
          <span className="hidden text-line-strong sm:inline">/</span>
          <h1 className="font-mono text-[15px] font-semibold">{invoice.number}</h1>
          <StatusBadge status="DRAFT" className="hidden sm:inline-flex" />
          {origin ? (
            <Link href={origin.href} className="hidden text-[13px] text-primary lg:inline">
              {origin.label}
            </Link>
          ) : null}
          <span className="truncate text-[13px]">
            <SaveStatusText status={status} savedAt={savedAt} />
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!wide ? (
            <Button variant="outline" className="hidden sm:inline-flex" onClick={() => setPreviewOpen(true)}>
              <EyeIcon data-icon="inline-start" /> Preview
            </Button>
          ) : null}
          <Button variant="outline" className="hidden sm:inline-flex" disabled={!ready} onClick={downloadPdf}>
            Download PDF
          </Button>
          <Button
            className="hidden sm:inline-flex"
            data-testid="send-trigger"
            disabled={!ready}
            onClick={() => setSendOpen(true)}
          >
            {labels.send}
          </Button>
          {menu}
        </div>
      </header>

      {phone ? (
        <div className="flex border-b bg-card px-4" role="tablist" aria-label="Editor view">
          {(["edit", "preview"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={phoneTab === tab}
              onClick={() => setPhoneTab(tab)}
              className={cn(
                "h-11 px-2 text-[15px] font-medium text-muted-foreground",
                phoneTab === tab && "text-foreground shadow-[inset_0_-2px_0_var(--primary)]",
              )}
            >
              {tab === "edit" ? "Edit" : "Preview"}
            </button>
          ))}
          <StatusBadge status="DRAFT" className="my-auto ml-auto" />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1">
        <main className={cn("flex min-w-0 flex-1 flex-col gap-4 px-4 py-5 sm:px-6", phone && "pb-28")}>
          {phone && phoneTab === "preview" ? (
            preview
          ) : (
            <>
              {showIssues ? <IssuesBanner issues={issues} /> : null}
              {headerFields}

              {phone ? (
                <section aria-label="Items" className="flex flex-col gap-2.5">
                  <p className="text-[12px] font-semibold tracking-[0.04em] text-muted-2 uppercase">
                    Items · {draft.items.length}
                  </p>
                  <ol aria-label="Document lines" className="flex flex-col gap-2.5">
                    {draft.items.map((item, index) => {
                      const error = fieldErrors[`items.${item.id}.unitPrice`] ?? fieldErrors[`items.${item.id}.description`];
                      return (
                        <li key={item.id} aria-label={`Line ${index + 1}`}>
                          <button
                            type="button"
                            onClick={() => setSheetItemId(item.id)}
                            className={cn(
                              "w-full rounded-[9px] border bg-card px-3.5 py-3 text-left",
                              error && "border-danger-border bg-danger-tint-2",
                            )}
                          >
                            <span className="block text-[14.5px] font-medium">{item.description || "Untitled line"}</span>
                            <span className="mt-1 flex items-end justify-between gap-3">
                              <span className="text-[13px] text-muted-foreground">
                                {formatQuantity(item.quantity || "0")} × {item.unitPrice ? formatMoney(item.unitPrice.replace(/,/g, "") || "0", draft.currency) : "no price"}
                              </span>
                              <span className="font-semibold">{formatMoney(lines[index].total, draft.currency)}</span>
                            </span>
                            {error ? <span className="mt-1 block text-[12.5px] text-destructive">{error[0]}</span> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button variant="outline" className="h-[46px]" onClick={addItem}>
                      + Add item
                    </Button>
                    <Button variant="outline" className="h-[46px]" onClick={() => setCatalogOpen(true)}>
                      From catalog
                    </Button>
                  </div>
                  <div className="rounded-[9px] border bg-card px-4 py-3">{totalsBlock}</div>
                  <div className="rounded-[9px] border bg-card px-4 py-3">{notesFields}</div>
                </section>
              ) : (
                <section aria-label="Items" className="flex flex-1 flex-col overflow-hidden rounded-lg border bg-card">
                  <LineGrid
                    items={draft.items}
                    lines={lines}
                    currency={draft.currency}
                    errors={fieldErrors}
                    onChangeItem={changeItem}
                    onRemoveItem={removeItem}
                    onReorder={(items) => update((current) => ({ ...current, items }))}
                    footer={draft.items.length ? addActions : emptyItems}
                  />
                  <div className="mt-auto grid gap-6 border-t px-5 py-4 md:grid-cols-[minmax(0,1fr)_270px]">
                    {notesFields}
                    {totalsBlock}
                  </div>
                </section>
              )}
            </>
          )}
        </main>

        {wide ? (
          <aside className="sticky top-14 flex h-[calc(100dvh-56px)] w-[330px] shrink-0 flex-col gap-4 overflow-y-auto border-l bg-canvas-2 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Preview</h2>
              <TemplatePicker
                template={draft.template}
                color={draft.color}
                onChange={(patch) => update((current) => ({ ...current, ...patch }))}
              />
            </div>
            {preview}
            <section className="rounded-lg border bg-card px-4 py-3">
              <p className="mb-2 text-sm font-semibold">Accent color</p>
              <AccentSwatches color={draft.color} onChange={(color) => update((current) => ({ ...current, color }))} />
            </section>
            <section className="rounded-lg border bg-card px-4 py-3 text-[13px]">
              {showIssues ? (
                <>
                  <p className="font-semibold">Why the preview still renders</p>
                  <p className="mt-1 text-muted-foreground">
                    Validation blocks <strong>send</strong> and <strong>PDF</strong>, not editing. Keep working and fix the rest later.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">The number is taken</p>
                  <p className="mt-1 text-muted-foreground">
                    {invoice.number} was assigned the moment this draft was created, so the sequence never has surprises — but an
                    abandoned draft leaves a gap.
                  </p>
                </>
              )}
            </section>
          </aside>
        ) : null}
      </div>

      {phone && phoneTab === "edit" ? (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t bg-card px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div>
            <p className="text-[12px] text-muted-foreground">Total due</p>
            <p className="text-[21px] leading-tight font-bold">{formatMoney(totals.total, draft.currency)}</p>
          </div>
          <Button
            className="h-[46px] w-[190px]"
            data-testid="send-trigger"
            disabled={!ready}
            onClick={() => setSendOpen(true)}
          >
            {labels.send}
          </Button>
        </div>
      ) : null}

      {!wide && !phone ? (
        <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
          <SheetContent side="right" className="w-[460px] overflow-y-auto bg-canvas-2 p-5 sm:max-w-[460px]">
            <SheetTitle>Preview</SheetTitle>
            <SheetDescription className="sr-only">{`How the ${labels.noun} will look`}</SheetDescription>
            <TemplatePicker
              template={draft.template}
              color={draft.color}
              onChange={(patch) => update((current) => ({ ...current, ...patch }))}
            />
            {preview}
          </SheetContent>
        </Sheet>
      ) : null}

      <PhoneLineSheet
        key={sheetItemId ?? "closed"}
        item={sheetItem}
        currency={draft.currency}
        errors={fieldErrors}
        onClose={() => setSheetItemId(null)}
        onRemove={(id) => {
          removeItem(id);
          setSheetItemId(null);
        }}
        onSave={(item) => {
          changeItem(item.id, item);
          setSheetItemId(null);
        }}
      />
      <CatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        products={products}
        currency={draft.currency}
        onPick={addProduct}
      />
      {sendOpen ? (
        <SendDialog
          open
          onOpenChange={(open) => {
            setSendOpen(open);
            if (!open) router.refresh();
          }}
          number={invoice.number}
          total={totals.total}
          currency={draft.currency}
          endDate={draft.endDate}
          kind={kind}
          clientName={client?.name ?? null}
          clientEmail={client?.email ?? null}
          businessName={issuer.name}
          emailEnabled={emailEnabled}
          onSendEmail={sendEmail}
          onMarkSent={markSent}
        />
      ) : null}
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${invoice.number}?`}
        description={`The draft is removed for good and ${invoice.number} becomes a gap in your numbering. Created ${formatDate(invoice.issueDate)}.`}
        onConfirm={async () => {
          await api.delete(`${apiBase}/${invoice.id}`);
          toast.success(`${invoice.number} was deleted`);
          router.push(config.listHref);
          router.refresh();
        }}
      />
    </>
  );
}
