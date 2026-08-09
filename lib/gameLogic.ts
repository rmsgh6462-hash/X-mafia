import type { GameRoom, NightResults, Player } from '@/types/game';

function playersOf(room: GameRoom): Player[] {
  return Object.values(room.players ?? {});
}

/** 마피아 nightTarget 수집 후 Set으로 중복 제거 */
export function collectMafiaKillTargets(room: GameRoom): string[] {
  const targets = playersOf(room)
    .filter((p) => p.isAlive && p.role === 'MAFIA' && p.nightTarget)
    .map((p) => p.nightTarget as string);

  // 멀티킬 버프가 없으면 최다 득표(지목) 1명만, 있으면 전원 독립 지목(중복 제거)
  if (!room.isMafiaBuffActive) {
    if (targets.length === 0) return [];
    const counts = new Map<string, number>();
    targets.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    let best = targets[0];
    let bestCount = 0;
    counts.forEach((count, id) => {
      if (count > bestCount) {
        best = id;
        bestCount = count;
      }
    });
    return [best];
  }

  return [...new Set(targets)];
}

/** 의사 구출 대상 (정전 시 무효) */
export function collectDoctorSaveTargets(room: GameRoom): string[] {
  if (room.gmEvent === 'SILENCE_NIGHT') return [];

  const saves = playersOf(room)
    .filter((p) => p.isAlive && p.role === 'DOCTOR' && p.nightTarget)
    .map((p) => p.nightTarget as string);

  return [...new Set(saves)];
}

/** 기자 속보 문구 (기존 값 유지 또는 nightTarget 기반 생성) */
export function collectReporterNews(room: GameRoom): string | null {
  const existing = room.nightResults?.reporterNews ?? null;
  if (existing) return existing;

  const reporter = playersOf(room).find(
    (p) => p.isAlive && p.role === 'REPORTER' && p.nightTarget,
  );
  if (!reporter?.nightTarget) return null;
  const target = room.players[reporter.nightTarget];
  if (!target) return null;
  return `[속보] ${target.name} 님 주변에서 수상한 움직임이 포착되었습니다.`;
}

export interface ResolveNightOptions {
  /** 기회의 밤: 사망 적용 후 부활 투표 대기 */
  openReviveVote?: boolean;
}

/**
 * 밤 세션 결과 연산
 * - 마피아 킬(멀티킬 시 Set 중복 제거)
 * - 의사 구출 (SILENCE_NIGHT 시 불가)
 * - 플레이어 isAlive 반영 + nightResults 기록
 * - gameState → RESULT (아침 발표)
 */
export function resolveNight(
  room: GameRoom,
  options: ResolveNightOptions = {},
): GameRoom {
  const killTargets = collectMafiaKillTargets(room);
  const savedIds = collectDoctorSaveTargets(room);
  const savedSet = new Set(savedIds);

  const deadPlayerIds = killTargets.filter((id) => {
    const target = room.players[id];
    if (!target || !target.isAlive) return false;
    if (savedSet.has(id)) return false;
    return true;
  });

  const nightResults: NightResults = {
    deadPlayerIds,
    savedPlayerIds: savedIds.filter((id) => killTargets.includes(id)),
    reporterNews: collectReporterNews(room),
  };

  const nextPlayers: Record<string, Player> = {};
  Object.values(room.players).forEach((p) => {
    const died = deadPlayerIds.includes(p.id);
    nextPlayers[p.id] = {
      ...p,
      isAlive: died ? false : p.isAlive,
      nightTarget: null,
    };
  });

  const openRevive =
    options.openReviveVote !== false &&
    room.gmEvent === 'REVIVE_NIGHT' &&
    deadPlayerIds.length > 0;

  return {
    ...room,
    players: nextPlayers,
    nightResults,
    gameState: 'RESULT',
    votes: {},
    matchEndsAt: null,
    voteEndsAt: null,
    // 부활 투표 세션이면 gmEvent 유지, 아니면 소모
    gmEvent: openRevive ? 'REVIVE_NIGHT' : null,
    isMafiaBuffActive: false,
  };
}

/** 부활 투표 집계 — 최다 득표 사망자 1명 부활 후 낮으로 */
export function resolveReviveVote(room: GameRoom): GameRoom {
  const candidates = new Set(room.nightResults?.deadPlayerIds ?? []);
  const tallies: Record<string, number> = {};

  Object.values(room.votes ?? {}).forEach((targetId) => {
    if (!candidates.has(targetId)) return;
    tallies[targetId] = (tallies[targetId] ?? 0) + 1;
  });

  let reviveId: string | null = null;
  let best = 0;
  Object.entries(tallies).forEach(([id, count]) => {
    if (count > best) {
      best = count;
      reviveId = id;
    }
  });

  const nextPlayers: Record<string, Player> = { ...room.players };
  if (reviveId && nextPlayers[reviveId]) {
    nextPlayers[reviveId] = { ...nextPlayers[reviveId], isAlive: true };
  }

  const remainingDead = (room.nightResults?.deadPlayerIds ?? []).filter(
    (id) => id !== reviveId,
  );

  return {
    ...room,
    players: nextPlayers,
    nightResults: room.nightResults
      ? { ...room.nightResults, deadPlayerIds: remainingDead }
      : null,
    gmEvent: null,
    votes: {},
    gameState: 'DAY_TALK',
  };
}

/** 아침 발표 종료 → 낮 토론 */
export function dismissMorningResult(room: GameRoom): GameRoom {
  return {
    ...room,
    gameState: 'DAY_TALK',
    // 부활 투표 미완료면 유지, 그 외 GM 이벤트 소모
    gmEvent: room.gmEvent === 'REVIVE_NIGHT' ? 'REVIVE_NIGHT' : null,
  };
}

export function hasAliveSpiritualist(room: GameRoom): boolean {
  return playersOf(room).some(
    (p) => p.role === 'SPIRITUALIST' && p.isAlive === true,
  );
}
