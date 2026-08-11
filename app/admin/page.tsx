'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Save, Shield } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  defaultHostAccessConfig,
  loadHostAccessConfig,
  saveHostAccessConfig,
  type HostAccessConfig,
} from '@/lib/game/adminConfig';

export default function AdminPage() {
  const [config, setConfig] = useState<HostAccessConfig>(defaultHostAccessConfig());
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!isFirebaseConfigured()) {
          if (!cancelled) {
            setError(
              'Firebase가 설정되지 않았습니다. .env.local을 확인한 뒤 다시 시도하세요.',
            );
            setLoading(false);
          }
          return;
        }
        const loaded = await loadHostAccessConfig();
        if (cancelled) return;
        setConfig(loaded);
        setPasswordRequired(loaded.passwordRequired);
        setPassword(loaded.password);
        setConfirmPassword(loaded.password);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : '설정을 불러오지 못했습니다.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setMessage(null);
    setError(null);

    if (passwordRequired) {
      if (password.trim().length < 4) {
        setError('비밀번호는 4자 이상이어야 합니다.');
        return;
      }
      if (password !== confirmPassword) {
        setError('비밀번호 확인이 일치하지 않습니다.');
        return;
      }
    }

    setBusy(true);
    try {
      const next = await saveHostAccessConfig({
        passwordRequired,
        password: passwordRequired ? password : '',
      });
      setConfig(next);
      setPassword(next.password);
      setConfirmPassword(next.password);
      setMessage(
        next.passwordRequired
          ? '방 생성 시 비밀번호가 필요합니다. 설정을 저장했습니다.'
          : '방 생성 비밀번호를 사용하지 않습니다. 설정을 저장했습니다.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-stone-950 px-5 py-8 text-white sm:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_20%_0%,rgba(245,158,11,0.16),transparent_55%),radial-gradient(ellipse_50%_40%_at_90%_100%,rgba(30,58,138,0.28),transparent_50%)]"
      />

      <div className="relative z-10 mx-auto w-full max-w-lg">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-sm font-bold text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            메인
          </Link>
          <Link
            href="/host"
            className="rounded-lg bg-amber-400/90 px-3 py-2 text-sm font-black text-stone-900 transition hover:bg-amber-300"
          >
            교사 화면
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-black tracking-wider text-amber-200">
            <Shield className="h-3.5 w-3.5" />
            ADMIN
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight">관리자 설정</h1>
          <p className="mt-2 text-sm text-white/55">
            방 생성 시 비밀번호 사용 여부와 비밀번호를 설정합니다.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-sm sm:p-6">
          {loading ? (
            <p className="py-10 text-center text-sm text-white/50">설정을 불러오는 중…</p>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 rounded-xl bg-black/30 px-4 py-3 ring-1 ring-white/10">
                <div>
                  <p className="text-sm font-black text-white">방 생성 비밀번호</p>
                  <p className="mt-1 text-xs text-white/50">
                    ON이면 교사 화면에서 방을 만들 때 비밀번호를 입력해야 합니다.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || Boolean(error && !isFirebaseConfigured())}
                  onClick={() => setPasswordRequired((v) => !v)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition ${
                    passwordRequired
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/10 text-white/60'
                  } disabled:opacity-40`}
                >
                  {passwordRequired ? 'ON' : 'OFF'}
                </button>
              </div>

              {passwordRequired && (
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-white/60">
                      <KeyRound className="h-3.5 w-3.5" />
                      비밀번호
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="4자 이상"
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-amber-400/0 transition placeholder:text-white/30 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/30"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-white/60">
                      비밀번호 확인
                    </span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="다시 입력"
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-amber-400/0 transition placeholder:text-white/30 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/30"
                    />
                  </label>
                </div>
              )}

              <div className="rounded-xl bg-white/5 px-4 py-3 text-xs text-white/45 ring-1 ring-white/10">
                현재 상태:{' '}
                <span className="font-bold text-white/75">
                  {config.passwordRequired
                    ? '비밀번호 필요'
                    : '비밀번호 없음 (누구나 방 생성 가능)'}
                </span>
                {config.updatedAt > 0 && (
                  <span className="mt-1 block text-white/35">
                    마지막 저장:{' '}
                    {new Date(config.updatedAt).toLocaleString('ko-KR')}
                  </span>
                )}
              </div>

              {error && (
                <p className="rounded-xl bg-red-950/60 px-4 py-3 text-sm font-semibold text-red-100 ring-1 ring-red-400/30">
                  {error}
                </p>
              )}
              {message && (
                <p className="rounded-xl bg-emerald-950/50 px-4 py-3 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-400/30">
                  {message}
                </p>
              )}

              <button
                type="button"
                disabled={busy || loading || !isFirebaseConfigured()}
                onClick={() => void handleSave()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3.5 text-sm font-black text-stone-900 transition hover:bg-amber-300 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {busy ? '저장 중…' : '설정 저장'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
