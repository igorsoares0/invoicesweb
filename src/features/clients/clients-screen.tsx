"use client";

import { cn } from "cn";
import { MoreHorizontalIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/page-header";
import { InitialAvatar } from "@/components/list/avatar";
import { ConfirmDeleteDialog } from "@/components/list/confirm-delete-dialog";
import { DetailPanel } from "@/components/list/detail-panel";
import { EmptyState } from "@/components/list/empty-state";
import { Pagination } from "@/components/list/pagination";
import { ResponsiveDialog } from "@/components/list/responsive-dialog";
import { SearchInput } from "@/components/list/search-input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import type { ApiList, ClientDto } from "@/lib/api-types";
import { countryName } from "@/lib/countries";
import { pluralize } from "@/lib/format";
import { withSearchParams } from "@/lib/url";
import { ClientDetails } from "./client-details";
import { ClientForm } from "./client-form";

type FormState = { mode: "create" } | { mode: "edit"; client: ClientDto } | null;

export function ClientsScreen({
  result,
  selected,
  defaultCurrency,
}: {
  result: ApiList<ClientDto>;
  selected: ClientDto | null;
  defaultCurrency: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = Object.fromEntries(searchParams);
  const [form, setForm] = useState<FormState>(null);
  const [toDelete, setToDelete] = useState<ClientDto | null>(null);
  const query = searchParams.get("q");
  const { data: clients, pagination } = result;

  const hrefFor = (clientId: string | null) => withSearchParams(pathname, searchParams, { client: clientId });

  async function deleteClient(client: ClientDto) {
    await api.delete(`/clients/${client.id}`);
    toast.success(`${client.name} was deleted`);
    router.replace(hrefFor(null), { scroll: false });
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Clients"
        actions={<Button onClick={() => setForm({ mode: "create" })}>New client</Button>}
      />
      <div className="flex min-w-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <SearchInput label="Search clients" placeholder="Search name, email or company" />
            <p className="text-[13px] text-muted-foreground" aria-live="polite">
              {query ? `${pluralize(pagination.total, "match", "matches")} for “${query}”` : pluralize(pagination.total, "client")}
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border bg-card shadow-card">
            {clients.length === 0 ? (
              query ? (
                <EmptyState icon={UsersIcon} title="No clients match" body="Try a different name, email or company." />
              ) : (
                <EmptyState
                  icon={UsersIcon}
                  title="No clients yet"
                  body="Add the people and companies you bill. A name and a billing email are enough to send an invoice."
                  action={<Button onClick={() => setForm({ mode: "create" })}>Add your first client</Button>}
                />
              )
            ) : (
              <>
                <div
                  role="row"
                  className="hidden h-9 grid-cols-[minmax(0,1fr)_140px_180px_28px] items-center gap-3 border-b px-4 text-[11px] font-semibold tracking-[0.02em] text-muted-2 uppercase md:grid"
                >
                  <span>Client</span>
                  <span>Phone</span>
                  <span>Location</span>
                  <span className="sr-only">Actions</span>
                </div>
                <ul aria-label="Clients">
                  {clients.map((client) => {
                    const active = selected?.id === client.id;
                    const location = [client.city, client.country ? countryName(client.country) : null]
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <li
                        key={client.id}
                        className={cn(
                          "relative grid min-h-14 grid-cols-[minmax(0,1fr)_28px] items-center gap-3 border-b border-divider px-4 py-2.5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_140px_180px_28px]",
                          active && "bg-canvas-2 shadow-[inset_2px_0_0_var(--primary)]",
                        )}
                      >
                        <Link
                          href={hrefFor(client.id)}
                          scroll={false}
                          className="flex min-w-0 items-center gap-3 after:absolute after:inset-0"
                          aria-current={active ? "true" : undefined}
                        >
                          <InitialAvatar name={client.name} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{client.name}</span>
                            <span className="block truncate text-[12px] text-muted-2">
                              {client.email ?? client.company ?? "No email"}
                            </span>
                          </span>
                        </Link>
                        <span className="hidden truncate text-[13px] text-ink-3 md:block">{client.phone ?? "—"}</span>
                        <span className="hidden truncate text-[13px] text-ink-3 md:block">{location || "—"}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="relative z-10 text-muted-2"
                              aria-label={`Actions for ${client.name}`}
                            >
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setForm({ mode: "edit", client })}>Edit</DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(client)}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    );
                  })}
                </ul>
                <div className="border-t border-divider px-4 py-3 text-[13px]">
                  <button type="button" onClick={() => setForm({ mode: "create" })} className="font-semibold text-primary">
                    + New client
                  </button>
                </div>
                <Pagination pathname={pathname} searchParams={params} {...pagination} />
              </>
            )}
          </div>
        </main>

        <DetailPanel open={selected !== null} onClose={() => router.replace(hrefFor(null), { scroll: false })} title="Client details">
          {selected ? (
            <ClientDetails
              client={selected}
              defaultCurrency={defaultCurrency}
              onEdit={() => setForm({ mode: "edit", client: selected })}
              onDelete={() => setToDelete(selected)}
            />
          ) : null}
        </DetailPanel>
      </div>

      <ResponsiveDialog
        open={form !== null}
        onOpenChange={(open) => !open && setForm(null)}
        title={form?.mode === "edit" ? `Edit ${form.client.name}` : "New client"}
      >
        {form ? (
          <ClientForm
            key={form.mode === "edit" ? form.client.id : "new"}
            client={form.mode === "edit" ? form.client : undefined}
            defaultCurrency={defaultCurrency}
            onCancel={() => setForm(null)}
            onSaved={(client) => {
              toast.success(form.mode === "edit" ? "Client saved" : `${client.name} was added`);
              setForm(null);
              router.replace(hrefFor(client.id), { scroll: false });
              router.refresh();
            }}
          />
        ) : null}
      </ResponsiveDialog>

      <ConfirmDeleteDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete ${toDelete?.name ?? "client"}?`}
        description="They disappear from your client list. Invoices you already sent keep the client's details."
        onConfirm={async () => {
          if (toDelete) await deleteClient(toDelete);
        }}
      />
    </>
  );
}
