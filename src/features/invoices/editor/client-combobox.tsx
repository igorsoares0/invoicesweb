"use client";

import { cn } from "cn";
import { ChevronDownIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { InitialAvatar } from "@/components/list/avatar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api-client";
import type { ClientDto } from "@/lib/api-types";

export function ClientCombobox({
  id,
  clients,
  value,
  onChange,
  onCreated,
  invalid,
}: {
  id: string;
  clients: ClientDto[];
  value: string | null;
  onChange: (client: ClientDto) => void;
  onCreated: (client: ClientDto) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const selected = clients.find((client) => client.id === value) ?? null;

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((client) =>
      [client.name, client.email, client.company].some((field) => field?.toLowerCase().includes(needle)),
    );
  }, [clients, query]);

  function choose(client: ClientDto) {
    onChange(client);
    setOpen(false);
    setQuery("");
  }

  async function create() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    try {
      const client = await api.post<ClientDto>("/clients", { name });
      onCreated(client);
      choose(client);
      toast.success(`${client.name} was added — add their email in Clients to send by email`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create the client");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-invalid={invalid || undefined}
          className={cn(
            "flex h-[38px] w-full min-w-0 items-center gap-2.5 rounded-md border bg-card px-2 text-left outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/12",
            invalid && "border-destructive ring-3 ring-destructive/10",
          )}
        >
          {selected ? (
            <>
              <InitialAvatar name={selected.name} className={cn("size-[22px] text-[11px]", invalid && "bg-[#fee2e2] text-destructive")} />
              <span className="truncate text-sm font-medium">{selected.name}</span>
              {selected.email ? (
                <span className="truncate text-[13px] text-muted-2">{selected.email}</span>
              ) : (
                <span className="shrink-0 text-[13px] text-destructive">no email</span>
              )}
            </>
          ) : (
            <span className="pl-1 text-sm text-muted-2">Search clients…</span>
          )}
          <ChevronDownIcon className="ml-auto size-4 shrink-0 text-muted-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0">
        <div className="border-b p-2">
          <Input
            autoFocus
            aria-label="Search clients"
            placeholder="Search or create a client"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (matches[0]) choose(matches[0]);
                else void create();
              }
            }}
          />
        </div>
        <ul id={`${id}-listbox`} role="listbox" aria-label="Clients" className="max-h-64 overflow-y-auto py-1">
          {matches.map((client) => (
            <li key={client.id}>
              <button
                type="button"
                role="option"
                aria-selected={client.id === value}
                onClick={() => choose(client)}
                className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-divider", client.id === value && "bg-canvas-2")}
              >
                <InitialAvatar name={client.name} className="size-[22px] text-[11px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{client.name}</span>
                  <span className={cn("block truncate text-[12px]", client.email ? "text-muted-2" : "text-destructive")}>
                    {client.email ?? "no email"}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {query.trim() ? (
            <li>
              <button
                type="button"
                disabled={creating}
                onClick={create}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-divider"
              >
                <PlusIcon className="size-4" />
                {creating ? "Creating…" : `Create “${query.trim()}”`}
              </button>
            </li>
          ) : matches.length === 0 ? (
            <li className="px-3 py-3 text-[13px] text-muted-foreground">No clients yet. Type a name to create one.</li>
          ) : null}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
