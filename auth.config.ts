import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import { isAdminEmail } from '@/lib/auth/admin';

function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return '';
}

/** Google OAuth 클라이언트 정보가 서버 환경변수에 있는지 확인한다. */
export function isGoogleAuthConfigured(): boolean {
  const clientId = readEnv('GOOGLE_CLIENT_ID', 'AUTH_GOOGLE_ID');
  const clientSecret = readEnv('GOOGLE_CLIENT_SECRET', 'AUTH_GOOGLE_SECRET');
  return Boolean(clientId && clientSecret);
}

const googleClientId = readEnv('GOOGLE_CLIENT_ID', 'AUTH_GOOGLE_ID');
const googleClientSecret = readEnv(
  'GOOGLE_CLIENT_SECRET',
  'AUTH_GOOGLE_SECRET',
);

if (process.env.NODE_ENV !== 'production') {
  console.info('[auth] Google OAuth env', {
    hasGoogleClientId: Boolean(googleClientId),
    hasGoogleClientSecret: Boolean(googleClientSecret),
    hasAuthSecret: Boolean(
      readEnv('AUTH_SECRET', 'NEXTAUTH_SECRET'),
    ),
    hasAdminEmail: Boolean(
      readEnv('ADMIN_EMAIL', 'NEXT_PUBLIC_ADMIN_EMAIL'),
    ),
  });
}

/**
 * Edge(proxy/middleware)에서도 안전하게 쓸 수 있는 Auth 설정.
 * 우선순위: GOOGLE_CLIENT_* → AUTH_GOOGLE_*
 */
export const authConfig = {
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
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
