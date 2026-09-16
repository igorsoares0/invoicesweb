"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ComponentProps } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { DocumentKind } from "@/lib/documents/view";

const PATHS: Record<DocumentKind, string> = { invoice: "/invoices", estimate: "/estimates" };

/** Creates the draft right away — its number is assigned now — and opens the editor. */
export function NewDocumentButton({
  kind = "invoice",
  clientId,
  label,
  ...props
}: { kind?: DocumentKind; clientId?: string; label?: string } & ComponentProps<typeof Button>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={async () => {
        setPending(true);
        try {
          const document = await api.post<{ id: string }>(PATHS[kind], clientId ? { clientId } : {});
          router.push(`${PATHS[kind]}/${document.id}`);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : `Couldn't create the ${kind}`);
          setPending(false);
        }
      }}
    >
      <PlusIcon data-icon="inline-start" />
      {pending ? "Creating…" : (label ?? `New ${kind}`)}
    </Button>
  );
}
