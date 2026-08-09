'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, FileText, Newspaper, Radio, Search } from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { playMorningEventSound } from '@/lib/game/audio';
import { ROLE_LABELS } from '@/lib/game/roles';
import type { Role } from '@/types/game';

export function MorningReporterNews({
  targetName,
  role,
  targetAvatarId,
  onClose,
  onNext,
  hasNext,
}: {
  targetName: string;
  role?: Role | null;
  targetAvatarId?: string | null;
  onClose: () => void;
  onNext: () => void;
  hasNext: boolean;
}) {
  const roleLabel = role ? ROLE_LABELS[role] : '확인된 직업';

  useEffect(() => {
    void playMorningEventSound('REPORTER_NEWS').catch(() => {
      /* 오디오 정책에 막혀도 신문 연출은 계속한다 */
    });
  }, []);

  return (
    <motion.section
      role="dialog"
      aria-modal="true"
      aria-labelledby="morning-result-title"
      initial={{ opacity: 0, y: -24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="relative overflow-hidden rounded-[0.35rem] border-[6px] border-[#6f211b] bg-[#ead9b7] text-[#2b2017] shadow-2xl shadow-black/70"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 22%, rgba(93,54,24,.22) 0 1px, transparent 1.5px), repeating-linear-gradient(8deg, rgba(102,65,31,.08) 0 1px, transparent 1px 7px)',
          backgroundSize: '17px 19px, 100% 100%',
        }}
      />

      <div className="relative border-b-2 border-[#6f211b] bg-[#8d2b20] px-4 py-3 text-[#fff6dc] sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-black tracking-[0.16em] sm:text-sm">
            <Radio className="h-4 w-4 animate-pulse" />
            X-마피아 신문 특보
          </p>
          <span className="rounded-sm border border-[#f8d889]/70 px-2 py-1 text-[9px] font-black uppercase tracking-[0.24em] text-[#f8d889]">
            Extra Edition
          </span>
        </div>
      </div>

      <div className="relative px-4 pb-4 pt-5 sm:px-6 sm:pb-6">
        <div className="flex items-center justify-between border-b border-[#6f211b]/50 pb-2 text-[9px] font-black uppercase tracking-[0.2em] text-[#6f211b]">
          <span className="inline-flex items-center gap-1.5">
            <Newspaper className="h-3.5 w-3.5" />
            Morning Gazette
          </span>
          <span>긴급 발행 · 전원 공개</span>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#8d2b20]">
          <Search className="h-4 w-4" />
          Reporter&apos;s Exclusive
          <FileText className="h-4 w-4" />
        </div>

        <motion.h2
          id="morning-result-title"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-3 text-center font-serif text-3xl font-black leading-none tracking-tight text-[#2b2017] sm:text-4xl"
        >
          {targetName}의 충격적 정체 밝혀져!
        </motion.h2>

        <div className="my-5 grid gap-4 border-y-4 border-double border-[#2b2017]/80 py-4 sm:grid-cols-[8.5rem_1fr] sm:items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 240, damping: 18 }}
            className="relative mx-auto w-36 border-[5px] border-[#d7bd8c] bg-[#d7bd8c] p-1.5 shadow-lg shadow-black/25 sm:mx-0 sm:w-full"
          >
            <CharacterAvatar
              avatarId={targetAvatarId}
              isAlive
              size={120}
              className="mx-auto"
            />
            <span className="absolute bottom-2 left-2 bg-[#2b2017]/85 px-1.5 py-0.5 text-[8px] font-black tracking-[0.16em] text-[#f6e5bd]">
              PHOTO
            </span>
            <Camera className="absolute right-2 top-2 h-4 w-4 text-[#f6e5bd] drop-shadow" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center sm:text-left"
          >
            <p className="text-sm font-bold leading-relaxed text-[#594431]">
              {targetName} 님의 진짜 직업은
            </p>
            <p className="mt-1 font-serif text-3xl font-black text-[#8d2b20] sm:text-4xl">
              {roleLabel}
            </p>
            <p className="mt-1 text-sm font-bold leading-relaxed text-[#594431]">
              인 것으로 확인되었습니다.
            </p>
          </motion.div>
        </div>

        <div className="flex items-center justify-between gap-3 text-[10px] font-black text-[#6f211b]/75">
          <span>특종 제보 · 기자단</span>
          <span>본 신문은 모든 참가자에게 공개됩니다.</span>
        </div>
      </div>

      <div className="relative flex gap-3 border-t border-[#6f211b]/35 bg-[#d9c49a]/70 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl bg-[#2b2017]/10 py-3 text-sm font-black text-[#4d3624] transition hover:bg-[#2b2017]/20"
        >
          닫기
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 rounded-xl bg-[#8d2b20] py-3 text-sm font-black text-[#fff6dc] shadow-lg shadow-[#6f211b]/25 transition hover:bg-[#a33b2d]"
        >
          {hasNext ? '다음 결과' : '확인'}
        </button>
      </div>
    </motion.section>
  );
}
