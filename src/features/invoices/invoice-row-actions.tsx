"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/list/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import type { InvoiceDto, InvoiceListItemDto } from "@/lib/api-types";
import { canPerform } from "@/lib/invoices/status";

export function InvoiceRowActions({ invoice }: { invoice: InvoiceListItemDto }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function duplicate() {
    try {
      const copy = await api.post<InvoiceDto>(`/invoices/${invoice.id}/duplicate`, {});
      toast.success(`${copy.number} was created from ${invoice.number}`);
      router.push(`/invoices/${copy.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't duplicate the invoice");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="relative z-10 text-muted-2" aria-label={`Actions for ${invoice.number}`}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(`/invoices/${invoice.id}`)}>
            {invoice.status === "DRAFT" ? "Edit" : "Open"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={duplicate}>Duplicate</DropdownMenuItem>
          {invoice.status !== "DRAFT" ? (
            <DropdownMenuItem asChild>
              <a href={`/api/v1/invoices/${invoice.id}/pdf?download=1`}>Download PDF</a>
            </DropdownMenuItem>
          ) : null}
          {canPerform(invoice.status, "delete") ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                Delete draft
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDeleteDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${invoice.number}?`}
        description={`The draft is removed for good and ${invoice.number} becomes a gap in your numbering.`}
        onConfirm={async () => {
          await api.delete(`/invoices/${invoice.id}`);
          toast.success(`${invoice.number} was deleted`);
          router.refresh();
        }}
      />
    </>
  );
}
