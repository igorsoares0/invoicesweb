import "server-only";
import type { ApiList, ClientDto } from "@/lib/api-types";
import { createClientSchema, listClientsQuerySchema, updateClientSchema } from "@/lib/validation/client";
import { toFieldErrors } from "@/lib/validation/errors";
import { ApiError } from "@/server/api/errors";
import type { BusinessContext } from "@/server/auth/types";
import { clientRepository } from "@/server/repositories/client-repository";
import { toClientDto } from "@/server/repositories/serializers";

export const clientService = {
  async list(context: BusinessContext, query: unknown): Promise<ApiList<ClientDto>> {
    const parsed = listClientsQuerySchema.safeParse(query);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    const { items, total } = await clientRepository.list(context.businessId, parsed.data);
    return {
      data: items.map(toClientDto),
      pagination: { page: parsed.data.page, limit: parsed.data.limit, total },
    };
  },

  async get(context: BusinessContext, id: string): Promise<ClientDto> {
    const client = await clientRepository.findById(context.businessId, id);
    if (!client) throw ApiError.notFound("Client");
    return toClientDto(client);
  },

  async create(context: BusinessContext, input: unknown): Promise<ClientDto> {
    const parsed = createClientSchema.safeParse(input);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    return toClientDto(await clientRepository.create(context.businessId, parsed.data));
  },

  async update(context: BusinessContext, id: string, input: unknown): Promise<ClientDto> {
    const parsed = updateClientSchema.safeParse(input);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    const client = await clientRepository.update(context.businessId, id, parsed.data);
    if (!client) throw ApiError.notFound("Client");
    return toClientDto(client);
  },

  async remove(context: BusinessContext, id: string): Promise<void> {
    if (!(await clientRepository.softDelete(context.businessId, id))) throw ApiError.notFound("Client");
  },
};
