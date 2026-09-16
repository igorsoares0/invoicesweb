import type { Metadata } from "next";
import { ClientsScreen } from "@/features/clients/clients-screen";
import { listClientsQuerySchema } from "@/lib/validation/client";
import { firstValues } from "@/lib/url";
import { ApiError } from "@/server/api/errors";
import { requireBusiness } from "@/server/auth/session";
import { clientService } from "@/server/services/client-service";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const { user, business } = await requireBusiness();
  const context = { userId: user.id, businessId: business.id };
  const params = firstValues(await searchParams);

  // A hand-edited URL with a bad sort or page falls back to the defaults instead of erroring.
  const query = listClientsQuerySchema.safeParse(params).success ? params : {};
  const [result, selected] = await Promise.all([
    clientService.list(context, query),
    params.client
      ? clientService.get(context, params.client).catch((error: unknown) => {
          if (error instanceof ApiError && error.code === "RESOURCE_NOT_FOUND") return null;
          throw error;
        })
      : null,
  ]);

  return <ClientsScreen result={result} selected={selected} defaultCurrency={business.defaultCurrency} />;
}
