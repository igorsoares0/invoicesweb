import "server-only";
import { auth } from "@/auth";
import { businessRepository } from "@/server/repositories/business-repository";
import type { BusinessContext, UserContext } from "./types";

/**
 * Resolves who is calling. Today that's the Auth.js cookie session; the mobile app's bearer
 * tokens (spec §47) plug in here without touching route handlers or services.
 */
export async function getUserContext(): Promise<UserContext | null> {
  const session = await auth();
  const userId = session?.user?.id;
  return userId ? { userId } : null;
}

export async function getBusinessContext(): Promise<(UserContext & { businessId: string | null }) | null> {
  const user = await getUserContext();
  if (!user) return null;
  const business = await businessRepository.findByUserId(user.userId);
  return { userId: user.userId, businessId: business?.id ?? null };
}

export function hasBusiness(
  context: UserContext & { businessId: string | null },
): context is BusinessContext {
  return context.businessId !== null;
}
