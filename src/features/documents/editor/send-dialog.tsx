"use client";

import { cn } from "cn";
import { XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { ErrorBanner } from "@/components/forms/error-banner";
import { Field, errorProps } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatShortDate } from "@/lib/dates";
import { defaultEmailMessage, defaultEmailSubject, MAX_EMAIL_RECIPIENTS } from "@/lib/documents/email-text";
import type { DocumentKind } from "@/lib/documents/view";
import { formatMoney } from "@/lib/money";

export interface SendEmailInput {
  to: string[];
  subject: string;
  message: string;
  attachPdf: boolean;
  sendCopy: boolean;
}

/** What came back from an attempt: the email may have failed after the document was sent. */
export interface SendEmailOutcome {
  status: "SENT" | "FAILED" | "QUEUED";
  error: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function RecipientChips({
  recipients,
  onRemove,
  disabled,
}: {
  recipients: string[];
  onRemove: (address: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      {recipients.map((address) => (
        <span key={address} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-divider px-2 text-[13px]">
          {address}
          <button
            type="button"
            aria-label={`Remove ${address}`}
            className="text-muted-2 hover:text-foreground disabled:opacity-50"
            disabled={disabled}
            onClick={() => onRemove(address)}
          >
            <XIcon className="size-3.5" />
          </button>
        </span>
      ))}
    </>
  );
}

function Toggle({
  label,
  checked,
  onCheckedChange,
  disabled,
  badge,
  hint,
}: {
  label: string;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  badge?: string;
  hint?: string;
}) {
  return (
    <label className={cn("flex items-center gap-2.5 text-[14px]", disabled && "text-muted-foreground")}>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={label} />
      <span>{label}</span>
      {badge ? (
        <span className="inline-flex h-[18px] items-center rounded bg-primary-tint px-1.5 text-[10.5px] font-semibold tracking-wide text-primary">
          {badge}
        </span>
      ) : null}
      {hint ? <span className="text-[12.5px] text-muted-2">{hint}</span> : null}
    </label>
  );
}

/**
 * Sending a document (design a3). Email is the default path; "Mark as sent" stays for documents
 * delivered by hand, and is the only path when no email transport is configured.
 */
export function SendDialog({
  open,
  onOpenChange,
  number,
  total,
  currency,
  endDate,
  kind,
  clientName,
  clientEmail,
  businessName,
  emailEnabled,
  alreadySent = false,
  onSendEmail,
  onMarkSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  number: string;
  total: string;
  currency: string;
  endDate: string;
  kind: DocumentKind;
  clientName: string | null;
  clientEmail: string | null;
  businessName: string;
  emailEnabled: boolean;
  /** A re-send: the number is assigned and the status won't change again. */
  alreadySent?: boolean;
  /** A string is an error to show; null means the caller took over (the plan-limit dialog). */
  onSendEmail: (input: SendEmailInput) => Promise<SendEmailOutcome | string | null>;
  onMarkSent: () => Promise<string | null>;
}) {
  const text = useMemo(() => ({ kind, number, clientName, businessName }), [kind, number, clientName, businessName]);
  const [recipients, setRecipients] = useState<string[]>(clientEmail ? [clientEmail] : []);
  const [draftRecipient, setDraftRecipient] = useState("");
  const [subject, setSubject] = useState(() => defaultEmailSubject(text));
  const [message, setMessage] = useState(() => defaultEmailMessage(text));
  const [attachPdf, setAttachPdf] = useState(true);
  const [sendCopy, setSendCopy] = useState(true);
  const [pending, setPending] = useState<"email" | "mark" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [recipientError, setRecipientError] = useState<string | undefined>(undefined);

  const noun = kind === "estimate" ? "estimate" : "invoice";
  const busy = pending !== null;

  function addRecipient(raw: string): boolean {
    const address = raw.trim().toLowerCase().replace(/,$/, "");
    if (!address) return true;
    if (!EMAIL_PATTERN.test(address)) {
      setRecipientError("Enter a valid email address");
      return false;
    }
    if (recipients.includes(address)) {
      setRecipientError("That address is already on the list");
      return false;
    }
    if (recipients.length >= MAX_EMAIL_RECIPIENTS) {
      setRecipientError(`Use at most ${MAX_EMAIL_RECIPIENTS} recipients`);
      return false;
    }
    setRecipients([...recipients, address]);
    setDraftRecipient("");
    setRecipientError(undefined);
    return true;
  }

  async function sendEmail() {
    if (draftRecipient.trim() && !addRecipient(draftRecipient)) return;
    const to = draftRecipient.trim() ? [...recipients, draftRecipient.trim().toLowerCase()] : recipients;
    if (!to.length) {
      setRecipientError("Add at least one recipient");
      return;
    }
    setPending("email");
    setError(null);
    setFailure(null);
    const outcome = await onSendEmail({ to, subject, message, attachPdf, sendCopy });
    setPending(null);
    if (outcome === null) return;
    if (typeof outcome === "string") {
      setError(outcome);
      return;
    }
    if (outcome.status === "SENT") {
      onOpenChange(false);
      return;
    }
    // The document is sent either way; only the email failed, so the dialog stays open to retry.
    setFailure(outcome.error ?? "the email provider couldn't accept it");
  }

  async function markSent() {
    setPending("mark");
    setError(null);
    const problem = await onMarkSent();
    setPending(null);
    if (problem) setError(problem);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="gap-0 p-0 sm:max-w-[560px]">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-[17px] font-semibold">
            {kind === "estimate" ? "Send estimate" : "Send invoice"}
          </DialogTitle>
          <DialogDescription>
            {number} · {formatMoney(total, currency)} · {kind === "estimate" ? "valid until" : "due"}{" "}
            {formatShortDate(endDate)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3.5 px-6 pb-5 text-[14px]">
          {error ? <ErrorBanner>{error}</ErrorBanner> : null}
          {failure ? (
            <div className="rounded-md border border-danger-border bg-danger-tint px-3 py-2.5 text-[13px] text-destructive">
              <p className="font-semibold">
                {number} is marked as sent, but the email didn&apos;t go out — {failure}.
              </p>
              <p className="mt-0.5">Try again, or close this and share the link instead.</p>
            </div>
          ) : null}

          {emailEnabled ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="send-to">To</Label>
                <div
                  className={cn(
                    "flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-md border bg-card px-2 py-1.5",
                    recipientError && "border-destructive",
                  )}
                >
                  <RecipientChips
                    recipients={recipients}
                    disabled={busy}
                    onRemove={(address) => {
                      setRecipients(recipients.filter((value) => value !== address));
                      setRecipientError(undefined);
                    }}
                  />
                  <input
                    id="send-to"
                    type="email"
                    className="h-7 min-w-[150px] flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-2"
                    placeholder={recipients.length ? "+ Add recipient" : "name@company.com"}
                    value={draftRecipient}
                    disabled={busy}
                    {...errorProps("send-to", recipientError)}
                    onChange={(event) => {
                      setDraftRecipient(event.target.value);
                      setRecipientError(undefined);
                    }}
                    onBlur={() => addRecipient(draftRecipient)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === "," || event.key === " ") {
                        event.preventDefault();
                        addRecipient(draftRecipient);
                      }
                    }}
                  />
                </div>
                {recipientError ? (
                  <p id="send-to-error" className="text-[12.5px] text-destructive">
                    {recipientError}
                  </p>
                ) : clientEmail ? null : (
                  <p className="text-[12.5px] text-muted-foreground">
                    {clientName ?? "This client"} has no email on file — add one, or send yourself the link instead.
                  </p>
                )}
              </div>

              <Field id="send-subject" label="Subject">
                <Input
                  id="send-subject"
                  value={subject}
                  disabled={busy}
                  maxLength={200}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </Field>

              <Field
                id="send-message"
                label="Message"
                hint={`Client name, amount, ${kind === "estimate" ? "validity" : "due date"} and the view button are filled by the template.`}
              >
                <Textarea
                  id="send-message"
                  rows={7}
                  value={message}
                  disabled={busy}
                  maxLength={2000}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </Field>

              <div className="flex flex-col gap-2">
                <Toggle label="Attach the PDF" checked={attachPdf} onCheckedChange={setAttachPdf} disabled={busy} />
                <Toggle label="Send me a copy" checked={sendCopy} onCheckedChange={setSendCopy} disabled={busy} />
                {kind === "invoice" ? (
                  <Toggle label="Remind me if unpaid after the due date" checked={false} disabled badge="PRO" />
                ) : null}
              </div>
            </>
          ) : (
            <p>
              Marking the {noun} as sent publishes a private link you can share with{" "}
              <strong className="font-semibold">{clientEmail ?? "your client"}</strong>. They can view it
              {kind === "estimate" ? ", accept or decline it," : " and download the PDF"} without an account.
            </p>
          )}
        </div>

        <DialogFooter className="flex-col items-stretch gap-3 rounded-b-xl border-t bg-canvas-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-muted-foreground">
            The number <strong className="font-mono font-semibold text-foreground">{number}</strong> is already assigned.{" "}
            {alreadySent ? `The ${noun} is already marked as sent.` : "On send the status becomes Sent."}
          </p>
          <div className="flex shrink-0 items-center justify-end gap-3">
            {emailEnabled && !alreadySent ? (
              <button
                type="button"
                data-testid="mark-as-sent"
                className="text-[13px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={busy}
                onClick={markSent}
              >
                {pending === "mark" ? "Sending…" : "Mark as sent"}
              </button>
            ) : null}
            <Button variant="outline" size="lg" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {emailEnabled ? (
              <Button size="lg" data-testid="send-email" disabled={busy} onClick={sendEmail}>
                {pending === "email" ? "Sending…" : failure ? "Try again" : kind === "estimate" ? "Send estimate" : "Send invoice"}
              </Button>
            ) : (
              <Button size="lg" data-testid="mark-as-sent" disabled={busy} onClick={markSent}>
                {pending === "mark" ? "Sending…" : "Mark as sent"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
