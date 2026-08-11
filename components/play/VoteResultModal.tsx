'use client';

import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { JailCaptureScene } from '@/components/play/JailCaptureScene';
import { Popup } from '@/components/play/Popup';
import { getCharacterStateForRole } from '@/lib/characterUtils';
import { ROLE_LABELS } from '@/lib/game/roles';
import type { DayVoteResult, Player, VoteResultRevealStep } from '@/types/game';

export function VoteResultModal({
  open,
  result,
  eliminatedPlayer,
  revealRoles,
  revealStep = 'ARREST',
  onClose,
}: {
  open: boolean;
  result: DayVoteResult | null | undefined;
  eliminatedPlayer?: Player | null;
  revealRoles: boolean;
  revealStep?: VoteResultRevealStep;
  onClose: () => void;
}) {
  const canRevealIdentity = Boolean(
    open && revealRoles && result?.eliminatedRole && eliminatedPlayer,
  );
  const isTease = revealStep === 'MAFIA_TEASE';
  const isMafiaResult = revealStep === 'MAFIA_RESULT';
  const isFullRole = revealRoles && revealStep === 'FULL_ROLE';
  const revealActualRole = Boolean(
    revealRoles && (isMafiaResult || isFullRole) && result?.eliminatedRole,
  );
  const isMafia = result?.eliminatedRole === 'MAFIA';

  return (
    <Popup
      open={open && Boolean(result?.announcement)}
      title="투표 탈락 공지"
      accent="red"
      onClose={onClose}
    >
      {canRevealIdentity && eliminatedPlayer && isFullRole ? (
        <JailCaptureScene
          avatarId={eliminatedPlayer.avatarId}
          name={eliminatedPlayer.name}
          isMafia={isMafia}
          role={result?.eliminatedRole}
          finalRoleReveal
          gender={eliminatedPlayer.gender}
        />
      ) : (
      <div className="relative overflow-hidden rounded-2xl border border-amber-200/20 bg-[#100b18] p-3 shadow-inner shadow-black/40">
        <div className="pointer-events-none absolute inset-0 opacity-80 [background:repeating-linear-gradient(90deg,transparent_0,transparent_9%,rgba(226,232,240,.05)_9.4%,rgba(226,232,240,.52)_10%,rgba(15,23,42,.9)_11%,transparent_12%,transparent_21%)]" />
        <div className="pointer-events-none absolute inset-x-1/4 top-[-30%] h-2/3 rounded-full bg-amber-100/15 blur-3xl" />
        <div className="relative z-10">
          {eliminatedPlayer && (
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-red-950/65 px-3 py-3 ring-1 ring-red-400/25">
              <CharacterAvatar
                avatarId={eliminatedPlayer.avatarId}
                isAlive
                role={revealActualRole ? result?.eliminatedRole : null}
                revealRole={revealActualRole}
                state={
                  revealActualRole && result?.eliminatedRole
                    ? getCharacterStateForRole(result.eliminatedRole)
                    : 'normal'
                }
                size={72}
              />
              <div className="min-w-0">
                <p className="text-lg font-black text-white">{eliminatedPlayer.name}</p>
                <p className="mt-1 text-xs font-bold text-red-200/80">투표 결과 체포 · 감옥 수감</p>
              </div>
            </div>
          )}
          <p className="text-base font-black leading-snug text-amber-100">
            {eliminatedPlayer
              ? `투표 결과, ${eliminatedPlayer.name} 님이 체포되어 감옥에 수감되었습니다.`
              : result?.announcement}
          </p>
          {canRevealIdentity && result?.eliminatedRole && revealStep !== 'ARREST' && (
            <div
              key={revealStep}
              className={`mt-4 rounded-xl px-4 py-3 text-center ring-1 ${isTease ? 'bg-amber-950/70 text-amber-100 ring-amber-300/35' : isMafia ? 'bg-red-950/70 text-red-100 ring-red-300/35' : 'bg-sky-950/70 text-sky-100 ring-sky-300/35'}`}
            >
              <p className="text-base font-black">
                {isTease
                  ? `${eliminatedPlayer?.name ?? '학생'} 님은 마피아가...`
                  : isMafiaResult
                    ? `${eliminatedPlayer?.name ?? '학생'} 님은 마피아가... ${isMafia ? '맞습니다!' : '아닙니다!'}`
                    : `${eliminatedPlayer?.name ?? '학생'} 님의 정체는 ${ROLE_LABELS[result.eliminatedRole]}였습니다.`}
              </p>
              {isMafiaResult && (
                <p className="mt-1 text-xs font-bold text-white/70">
                  교사가 다음을 누르면 구체적인 직업이 공개됩니다.
                </p>
              )}
              {isFullRole && (
                <p className="mt-1 text-xs font-bold text-white/70">
                  직업 이미지 공개 · {ROLE_LABELS[result.eliminatedRole]}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      )}
    </Popup>
  );
}
