'use client';

import { useMemo, useState } from 'react';
import { ROLE_LABELS } from '@/lib/game/roles';
import { publishReporterNews, setNightTarget } from '@/lib/game/room';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import type { GameRoom, Player, Role } from '@/types/game';

function PlayerPickList({
  players,
  selectedId,
  onSelect,
  disabled,
}: {
  players: Player[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {players.map((p) => {
        const active = selectedId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(p.id)}
            className={`flex min-h-14 items-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition hover:brightness-110 ${
              active
                ? 'bg-amber-400 text-stone-900 ring-2 ring-amber-200'
                : 'bg-white/10 text-white hover:bg-white/16'
            } disabled:opacity-40`}
          >
            <CharacterAvatar
              avatarId={p.avatarId}
              isAlive={p.isAlive}
              size={36}
            />
            <span className="truncate">{p.name}</span>
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

  const candidates = useMemo(() => {
    const all = Object.values(room.players ?? {});
    if (role === 'SPIRITUALIST') {
      return all.filter((p) => !p.isAlive);
    }
    return all.filter((p) => p.isAlive && p.id !== me.id);
  }, [room.players, role, me.id]);

  const title = useMemo(() => {
    switch (role) {
      case 'MAFIA':
        return room.isMafiaBuffActive
          ? '타겟 지목 (미션 보상 — 각자 1명, 마피아끼리도 가능)'
          : '타겟 지목 (다른 마피아도 지목 가능)';
      case 'DOCTOR':
        return '살릴 플레이어 선택';
      case 'POLICE':
        return '조사할 플레이어 선택';
      case 'REPORTER':
        return '취재 대상 선택';
      case 'SPIRITUALIST':
        return '영혼에게 직업 묻기';
      default:
        return '밤에는 조용히 대기';
    }
  }, [role, room.isMafiaBuffActive]);

  const silenced =
    room.gmEvent === 'SILENCE_NIGHT' &&
    (role === 'POLICE' || role === 'DOCTOR');

  const handleSelect = async (targetId: string) => {
    if (!role || role === 'CITIZEN' || silenced) return;
    setSaving(true);
    try {
      await setNightTarget(pin, me.id, targetId);
      const target = room.players[targetId];

      if (role === 'POLICE' && target) {
        const isMafia = target.role === 'MAFIA';
        setResult(
          isMafia
            ? `${target.name} 님은 X맨(마피아)입니다.`
            : `${target.name} 님은 마피아가 아닙니다.`,
        );
      } else if (role === 'SPIRITUALIST' && target) {
        setResult(
          `${target.name} 님의 진짜 직업은 ${target.role ? ROLE_LABELS[target.role] : '???'} 입니다.`,
        );
      } else if (role === 'REPORTER' && target) {
        await publishReporterNews(
          pin,
          `[속보] ${target.name} 님 주변에서 수상한 움직임이 포착되었습니다.`,
        );
        setResult(
          `${target.name} 님을 취재했습니다. 다음 날 아침 속보로 공개됩니다.`,
        );
      } else if (role === 'DOCTOR' && target) {
        setResult(`${target.name} 님을 치료 대상으로 선택했습니다.`);
      } else if (role === 'MAFIA' && target) {
        setResult(
          room.isMafiaBuffActive
            ? `${target.name} 님을 독립 지목했습니다.`
            : `${target.name} 님을 지목했습니다.`,
        );
      }
    } catch {
      setResult('선택 저장에 실패했습니다. 네트워크를 확인해 주세요.');
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
      </p>
      <div className="mt-4">
        <PlayerPickList
          players={candidates}
          selectedId={me.nightTarget}
          onSelect={(id) => void handleSelect(id)}
          disabled={saving}
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
