'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { ROLE_ACCENTS, ROLE_BLURBS, ROLE_LABELS } from '@/lib/game/roles';
import type { CitizenMission, MafiaMission, Role } from '@/types/game';

export function RoleCard({
  role,
  citizenMission,
  mafiaMission,
}: {
  role: Role;
  citizenMission?: CitizenMission | null;
  mafiaMission?: MafiaMission | null;
}) {
  const [flipped, setFlipped] = useState(false);
  const isMafia = role === 'MAFIA';
  const accent = ROLE_ACCENTS[role];

  return (
    <div className="w-full max-w-sm perspective-[1200px]">
      <button
        type="button"
        onClick={() => setFlipped((v) => !v)}
        className="relative h-72 w-full cursor-pointer text-left outline-none transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-amber-400/50 sm:h-80"
        style={{ transformStyle: 'preserve-3d' }}
        aria-label="직업 카드 뒤집기"
      >
        <motion.div
          className="absolute inset-0"
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.65, ease: [0.4, 0.1, 0.2, 1] }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* 앞면 */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-stone-800 to-stone-950 shadow-xl"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <Sparkles className="mb-4 h-11 w-11 text-amber-300" />
            <p className="text-xl font-black tracking-wide text-white">비밀 직업</p>
            <p className="mt-3 text-sm text-white/55">클릭 / 탭하여 확인</p>
          </div>

          {/* 뒷면 */}
          <div
            className="absolute inset-0 flex flex-col rounded-2xl p-5 shadow-xl sm:p-6"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: `linear-gradient(160deg, ${accent}, #1c1917 70%)`,
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
              Your Role
            </p>
            <h2 className="mt-1 text-3xl font-black text-white">
              {ROLE_LABELS[role]}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-white/85">
              {ROLE_BLURBS[role]}
            </p>

            {isMafia && (
              <div className="mt-auto space-y-2 pt-3">
                {citizenMission && (
                  <div className="rounded-lg bg-black/35 px-2.5 py-2">
                    <p className="text-[10px] font-bold text-amber-200">시민 미션 (참고)</p>
                    <p className="text-[11px] leading-snug text-white/90">
                      {citizenMission.description}
                    </p>
                  </div>
                )}
                {mafiaMission && (
                  <div className="rounded-lg bg-red-950/70 px-2.5 py-2 ring-1 ring-red-400/40">
                    <p className="text-[10px] font-bold text-red-200">X맨 비밀 미션</p>
                    <p className="text-[11px] leading-snug text-white/90">
                      {mafiaMission.description}
                    </p>
                  </div>
                )}
              </div>
            )}

            {!isMafia && (
              <p className="mt-auto text-[11px] text-white/50">다시 탭하면 숨깁니다</p>
            )}
          </div>
        </motion.div>
      </button>
    </div>
  );
}
