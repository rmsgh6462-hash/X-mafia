'use client';

import { getAvatarDef, getAvatarSprite, type AvatarId } from '@/lib/game/avatars';

/**
 * High-quality roster sprite renderer.
 *
 * The M0–M15/F0–F15 IDs are intentionally unchanged so existing rooms keep
 * their selections. Each ID now crops one tile from the new 4x4 boy/girl
 * roster sheets instead of drawing the old generic SVG avatar.
 */
export function CharacterAvatar({
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
  /** @deprecated 캐릭터 고유 이름은 더 이상 표시하지 않음 */
  showLabel?: boolean;
}) {
  const def = getAvatarDef(avatarId);
  const sprite = getAvatarSprite(def.id);

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div
        role="img"
        aria-label={showLabel ? '학생 캐릭터' : undefined}
        className={`relative shrink-0 overflow-hidden rounded-[28%] border-2 shadow-lg shadow-slate-950/20 ${
          isAlive
            ? 'border-white/45 bg-[#fff8e8]'
            : 'border-rose-300/75 bg-slate-900/80'
        }`}
        style={{
          width: size,
          height: size,
          transform: isAlive ? undefined : 'rotate(-4deg)',
        }}
      >
        <div
          aria-hidden="true"
          className={`absolute inset-0 bg-no-repeat ${
            isAlive ? '' : 'grayscale brightness-[0.62] saturate-[0.7] opacity-80'
          }`}
          style={{
            backgroundImage: `url(${sprite.src})`,
            backgroundPosition: sprite.backgroundPosition,
            backgroundSize: '400% 400%',
          }}
        />

        {!isAlive && (
          <>
            <div className="absolute inset-0 bg-slate-950/18" aria-hidden="true" />
            <div className="absolute left-1/2 top-[42%] h-5 w-9 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
              <span className="absolute left-1/2 top-1/2 h-1 w-8 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-rose-950/90 shadow-sm" />
              <span className="absolute left-1/2 top-1/2 h-1 w-8 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-rose-950/90 shadow-sm" />
            </div>
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-rose-950/85 px-1.5 py-0.5 text-[8px] font-black tracking-tight text-rose-100">
              탈락
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export type { AvatarId };
