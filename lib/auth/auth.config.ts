import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }

      return session;
    },
    authorized({ auth, request }) {
      const isStudio = request.nextUrl.pathname.startsWith("/studio");
      if (isStudio) {
        return Boolean(auth?.user);
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
