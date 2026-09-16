import { afterAll, beforeEach, vi } from "vitest";
import { db } from "@/server/db";
import { resetRateLimits } from "@/server/auth/rate-limit";
import { authState } from "./auth-state";
import { truncateAll } from "./db";

// Route handlers resolve the caller through this module; tests pick the caller with signInAs().
// The real module imports Auth.js, which needs the Next.js runtime, so it is replaced entirely.
vi.mock("@/server/auth/context", async () => {
  const { businessRepository } = await import("@/server/repositories/business-repository");
  return {
    hasBusiness: (context: { businessId: string | null }) => context.businessId !== null,
    getUserContext: async () => (authState.userId ? { userId: authState.userId } : null),
    getBusinessContext: async () => {
      if (!authState.userId) return null;
      const business = await businessRepository.findByUserId(authState.userId);
      return { userId: authState.userId, businessId: business?.id ?? null };
    },
  };
});

beforeEach(async () => {
  await truncateAll();
  resetRateLimits();
  authState.userId = null;
});

afterAll(async () => {
  await db.$disconnect();
});
