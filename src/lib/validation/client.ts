import { z } from "zod";
import {
  listQuery,
  optionalCountryCode,
  optionalCurrencyCode,
  optionalEmail,
  optionalText,
  requiredText,
} from "./common";

const clientFields = {
  name: requiredText(200, "Client name"),
  email: optionalEmail,
  phone: optionalText(50),
  company: optionalText(200),
  taxId: optionalText(50),
  address: optionalText(500),
  city: optionalText(100),
  state: optionalText(100),
  country: optionalCountryCode,
  postalCode: optionalText(20),
  currency: optionalCurrencyCode,
  notes: optionalText(2000),
};

export const createClientSchema = z.object(clientFields);
export const updateClientSchema = z.object(clientFields).partial();

export const CLIENT_SORT_FIELDS = ["name", "createdAt"] as const;
export const listClientsQuerySchema = listQuery(CLIENT_SORT_FIELDS, { sort: "name", order: "asc" });

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
