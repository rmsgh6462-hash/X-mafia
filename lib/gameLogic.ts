import type {
  GameRoom,
  ActiveMorningEvent,
  NightResults,
  Player,
  Role,
} from '@/types/game';
import { playerGenderFromAvatarId } from '@/lib/game/avatars';
import { ROLE_LABELS } from '@/lib/game/roles';
import {
  buildNightDeathAnnouncement,
  finalizeNightQuiz,
} from '@/lib/game/room';
import { evaluateGameEnd } from '@/lib/game/winConditions';

export { evaluateGameEnd, checkGameOver } from '@/lib/game/winConditions';

function playersOf(room: GameRoom): Player[] {
  return Object.values(room.players ?? {});
}

/**
 * 동종 직업 밤 지목 집계 — 최다 득표, 동률이면 무작위 1명.
 */
export function resolveTieAction(targetIds: string[]): {
  selectedId: string | null;
  wasTie: boolean;
  tallies: Record<string, number>;
} {
  const tallies: Record<string, number> = {};
  targetIds.forEach((id) => {
    if (!id) return;
    tallies[id] = (tallies[id] ?? 0) + 1;
  });

  const entries = Object.entries(tallies).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0 || entries[0][1] <= 0) {
    return { selectedId: null, wasTie: false, tallies };
  }

  const topCount = entries[0][1];
  const tied = entries.filter(([, c]) => c === topCount).map(([id]) => id);
  const wasTie = tied.length > 1;
  const selectedId =
    tied[Math.floor(Math.random() * tied.length)] ?? null;

  return { selectedId, wasTie, tallies };
}

/** 생존한 특정 직업의 nightTarget 목록 */
export function collectRoleNightTargets(
  room: GameRoom,
  role: Role,
): string[] {
  return playersOf(room)
    .filter((p) => p.isAlive && p.role === role && p.nightTarget)
    .map((p) => p.nightTarget as string);
}

/** 마피아 nightTarget 수집 — 버프 없으면 최다 1명(동률 무작위), 버프면 전원 */
export function collectMafiaKillTargets(room: GameRoom): string[] {
  const targets = collectRoleNightTargets(room, 'MAFIA');
  if (!room.isMafiaBuffActive) {
    const { selectedId } = resolveTieAction(targets);
    return selectedId ? [selectedId] : [];
  }
  return [...new Set(targets)];
}

/** 의사 구출 — 정전 시 무효, 다수 의사 동률 시 무작위 1명 */
export function collectDoctorSaveTargets(room: GameRoom): string[] {
  if (room.gmEvent === 'SILENCE_NIGHT') return [];
  const { selectedId } = resolveDoctorSave(room);
  return selectedId ? [selectedId] : [];
}

/** 의사 치료 대상 확정 (동률 무작위 + 자힐 무효 지목은 제외하지 않음 — UI에서 차단) */
export function resolveDoctorSave(room: GameRoom): {
  selectedId: string | null;
  wasTie: boolean;
  tallies: Record<string, number>;
} {
  if (room.gmEvent === 'SILENCE_NIGHT') {
    return { selectedId: null, wasTie: false, tallies: {} };
  }

  // 이미 자힐을 쓴 의사가 다시 자신을 지목한 경우는 무효 처리
  const targets = playersOf(room)
    .filter((p) => p.isAlive && p.role === 'DOCTOR' && p.nightTarget)
    .map((p) => {
      const targetId = p.nightTarget as string;
      if (targetId === p.id && p.hasSelfHealed) return null;
      return targetId;
    })
    .filter((id): id is string => Boolean(id));

  return resolveTieAction(targets);
}

/** 기자 취재 — 동률 시 무작위, 아침 전체 공개용 실제 직업 속보 */
export function resolveReporterInvestigation(room: GameRoom): {
  news: string | null;
  targetId: string | null;
  targetRole: Role | null;
  wasTie: boolean;
} {
  const { selectedId, wasTie } = resolveTieAction(
    collectRoleNightTargets(room, 'REPORTER'),
  );
  if (!selectedId) {
    return { news: null, targetId: null, targetRole: null, wasTie: false };
  }
  const target = room.players[selectedId];
  if (!target?.role) {
    return {
      news: null,
      targetId: selectedId,
      targetRole: null,
      wasTie,
    };
  }
  const tieNote = wasTie ? ' (기자 지목 동률 → 무작위 선정)' : '';
  return {
    news: `[속보] ${target.name} 님의 직업은 「${ROLE_LABELS[target.role]}」입니다.${tieNote}`,
    targetId: selectedId,
    targetRole: target.role,
    wasTie,
  };
}

/** 경찰 조사 — 동률 시 무작위, 경찰·교사만 열람 */
export function resolvePoliceInvestigation(room: GameRoom): {
  targetId: string;
  targetName: string;
  isMafia: boolean;
  wasTie: boolean;
} | null {
  if (room.gmEvent === 'SILENCE_NIGHT') return null;

  const { selectedId, wasTie } = resolveTieAction(
    collectRoleNightTargets(room, 'POLICE'),
  );
  if (!selectedId) return null;
  const target = room.players[selectedId];
  if (!target) return null;

  return {
    targetId: selectedId,
    targetName: target.name,
    isMafia: target.role === 'MAFIA',
    wasTie,
  };
}

/** @deprecated — resolveReporterInvestigation 사용 */
export function collectReporterNews(room: GameRoom): string | null {
  return (
    room.nightResults?.reporterNews ??
    resolveReporterInvestigation(room).news
  );
}

export interface ResolveNightOptions {
  openReviveVote?: boolean;
}

/**
 * 밤 세션 결과 연산
 * - 밤 퀴즈 판정 → 성공 시 아침 힌트
 * - 마피아 킬 / 의사 구출
 * - 기자·경찰 동률 시 무작위 1명 확정
 * - gameState → RESULT
 */
export function resolveNight(
  room: GameRoom,
  options: ResolveNightOptions = {},
): GameRoom {
  const nextRoom = finalizeNightQuiz(room);

  // 마피아 킬 대상
  const killTargets = collectMafiaKillTargets(nextRoom);

  const doctorSave = resolveDoctorSave(nextRoom);
  const savedIds = doctorSave.selectedId ? [doctorSave.selectedId] : [];
  const savedSet = new Set(savedIds);

  const deadPlayerIds = killTargets.filter((id) => {
    const target = nextRoom.players[id];
    if (!target || !target.isAlive) return false;
    if (savedSet.has(id)) return false;
    return true;
  });

  // 공격 대상과 의사의 보호 대상이 일치하고, 다른 희생자도 없을 때만 성공 연출을 띄운다.
  const isDoctorDefended =
    deadPlayerIds.length === 0 &&
    doctorSave.selectedId !== null &&
    killTargets.includes(doctorSave.selectedId);

  const quiz = nextRoom.nightQuizState;
  const quizSuccess = quiz?.outcome === 'SUCCESS';
  const quizHint =
    quizSuccess && quiz?.successHint ? quiz.successHint : null;

  const reporter = resolveReporterInvestigation(nextRoom);
  const policeReport = resolvePoliceInvestigation(nextRoom);

  // 아침 공개 큐는 고정 순서(마피아 → 의사 → 기자)로 만든다.
  // 능력을 쓰지 않았거나 해당 직업이 이미 탈락한 경우에도 미행동 연출을 남긴다.
  const activeEvents: ActiveMorningEvent[] = [];
  const mafiaActor = playersOf(nextRoom).find(
    (p) => p.isAlive && p.role === 'MAFIA' && Boolean(p.nightTarget),
  );
  if (mafiaActor && killTargets.length > 0) {
    const targetId = killTargets[0] ?? mafiaActor.nightTarget;
    const target = targetId ? nextRoom.players[targetId] : null;
    activeEvents.push({
      event: 'MAFIA_KILL',
      actorId: mafiaActor.id,
      targetId,
      targetName: target?.name ?? null,
      targetGender: target?.gender ?? playerGenderFromAvatarId(target?.avatarId),
    });
  }

  const doctorActor = playersOf(nextRoom).find((p) => p.role === 'DOCTOR');
  if (
    doctorActor &&
    doctorActor.isAlive &&
    !deadPlayerIds.includes(doctorActor.id) &&
    doctorActor.nightTarget
  ) {
    const targetId = doctorActor.nightTarget;
    const target = nextRoom.players[targetId];
    activeEvents.push({
      event: 'DOCTOR_DEFEND',
      actorId: doctorActor.id,
      targetId,
      targetName: target?.name ?? null,
      targetGender: target?.gender ?? playerGenderFromAvatarId(target?.avatarId),
      success: isDoctorDefended && doctorSave.selectedId === targetId,
    });
  } else if (doctorActor) {
    activeEvents.push({
      event: 'DOCTOR_IDLE',
      actorId: doctorActor.id,
      targetId: null,
      targetName: null,
      targetGender: null,
    });
  }

  const reporterActor = playersOf(nextRoom).find(
    (p) =>
      p.role === 'REPORTER' &&
      p.isAlive &&
      !deadPlayerIds.includes(p.id) &&
      Boolean(p.nightTarget) &&
      p.nightTarget === reporter.targetId,
  );
  if (reporterActor && reporter.news && reporter.targetId) {
    const target = nextRoom.players[reporter.targetId];
    activeEvents.push({
      event: 'REPORTER_NEWS',
      actorId: reporterActor.id,
      targetId: reporter.targetId,
      targetName: target?.name ?? null,
      targetGender: target?.gender ?? playerGenderFromAvatarId(target?.avatarId),
    });
  } else {
    const reporterPlayer = playersOf(nextRoom).find((p) => p.role === 'REPORTER');
    if (reporterPlayer) {
      activeEvents.push({
        event: 'REPORTER_IDLE',
        actorId: reporterPlayer.id,
        targetId: null,
        targetName: null,
        targetGender: null,
      });
    }
  }

  const morningEvents = activeEvents.map(({ event }) => event);

  const reveal = nextRoom.revealDeathRoles !== false;
  const deadRoles: Record<string, Role> = {};
  const deathAnnouncements: string[] = [];
  deadPlayerIds.forEach((id) => {
    const p = nextRoom.players[id];
    if (!p) return;
    if (reveal && p.role) deadRoles[id] = p.role;
    deathAnnouncements.push(
      buildNightDeathAnnouncement(p.name, p.role, reveal),
    );
  });

  const actionLog = playersOf(nextRoom)
    .filter(
      (p) =>
        p.role === 'MAFIA' ||
        p.role === 'DOCTOR' ||
        p.role === 'POLICE' ||
        p.role === 'REPORTER' ||
        p.role === 'SPIRITUALIST',
    )
    .map((p) => ({
      actorId: p.id,
      role: p.role as Role,
      targetId: p.nightTarget,
    }));

  const nightResults: NightResults = {
    deadPlayerIds,
    savedPlayerIds: savedIds.filter((id) => killTargets.includes(id)),
    activeEvents,
    morningEvent: morningEvents[0] ?? null,
    morningEvents,
    deadRoles,
    deathAnnouncements,
    doctorSavedPlayerId: doctorSave.selectedId,
    doctorSaveWasTie: doctorSave.wasTie,
    isDoctorDefended,
    reporterNews: reporter.news,
    reporterTargetId: reporter.targetId,
    reporterTargetRole: reporter.targetRole,
    reporterWasTie: reporter.wasTie,
    policeReport,
    quizHint,
    quizSuccessRate: quiz?.finalSuccessRate ?? null,
    quizOutcome: quiz?.outcome ?? null,
    actionLog,
  };

  const nextPlayers: Record<string, Player> = {};
  Object.values(nextRoom.players).forEach((p) => {
    const died = deadPlayerIds.includes(p.id);
    // 의사가 자신을 지목했으면 자힐 1회 소모 (정전이 아닐 때)
    const usedSelfHeal =
      p.role === 'DOCTOR' &&
      p.isAlive &&
      p.nightTarget === p.id &&
      nextRoom.gmEvent !== 'SILENCE_NIGHT' &&
      !p.hasSelfHealed;
    nextPlayers[p.id] = {
      ...p,
      isAlive: died ? false : p.isAlive,
      nightTarget: null,
      hasSelfHealed: usedSelfHeal ? true : p.hasSelfHealed === true,
    };
  });

  const openRevive =
    options.openReviveVote !== false &&
    nextRoom.gmEvent === 'REVIVE_NIGHT' &&
    deadPlayerIds.length > 0;

  const resolved: GameRoom = {
    ...nextRoom,
    players: nextPlayers,
    nightResults,
    morningRevealIndex: 0,
    morningIdentityStep: 'NONE',
    currentHint: quizHint ?? nextRoom.currentHint ?? null,
    gameState: 'RESULT',
    votes: {},
    matchEndsAt: null,
    voteEndsAt: null,
    talkEndsAt: null,
    voteRevoteCandidates: null,
    gmEvent: openRevive ? 'REVIVE_NIGHT' : null,
    isMafiaBuffActive: false,
  };

  // 밤 사망으로 마피아가 전멸하면 즉시 시민 승리 (라운드 한도는 낮 종료 시 판정)
  return evaluateGameEnd(resolved);
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

  const next: GameRoom = {
    ...room,
    players: nextPlayers,
    nightResults: room.nightResults
      ? { ...room.nightResults, deadPlayerIds: remainingDead }
      : null,
    gmEvent: null,
    votes: {},
    gameState: 'DAY_TALK',
  };
  return evaluateGameEnd(next);
}

/** 아침 발표 종료 → 낮 토론 */
export function dismissMorningResult(room: GameRoom): GameRoom {
  if (room.gameState === 'ENDED') return room;
  return evaluateGameEnd({
    ...room,
    gameState: 'DAY_TALK',
    morningRevealIndex: 0,
    morningIdentityStep: 'NONE',
    gmEvent: room.gmEvent === 'REVIVE_NIGHT' ? 'REVIVE_NIGHT' : null,
  });
}

function currentMorningEvent(room: GameRoom) {
  const events = room.nightResults?.activeEvents ?? [];
  if (events.length === 0) return null;
  const index = Math.min(
    Math.max(0, room.morningRevealIndex ?? 0),
    events.length - 1,
  );
  return events[index] ?? null;
}

function canRevealMorningIdentity(room: GameRoom): boolean {
  const event = currentMorningEvent(room);
  if (!event || event.event !== 'MAFIA_KILL' || !event.targetId) return false;
  if (room.revealDeathRoles === false) return false;
  const deadIds = room.nightResults?.deadPlayerIds ?? [];
  if (!deadIds.includes(event.targetId)) return false;
  return Boolean(room.nightResults?.deadRoles?.[event.targetId]);
}

/**
 * 교사 수동 — 아침 공개 진행.
 * 사망자 직업 공개가 있으면 TEASE → 맞습니다/아닙니다 → 정체 공개 후 다음 이벤트로.
 */
export function advanceMorningReveal(room: GameRoom): GameRoom {
  if (room.gameState !== 'RESULT') return room;
  const events = room.nightResults?.activeEvents ?? [];
  const legacyCount = room.nightResults?.morningEvents?.length ?? 0;
  const total = Math.max(events.length, legacyCount, 0);
  if (total <= 0) return room;

  const current = Math.max(0, room.morningRevealIndex ?? 0);
  const step = room.morningIdentityStep ?? 'NONE';

  if (canRevealMorningIdentity(room)) {
    if (step === 'NONE') {
      return { ...room, morningIdentityStep: 'TEASE' };
    }
    if (step === 'TEASE') {
      return { ...room, morningIdentityStep: 'REVEAL_MAFIA_CHECK' };
    }
    if (step === 'REVEAL_MAFIA_CHECK') {
      return { ...room, morningIdentityStep: 'REVEAL_FULL_ROLE' };
    }
    // REVEAL_FULL_ROLE → 다음 이벤트
  }

  if (current >= total - 1) {
    return { ...room, morningIdentityStep: 'REVEAL_FULL_ROLE' };
  }
  return {
    ...room,
    morningRevealIndex: current + 1,
    morningIdentityStep: 'NONE',
  };
}

export function hasAliveSpiritualist(room: GameRoom): boolean {
  return playersOf(room).some(
    (p) => p.role === 'SPIRITUALIST' && p.isAlive === true,
  );
}
