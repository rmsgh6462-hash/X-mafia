'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { LockKeyhole, Siren } from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { playMafiaJailSound } from '@/lib/game/audio';
import { getCharacterPronoun, getCharacterStateForRole } from '@/lib/characterUtils';
import { ROLE_LABELS } from '@/lib/game/roles';
import type { PlayerGender, Role } from '@/types/game';

/**
 * 투표 체포 뒤 정체 공개가 허용된 경우에만 사용하는 공개 수감 장면.
 * arrested.png를 먼저 보여주고, 철창이 내려오며 마피아 여부에 맞는 색과 문구를 보여준다.
 */
export function JailCaptureScene({
  avatarId,
  name,
  isMafia,
  role,
  gender,
  finalRoleReveal = false,
  displayMode = false,
  playSound = true,
}: {
  avatarId: string;
  name: string;
  isMafia: boolean;
  role?: Role | null;
  gender?: PlayerGender | null;
  finalRoleReveal?: boolean;
  displayMode?: boolean;
  playSound?: boolean;
}) {
  useEffect(() => {
    if (!playSound || !isMafia) return;
    void playMafiaJailSound().catch(() => {
      /* 브라우저 자동 재생 제한 시에도 화면 연출은 계속한다. */
    });
  }, [isMafia, playSound]);

  const imageSize = displayMode ? 440 : 188;
  const pronoun = getCharacterPronoun(gender);
  const shellClass = displayMode
    ? 'min-h-[70vh] w-full max-w-7xl rounded-[2rem] p-6 sm:p-10'
    : 'w-full rounded-2xl p-4';

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.92, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 22 }}
      className={`relative isolate overflow-hidden border shadow-2xl ${
        isMafia
          ? 'border-red-300/45 bg-[#16070a] shadow-red-950/80'
          : 'border-sky-300/40 bg-[#071321] shadow-sky-950/70'
      } ${shellClass}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 ${
          isMafia
            ? 'bg-[radial-gradient(circle_at_50%_35%,rgba(185,28,28,.48),transparent_42%),linear-gradient(140deg,#050508,#2a0b11_52%,#090b14)]'
            : 'bg-[radial-gradient(circle_at_50%_35%,rgba(14,116,144,.42),transparent_42%),linear-gradient(140deg,#020617,#082f49_52%,#07111f)]'
        }`}
      />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(135deg,transparent_0,transparent_8%,rgba(148,163,184,.18)_8.4%,transparent_9%,transparent_16%)]" />

      <motion.div
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 z-30 h-3 ${
          isMafia ? 'bg-red-500' : 'bg-sky-400'
        }`}
        animate={isMafia ? { opacity: [0.35, 1, 0.35] } : { opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: isMafia ? 0.72 : 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute right-6 top-6 z-30 flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-black tracking-[0.16em] text-white/75">
        {isMafia ? <Siren className="h-4 w-4 text-red-300" /> : <LockKeyhole className="h-4 w-4 text-sky-300" />}
        {isMafia ? '마피아 수감' : '시민 수감'}
      </div>

      <div className="relative z-10 grid min-h-full items-center gap-8 lg:grid-cols-[1.05fr_1fr]">
        <div className="relative flex min-h-[42vh] items-center justify-center overflow-hidden rounded-3xl border border-white/15 bg-black/25 p-5 sm:min-h-[52vh]">
          <div className={`pointer-events-none absolute inset-x-[18%] top-[8%] h-3/4 rounded-full blur-3xl ${isMafia ? 'bg-red-500/25' : 'bg-sky-400/20'}`} />
          <motion.div
            initial={{ scale: 0.78, opacity: 0, rotate: -3 }}
            animate={{ scale: [0.96, 1.03, 1], opacity: 1, rotate: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="relative z-10"
          >
            <CharacterAvatar
              avatarId={avatarId}
              isAlive
              state={role ? getCharacterStateForRole(role) : 'arrested'}
              role={role}
              revealRole={Boolean(role)}
              size={imageSize}
              className="drop-shadow-[0_22px_30px_rgba(0,0,0,.7)]"
            />
          </motion.div>

          <motion.div
            aria-hidden="true"
            initial={{ y: '-112%' }}
            animate={{ y: '0%' }}
            transition={{ delay: 0.28, duration: 0.82, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-[-8%] z-20 opacity-90 [background:repeating-linear-gradient(90deg,transparent_0,transparent_8.5%,rgba(226,232,240,.1)_9%,rgba(2,6,23,.92)_10.1%,rgba(226,232,240,.52)_10.8%,rgba(2,6,23,.92)_11.6%,transparent_12.5%,transparent_21%)]"
          />
          <motion.div
            aria-hidden="true"
            initial={{ y: '-120%' }}
            animate={{ y: '0%' }}
            transition={{ delay: 0.34, duration: 0.82, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-2 bg-white/35 shadow-[0_0_18px_rgba(226,232,240,.8)]"
          />

          <div className={`absolute bottom-4 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap border px-4 py-2 text-center font-mono text-xs font-black tracking-[0.18em] shadow-xl sm:text-sm ${isMafia ? 'border-red-300/50 bg-red-950/90 text-red-100' : 'border-sky-300/45 bg-sky-950/90 text-sky-100'}`}>
            <span className="mr-2 opacity-60">NO. X-{name.slice(0, 8).toUpperCase()}</span>
            수감자: {name}
          </div>
        </div>

        <div className="relative text-center lg:text-left">
          <p className={`text-sm font-black uppercase tracking-[0.32em] ${isMafia ? 'text-red-300' : 'text-sky-300'}`}>
            {finalRoleReveal
              ? `직업 공개 · ${role ? ROLE_LABELS[role] : '직업 공개'}`
              : isMafia
                ? '긴급 경보 · 마피아 수감'
                : '오검 체포 · 시민 수감'}
          </p>
          <h2 className={`mt-5 text-balance text-4xl font-black leading-tight sm:text-6xl ${isMafia ? 'text-red-50' : 'text-sky-50'}`}>
            {finalRoleReveal
              ? `${pronoun}의 정체는 ${role ? ROLE_LABELS[role] : '알 수 없는 직업'}이었습니다.`
              : isMafia
                ? '지목된 변장자는... 마피아가 맞습니다!'
                : '안타깝게도 선량한 시민이 감옥에 갇혔습니다...'}
          </h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.95, duration: 0.45 }}
            className="mt-6 text-2xl font-black leading-relaxed text-white sm:text-4xl"
          >
            {finalRoleReveal
              ? `${name} 님의 직업 캐릭터가 공개되었습니다.`
              : isMafia
                ? `${name} 마피아가 감옥에 갇혔습니다!`
                : `${name} 님은 투표로 감옥에 갇혔습니다.`}
          </motion.p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-4 py-2 text-sm font-bold text-white/70 sm:text-base">
            <LockKeyhole className="h-4 w-4" />
            철창 수감 연출 · 체포 상태 공개
          </p>
        </div>
      </div>
    </motion.section>
  );
}
