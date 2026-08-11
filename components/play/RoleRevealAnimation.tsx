'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Clock3,
  Eye,
  HeartPulse,
  Newspaper,
  Shield,
  Skull,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { getCharacterImageUrl, getCharacterStateForRole } from '@/lib/characterUtils';
import { playRoleRevealSound } from '@/lib/game/audio';
import { ROLE_ACCENTS, ROLE_LABELS } from '@/lib/game/roles';
import type { Role } from '@/types/game';

const ROLE_COPY: Record<Role, string> = {
  MAFIA: '밤에 한 명을 골라 공격하고, 들키지 않게 시민들 사이에 숨어요.',
  DOCTOR: '밤에 한 명을 치료해 마피아의 공격으로부터 지켜줘요.',
  POLICE: '밤에 한 명을 조사해 마피아인지 확인할 수 있어요.',
  REPORTER: '밤에 한 명을 취재하면 다음 날 그 학생의 직업이 모두에게 공개돼요.',
  SPIRITUALIST: '탈락한 학생을 살펴보고 그 학생의 진짜 직업을 확인할 수 있어요.',
  CITIZEN: '토론과 투표로 마피아를 찾아 마을을 지켜요.',
};

const ROLE_ICONS: Record<Role, typeof Skull> = {
  MAFIA: Skull,
  DOCTOR: HeartPulse,
  POLICE: Shield,
  REPORTER: Newspaper,
  SPIRITUALIST: WandSparkles,
  CITIZEN: Eye,
};

const PARTICLES = Array.from({ length: 12 }, (_, index) => index);

export function RoleRevealAnimation({
  open,
  role,
  avatarId,
  playerName,
  onClose,
}: {
  open: boolean;
  role: Role;
  avatarId?: string | null;
  playerName: string;
  onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [confirmSeconds, setConfirmSeconds] = useState(5);
  const revealedRef = useRef(false);

  const revealCard = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setRevealed(true);
    setConfirmSeconds(5);
    void playRoleRevealSound(role);
  }, [role]);

  useEffect(() => {
    if (!open) {
      revealedRef.current = false;
      return;
    }

    // GAME_START 직후 앞면 자원을 먼저 캐시해 회전 중 흰 화면이 보이지 않게 한다.
    const characterId = avatarId ?? 'M0';
    const roleState = getCharacterStateForRole(role);
    [
      getCharacterImageUrl(characterId, 'normal'),
      getCharacterImageUrl(characterId, roleState),
    ].forEach((src) => {
      const image = new window.Image();
      image.decoding = 'async';
      image.src = src;
    });

    const resetTimer = window.setTimeout(() => {
      setRevealed(false);
      setConfirmSeconds(5);
    }, 0);
    const autoRevealTimer = window.setTimeout(revealCard, 3000);

    return () => {
      window.clearTimeout(resetTimer);
      window.clearTimeout(autoRevealTimer);
    };
  }, [avatarId, open, revealCard, role]);

  useEffect(() => {
    if (!open || !revealed) return;
    const timer = window.setInterval(() => {
      setConfirmSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, revealed]);

  const RoleIcon = ROLE_ICONS[role];
  const accent = ROLE_ACCENTS[role];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex min-h-dvh items-center justify-center overflow-y-auto bg-slate-950/90 px-4 py-6 backdrop-blur-md sm:px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(59,130,246,0.22),transparent_45%),radial-gradient(circle_at_50%_100%,rgba(245,158,11,0.12),transparent_55%)]"
            animate={{ opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.div
            className="relative flex w-full max-w-[22rem] flex-col items-center"
            initial={{ y: 26, scale: 0.94 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -220, scale: 0.42, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <div className="mb-4 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-sky-200/70">
                X-MAFIA · SECRET ROLE
              </p>
              <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">
                {revealed ? '당신의 직업이 공개되었습니다' : '당신의 직업을 확인하는 중...'}
              </h1>
              <p className="mt-2 text-xs font-bold text-white/55">{playerName} 학생만 확인하세요</p>
            </div>

            <div className="relative h-[min(70vh,34rem)] w-full [perspective:1200px]">
              <motion.div
                className="absolute inset-0 transform-gpu will-change-transform"
                animate={{ rotateY: revealed ? 180 : 0 }}
                transition={{ duration: 0.9, ease: [0.22, 0.8, 0.24, 1] }}
                style={{ transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }}
              >
                <div
                  className="absolute inset-0 overflow-hidden rounded-[2rem] border border-sky-200/35 bg-[linear-gradient(145deg,#172554,#111827_56%,#312e81)] p-6 shadow-[0_0_70px_rgba(56,189,248,0.3)]"
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                  <motion.div
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-20 rounded-full bg-cyan-300/10 blur-3xl"
                    animate={{ scale: [0.85, 1.1, 0.85], opacity: [0.45, 0.8, 0.45] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <div className="relative flex h-full flex-col items-center justify-between text-center">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-sky-200/80">
                      <Sparkles className="h-4 w-4 animate-pulse" />
                      Secret Identity
                      <Sparkles className="h-4 w-4 animate-pulse" />
                    </div>

                    <div className="relative flex flex-col items-center">
                      <motion.div
                        className="absolute -inset-8 rounded-full border border-cyan-200/20"
                        animate={{ rotate: 360, scale: [0.9, 1, 0.9] }}
                        transition={{ rotate: { duration: 8, repeat: Infinity, ease: 'linear' }, scale: { duration: 2, repeat: Infinity } }}
                      />
                      <div className="relative flex h-32 w-32 items-center justify-center rounded-full border border-cyan-100/35 bg-white/10 shadow-[0_0_40px_rgba(103,232,249,0.35)] sm:h-36 sm:w-36">
                        <span className="text-7xl font-black tracking-tight text-white drop-shadow-[0_0_20px_rgba(125,211,252,0.8)]">
                          X
                        </span>
                      </div>
                      <p className="mt-8 text-xl font-black text-white">비밀 직업 카드</p>
                      <p className="mt-2 text-sm font-bold text-sky-100/65">
                        카드를 눌러 직업을 확인하세요
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={revealCard}
                      className="relative w-full rounded-2xl bg-sky-300 px-5 py-4 text-base font-black text-slate-950 shadow-[0_0_26px_rgba(125,211,252,0.3)] transition hover:bg-sky-200 active:scale-[0.98]"
                    >
                      직업 확인하기
                    </button>
                  </div>
                </div>

                <div
                  className="absolute inset-0 overflow-hidden rounded-[2rem] border border-white/25 p-5 shadow-2xl sm:p-6"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  background: `linear-gradient(155deg, ${accent}, rgba(15,23,42,0.98) 78%)`,
                  }}
                >
                  <div className="relative flex h-full flex-col">
                    {PARTICLES.map((particle) => (
                      <motion.span
                        key={particle}
                        aria-hidden="true"
                        className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_12px_rgba(253,230,138,0.9)]"
                        style={{
                          left: `${8 + ((particle * 37) % 84)}%`,
                          top: `${8 + ((particle * 53) % 78)}%`,
                        }}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: [0, 1, 0], scale: [0.4, 1.3, 0.4], y: [10, -14, -28] }}
                        transition={{ duration: 1.8, delay: particle * 0.04, repeat: Infinity, repeatDelay: 1.1 }}
                      />
                    ))}

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/65">
                          Your role
                        </p>
                        <h2 className="mt-1 text-4xl font-black text-white">
                          {ROLE_LABELS[role]}
                        </h2>
                      </div>
                      <div className="rounded-2xl bg-black/20 p-3 ring-1 ring-white/25">
                        <RoleIcon className="h-7 w-7 text-white" />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-1 flex-col items-center justify-center">
                      <CharacterAvatar
                        avatarId={avatarId}
                        isAlive
                        state={getCharacterStateForRole(role)}
                        size={142}
                        className="ring-4 ring-white/40 shadow-[0_0_34px_rgba(255,255,255,0.35)] sm:h-[154px] sm:w-[154px]"
                      />
                      <p className="mt-4 text-center text-sm font-bold text-white/75">{playerName}</p>
                      <div className="mt-5 w-full rounded-2xl bg-black/25 p-4 ring-1 ring-white/20">
                        <p className="flex items-center gap-2 text-xs font-black text-white/70">
                          <Sparkles className="h-4 w-4 text-amber-200" />
                          나의 미션
                        </p>
                        <p className="mt-2 text-sm font-bold leading-relaxed text-white">
                          {ROLE_COPY[role]}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-base font-black text-slate-900 shadow-xl transition hover:bg-slate-100 active:scale-[0.98]"
                    >
                      <Check className="h-5 w-5" />
                      확인했습니다 ({confirmSeconds}초)
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-white/45">
              <Clock3 className="h-3.5 w-3.5" />
              {revealed ? '역할을 확인한 뒤 아래 버튼을 눌러 계속하세요.' : '3초 후 카드가 자동으로 뒤집힙니다.'}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
