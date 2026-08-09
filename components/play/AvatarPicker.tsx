'use client';

import {
  FEMALE_AVATARS,
  MALE_AVATARS,
  type AvatarDef,
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
        title="남자 캐릭터 · 16명"
        avatars={MALE_AVATARS}
        selectedId={selectedId}
        takenIds={takenIds}
        onSelect={onSelect}
      />
      <GenderSection
        title="여자 캐릭터 · 16명"
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
  avatars: AvatarDef[];
  selectedId: string | null;
  takenIds: Set<string>;
  onSelect: (id: AvatarId) => void;
}) {
  return (
    <section>
      <p className="mb-2 text-xs font-bold tracking-wide text-white/55">{title}</p>
      <div className="grid grid-cols-4 gap-2">
        {avatars.map((avatar, index) => {
          const taken = takenIds.has(avatar.id);
          const selected = selectedId === avatar.id;
          const a11yName = `${title.includes('여자') ? '여자' : '남자'} 캐릭터 ${index + 1}`;
          return (
            <button
              key={avatar.id}
              type="button"
              disabled={taken}
              title={taken ? `${a11yName} · 사용 중` : a11yName}
              aria-label={taken ? `${a11yName}, 사용 중` : a11yName}
              onClick={() => onSelect(avatar.id)}
              className={
                selected
                  ? 'relative flex min-h-[72px] flex-col items-center justify-center rounded-xl bg-amber-400/25 p-1.5 ring-2 ring-amber-400 transition'
                  : taken
                    ? 'relative flex min-h-[72px] cursor-not-allowed flex-col items-center justify-center rounded-xl bg-white/5 p-1.5 opacity-35 transition'
                    : 'relative flex min-h-[72px] flex-col items-center justify-center rounded-xl bg-white/10 p-1.5 transition hover:bg-white/16'
              }
            >
              <CharacterAvatar avatarId={avatar.id} size={48} isAlive />
              {taken && (
                <span className="absolute bottom-1 rounded bg-red-950/85 px-1 text-[8px] font-bold text-red-200">
                  사용 중
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
