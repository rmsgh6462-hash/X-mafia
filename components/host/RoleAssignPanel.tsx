'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Dices,
  HeartPulse,
  Info,
  Newspaper,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  UserCog,
} from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  specialRoleTotal,
  type RoleCountConfig,
} from '@/lib/game/roles';
import { getDefaultRoleConfig, type RoleConfig } from '@/lib/gameRules';
import { playerList, defaultMaxRoundsFromMafiaCount } from '@/lib/game/room';
import type { GameRoom, Role } from '@/types/game';

type Mode = 'random' | 'manual';

const ROUND_PRESETS = [3, 6, 9, 12, 15, 18];

const RANDOM_ROLE_FIELDS = [
  {
    key: 'MAFIA',
    label: '마피아',
    description: '밤에 시민을 공격하는 팀입니다.',
    icon: Skull,
    tone: 'red',
  },
  {
    key: 'DOCTOR',
    label: '의사',
    description: '밤에 한 명을 치료해 공격을 막습니다.',
    icon: HeartPulse,
    tone: 'emerald',
  },
  {
    key: 'POLICE',
    label: '경찰',
    description: '밤에 한 명의 마피아 여부를 조사합니다.',
    icon: Shield,
    tone: 'blue',
  },
  {
    key: 'REPORTER',
    label: '기자',
    description: '취재 결과를 다음 날 모두에게 공개합니다.',
    icon: Newspaper,
    tone: 'amber',
  },
  {
    key: 'SPIRITUALIST',
    label: '영매',
    description: '탈락자의 직업을 확인할 수 있습니다.',
    icon: Sparkles,
    tone: 'violet',
  },
] as const;

function toRoleCountConfig(config: RoleConfig): RoleCountConfig {
  return {
    MAFIA: config.mafia,
    DOCTOR: config.doctor,
    POLICE: config.police,
    REPORTER: config.reporter,
    SPIRITUALIST: config.shaman,
  };
}

const ROLE_TONE_CLASSES = {
  red: {
    card: 'border-red-400/25 bg-red-500/[0.08]',
    icon: 'bg-red-500/20 text-red-200',
    value: 'text-red-100',
  },
  emerald: {
    card: 'border-emerald-400/25 bg-emerald-500/[0.08]',
    icon: 'bg-emerald-500/20 text-emerald-200',
    value: 'text-emerald-100',
  },
  blue: {
    card: 'border-blue-400/25 bg-blue-500/[0.08]',
    icon: 'bg-blue-500/20 text-blue-200',
    value: 'text-blue-100',
  },
  amber: {
    card: 'border-amber-400/25 bg-amber-500/[0.08]',
    icon: 'bg-amber-500/20 text-amber-200',
    value: 'text-amber-100',
  },
  violet: {
    card: 'border-violet-400/25 bg-violet-500/[0.08]',
    icon: 'bg-violet-500/20 text-violet-200',
    value: 'text-violet-100',
  },
} as const;

export function RoleAssignPanel({
  room,
  busy,
  onRandomAssign,
  onManualAssign,
  onStart,
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
}) {
  const players = useMemo(() => playerList(room), [room]);
  const n = players.length;
  const [mode, setMode] = useState<Mode>('random');
  const [counts, setCounts] = useState<RoleCountConfig>(() =>
    toRoleCountConfig(getDefaultRoleConfig(Math.max(n, 4))),
  );
  const [manual, setManual] = useState<Record<string, Role | null>>({});
  const [roundsDirty, setRoundsDirty] = useState(false);
  const [maxRounds, setMaxRoundsLocal] = useState(
    () => room.maxRounds || defaultMaxRoundsFromMafiaCount(counts.MAFIA),
  );

  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        setCounts(toRoleCountConfig(getDefaultRoleConfig(Math.max(n, 4)))),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [n]);

  useEffect(() => {
    if (roundsDirty) return;
    const next = defaultMaxRoundsFromMafiaCount(counts.MAFIA);
    const timer = window.setTimeout(() => setMaxRoundsLocal(next), 0);
    // Firebase에 즉시 쓰지 않는다. 전체 room set 과 수동 배정이 레이스하면
    // 방금 저장한 직업이 덮어씌워질 수 있다. 라운드는 시작/배정 버튼에서 함께 전달한다.
    return () => window.clearTimeout(timer);
  }, [counts.MAFIA, roundsDirty]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
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
    }, 0);
    return () => window.clearTimeout(timer);
  }, [players]);

  const special = specialRoleTotal(counts);
  const citizenCount = Math.max(0, n - special);
  const specialRoleOverflow = special > n;
  const mafiaTooFew = counts.MAFIA < 1;
  const mafiaTooMany = n > 0 && counts.MAFIA * 2 >= n;
  const countsValid =
    n > 0 && !specialRoleOverflow && !mafiaTooFew && !mafiaTooMany;

  const allAssigned = players.length > 0 && players.every((p) => p.role != null);
  const manualAssignedCount = players.filter((p) => Boolean(manual[p.id])).length;
  const manualMafiaCount = players.filter((p) => manual[p.id] === 'MAFIA').length;
  const manualMafiaTooMany = n > 0 && manualMafiaCount * 2 >= n;
  const manualReady =
    players.length >= 4 &&
    players.every((p) => Boolean(manual[p.id])) &&
    manualMafiaCount >= 1 &&
    !manualMafiaTooMany;

  const setCount = (key: keyof RoleCountConfig, value: number) => {
    setCounts((c) => ({
      ...c,
      [key]: Math.max(0, Math.min(n, Math.floor(Number.isFinite(value) ? value : 0))),
    }));
  };

  const bump = (key: keyof RoleCountConfig, delta: number) => {
    setCount(key, counts[key] + delta);
  };

  const applyMaxRounds = (value: number) => {
    const clamped = Math.max(1, Math.min(30, Math.floor(value) || 1));
    setRoundsDirty(true);
    setMaxRoundsLocal(clamped);
    // 로컬만 갱신. 저장은 배정/시작 시 maxRounds 인자로 함께 반영한다.
  };

  const suggested = defaultMaxRoundsFromMafiaCount(counts.MAFIA);
  const applyDefaultRolePreset = () => {
    const next = toRoleCountConfig(getDefaultRoleConfig(Math.max(n, 4)));
    setCounts(next);
    setRoundsDirty(false);
    setMaxRoundsLocal(defaultMaxRoundsFromMafiaCount(next.MAFIA));
  };

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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-400/10 px-4 py-3 ring-1 ring-amber-300/20">
            <div>
              <p className="text-sm font-black text-amber-100">
                참여 인원 {n}명 기준 추천 직업 배치
              </p>
              <p className="mt-1 text-xs text-white/55">
                교사는 아래 수량을 자유롭게 수정할 수 있고, 시민 수는 자동 계산됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={applyDefaultRolePreset}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-300/20 px-3 py-2 text-xs font-black text-amber-100 ring-1 ring-amber-200/30 transition hover:bg-amber-300/30"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              추천 설정으로 리셋
            </button>
          </div>
          <p className="text-sm text-white/60">
            직업별 인원만 정하면 자동으로 랜덤 배정됩니다. 나머지 {citizenCount}명은
            시민입니다.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {RANDOM_ROLE_FIELDS.map((role) => {
              const Icon = role.icon;
              const tone = ROLE_TONE_CLASSES[role.tone];
              return (
                <div
                  key={role.key}
                  title={role.description}
                  className={`rounded-2xl border px-3 py-3 ${tone.card}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-white">{role.label}</span>
                        <Info className="h-3.5 w-3.5 text-white/40" aria-label={role.description} />
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-white/55">
                        {role.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      aria-label={`${role.label} 1명 줄이기`}
                      disabled={counts[role.key] <= 0}
                      className="h-9 w-9 rounded-lg bg-black/25 text-xl font-black text-white transition hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-30"
                      onClick={() => bump(role.key, -1)}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={n}
                      inputMode="numeric"
                      aria-label={`${role.label} 수량`}
                      value={counts[role.key]}
                      onChange={(event) => setCount(role.key, Number(event.target.value))}
                      className={`h-9 w-16 rounded-lg border border-white/15 bg-stone-950/70 text-center font-mono text-lg font-black outline-none ring-amber-300/50 transition focus:ring-2 ${tone.value}`}
                    />
                    <button
                      type="button"
                      aria-label={`${role.label} 1명 늘리기`}
                      disabled={counts[role.key] >= n}
                      className="h-9 w-9 rounded-lg bg-black/25 text-xl font-black text-white transition hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-30"
                      onClick={() => bump(role.key, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <SummaryCard label="전체 학생" value={n} tone="neutral" />
            <SummaryCard label="특수 직업" value={special} tone="amber" />
            <SummaryCard label="시민 (자동)" value={citizenCount} tone="emerald" />
            <SummaryCard
              label="현재 배치 합계"
              value={special + citizenCount}
              tone={specialRoleOverflow ? 'danger' : 'neutral'}
              suffix={`/ ${n}`}
            />
          </div>

          {!countsValid && (
            <div className="space-y-1 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {specialRoleOverflow && <p>직업 인원의 합이 전체 학생 수를 초과했습니다.</p>}
              {mafiaTooFew && <p>마피아 수량은 최소 1명이어야 합니다.</p>}
              {mafiaTooMany && (
                <p>마피아가 전체 인원의 50% 이상입니다. 시민 팀이 너무 적습니다.</p>
              )}
              {n === 0 && <p>학생이 입장한 뒤 직업 배치를 설정할 수 있습니다.</p>}
            </div>
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
                : manualMafiaCount < 1
                  ? '마피아를 최소 1명 배정해야 시작할 수 있습니다.'
                  : '마피아가 전체 인원의 50% 이상이면 게임을 시작할 수 없습니다.'}
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

function SummaryCard({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone: 'neutral' | 'amber' | 'emerald' | 'danger';
}) {
  const styles = {
    neutral: 'border-white/10 bg-white/5 text-white',
    amber: 'border-amber-300/20 bg-amber-400/10 text-amber-100',
    emerald: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
    danger: 'border-red-300/30 bg-red-500/15 text-red-100',
  }[tone];

  return (
    <div className={`rounded-xl border px-3 py-3 ${styles}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold opacity-70">{label}</p>
        {tone === 'emerald' && <BadgeCheck className="h-4 w-4 opacity-80" />}
      </div>
      <p className="mt-1 font-mono text-2xl font-black">
        {value}
        {suffix && <span className="ml-1 text-xs font-bold opacity-60">{suffix}</span>}
      </p>
    </div>
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
