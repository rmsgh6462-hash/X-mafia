'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  FEMALE_AVATARS,
  MALE_AVATARS,
  type AvatarDef,
  type AvatarGender,
  type AvatarId,
} from '@/lib/game/avatars';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';

const STRIP_SIZE = 5;

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

/** 학생 입장용 — 성별 선택 후 큰 미리보기 + 좌우 넘김 + 하단 5칸 스트립 */
export function AvatarPickerGrid({
  selectedId,
  takenIds,
  onSelect,
}: {
  selectedId: string | null;
  takenIds: Set<string>;
  onSelect: (id: AvatarId) => void;
}) {
  const initialGender: AvatarGender | null = selectedId
    ? selectedId.startsWith('F')
      ? 'F'
      : 'M'
    : null;
  const [gender, setGender] = useState<AvatarGender | null>(initialGender);
  const [focusIndex, setFocusIndex] = useState(0);

  const roster = useMemo(
    () => (gender === 'F' ? FEMALE_AVATARS : gender === 'M' ? MALE_AVATARS : []),
    [gender],
  );

  // 성별·선택 ID가 바뀌면 포커스 인덱스를 맞춘다
  useEffect(() => {
    if (!gender || roster.length === 0) return;
    if (selectedId) {
      const idx = roster.findIndex((a) => a.id === selectedId);
      if (idx >= 0) {
        setFocusIndex(idx);
        return;
      }
    }
    const firstFree = roster.findIndex((a) => !takenIds.has(a.id));
    setFocusIndex(firstFree >= 0 ? firstFree : 0);
  }, [gender, selectedId, roster, takenIds]);

  if (!gender) {
    return (
      <div className="space-y-3">
        <p className="text-center text-sm font-bold text-white/70">
          먼저 성별을 골라 주세요
        </p>
        <div className="grid grid-cols-2 gap-3">
          <GenderPickButton
            label="남자 캐릭터"
            sub="16명"
            onClick={() => {
              setGender('M');
              onSelectFirstFree(MALE_AVATARS, takenIds, onSelect);
            }}
          />
          <GenderPickButton
            label="여자 캐릭터"
            sub="16명"
            onClick={() => {
              setGender('F');
              onSelectFirstFree(FEMALE_AVATARS, takenIds, onSelect);
            }}
          />
        </div>
      </div>
    );
  }

  const focused = roster[focusIndex] ?? roster[0];
  const focusedTaken = focused ? takenIds.has(focused.id) : true;
  const stripStart = getStripStart(focusIndex, roster.length, STRIP_SIZE);
  const strip = roster.slice(stripStart, stripStart + STRIP_SIZE);

  const move = (delta: number) => {
    if (roster.length === 0) return;
    const next = (focusIndex + delta + roster.length) % roster.length;
    setFocusIndex(next);
    const avatar = roster[next];
    if (avatar && !takenIds.has(avatar.id)) onSelect(avatar.id);
  };

  const pickAt = (avatar: AvatarDef, absoluteIndex: number) => {
    setFocusIndex(absoluteIndex);
    if (!takenIds.has(avatar.id)) onSelect(avatar.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold tracking-wide text-white/55">
          {gender === 'M' ? '남자' : '여자'} 캐릭터 · {roster.length}명
        </p>
        <button
          type="button"
          onClick={() => setGender(null)}
          className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/80 hover:bg-white/16"
        >
          성별 다시 고르기
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 sm:gap-3">
        <NavButton
          label="이전 캐릭터"
          onClick={() => move(-1)}
          icon={<ChevronLeft className="h-6 w-6" />}
        />
        <div className="relative flex min-h-[11.5rem] w-full max-w-[13rem] flex-col items-center justify-center rounded-2xl bg-black/35 p-3 ring-1 ring-white/15">
          {focused && (
            <CharacterAvatar
              avatarId={focused.id}
              size={148}
              isAlive
              previewOnHover={false}
            />
          )}
          {focusedTaken && (
            <span className="absolute bottom-3 rounded-full bg-red-950/90 px-2.5 py-1 text-[11px] font-black text-red-100 ring-1 ring-red-400/40">
              사용 중 · 다른 캐릭터를 고르세요
            </span>
          )}
          {!focusedTaken && focused && selectedId === focused.id && (
            <span className="absolute bottom-3 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-black text-stone-900">
              선택됨
            </span>
          )}
        </div>
        <NavButton
          label="다음 캐릭터"
          onClick={() => move(1)}
          icon={<ChevronRight className="h-6 w-6" />}
        />
      </div>

      <div>
        <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-white/40">
          {focusIndex + 1} / {roster.length}
        </p>
        <div className="mx-auto grid max-w-sm grid-cols-5 gap-1.5">
          {strip.map((avatar, i) => {
            const absoluteIndex = stripStart + i;
            const taken = takenIds.has(avatar.id);
            const active = absoluteIndex === focusIndex;
            const selected = selectedId === avatar.id;
            return (
              <button
                key={avatar.id}
                type="button"
                title={taken ? '사용 중' : `캐릭터 ${absoluteIndex + 1}`}
                aria-label={
                  taken
                    ? `캐릭터 ${absoluteIndex + 1}, 사용 중`
                    : `캐릭터 ${absoluteIndex + 1}`
                }
                aria-current={active ? 'true' : undefined}
                onClick={() => pickAt(avatar, absoluteIndex)}
                className={
                  active
                    ? 'relative flex aspect-square items-center justify-center rounded-xl bg-amber-400/30 p-1 ring-2 ring-amber-300'
                    : selected
                      ? 'relative flex aspect-square items-center justify-center rounded-xl bg-amber-400/15 p-1 ring-1 ring-amber-400/50'
                      : taken
                        ? 'relative flex aspect-square cursor-pointer items-center justify-center rounded-xl bg-white/5 p-1 opacity-40'
                        : 'relative flex aspect-square items-center justify-center rounded-xl bg-white/10 p-1 hover:bg-white/16'
                }
              >
                <CharacterAvatar
                  avatarId={avatar.id}
                  size={44}
                  isAlive
                  previewOnHover={false}
                />
                {taken && (
                  <span className="absolute bottom-0.5 rounded bg-red-950/85 px-0.5 text-[7px] font-bold text-red-200">
                    사용
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getStripStart(focusIndex: number, length: number, windowSize: number): number {
  if (length <= windowSize) return 0;
  const half = Math.floor(windowSize / 2);
  let start = focusIndex - half;
  if (start < 0) start = 0;
  if (start + windowSize > length) start = length - windowSize;
  return start;
}

function onSelectFirstFree(
  avatars: AvatarDef[],
  takenIds: Set<string>,
  onSelect: (id: AvatarId) => void,
) {
  const free = avatars.find((a) => !takenIds.has(a.id));
  if (free) onSelect(free.id);
}

function GenderPickButton({
  label,
  sub,
  onClick,
}: {
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[5.5rem] flex-col items-center justify-center rounded-2xl bg-white/10 px-3 py-4 text-center transition hover:bg-amber-400/20 hover:ring-2 hover:ring-amber-300/60"
    >
      <span className="text-base font-black text-white">{label}</span>
      <span className="mt-1 text-xs font-bold text-white/50">{sub}</span>
    </button>
  );
}

function NavButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-amber-400 hover:text-stone-900"
    >
      {icon}
    </button>
  );
}
