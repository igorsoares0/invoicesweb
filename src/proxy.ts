import { type NextRequest, NextResponse } from "next/server";
import { signInRedirectFor } from "@/lib/proxy-rules";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name);
  const target = signInRedirectFor(pathname, search, cookieNames);
  return target ? NextResponse.redirect(new URL(target, request.url)) : NextResponse.next();
}

export const config = {
  // Pages only: API routes answer 401 themselves, and public documents (/i, /e) come in phase 2.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
