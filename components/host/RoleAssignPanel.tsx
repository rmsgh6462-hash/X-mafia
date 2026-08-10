'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dices, UserCog } from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  specialRoleTotal,
  suggestedRoleCounts,
  type RoleCountConfig,
} from '@/lib/game/roles';
import { playerList, defaultMaxRoundsFromMafiaCount } from '@/lib/game/room';
import type { GameRoom, Role } from '@/types/game';

type Mode = 'random' | 'manual';

const ROUND_PRESETS = [3, 6, 9, 12, 15, 18];

export function RoleAssignPanel({
  room,
  busy,
  onRandomAssign,
  onManualAssign,
  onStart,
  onMaxRoundsChange,
}: {
  room: GameRoom;
  busy?: boolean;
  onRandomAssign: (
    counts: RoleCountConfig,
    startNow: boolean,
    maxRounds: number,
  ) => void;
  onManualAssign: (assignments: Record<string, Role | null>) => void;
  /** 수동 배정 저장 + 게임 시작을 한 번에 (assignments 미전달 시 현재 room 직업 사용) */
  onStart: (
    maxRounds: number,
    assignments?: Record<string, Role | null>,
  ) => void;
  onMaxRoundsChange?: (maxRounds: number) => void;
}) {
  const players = useMemo(() => playerList(room), [room]);
  const n = players.length;
  const [mode, setMode] = useState<Mode>('random');
  const [counts, setCounts] = useState<RoleCountConfig>(() =>
    suggestedRoleCounts(Math.max(n, 4)),
  );
  const [manual, setManual] = useState<Record<string, Role | null>>({});
  const [roundsDirty, setRoundsDirty] = useState(false);
  const [maxRounds, setMaxRoundsLocal] = useState(
    () => room.maxRounds || defaultMaxRoundsFromMafiaCount(counts.MAFIA),
  );

  useEffect(() => {
    setCounts(suggestedRoleCounts(Math.max(n, 4)));
  }, [n]);

  useEffect(() => {
    if (roundsDirty) return;
    const next = defaultMaxRoundsFromMafiaCount(counts.MAFIA);
    setMaxRoundsLocal(next);
    onMaxRoundsChange?.(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts.MAFIA, roundsDirty]);

  useEffect(() => {
    setManual((prev) => {
      const next: Record<string, Role | null> = {};
      players.forEach((p) => {
        // null 은 유효한 '미배정' 선택이므로 ?? 로 덮어쓰지 않는다.
        next[p.id] = Object.prototype.hasOwnProperty.call(prev, p.id)
          ? prev[p.id] ?? null
          : (p.role ?? null);
      });
      return next;
    });
  }, [players]);

  const special = specialRoleTotal(counts);
  const citizenCount = Math.max(0, n - special);
  const countsValid = special <= n && counts.MAFIA >= 1;

  const allAssigned = players.length > 0 && players.every((p) => p.role != null);
  const manualAssignedCount = players.filter((p) => Boolean(manual[p.id])).length;
  const manualMafiaCount = players.filter((p) => manual[p.id] === 'MAFIA').length;
  const manualReady =
    players.length >= 4 &&
    players.every((p) => Boolean(manual[p.id])) &&
    manualMafiaCount >= 1;

  const bump = (key: keyof RoleCountConfig, delta: number) => {
    setCounts((c) => ({
      ...c,
      [key]: Math.max(0, Math.min(n, c[key] + delta)),
    }));
  };

  const applyMaxRounds = (value: number) => {
    const clamped = Math.max(1, Math.min(30, Math.floor(value) || 1));
    setRoundsDirty(true);
    setMaxRoundsLocal(clamped);
    onMaxRoundsChange?.(clamped);
  };

  const suggested = defaultMaxRoundsFromMafiaCount(counts.MAFIA);

  return (
    <section className="w-full max-w-4xl rounded-2xl border border-amber-500/25 bg-stone-950/80 p-5 text-left shadow-xl backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-black text-amber-200">직업 배정</h3>
        <div className="flex rounded-full bg-black/40 p-1">
          <ModeTab
            active={mode === 'random'}
            onClick={() => setMode('random')}
            icon={<Dices className="h-3.5 w-3.5" />}
            label="인원 지정 랜덤"
          />
          <ModeTab
            active={mode === 'manual'}
            onClick={() => setMode('manual')}
            icon={<UserCog className="h-3.5 w-3.5" />}
            label="직접 배정"
          />
        </div>
      </div>

      <div className="mb-5 rounded-xl bg-black/35 p-4 ring-1 ring-amber-400/20">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-white/50">총 진행 라운드 수</p>
            <p className="text-sm text-white/70">
              기본값 = 마피아 수 × 3
              <span className="ml-2 font-mono text-amber-200">
                (현재 제안 {suggested})
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setRoundsDirty(false);
              setMaxRoundsLocal(suggested);
              onMaxRoundsChange?.(suggested);
            }}
            className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/80 hover:bg-white/20"
          >
            기본값으로
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={ROUND_PRESETS.includes(maxRounds) ? maxRounds : 'custom'}
            onChange={(e) => {
              if (e.target.value === 'custom') return;
              applyMaxRounds(Number(e.target.value));
            }}
            className="rounded-lg border border-white/15 bg-stone-900 px-3 py-2 text-sm font-bold"
          >
            {ROUND_PRESETS.map((r) => (
              <option key={r} value={r}>
                {r}라운드
              </option>
            ))}
            <option value="custom">직접 입력</option>
          </select>
          <input
            type="number"
            min={1}
            max={30}
            value={maxRounds}
            onChange={(e) => applyMaxRounds(Number(e.target.value))}
            className="w-24 rounded-lg border border-white/15 bg-stone-900 px-3 py-2 font-mono text-sm font-black"
          />
          <span className="text-xs text-white/45">1–30</span>
        </div>
      </div>

      {mode === 'random' ? (
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            직업별 인원만 정하면 자동으로 랜덤 배정됩니다. 나머지 {citizenCount}명은
            시민입니다.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ['MAFIA', '마피아'],
                ['DOCTOR', '의사'],
                ['POLICE', '경찰'],
                ['REPORTER', '기자'],
                ['SPIRITUALIST', '영매'],
              ] as const
            ).map(([key, label]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5"
              >
                <span className="text-sm font-bold text-white">{label}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-8 w-8 rounded-lg bg-white/10 text-lg font-bold hover:bg-white/20"
                    onClick={() => bump(key, -1)}
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-mono text-lg font-black">
                    {counts[key]}
                  </span>
                  <button
                    type="button"
                    className="h-8 w-8 rounded-lg bg-white/10 text-lg font-bold hover:bg-white/20"
                    onClick={() => bump(key, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-3 py-2.5 ring-1 ring-emerald-400/20">
              <span className="text-sm font-bold text-emerald-100">시민 (자동)</span>
              <span className="font-mono text-lg font-black text-emerald-200">
                {citizenCount}
              </span>
            </div>
          </div>

          {!countsValid && (
            <p className="text-sm text-red-300">
              {counts.MAFIA < 1
                ? '마피아은 최소 1명 필요합니다.'
                : `특수 직업 합(${special})이 전체(${n})를 초과합니다.`}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || n < 1 || !countsValid}
              onClick={() => onRandomAssign(counts, false, maxRounds)}
              className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 disabled:opacity-40"
            >
              랜덤 배정만
            </button>
            <button
              type="button"
              disabled={busy || n < 4 || !countsValid}
              onClick={() => onRandomAssign(counts, true, maxRounds)}
              className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-stone-900 hover:bg-amber-300 disabled:opacity-40"
            >
              랜덤 배정 후 게임 시작
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            학생마다 직업을 직접 고른 뒤 저장하고, 게임을 시작하세요.
          </p>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {players.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2"
              >
                <CharacterAvatar avatarId={p.avatarId} size={40} isAlive previewOnHover />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">
                  {p.name}
                </span>
                <select
                  value={manual[p.id] ?? ''}
                  onChange={(e) =>
                    setManual((m) => ({
                      ...m,
                      [p.id]: (e.target.value || null) as Role | null,
                    }))
                  }
                  className="rounded-lg border border-white/15 bg-stone-900 px-2 py-1.5 text-sm text-white"
                >
                  <option value="">미배정</option>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || n < 1}
              onClick={() => onManualAssign(manual)}
              className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 disabled:opacity-40"
            >
              수동 배정 저장
            </button>
            <button
              type="button"
              disabled={busy || !manualReady}
              onClick={() => onStart(maxRounds, manual)}
              className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-stone-900 hover:bg-amber-300 disabled:opacity-40"
            >
              배정 저장 후 게임 시작
            </button>
          </div>
          {n >= 4 && !manualReady && (
            <p className="text-sm text-amber-200/90">
              {manualAssignedCount < n
                ? `전원 직업을 선택하세요. (${manualAssignedCount}/${n})`
                : '마피아를 최소 1명 배정해야 시작할 수 있습니다.'}
            </p>
          )}
          {n < 4 && (
            <p className="text-sm text-white/50">게임 시작에는 최소 4명이 필요합니다.</p>
          )}
        </div>
      )}

      {(allAssigned || manualReady) && (
        <p className="mt-4 text-xs text-emerald-300/90">
          전원 직업 배정 완료 — 게임 시작 가능
          {players.map((p) => (
            <span key={p.id} className="ml-2 text-white/50">
              {p.name}:
              {ROLE_LABELS[(manual[p.id] ?? p.role) as Role] ?? '?'}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
        active ? 'bg-amber-400 text-stone-900' : 'text-white/65 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
