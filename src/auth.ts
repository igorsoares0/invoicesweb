import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/server/db";
import { userService } from "@/server/services/user-service";

/** Surfaces to the sign-in form as `code`; `invalid_credentials:2` means two attempts remain. */
class PasswordSignInError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

export const isGoogleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  // Credentials sign-in only works with JWT sessions.
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  trustHost: true,
  logger: {
    error(error) {
      // Wrong passwords are expected traffic, not server errors.
      if (error instanceof CredentialsSignin || error.name === "CredentialsSignin") return;
      console.error(error);
    },
  },
  providers: [
    ...(isGoogleEnabled ? [Google] : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const result = await userService.authenticateWithPassword(credentials);
        if (result.ok) return result.user;
        if (result.reason === "rate_limited") throw new PasswordSignInError("rate_limited");
        throw new PasswordSignInError(`invalid_credentials:${result.attemptsLeft}`);
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
});
