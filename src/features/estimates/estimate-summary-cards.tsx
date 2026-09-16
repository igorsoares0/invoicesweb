import type { EstimateSummaryDto } from "@/lib/api-types";
import { formatMoney } from "@/lib/money";
import { pluralize } from "@/lib/format";
import { StatCard } from "@/components/documents/stat-card";

/** Design c1: framed around the reply, not the document. */
export function EstimateSummaryCards({ summary }: { summary: EstimateSummaryDto }) {
  const money = (value: string) => formatMoney(value, summary.currency);
  const { awaitingReply, acceptedNotInvoiced, wonThisQuarter, averageReplyDays } = summary;
  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      <StatCard label="Awaiting reply" value={money(awaitingReply.amount)} money hint={`${pluralize(awaitingReply.count, "estimate")} out`} />
      <StatCard
        label="Accepted, not invoiced"
        value={money(acceptedNotInvoiced.amount)}
        money
        valueTone={acceptedNotInvoiced.count ? "success" : undefined}
        hint={acceptedNotInvoiced.count ? `${acceptedNotInvoiced.count} ready to convert` : "Nothing waiting"}
      />
      <StatCard
        label="Won this quarter"
        value={wonThisQuarter.percent === null ? "—" : `${wonThisQuarter.percent}%`}
        hint={wonThisQuarter.decided ? `${wonThisQuarter.accepted} of ${wonThisQuarter.decided} accepted` : "No replies yet"}
      />
      <StatCard
        label="Avg. reply time"
        value={averageReplyDays === null ? "—" : pluralize(averageReplyDays, "day")}
        hint="Since first view"
      />
    </div>
  );
}
