import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL!;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      // 1인 전용: 본인 Gmail만 허용
      return profile?.email === ALLOWED_EMAIL;
    },
    session({ session, token }) {
      return session;
    },
    jwt({ token, profile }) {
      if (profile) {
        token.email = profile.email;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
