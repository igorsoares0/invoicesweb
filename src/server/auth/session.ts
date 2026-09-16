import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { BusinessDto, UserDto } from "@/lib/api-types";
import { businessService } from "@/server/services/business-service";
import { userService } from "@/server/services/user-service";

/** For pages: the signed-in user, or a redirect to sign-in. */
export async function requireUser(): Promise<UserDto> {
  const session = await auth();
  const user = session?.user?.id ? await userService.getById(session.user.id) : null;
  if (!user) redirect("/sign-in");
  return user;
}

/** For app pages: the user and their business, redirecting to onboarding when there is none yet. */
export async function requireBusiness(): Promise<{ user: UserDto; business: BusinessDto }> {
  const user = await requireUser();
  const business = await businessService.getForUser(user.id);
  if (!business) redirect("/onboarding");
  return { user, business };
}
