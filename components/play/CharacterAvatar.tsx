'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { getAvatarDef, getAvatarSprite, type AvatarId } from '@/lib/game/avatars';
import { CharacterImage } from '@/components/play/CharacterImage';
import {
  getSecuredCharacterImageUrl,
  getSecuredCharacterState,
  type CharacterState,
  type CharacterViewerRole,
} from '@/lib/characterUtils';
import type { Role } from '@/types/game';

const PUBLIC_EVENT_STATES: CharacterState[] = [
  'dead',
  'arrested',
  'doctor_fail',
  'doctor_idle',
  'reporter_idle',
];

function AvatarFace({
  avatarId,
  isAlive = true,
  size = 64,
  className = '',
  showLabel = false,
  state = null,
  role = null,
  viewerRole,
  targetPlayerId,
  viewerPlayerId,
  revealRole = false,
}: {
  avatarId: string | null | undefined;
  isAlive?: boolean;
  size?: number;
  className?: string;
  showLabel?: boolean;
  /** 상태별 개별 이미지를 선택적으로 사용한다. 기본값 null이면 기존 스프라이트를 유지한다. */
  state?: CharacterState | null;
  /** 이미지 대상 플레이어의 실제 직업. viewerRole과 함께 보안 매핑에 사용한다. */
  role?: Role | null;
  /** 현재 화면을 보는 주체의 역할. TEACHER면 모든 직업 이미지가 허용된다. */
  viewerRole?: CharacterViewerRole | null;
  targetPlayerId?: string | null;
  viewerPlayerId?: string | null;
  /** 공개된 정체 발표 단계에서만 직업 이미지 잠금을 해제한다. */
  revealRole?: boolean;
}) {
  const def = getAvatarDef(avatarId);
  const sprite = getAvatarSprite(def.id);
  const hasViewerContext =
    role != null &&
    (revealRole ||
      (viewerRole !== undefined && targetPlayerId !== undefined));
  const canUseSecuredRoleImage = !PUBLIC_EVENT_STATES.includes(state ?? 'normal');
  const securedImageUrl = hasViewerContext && canUseSecuredRoleImage
    ? getSecuredCharacterImageUrl(
        def.id,
        role,
        viewerRole,
        targetPlayerId,
        viewerPlayerId,
        revealRole,
      )
    : undefined;
  const resolvedState = PUBLIC_EVENT_STATES.includes(state ?? 'normal')
    ? state
    : hasViewerContext
      ? getSecuredCharacterState(
          role,
          viewerRole,
          targetPlayerId,
          viewerPlayerId,
          revealRole,
        )
      : state;

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
        {resolvedState || securedImageUrl ? (
          <CharacterImage
            characterId={def.id}
            state={resolvedState ?? 'normal'}
            imageUrl={securedImageUrl}
            alt=""
            className={`absolute inset-0 h-full w-full object-contain ${
              isAlive ? '' : 'grayscale brightness-[0.62] saturate-[0.7] opacity-80'
            }`}
          />
        ) : (
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
        )}

        {!isAlive && (
          <>
            <div className="absolute inset-0 bg-slate-950/18" aria-hidden="true" />
            <div
              className="absolute left-1/2 top-[42%] h-5 w-9 -translate-x-1/2 -translate-y-1/2"
              aria-hidden="true"
            >
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

/**
 * High-quality roster sprite renderer.
 * previewOnHover: 작은 아바타에 마우스를 올리면 큰 미리보기를 띄운다 (교사 화면 등).
 */
export function CharacterAvatar({
  avatarId,
  isAlive = true,
  size = 64,
  className = '',
  showLabel = false,
  previewOnHover = false,
  previewSize = 132,
  state = null,
  role = null,
  viewerRole,
  targetPlayerId,
  viewerPlayerId,
  revealRole = false,
}: {
  avatarId: string | null | undefined;
  isAlive?: boolean;
  size?: number;
  className?: string;
  /** @deprecated 캐릭터 고유 이름은 더 이상 표시하지 않음 */
  showLabel?: boolean;
  /** 호버/포커스 시 큰 미리보기 (캐릭터 선택 UI에서는 끄세요) */
  previewOnHover?: boolean;
  previewSize?: number;
  state?: CharacterState | null;
  /** 이미지 대상 플레이어의 실제 직업 */
  role?: Role | null;
  /** 본인 역할 또는 TEACHER. 다른 학생 역할 이미지는 공개하지 않는다. */
  viewerRole?: CharacterViewerRole | null;
  targetPlayerId?: string | null;
  viewerPlayerId?: string | null;
  revealRole?: boolean;
}) {
  const tipId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 10;
    let top = rect.top - previewSize - gap;
    if (top < 8) top = rect.bottom + gap;
    let left = rect.left + rect.width / 2 - previewSize / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - previewSize - 8));
    setCoords({ top, left });
  }, [previewSize]);

  useLayoutEffect(() => {
    if (!open || !previewOnHover) return;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, previewOnHover, updatePosition]);

  const show = () => {
    if (!previewOnHover) return;
    updatePosition();
    setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <div
      ref={anchorRef}
      className={`relative inline-flex ${previewOnHover ? 'cursor-zoom-in' : ''} ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={previewOnHover ? 0 : undefined}
      aria-describedby={previewOnHover && open ? tipId : undefined}
    >
      <AvatarFace
        avatarId={avatarId}
        isAlive={isAlive}
        size={size}
        showLabel={showLabel}
        state={state}
        role={role}
        viewerRole={viewerRole}
        targetPlayerId={targetPlayerId}
        viewerPlayerId={viewerPlayerId}
        revealRole={revealRole}
      />
      {mounted &&
        previewOnHover &&
        open &&
        coords &&
        createPortal(
          <div
            id={tipId}
            role="tooltip"
            className="pointer-events-none fixed z-[200] rounded-2xl border border-white/25 bg-stone-950/95 p-2 shadow-2xl shadow-black/60 ring-1 ring-amber-300/30"
            style={{ top: coords.top, left: coords.left, width: previewSize + 16 }}
          >
            <AvatarFace
              avatarId={avatarId}
              isAlive={isAlive}
              size={previewSize}
              className="mx-auto"
              state={state}
              role={role}
              viewerRole={viewerRole}
              targetPlayerId={targetPlayerId}
              viewerPlayerId={viewerPlayerId}
              revealRole={revealRole}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

export type { AvatarId };
