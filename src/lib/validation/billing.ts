import { z } from "zod";

export const checkoutSchema = z.object({
  interval: z.enum(["MONTH", "YEAR"]),
});

export const syncCheckoutSchema = z.object({
  transactionId: z.string().regex(/^txn_[a-z\d]{26}$/, "Invalid transaction"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
