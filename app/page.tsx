import Link from 'next/link';
import { Monitor, Settings, Smartphone } from 'lucide-react';

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-stone-950 px-6 text-white">
      {/* 분위기용 배경 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(245,158,11,0.18),transparent_55%),radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(69,26,26,0.35),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <Link
        href="/admin"
        className="absolute right-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-black text-stone-900 shadow-lg shadow-black/40 transition hover:bg-amber-300 sm:right-6 sm:top-6 sm:text-sm"
      >
        <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        관리자
      </Link>

      <main className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-400/90">
          Classroom Game
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl md:text-6xl">
          X-MAFIA
          <span className="mt-2 block text-2xl font-bold tracking-[0.12em] text-white/75 sm:text-3xl md:text-4xl">
            SMART CLASS
          </span>
        </h1>
        <p className="mt-4 max-w-md text-sm text-white/50 sm:text-base">
          역할을 선택해 교실 게임을 시작하세요
        </p>

        <div className="mt-12 grid w-full gap-4 sm:grid-cols-2 sm:gap-5">
          <Link
            href="/host"
            className="group flex flex-col items-start rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left transition hover:border-amber-400/40 hover:bg-amber-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300 transition group-hover:bg-amber-400 group-hover:text-stone-900">
              <Monitor className="h-6 w-6" />
            </span>
            <span className="mt-5 text-xl font-black tracking-tight">
              교사 (대형 화면)
            </span>
            <span className="mt-2 text-sm leading-relaxed text-white/45">
              TV·프로젝터용 호스트 화면으로 이동
            </span>
          </Link>

          <Link
            href="/play"
            className="group flex flex-col items-start rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left transition hover:border-sky-400/40 hover:bg-sky-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300 transition group-hover:bg-sky-400 group-hover:text-stone-900">
              <Smartphone className="h-6 w-6" />
            </span>
            <span className="mt-5 text-xl font-black tracking-tight">
              학생 (모바일 접속)
            </span>
            <span className="mt-2 text-sm leading-relaxed text-white/45">
              스마트폰에서 PIN으로 게임에 참가
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
