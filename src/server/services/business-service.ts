import "server-only";
import type { BusinessDto, MeDto } from "@/lib/api-types";
import { createBusinessSchema, updateBusinessSchema } from "@/lib/validation/business";
import { toFieldErrors } from "@/lib/validation/errors";
import { ApiError } from "@/server/api/errors";
import type { BusinessContext } from "@/server/auth/types";
import { getEntitlements } from "@/server/entitlements/entitlements";
import { businessRepository } from "@/server/repositories/business-repository";
import { estimateRepository } from "@/server/repositories/estimate-repository";
import { invoiceRepository } from "@/server/repositories/invoice-repository";
import { isPrismaError } from "@/server/repositories/prisma-errors";
import { toBusinessDto } from "@/server/repositories/serializers";
import { userService } from "./user-service";

const ALREADY_EXISTS = "This account already has a business";

export const businessService = {
  async getForUser(userId: string): Promise<BusinessDto | null> {
    const business = await businessRepository.findByUserId(userId);
    return business ? toBusinessDto(business) : null;
  },

  async create(userId: string, input: unknown): Promise<BusinessDto> {
    const parsed = createBusinessSchema.safeParse(input);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));

    const user = await userService.getById(userId);
    if (!user) throw ApiError.unauthorized();
    if (await businessRepository.findByUserId(userId)) throw ApiError.conflict(ALREADY_EXISTS);

    try {
      const business = await businessRepository.create(userId, {
        ...parsed.data,
        // Invoices go out from the account email until the user sets a different one.
        email: user.email,
      });
      return toBusinessDto(business);
    } catch (error) {
      if (isPrismaError(error, "P2002")) throw ApiError.conflict(ALREADY_EXISTS);
      throw error;
    }
  },

  async update(context: BusinessContext, input: unknown): Promise<BusinessDto> {
    const parsed = updateBusinessSchema.safeParse(input);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    if (parsed.data.invoiceNextNumber !== undefined) {
      // Lowering the counter would hand out a number that's already on an invoice.
      const used = await invoiceRepository.maxSequence(context.businessId);
      if (parsed.data.invoiceNextNumber <= used) {
        throw ApiError.validation({ invoiceNextNumber: [`Must be ${used + 1} or more — ${used} is already used`] });
      }
    }
    if (parsed.data.estimateNextNumber !== undefined) {
      const used = await estimateRepository.maxSequence(context.businessId);
      if (parsed.data.estimateNextNumber <= used) {
        throw ApiError.validation({ estimateNextNumber: [`Must be ${used + 1} or more — ${used} is already used`] });
      }
    }
    const business = await businessRepository.update(context.businessId, parsed.data);
    return toBusinessDto(business);
  },

  async getMe(userId: string): Promise<MeDto> {
    const [user, business] = await Promise.all([userService.getById(userId), this.getForUser(userId)]);
    if (!user) throw ApiError.unauthorized();
    // Billing arrives in phase 5; until then everyone is on the free plan.
    const plan = "FREE" as const;
    return { user, business, subscription: { plan, status: "ACTIVE" }, entitlements: getEntitlements(plan) };
  },
};
