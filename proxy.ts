import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdminEmail } from '@/lib/auth/admin';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const email = req.auth?.user?.email;
  const loggedIn = Boolean(email);

  // 미로그인: 관리자 페이지에서 로그인 UI를 보여 준다.
  if (!loggedIn) {
    return NextResponse.next();
  }

  // 로그인됐지만 화이트리스트에 없으면 메인으로 돌려보낸다.
  if (!isAdminEmail(email)) {
    const url = new URL('/', req.nextUrl.origin);
    url.searchParams.set('adminError', 'forbidden');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/admin/:path*'],
};
