'use client';

import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { Popup } from '@/components/play/Popup';
import { ROLE_LABELS } from '@/lib/game/roles';
import type { DayVoteResult, Player } from '@/types/game';

export function VoteResultModal({
  open,
  result,
  eliminatedPlayer,
  revealRoles,
  onClose,
}: {
  open: boolean;
  result: DayVoteResult | null | undefined;
  eliminatedPlayer?: Player | null;
  revealRoles: boolean;
  onClose: () => void;
}) {
  const role = revealRoles ? result?.eliminatedRole : null;

  return (
    <Popup
      open={open && Boolean(result?.announcement)}
      title="투표 탈락 공지"
      accent="red"
      onClose={onClose}
    >
      {eliminatedPlayer && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-red-950/45 px-3 py-3 ring-1 ring-red-400/25">
          <CharacterAvatar
            avatarId={eliminatedPlayer.avatarId}
            isAlive={false}
            state="arrested"
            size={72}
          />
          <div className="min-w-0">
            <p className="text-lg font-black text-white">{eliminatedPlayer.name}</p>
            <p className="mt-1 text-xs font-bold text-red-200/80">투표 결과 체포</p>
          </div>
        </div>
      )}
      <p className="text-base font-bold leading-snug">{result?.announcement}</p>
      {role && (
        <p className="mt-3 text-center text-sm font-black text-amber-200">
          직업: {ROLE_LABELS[role]}
        </p>
      )}
    </Popup>
  );
}
