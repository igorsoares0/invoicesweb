import type { InvoiceIssueDto } from "@/lib/api-types";
import { issueHeadline } from "@/lib/invoices/issues";

/** Design a2 "validation blocked": the summary; the same errors also appear on each field and line. */
export function IssuesBanner({ issues }: { issues: InvoiceIssueDto[] }) {
  if (!issues.length) return null;
  return (
    <section
      role="alert"
      aria-label="Problems to fix before sending"
      className="rounded-lg border border-danger-border border-l-[3px] border-l-destructive bg-card px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-danger-ink">
          <span aria-hidden className="flex size-[18px] items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-white">
            !
          </span>
          {issueHeadline(issues.length)}
        </h2>
        <span className="text-[13px] text-muted-foreground">The draft is saved — nothing is lost</span>
      </div>
      <ul className="mt-1.5 flex flex-col gap-0.5 pl-6">
        {issues.map((issue) => (
          <li key={issue.path} className="list-disc text-[13.5px] marker:text-destructive">
            <strong className="font-semibold">{issue.summary}</strong>
            <span className="text-muted-foreground"> — {issue.fix}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
