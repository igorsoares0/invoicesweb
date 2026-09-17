import type { DocumentKind } from "@/lib/documents/view";

export const MAX_EMAIL_RECIPIENTS = 5;
export const MAX_EMAIL_SUBJECT = 200;
export const MAX_EMAIL_MESSAGE = 2000;

export interface EmailTextInput {
  kind: DocumentKind;
  number: string;
  /** Who the document is for; only the first name is used, the way people write emails. */
  clientName: string | null;
  businessName: string;
  /** True for an invoice with nothing left to pay: the copy stops talking about a due date. */
  settled?: boolean;
}

/** "Invoice INV-0044 from Alvorada Studio" (design a3). */
export function defaultEmailSubject({ kind, number, businessName }: EmailTextInput): string {
  const noun = kind === "estimate" ? "Estimate" : "Invoice";
  return `${noun} ${number} from ${businessName}`;
}

function firstName(clientName: string | null): string | null {
  const first = clientName?.trim().split(/\s+/)[0];
  return first && /^[\p{L}'-]+$/u.test(first) ? first : null;
}

/**
 * The human paragraph of the email, and only that: the number, amount, dates and the view
 * button are printed by the template, so the message must not repeat them (design a3 helper).
 */
export function defaultEmailMessage(input: EmailTextInput): string {
  const greeting = firstName(input.clientName) ?? "Hi there";
  const opening = input.kind === "estimate" ? "Here's the estimate we discussed." : "Here's the invoice for the work.";
  const closing =
    input.kind === "estimate"
      ? "Have a look and let me know if it works for you."
      : input.settled
        ? "Attaching it for your records — nothing is owed."
        : "Let me know if anything looks off.";
  return `${greeting === "Hi there" ? greeting : `Hi ${greeting}`},\n\n${opening} ${closing}\n\nThanks,\n${input.businessName}`;
}
