import { Button } from "@/components/ui/button";
import { NewDocumentButton } from "@/features/documents/new-document-button";
import { InitialAvatar } from "@/components/list/avatar";
import type { ClientDto } from "@/lib/api-types";
import { formatAddress, formatMonthYear } from "@/lib/format";

function Row({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={mono ? "text-right font-mono text-[13px]" : "text-right break-words"}>
        {value || <span className="text-muted-2">—</span>}
      </dd>
    </div>
  );
}

export function ClientDetails({
  client,
  defaultCurrency,
  onEdit,
  onDelete,
}: {
  client: ClientDto;
  defaultCurrency: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 px-5 py-5">
      <div className="flex items-start gap-3 pr-8 xl:pr-0">
        <InitialAvatar name={client.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-semibold">{client.name}</h2>
          <p className="text-[13px] text-muted-foreground">Client since {formatMonthYear(client.createdAt)}</p>
        </div>
        <button type="button" onClick={onEdit} className="text-[13px] font-semibold text-primary">
          Edit
        </button>
      </div>

      <section className="rounded-lg border px-4 py-3">
        <h3 className="mb-1 text-sm font-semibold">Details</h3>
        <dl className="text-[13.5px]">
          <Row label="Email" value={client.email} />
          <Row label="Phone" value={client.phone} />
          <Row label="Company" value={client.company} />
          <Row label="Tax ID" value={client.taxId} mono />
          <Row label="Address" value={formatAddress(client)} />
          <Row label="Currency" value={client.currency ?? `${defaultCurrency} (default)`} />
        </dl>
      </section>

      {client.notes ? (
        <section className="rounded-lg border px-4 py-3">
          <h3 className="mb-1 text-sm font-semibold">Notes</h3>
          <p className="text-[13.5px] whitespace-pre-line text-ink-2">{client.notes}</p>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <NewDocumentButton kind="invoice" clientId={client.id} />
        <NewDocumentButton kind="estimate" clientId={client.id} variant="outline" />
      </div>

      <div className="mt-auto flex items-center justify-between pt-2">
        <Button variant="outline" size="lg" onClick={onEdit}>
          Edit client
        </Button>
        <button type="button" onClick={onDelete} className="text-[13px] font-semibold text-destructive">
          Delete
        </button>
      </div>
    </div>
  );
}
