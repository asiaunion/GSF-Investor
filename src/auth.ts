import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import {
  DEV_PREVIEW_PROVIDER_ID,
  isDevPreviewEnabled,
} from "@/lib/dev-preview";

const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL?.trim();

const googleConfigured =
  !!process.env.GOOGLE_CLIENT_ID?.trim() &&
  !!process.env.GOOGLE_CLIENT_SECRET?.trim();

const providers = [
  ...(googleConfigured
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : []),
  ...(isDevPreviewEnabled()
    ? [
        Credentials({
          id: DEV_PREVIEW_PROVIDER_ID,
          name: "Design Preview",
          credentials: {
            token: { label: "Token", type: "password" },
          },
          authorize(credentials) {
            const expected =
              process.env.DEV_PREVIEW_SECRET?.trim() || "preview";
            if (credentials?.token !== expected) return null;
            return {
              id: "dev-preview",
              email:
                process.env.DEV_PREVIEW_EMAIL?.trim() ||
                "preview@gsf-investor.local",
              name: "Design Preview",
            };
          },
        }),
      ]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers,
  callbacks: {
    signIn({ profile, account }) {
      if (account?.provider === DEV_PREVIEW_PROVIDER_ID) return true;
      if (!ALLOWED_EMAIL) return false;
      return profile?.email === ALLOWED_EMAIL;
    },
    session({ session }) {
      return session;
    },
    jwt({ token, profile, user }) {
      if (profile?.email) token.email = profile.email;
      if (user?.email) token.email = user.email;
      return token;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
