import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/db/prisma";
import { authConfig } from "@/lib/auth/auth.config";
import { GOOGLE_PROVIDER, isGoogleSignInEnabled, resolveGoogleUser } from "@/lib/auth/google-account";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validation/auth";

class GoogleOnlyAccount extends CredentialsSignin {
  code = "google_account";
}

const credentials = Credentials({
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(input) {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (!user) {
      return null;
    }
    if (!user.passwordHash) {
      throw new GoogleOnlyAccount();
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  pages: { ...authConfig.pages, error: "/login" },
  providers: isGoogleSignInEnabled() ? [credentials, Google] : [credentials],
  callbacks: {
    ...authConfig.callbacks,
    signIn({ account, profile }) {
      if (account?.provider !== GOOGLE_PROVIDER) {
        return true;
      }
      return Boolean(profile?.sub && profile.email && profile.email_verified);
    },
    async jwt(params) {
      const { token, account, profile } = params;
      if (account?.provider === GOOGLE_PROVIDER && profile?.sub && profile.email) {
        const user = await resolveGoogleUser({
          sub: profile.sub,
          email: profile.email,
          emailVerified: profile.email_verified === true,
          name: profile.name,
          picture: typeof profile.picture === "string" ? profile.picture : null,
        });
        token.id = user.id;
        token.sub = user.id;
        token.email = user.email;
        return token;
      }
      return authConfig.callbacks.jwt(params);
    },
  },
});
