'use client';

import {
  FEMALE_AVATARS,
  MALE_AVATARS,
  type AvatarId,
} from '@/lib/game/avatars';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';

export function CharacterAvatarView({
  avatarId,
  isAlive = true,
  size = 64,
  className = '',
  showLabel = false,
}: {
  avatarId: string | null | undefined;
  isAlive?: boolean;
  size?: number;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <CharacterAvatar
      avatarId={avatarId}
      isAlive={isAlive}
      size={size}
      className={className}
      showLabel={showLabel}
    />
  );
}

export function AvatarPickerGrid({
  selectedId,
  takenIds,
  onSelect,
}: {
  selectedId: string | null;
  takenIds: Set<string>;
  onSelect: (id: AvatarId) => void;
}) {
  return (
    <div className="space-y-4">
      <GenderSection
        title="남자 캐릭터"
        avatars={MALE_AVATARS}
        selectedId={selectedId}
        takenIds={takenIds}
        onSelect={onSelect}
      />
      <GenderSection
        title="여자 캐릭터"
        avatars={FEMALE_AVATARS}
        selectedId={selectedId}
        takenIds={takenIds}
        onSelect={onSelect}
      />
    </div>
  );
}

function GenderSection({
  title,
  avatars,
  selectedId,
  takenIds,
  onSelect,
}: {
  title: string;
  avatars: { id: AvatarId }[];
  selectedId: string | null;
  takenIds: Set<string>;
  onSelect: (id: AvatarId) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">
        {title}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {avatars.map((a) => {
          const taken = takenIds.has(a.id);
          const selected = selectedId === a.id;
          return (
            <button
              key={a.id}
              type="button"
              disabled={taken}
              onClick={() => onSelect(a.id)}
              className={`flex min-h-[72px] flex-col items-center justify-center rounded-xl p-2 transition ${
                selected
                  ? 'bg-amber-400/25 ring-2 ring-amber-400'
                  : taken
                    ? 'cursor-not-allowed bg-white/5 opacity-35'
                    : 'bg-white/10 hover:bg-white/16'
              }`}
            >
              <CharacterAvatar avatarId={a.id} size={48} isAlive />
              {taken && (
                <span className="mt-0.5 text-[9px] font-bold text-red-300">
                  사용중
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
