import { formatShortDate, type IsoDate } from "@/lib/dates";
import type { FieldErrors } from "@/lib/validation/errors";

export interface IssueCheckInput {
  clientId: string | null;
  issueDate: IsoDate;
  /** Due date for invoices, expiry date for estimates. */
  endDate: IsoDate;
  items: {
    id: string;
    description: string;
    unitPrice: string | null;
    taxExempt: boolean;
    taxExemptReason: string | null;
  }[];
}

export interface IssueProblem {
  /** Field path, matching API error details: `clientId`, `dueDate`, `items.<id>.unitPrice`. */
  path: string;
  /** Bold part of the banner bullet. */
  summary: string;
  /** How to fix it, after the dash. */
  fix: string;
  /** Short message shown next to the field or line. */
  message: string;
}

/**
 * What blocks sending an invoice or downloading its PDF. Drafts may be incomplete while
 * they're edited; these rules only apply when the document leaves the building.
 */
export function findIssueProblems(
  invoice: IssueCheckInput,
  { endPath = "dueDate", endLabel = "Due date" }: { endPath?: string; endLabel?: string } = {},
): IssueProblem[] {
  const problems: IssueProblem[] = [];

  if (!invoice.clientId) {
    problems.push({
      path: "clientId",
      summary: "No client selected",
      fix: "Pick who this invoice is for",
      message: "Choose a client",
    });
  }

  if (invoice.items.length === 0) {
    problems.push({
      path: "items",
      summary: "The invoice has no lines",
      fix: "Add at least one item",
      message: "Add at least one item",
    });
  }

  invoice.items.forEach((item, index) => {
    const label = `Line ${index + 1}`;
    if (!item.description.trim()) {
      problems.push({
        path: `items.${item.id}.description`,
        summary: `${label} has no description`,
        fix: "Describe the work, or remove the line",
        message: "Description is required",
      });
    }
    if (item.unitPrice === null) {
      problems.push({
        path: `items.${item.id}.unitPrice`,
        summary: `${label} has no unit price`,
        fix: "Set a price, or remove the line",
        message: "Unit price is required — the server rejects the line otherwise",
      });
    }
    if (item.taxExempt && !item.taxExemptReason?.trim()) {
      problems.push({
        path: `items.${item.id}.taxExemptReason`,
        summary: `${label} is VAT exempt without a reason`,
        fix: "Add the reason that prints on the PDF",
        message: "Exemption reason is required",
      });
    }
  });

  if (invoice.endDate < invoice.issueDate) {
    problems.push({
      path: endPath,
      summary: `${endLabel} is before the issue date`,
      fix: `${formatShortDate(invoice.endDate)} comes before ${formatShortDate(invoice.issueDate)}`,
      message: `Must be on or after ${formatShortDate(invoice.issueDate)}`,
    });
  }

  return problems;
}

export function problemsToFieldErrors(problems: IssueProblem[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const problem of problems) (errors[problem.path] ??= []).push(problem.message);
  return errors;
}

const COUNT_WORDS = ["", "One thing", "Two things", "Three things", "Four things", "Five things"];

/** Banner heading: "Three things to fix before sending". */
export function issueHeadline(count: number): string {
  const subject = COUNT_WORDS[count] ?? `${count} things`;
  return `${subject} to fix before sending`;
}
