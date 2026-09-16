"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ComponentProps } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { InvoiceDto } from "@/lib/api-types";

/** Creates the draft right away — its number is assigned now — and opens the editor. */
export function NewInvoiceButton({
  clientId,
  label = "New invoice",
  ...props
}: { clientId?: string; label?: string } & ComponentProps<typeof Button>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={async () => {
        setPending(true);
        try {
          const invoice = await api.post<InvoiceDto>("/invoices", clientId ? { clientId } : {});
          router.push(`/invoices/${invoice.id}`);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Couldn't create the invoice");
          setPending(false);
        }
      }}
    >
      <PlusIcon data-icon="inline-start" />
      {pending ? "Creating…" : label}
    </Button>
  );
}
