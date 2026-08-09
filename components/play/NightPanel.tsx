'use client';

import { useMemo, useState } from 'react';
import { ROLE_LABELS } from '@/lib/game/roles';
import { setNightTarget } from '@/lib/game/room';
import { getMafiaAllies } from '@/lib/game/visibility';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import type { GameRoom, Player, Role } from '@/types/game';

function PlayerPickList({
  players,
  selectedId,
  onSelect,
  disabled,
  disabledIds,
  disabledHints,
  allyBadgeIds,
}: {
  players: Player[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
  disabledIds?: Set<string>;
  disabledHints?: Record<string, string>;
  /** 마피아 동료 — [마피아] 배지 */
  allyBadgeIds?: Set<string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {players.map((p) => {
        const active = selectedId === p.id;
        const itemDisabled = Boolean(disabled || disabledIds?.has(p.id));
        const isAlly = allyBadgeIds?.has(p.id);
        return (
          <button
            key={p.id}
            type="button"
            disabled={itemDisabled}
            title={
              disabledIds?.has(p.id)
                ? disabledHints?.[p.id] ?? '선택할 수 없습니다'
                : undefined
            }
            onClick={() => onSelect(p.id)}
            className={`flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-xl px-3 py-3 text-sm font-bold transition hover:brightness-110 ${
              active
                ? 'bg-amber-400 text-stone-900 ring-2 ring-amber-200'
                : itemDisabled
                  ? 'cursor-not-allowed bg-white/5 text-white/35 line-through'
                  : isAlly
                    ? 'bg-red-950/50 text-white ring-1 ring-red-400/40 hover:bg-red-950/70'
                    : 'bg-white/10 text-white hover:bg-white/16'
            } disabled:opacity-50`}
          >
            <span className="flex w-full items-center gap-2">
              <CharacterAvatar
                avatarId={p.avatarId}
                isAlive={p.isAlive}
                size={36}
              />
              <span className="min-w-0 flex-1 truncate text-left">{p.name}</span>
              {isAlly && (
                <span className="shrink-0 rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                  [마피아]
                </span>
              )}
            </span>
            {disabledIds?.has(p.id) && disabledHints?.[p.id] && (
              <span className="pl-11 text-[10px] font-semibold no-underline opacity-80">
                {disabledHints[p.id]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function NightPanel({
  room,
  me,
  pin,
}: {
  room: GameRoom;
  me: Player;
  pin: string;
}) {
  const role = me.role as Role | null;
  const [result, setResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const selfHealUsed = me.hasSelfHealed === true;

  const candidates = useMemo(() => {
    const all = Object.values(room.players ?? {});
    if (role === 'SPIRITUALIST') {
      return all.filter((p) => !p.isAlive);
    }
    if (role === 'DOCTOR') {
      // 생존자 전원 + 본인(자힐) — 자힐 소진 시에도 목록에 두되 비활성
      return all.filter((p) => p.isAlive);
    }
    return all.filter((p) => p.isAlive && p.id !== me.id);
  }, [room.players, role, me.id]);

  const doctorDisabledIds = useMemo(() => {
    if (role !== 'DOCTOR' || !selfHealUsed) return new Set<string>();
    return new Set([me.id]);
  }, [role, selfHealUsed, me.id]);

  const doctorDisabledHints = useMemo(() => {
    if (role !== 'DOCTOR' || !selfHealUsed) return {};
    return { [me.id]: '자힐 이미 사용 (1회 제한)' };
  }, [role, selfHealUsed, me.id]);

  const mafiaAllyIds = useMemo(() => {
    if (role !== 'MAFIA') return new Set<string>();
    return new Set(getMafiaAllies(room, me).map((p) => p.id));
  }, [role, room, me]);

  const title = useMemo(() => {
    switch (role) {
      case 'MAFIA':
        return room.isMafiaBuffActive
          ? '타겟 지목 (미션 보상 — 각자 1명 독립 공격)'
          : '타겟 지목 (다른 마피아도 지목 가능)';
      case 'DOCTOR':
        return selfHealUsed
          ? '살릴 플레이어 선택 (자힐 사용 완료)'
          : '살릴 플레이어 선택 (자힐 1회 가능)';
      case 'POLICE':
        return '조사할 플레이어 선택';
      case 'REPORTER':
        return '취재 대상 선택';
      case 'SPIRITUALIST':
        return '영혼에게 직업 묻기';
      default:
        return '밤에는 조용히 대기';
    }
  }, [role, room.isMafiaBuffActive, selfHealUsed]);

  const silenced =
    room.gmEvent === 'SILENCE_NIGHT' &&
    (role === 'POLICE' || role === 'DOCTOR');

  const handleSelect = async (targetId: string) => {
    if (!role || role === 'CITIZEN' || silenced) return;
    if (role === 'DOCTOR' && targetId === me.id && selfHealUsed) {
      setResult('자기 치료(자힐)는 이미 사용했습니다.');
      return;
    }
    setSaving(true);
    try {
      await setNightTarget(pin, me.id, targetId);
      const target =
        targetId === me.id ? me : room.players[targetId];

      if (role === 'POLICE' && target) {
        setResult(
          `${target.name} 님을 조사 대상으로 선택했습니다. 결과는 아침에 경찰에게만 공개됩니다.`,
        );
      } else if (role === 'SPIRITUALIST' && target) {
        setResult(
          `${target.name} 님의 진짜 직업은 ${target.role ? ROLE_LABELS[target.role] : '???'} 입니다.`,
        );
      } else if (role === 'REPORTER' && target) {
        setResult(
          `${target.name} 님을 취재했습니다. 실제 직업은 아침 속보로 전원에게 공개됩니다.`,
        );
      } else if (role === 'DOCTOR' && target) {
        setResult(
          targetId === me.id
            ? '자신을 치료 대상으로 선택했습니다. (자힐 · 게임당 1회)'
            : `${target.name} 님을 치료 대상으로 선택했습니다.`,
        );
      } else if (role === 'MAFIA' && target) {
        setResult(
          room.isMafiaBuffActive
            ? `${target.name} 님을 독립 지목했습니다.`
            : `${target.name} 님을 지목했습니다.`,
        );
      }
    } catch (e) {
      setResult(
        e instanceof Error
          ? e.message
          : '선택 저장에 실패했습니다. 네트워크를 확인해 주세요.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (!role || role === 'CITIZEN') {
    return (
      <section className="rounded-2xl bg-indigo-950/50 p-4 ring-1 ring-white/10">
        <h3 className="text-sm font-black text-indigo-100">밤</h3>
        <p className="mt-2 text-sm text-white/75">
          시민은 능력을 사용하지 않습니다. 눈을 감고 기다려 주세요.
        </p>
      </section>
    );
  }

  if (silenced) {
    return (
      <section className="rounded-2xl bg-slate-900/80 p-4 ring-1 ring-slate-400/30">
        <h3 className="text-sm font-black text-slate-100">정전 발생</h3>
        <p className="mt-2 text-sm text-white/75">
          이번 밤 경찰·의사 능력이 무효화되었습니다. 행동을 할 수 없습니다.
        </p>
      </section>
    );
  }

  if (role === 'SPIRITUALIST' && candidates.length === 0) {
    return (
      <section className="rounded-2xl bg-violet-950/50 p-4 ring-1 ring-violet-400/20">
        <h3 className="text-sm font-black text-violet-100">{title}</h3>
        <p className="mt-2 text-sm text-white/75">아직 사망자가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-stone-900/80 p-5 ring-1 ring-white/10">
      <h3 className="text-sm font-black text-white">{title}</h3>
      <p className="mt-1 text-xs text-white/50">
        {ROLE_LABELS[role]} 행동 · 한 명을 선택하세요
        {role === 'DOCTOR' && !selfHealUsed
          ? ' · 본인 선택 시 자힐'
          : ''}
      </p>
      <div className="mt-4">
        <PlayerPickList
          players={candidates}
          selectedId={me.nightTarget}
          onSelect={(id) => void handleSelect(id)}
          disabled={saving}
          disabledIds={doctorDisabledIds}
          disabledHints={doctorDisabledHints}
          allyBadgeIds={mafiaAllyIds}
        />
      </div>
      {result && (
        <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-amber-100">
          {result}
        </p>
      )}
    </section>
  );
}
