'use client';

import { motion } from 'framer-motion';
import { Crosshair, Swords } from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { ScreenFlashOverlay } from '@/components/play/ScreenFlashOverlay';
import { useMafiaKillReveal } from '@/hooks/useMafiaKillReveal';

export function PublicMafiaKillScene({
  targetName,
  avatarId,
  avatarSize,
  wasKilled,
  targetKey,
}: {
  targetName: string;
  avatarId?: string | null;
  avatarSize: number;
  wasKilled: boolean;
  targetKey: string | null;
}) {
  const { impactReady, showWhiteFlash } = useMafiaKillReveal(wasKilled, targetKey);
  const showDeadVisual = wasKilled && impactReady;

  return (
    <motion.section
      key="public-mafia-kill"
      initial={{ opacity: 0, scale: 0.9, x: 24 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      className={`morning-panel-shake relative w-full max-w-6xl overflow-hidden rounded-[2rem] border border-red-300/35 bg-[#0a0816]/85 text-white shadow-2xl shadow-red-950/60 ${showDeadVisual ? 'morning-dead-reveal' : ''}`}
    >
      <ScreenFlashOverlay active={showWhiteFlash} variant="white" />
      <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-red-700 via-rose-300 to-red-700" />
      <div className="pointer-events-none absolute left-[12%] top-[12%] h-24 w-24 rounded-full bg-slate-100/15 blur-[1px] sm:h-36 sm:w-36" />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[-12%] bottom-0 h-1/2 bg-gradient-to-t from-slate-100/10 via-slate-300/5 to-transparent blur-2xl"
        animate={{ x: ['-4%', '4%', '-4%'], opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="relative z-10 grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1.25fr_1fr] lg:p-14">
        <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-3xl border border-red-200/25 bg-[radial-gradient(circle_at_50%_45%,rgba(127,29,29,0.85),rgba(11,10,25,0.92)_70%)] shadow-2xl shadow-red-950/50 sm:h-[25rem]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(2,6,23,.88),transparent_62%),radial-gradient(circle_at_50%_22%,rgba(148,163,184,.16),transparent_32%)]" />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-12 bottom-0 h-1/3 bg-slate-300/10 blur-xl"
            animate={{ x: ['-8%', '8%', '-8%'], opacity: [0.2, 0.55, 0.2] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <CharacterAvatar
            avatarId={avatarId}
            isAlive={!showDeadVisual}
            state={showDeadVisual ? 'dead' : null}
            size={avatarSize}
            className="relative z-10"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-red-950/20" />
          <div
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-red-100 drop-shadow-[0_0_18px_rgba(248,113,113,.9)] transition-opacity duration-200 ${showDeadVisual ? 'opacity-0' : 'opacity-100'}`}
          >
            <Crosshair className="h-24 w-24 sm:h-36 sm:w-36" strokeWidth={1.2} />
          </div>
          {showDeadVisual && (
            <span className="morning-bullet-impact pointer-events-none absolute left-1/2 top-1/2 z-30 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#030308] ring-2 ring-red-200/90 shadow-[0_0_18px_6px_rgba(248,113,113,0.65)] sm:h-10 sm:w-10" />
          )}
          <div className="absolute bottom-4 left-4 rounded-full bg-black/65 px-4 py-2 text-sm font-black text-red-100 ring-1 ring-red-200/25 sm:text-lg">
            {targetName}
          </div>
        </div>
        <div className="text-center lg:text-left">
          <div className="flex items-center justify-center gap-3 text-sm font-black uppercase tracking-[0.3em] text-red-200 lg:justify-start sm:text-lg">
            <Swords className="h-6 w-6 animate-pulse" />
            마피아 공격 경보
          </div>
          <h1 className="mt-6 text-balance text-4xl font-black leading-tight text-red-50 sm:text-6xl">
            {showDeadVisual
              ? `${targetName} 님이 탈락했습니다`
              : wasKilled
                ? '마피아의 공격이 감지되었습니다…'
                : '마피아의 공격이 감지되었습니다'}
          </h1>
          <p className="mt-5 text-lg font-bold leading-relaxed text-red-100/75 sm:text-2xl">
            {showDeadVisual
              ? '지난밤 마을에서 공격을 받아 더 이상 게임에 참여할 수 없습니다.'
              : wasKilled
                ? `${targetName} 님에게 무언가 일어나고 있습니다.`
                : `${targetName} 님이 공격 대상이었지만 아직 생존해 있습니다.`}
          </p>
        </div>
      </div>
    </motion.section>
  );
}
