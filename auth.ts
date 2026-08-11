import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

const authSecret =
  process.env.AUTH_SECRET?.trim() ||
  process.env.NEXTAUTH_SECRET?.trim() ||
  undefined;

if (process.env.NODE_ENV !== 'production' && !authSecret) {
  console.warn(
    '[auth] AUTH_SECRET(또는 NEXTAUTH_SECRET)이 비어 있습니다. Google 로그인 Configuration 오류가 날 수 있습니다.',
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: authSecret,
});
