import Link from 'next/link';
import { Shield } from 'lucide-react';
import { signIn } from '@/auth';

export function AdminLoginGate({
  authError,
}: {
  authError?: string | null;
}) {
  return (
    <>
      <div className="mb-8 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-sm font-bold text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
        >
          메인
        </Link>
      </div>

      <header className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-black tracking-wider text-amber-200">
          <Shield className="h-3.5 w-3.5" />
          ADMIN
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight">관리자 로그인</h1>
        <p className="mt-2 text-sm text-white/55">
          등록된 선생님 Google 계정으로만 접속할 수 있습니다.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-sm sm:p-6">
        {authError && (
          <p className="mb-4 rounded-xl bg-red-950/60 px-4 py-3 text-sm font-semibold text-red-100 ring-1 ring-red-400/30">
            {authError === 'Configuration'
              ? 'Google 로그인 설정이 완료되지 않았습니다. 환경변수를 확인해 주세요.'
              : authError === 'AccessDenied'
                ? '관리자 권한이 없는 계정입니다.'
                : '로그인에 실패했습니다. 다시 시도해 주세요.'}
          </p>
        )}

        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/admin' });
          }}
        >
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-black text-stone-900 transition hover:bg-amber-100"
          >
            <GoogleMark />
            Google 계정으로 로그인
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-white/40">
          허용된 관리자 이메일만 통과합니다.
        </p>
      </section>
    </>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.7 3.7 14.5 2.7 12 2.7 6.9 2.7 2.7 6.9 2.7 12S6.9 21.3 12 21.3c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.8H12z"
      />
    </svg>
  );
}
