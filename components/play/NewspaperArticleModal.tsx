'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Newspaper,
  Radio,
} from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { playReporterNewsSound } from '@/lib/game/audio';
import { getCharacterStateForRole } from '@/lib/characterUtils';
import { ROLE_LABELS } from '@/lib/game/roles';
import type { Role } from '@/types/game';

export function NewspaperArticleModal({
  targetName,
  role,
  targetAvatarId,
  onClose,
  onNext,
  hasNext = false,
  hideActions = false,
  displayMode = false,
  playSound = true,
  className = '',
}: {
  targetName: string;
  role?: Role | null;
  targetAvatarId?: string | null;
  onClose?: () => void;
  onNext?: () => void;
  hasNext?: boolean;
  hideActions?: boolean;
  displayMode?: boolean;
  playSound?: boolean;
  className?: string;
}) {
  const roleLabel = role ? ROLE_LABELS[role] : '확인된 직업';

  useEffect(() => {
    if (!playSound) return;
    void playReporterNewsSound().catch(() => {
      /* 자동 재생이 차단되어도 신문 연출은 계속한다. */
    });
  }, [playSound]);

  return (
    <motion.section
      role="dialog"
      aria-modal="true"
      aria-labelledby="morning-result-title"
      initial={{ opacity: 0, y: -24, rotate: -1.5, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={`relative w-full overflow-hidden border-[6px] border-[#6f211b] bg-[#ead9b7] text-[#2b2017] shadow-2xl shadow-black/70 ${
        displayMode
          ? 'min-h-[58vh] max-w-7xl rounded-[0.5rem] border-[8px]'
          : 'rounded-[0.35rem]'
      } ${className}`}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        animate={{ backgroundPosition: ['0% 0%', '15% 8%', '-10% 14%', '0% 0%'] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 22%, rgba(93,54,24,.3) 0 1px, transparent 1.5px), repeating-linear-gradient(8deg, rgba(102,65,31,.1) 0 1px, transparent 1px 7px)',
          backgroundSize: '17px 19px, 100% 100%',
        }}
      />

      <header className="relative border-b-4 border-[#6f211b] bg-[#8d2b20] px-5 py-4 text-[#fff6dc] sm:px-8 sm:py-5">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-black tracking-[0.16em] sm:text-lg">
            <Radio className="h-5 w-5 animate-pulse" />
            X-마피아 신문 특보
          </p>
          <span className="rounded-sm border border-[#f8d889]/70 px-2 py-1 text-[9px] font-black tracking-[0.24em] text-[#f8d889] sm:text-xs">
            특별판
          </span>
        </div>
      </header>

      <div className={`relative grid gap-6 ${displayMode ? 'p-7 sm:grid-cols-[minmax(16rem,0.85fr)_minmax(0,1.15fr)] sm:gap-10 sm:p-12 lg:p-16' : 'px-4 pb-5 pt-5 sm:px-6 sm:pb-6'}`}>
        <div className="min-w-0">
          <div className="flex items-center justify-between border-b border-[#6f211b]/50 pb-2 text-[9px] font-black uppercase tracking-[0.2em] text-[#6f211b] sm:text-xs">
            <span className="inline-flex items-center gap-1.5">
              <Newspaper className="h-3.5 w-3.5" />
              아침 신문
            </span>
            <span>긴급 발행 · 전원 공개</span>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#8d2b20] sm:text-sm">
            <FileText className="h-4 w-4" />
            취재 대상 공개
            <FileText className="h-4 w-4" />
          </div>

          <div className="mt-5 flex justify-center">
            <div className="relative w-full max-w-[25rem] rounded-2xl border-2 border-[#b79a68] bg-[#d7bd8c] p-5 text-center shadow-xl shadow-black/25">
              <CharacterAvatar
                avatarId={targetAvatarId}
                isAlive
                state={getCharacterStateForRole(role)}
                size={displayMode ? 300 : 136}
                className="mx-auto"
              />
              <p className="mt-4 truncate text-xl font-black tracking-tight text-[#2b2017] sm:text-3xl">
                {targetName}
              </p>
              <p className="mt-1 text-[10px] font-black tracking-[0.16em] text-[#6f211b] sm:text-sm">
                취재 대상 학생
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 self-center rounded-2xl border-2 border-[#6f211b]/35 bg-[#fff7df]/85 p-5 text-center shadow-inner shadow-[#6f211b]/10 sm:p-8 sm:text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#8d2b20] sm:text-sm">
            특보 헤드라인
          </p>
          <h2
            id="morning-result-title"
            className={`mt-3 text-balance font-serif font-black leading-[1.08] tracking-tight text-[#2b2017] ${displayMode ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-4xl'}`}
          >
            {targetName}의 충격적 정체 밝혀져!
          </h2>
          <div className="mt-6 border-y-4 border-double border-[#2b2017]/70 py-5">
            <p className="text-sm font-bold leading-relaxed text-[#594431] sm:text-xl">
              {targetName} 님의 진짜 직업은
            </p>
            <p className={`mt-2 font-serif font-black text-[#8d2b20] ${displayMode ? 'text-5xl sm:text-7xl' : 'text-4xl sm:text-5xl'}`}>
              {roleLabel}
            </p>
            <p className="mt-2 text-sm font-bold leading-relaxed text-[#594431] sm:text-xl">
              인 것으로 확인되었습니다.
            </p>
          </div>
          <p className="mt-5 text-[10px] font-black leading-relaxed text-[#6f211b]/75 sm:text-sm">
            사진과 기사는 서로 겹치지 않는 독립 영역으로 구성되었습니다.
          </p>
        </div>
      </div>

      <div className="relative flex items-center justify-between gap-3 border-t border-[#6f211b]/35 bg-[#d9c49a]/75 px-4 py-3 text-[10px] font-black text-[#6f211b]/75 sm:px-6 sm:text-xs">
        <span>특종 제보 · 기자단</span>
        <span>본 신문은 모든 참가자에게 공개됩니다.</span>
      </div>

      {!hideActions && onClose && onNext && (
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
      )}
    </motion.section>
  );
}
