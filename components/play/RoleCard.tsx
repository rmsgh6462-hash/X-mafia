'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Sparkles, Users } from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { ROLE_ACCENTS, ROLE_BLURBS, ROLE_LABELS } from '@/lib/game/roles';
import { type CharacterViewerRole } from '@/lib/characterUtils';
import type { Player, Role } from '@/types/game';

export function RoleCard({
  role,
  avatarId,
  isAlive = true,
  mafiaAllies = [],
  playerId = null,
  viewerRole = role,
  viewerPlayerId = playerId,
}: {
  role: Role;
  avatarId?: string | null;
  isAlive?: boolean;
  /** 마피아만 — 다른 마피아 동료 목록 */
  mafiaAllies?: Player[];
  /** 역할 카드의 대상 플레이어 ID */
  playerId?: string | null;
  /** 현재 역할 카드를 보는 주체. 기본값은 본인 역할이다. */
  viewerRole?: CharacterViewerRole | null;
  viewerPlayerId?: string | null;
}) {
  const [flipped, setFlipped] = useState(false);
  const isMafia = role === 'MAFIA';
  const accent = ROLE_ACCENTS[role];

  return (
    <div className="w-full max-w-sm">
      <div className="perspective-[1200px]">
        <motion.div
          className="relative h-72 w-full transform-gpu sm:h-80"
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.65, ease: [0.4, 0.1, 0.2, 1] }}
          style={{ transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d', willChange: 'transform' }}
        >
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-stone-800 to-stone-950 shadow-xl"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          >
            <Sparkles className="mb-4 h-11 w-11 text-amber-300" />
            <p className="text-xl font-black tracking-wide text-white">직업 카드</p>
            <p className="mt-3 text-sm text-white/55">아래 버튼으로 확인하세요</p>
          </div>

          <div
            className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl p-5 shadow-xl sm:p-6"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: `linear-gradient(160deg, ${accent}, #1c1917 70%)`,
            }}
          >
            <p className="text-[11px] font-semibold tracking-[0.16em] text-white/70">
              나의 직업
            </p>
            <h2 className="mt-1 text-3xl font-black text-white">
              {ROLE_LABELS[role]}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-white/85">
              {ROLE_BLURBS[role]}
            </p>

            {avatarId && (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2 ring-1 ring-white/10">
                <CharacterAvatar
                  avatarId={avatarId}
                  isAlive={isAlive}
                  state={isAlive ? null : 'dead'}
                  role={role}
                  viewerRole={viewerRole}
                  targetPlayerId={playerId}
                  viewerPlayerId={viewerPlayerId}
                  size={64}
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-wide text-white/45">
                    현재 캐릭터
                  </p>
                  <p className="mt-1 truncate text-sm font-black text-white">
                    {ROLE_LABELS[role]} 캐릭터
                  </p>
                </div>
              </div>
            )}

            <div className="mt-auto space-y-2 pt-3">
              {isMafia && (
                <div className="rounded-lg bg-black/40 px-2.5 py-2 ring-1 ring-red-400/30">
                  <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold text-red-200">
                    <Users className="h-3 w-3" />
                    마피아 동료
                  </p>
                  {mafiaAllies.length === 0 ? (
                    <p className="text-[11px] text-white/60">
                      다른 마피아가 없습니다. (혼자)
                    </p>
                  ) : (
                    <ul className="max-h-12 space-y-1 overflow-hidden">
                      {mafiaAllies.slice(0, 3).map((ally) => (
                        <li
                          key={ally.id}
                          className="flex items-center gap-2 text-[11px] font-bold text-white"
                        >
                          <CharacterAvatar
                            avatarId={ally.avatarId}
                            isAlive={ally.isAlive}
                            state={ally.isAlive ? null : 'dead'}
                            role={ally.role}
                            viewerRole={viewerRole}
                            targetPlayerId={ally.id}
                            viewerPlayerId={viewerPlayerId}
                            size={22}
                          />
                          <span className="truncate">{ally.name}</span>
                          <span className="shrink-0 rounded bg-red-500/80 px-1.5 py-0.5 text-[9px] font-black text-white">
                            마피아
                          </span>
                          {!ally.isAlive && (
                            <span className="text-[9px] text-white/40">탈락</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((v) => !v)}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-400 py-2.5 text-sm font-black text-stone-900 transition hover:bg-amber-300"
      >
        {flipped ? (
          <>
            <EyeOff className="h-4 w-4" />
            직업 카드 뒤집기
          </>
        ) : (
          <>
            <Eye className="h-4 w-4" />
            직업 카드 보기
          </>
        )}
      </button>
    </div>
  );
}
