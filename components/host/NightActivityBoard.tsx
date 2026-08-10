'use client';

import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { ROLE_ACCENTS, ROLE_LABELS } from '@/lib/game/roles';
import { alivePlayers, playerList } from '@/lib/game/room';
import type { GameRoom, Player, Role } from '@/types/game';

const NIGHT_ROLES: Role[] = [
  'MAFIA',
  'DOCTOR',
  'POLICE',
  'REPORTER',
  'SPIRITUALIST',
];

const ACTION_LABEL: Record<Exclude<Role, 'CITIZEN'>, string> = {
  MAFIA: '암살 지목',
  DOCTOR: '치료 대상',
  POLICE: '조사 대상',
  REPORTER: '취재 대상',
  SPIRITUALIST: '영혼 문의',
};

function targetName(room: GameRoom, targetId: string | null): string {
  if (!targetId) return '대기 중…';
  return room.players[targetId]?.name ?? '???';
}

function policeResult(room: GameRoom, targetId: string | null): string | null {
  if (!targetId) return null;
  // 확정된 아침 결과가 있으면 그것을 우선 표시
  const report = room.nightResults?.policeReport;
  if (report && room.gameState !== 'NIGHT') {
    if (report.targetId !== targetId) {
      return `확정 조사 대상 아님 (확정: ${report.targetName})`;
    }
    return report.isMafia
      ? `확정 결과: 마피아 O${report.wasTie ? ' · 동률추첨' : ''}`
      : `확정 결과: 마피아 아님 X${report.wasTie ? ' · 동률추첨' : ''}`;
  }
  const t = room.players[targetId];
  if (!t) return null;
  return t.role === 'MAFIA' ? '결과: 마피아 O' : '결과: 마피아 아님 X';
}

function spiritualistResult(
  room: GameRoom,
  targetId: string | null,
): string | null {
  if (!targetId) return null;
  const t = room.players[targetId];
  if (!t?.role) return null;
  return `진짜 직업: ${ROLE_LABELS[t.role]}`;
}

export function NightActivityBoard({ room }: { room: GameRoom }) {
  const silenced = room.gmEvent === 'SILENCE_NIGHT';
  const byRole = NIGHT_ROLES.map((role) => ({
    role,
    actors: playerList(room).filter(
      (p) => p.isAlive && p.role === role,
    ),
  })).filter((g) => g.actors.length > 0);

  const citizens = alivePlayers(room).filter((p) => p.role === 'CITIZEN');
  const pendingSpecial = byRole.flatMap((g) => g.actors).filter((p) => {
    if (silenced && (p.role === 'DOCTOR' || p.role === 'POLICE')) return false;
    return !p.nightTarget;
  }).length;

  return (
    <div className="mx-auto mt-6 w-full max-w-4xl text-left">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-amber-200/90">
          직업별 밤 활동 (교사 전용)
        </h3>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/70">
          미완료 {pendingSpecial}명
          {silenced ? ' · 정전(경찰·의사 무효)' : ''}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {byRole.map(({ role, actors }) => (
          <RoleActivityCard
            key={role}
            room={room}
            role={role}
            actors={actors}
            silenced={silenced}
          />
        ))}
      </div>

      {citizens.length > 0 && (
        <div className="mt-3 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
          <p className="text-xs font-bold text-white/50">시민 (능력 없음)</p>
          <p className="mt-1 text-sm text-white/75">
            {citizens.map((c) => c.name).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}

function RoleActivityCard({
  room,
  role,
  actors,
  silenced,
}: {
  room: GameRoom;
  role: Role;
  actors: Player[];
  silenced: boolean;
}) {
  const blocked =
    silenced && (role === 'DOCTOR' || role === 'POLICE');
  const accent = ROLE_ACCENTS[role];
  const action =
    role === 'CITIZEN' ? '대기' : ACTION_LABEL[role as Exclude<Role, 'CITIZEN'>];

  return (
    <section
      className="rounded-xl p-4 ring-1 ring-white/10"
      style={{ background: `linear-gradient(135deg, ${accent}33, #00000066)` }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-black text-white">
          {ROLE_LABELS[role]}
          <span className="ml-2 text-xs font-semibold text-white/55">
            {action}
          </span>
        </p>
        {blocked && (
          <span className="rounded-md bg-slate-700/80 px-2 py-0.5 text-[10px] font-bold text-slate-100">
            정전 · 무효
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {actors.map((actor) => {
          const targetId = actor.nightTarget;
          const done = Boolean(targetId) || blocked;
          let detail: string | null = null;
          if (role === 'POLICE' && targetId && !blocked) {
            // 교사만 마피아 여부 표시
            detail = policeResult(room, targetId);
          }
          if (role === 'REPORTER' && targetId) {
            const resolved = room.nightResults;
            if (
              resolved?.reporterTargetId &&
              room.gameState !== 'NIGHT'
            ) {
              detail =
                resolved.reporterTargetId === targetId
                  ? `확정 취재${resolved.reporterWasTie ? ' · 동률추첨' : ''}: ${
                      resolved.reporterTargetRole
                        ? ROLE_LABELS[resolved.reporterTargetRole]
                        : '???'
                    }`
                  : `확정 대상 아님 (→ ${
                      room.players[resolved.reporterTargetId ?? '']?.name ?? '?'
                    })`;
            } else {
              const t = room.players[targetId];
              detail = t?.role
                ? `취재 예정 직업: ${ROLE_LABELS[t.role]}`
                : null;
            }
          }
          if (role === 'SPIRITUALIST' && targetId) {
            detail = spiritualistResult(room, targetId);
          }

          return (
            <li
              key={actor.id}
              className="flex items-center gap-3 rounded-lg bg-black/35 px-3 py-2"
            >
              <CharacterAvatar
                avatarId={actor.avatarId}
                isAlive={actor.isAlive}
                size={40}
                previewOnHover
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">
                  {actor.name}
                </p>
                <p className="truncate text-xs text-white/65">
                  {blocked
                    ? '정전으로 행동 불가'
                    : `${action} → ${targetName(room, targetId)}${
                        role === 'DOCTOR' && targetId === actor.id
                          ? ' (자힐)'
                          : ''
                      }`}
                </p>
                {role === 'DOCTOR' && actor.hasSelfHealed && (
                  <p className="mt-0.5 text-[10px] font-semibold text-sky-200/70">
                    자힐 사용 완료
                  </p>
                )}
                {role === 'DOCTOR' &&
                  room.nightResults?.doctorSavedPlayerId &&
                  room.gameState !== 'NIGHT' &&
                  targetId && (
                    <p className="mt-0.5 text-xs font-semibold text-amber-200">
                      {room.nightResults?.doctorSavedPlayerId === targetId
                        ? `확정 구출${
                            room.nightResults?.doctorSaveWasTie
                              ? ' · 동률추첨'
                              : ''
                          }`
                        : `확정 아님 (→ ${
                            room.players[
                              room.nightResults?.doctorSavedPlayerId ?? ''
                            ]?.name ?? '?'
                          })`}
                    </p>
                  )}
                {detail && (
                  <p className="mt-0.5 text-xs font-semibold text-amber-200">
                    {detail}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  done
                    ? 'bg-emerald-500/25 text-emerald-200'
                    : 'bg-amber-500/20 text-amber-100'
                }`}
              >
                {blocked ? '무효' : done ? '완료' : '대기'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
