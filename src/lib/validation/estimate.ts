import { z } from "zod";
import { listQuery } from "./common";
import { checkUniqueLineIds, createDocumentSchema, documentDraftFields, isoDate } from "./document";

export const createEstimateSchema = createDocumentSchema;

export const updateEstimateSchema = z
  .object({ ...documentDraftFields, expiryDate: isoDate })
  .partial()
  .superRefine(checkUniqueLineIds);

export const convertEstimateSchema = z
  .object({
    issueDate: isoDate,
    dueDate: isoDate,
    /** Mark the new invoice as sent straight away. */
    send: z.boolean().default(false),
  })
  .refine((input) => input.dueDate >= input.issueDate, {
    path: ["dueDate"],
    message: "Must be on or after the issue date",
  });

export const ESTIMATE_FILTERS = ["all", "draft", "sent", "accepted", "declined", "expired", "converted"] as const;
export const ESTIMATE_SORT_FIELDS = ["number", "expiryDate", "issueDate", "total", "createdAt"] as const;

export const listEstimatesQuerySchema = listQuery(ESTIMATE_SORT_FIELDS, { sort: "number", order: "desc" }).extend({
  status: z.enum(ESTIMATE_FILTERS).default("all"),
  clientId: z.string().max(40).optional(),
});

export type ListEstimatesQuery = z.infer<typeof listEstimatesQuerySchema>;
export type EstimateFilter = (typeof ESTIMATE_FILTERS)[number];
