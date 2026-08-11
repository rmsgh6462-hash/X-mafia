import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import { isAdminEmail } from '@/lib/auth/admin';

/**
 * Edge(middleware)에서도 안전하게 쓸 수 있는 Auth 설정.
 * Google Client ID/Secret은 AUTH_GOOGLE_* 또는 GOOGLE_CLIENT_* 를 모두 지원한다.
 */
export const authConfig = {
  providers: [
    Google({
      clientId:
        process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID,
      clientSecret:
        process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: '/admin',
    error: '/admin',
  },
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      if (!path.startsWith('/admin')) return true;

      // 미로그인: 페이지에서 Google 로그인 버튼을 보여 준다.
      if (!auth?.user) return true;

      // 로그인됐지만 관리자가 아니면 차단.
      return isAdminEmail(auth.user.email);
    },
    async signIn({ user }) {
      if (!isAdminEmail(user.email)) {
        return '/?adminError=forbidden';
      }
      return true;
    },
    async jwt({ token }) {
      token.isAdmin = isAdminEmail(
        typeof token.email === 'string' ? token.email : null,
      );
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.isAdmin = token.isAdmin === true;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
  trustHost: true,
} satisfies NextAuthConfig;
