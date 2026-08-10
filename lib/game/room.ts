import {
  get,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  set,
  update,
  type Unsubscribe,
} from 'firebase/database';
import { getFirebaseDatabase } from '@/lib/firebase';
import {
  isAvatarId,
  playerGenderFromAvatarId,
  takenAvatarIds,
} from '@/lib/game/avatars';
import {
  buildMafiaMissionState,
  createNightQuizState,
  emptyMafiaMissionState,
  getNightQuizStats,
  isAnswerCorrect,
} from '@/lib/game/missions';
import {
  generateQuizByMode,
  type ElementaryGrade,
  type QuizMode,
} from '@/lib/game/quizGenerator';
import {
  buildRoleDeck,
  buildRoleDeckFromCounts,
  ROLE_LABELS,
  type RoleCountConfig,
} from '@/lib/game/roles';
import { resolveAssignmentsWithRandomFill } from '@/lib/roleAssignment';
import { evaluateGameEnd } from '@/lib/game/winConditions';
import type {
  GameRoom,
  GhostChatMessage,
  MafiaChatMessage,
  MafiaMissionAssignConfig,
  MatchChatMessage,
  MissionOutcome,
  MissionSubmission,
  NicknameChangeRequest,
  NightQuizConfig,
  NightQuizState,
  Player,
  Role,
  Theme,
  WinnerSide,
} from '@/types/game';

export function createEmptyRoom(theme: Theme, pin: string): GameRoom {
  return {
    roomId: pin,
    pin,
    gameState: 'WAITING',
    theme,
    players: {},
    nightQuizState: null,
    pendingNightQuizConfig: null,
    mafiaMissionState: emptyMafiaMissionState(),
    pendingMafiaNightBuff: false,
    isMafiaBuffActive: false,
    currentCitizenMission: null,
    mafiaMission: null,
    missionSubmissions: {},
    missionPeerMap: {},
    missionOutcome: null,
    currentHint: null,
    nightResults: null,
    morningRevealIndex: 0,
    morningIdentityStep: 'NONE',
    gmEvent: null,
    votes: {},
    matchEndsAt: null,
    voteEndsAt: null,
    talkEndsAt: null,
    voteTieResolution: 'RANDOM',
    revealDeathRoles: true,
    allowMafiaTargetMafia: true,
    mafiaChatEnabled: true,
    maxRounds: 3,
    currentRound: 0,
    winnerSide: null,
    victoryTeam: null,
    voteRevoteCandidates: null,
    dayVoteResult: null,
    createdAt: Date.now(),
    ghostChat: {},
    mafiaChat: {},
    matchChats: {},
    matchChatHistory: {},
    ghostPredictions: {},
    nicknameChangeRequest: null,
    pendingRoleAssignments: null,
    roleCountConfig: null,
    nightQuizPreviewByRole: defaultNightQuizPreviewByRole(),
  };
}

export function defaultNightQuizPreviewByRole(): Record<Role, boolean> {
  return {
    CITIZEN: false,
    MAFIA: false,
    DOCTOR: false,
    POLICE: false,
    REPORTER: false,
    SPIRITUALIST: false,
  };
}

export function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Firebase Realtime Database는 undefined / NaN / Infinity 를 거부한다.
 * 저장 직전에 안전하게 JSON 호환 값으로 정리한다.
 */
export function toFirebaseJson<T>(value: T): T {
  return sanitizeForFirebase(value) as T;
}

function sanitizeForFirebase(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) =>
      item === undefined ? null : sanitizeForFirebase(item),
    );
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (child === undefined) continue;
    out[key] = sanitizeForFirebase(child);
  }
  return out;
}

export async function saveRoom(room: GameRoom): Promise<void> {
  try {
    const db = getFirebaseDatabase();
    const payload = toFirebaseJson(normalizeGameRoom(room));
    await set(ref(db, `rooms/${room.roomId}`), payload);
  } catch (err) {
    console.error('saveRoom failed', err);
    const detail =
      err instanceof Error && err.message
        ? err.message
        : '방 저장에 실패했습니다.';
    throw new Error(detail);
  }
}

/** 교사: 게임 종료 — 모든 클라이언트에 최종 결과 화면을 표시 */
export function endGameRoom(room: GameRoom): GameRoom {
  return {
    ...room,
    gameState: 'ENDED',
    winnerSide: room.winnerSide ?? null,
    victoryTeam: room.victoryTeam ?? room.winnerSide ?? null,
    matchEndsAt: null,
    voteEndsAt: null,
    talkEndsAt: null,
  };
}

/** 교사: 결과 화면에서 방을 유지한 채 같은 학생들로 새 게임 준비 */
export function restartGameRoom(room: GameRoom): GameRoom {
  const players: Record<string, Player> = {};
  Object.values(room.players ?? {}).forEach((player) => {
    players[player.id] = {
      ...player,
      role: null,
      isAlive: true,
      nightTarget: null,
      partnerId: null,
      hasSelfHealed: false,
    };
  });

  const fresh = createEmptyRoom(room.theme, room.pin);
  return {
    ...fresh,
    players,
    maxRounds: room.maxRounds > 0 ? room.maxRounds : fresh.maxRounds,
    createdAt: room.createdAt,
  };
}

/** 종료된 방 삭제 (교사 새 방 만들기 전) */
export async function deleteRoom(roomId: string): Promise<void> {
  const db = getFirebaseDatabase();
  await remove(ref(db, `rooms/${roomId}`));
}

export async function patchRoom(
  roomId: string,
  patch: Partial<GameRoom>,
): Promise<void> {
  const db = getFirebaseDatabase();
  await update(ref(db, `rooms/${roomId}`), patch);
}

export function subscribeRoom(
  roomId: string,
  onData: (room: GameRoom | null) => void,
): Unsubscribe {
  const db = getFirebaseDatabase();
  return onValue(ref(db, `rooms/${roomId}`), (snap) => {
    onData(
      snap.exists() ? normalizeGameRoom(snap.val() as GameRoom) : null,
    );
  });
}

/** Firebase는 빈 객체 {} 를 저장하지 않으므로 submissions/peerMap 이 빠질 수 있다. */
function normalizeNightQuizState(
  quiz: NightQuizState | null | undefined,
): NightQuizState | null {
  if (!quiz) return null;
  return {
    ...quiz,
    choices: Array.isArray(quiz.choices) ? quiz.choices : [],
    submissions: quiz.submissions ?? {},
    peerMap: quiz.peerMap ?? {},
  };
}

function normalizePendingNightQuizConfig(
  config: NightQuizConfig | null | undefined,
): NightQuizConfig | null {
  if (!config) return null;
  const choices = Array.isArray(config.choices)
    ? config.choices.map((c) => String(c ?? '')).slice(0, 4)
    : [];
  while (choices.length < 4) choices.push('');
  const mode =
    config.mode === 'KOREAN' ||
    config.mode === 'GENERAL' ||
    config.mode === 'CUSTOM' ||
    config.mode === 'MATH'
      ? config.mode
      : 'MATH';
  const correctIndex = Math.min(
    3,
    Math.max(0, Math.floor(config.correctIndex ?? 0)),
  );
  const question = String(config.question ?? '').trim();
  const successHint = String(config.successHint ?? '').trim();
  if (!question || !successHint || choices.some((c) => !c.trim())) {
    // 불완전하게 저장된 값은 무시하고 기본 자동 생성으로 되돌린다.
    return null;
  }
  return {
    mode,
    grade:
      mode === 'MATH'
        ? Math.min(6, Math.max(1, Math.floor(config.grade ?? 3)))
        : null,
    question,
    answer: String(config.answer ?? choices[correctIndex] ?? '').trim(),
    choices,
    correctIndex,
    timeLimitSec: Math.min(
      300,
      Math.max(5, Math.floor(config.timeLimitSec ?? 45)),
    ),
    successThresholdPercent: Math.min(
      100,
      Math.max(1, Math.floor(config.successThresholdPercent ?? 70)),
    ),
    successHint,
  };
}

/** 교사가 낮/투표 중 미리 저장한 밤 미션 설정 */
export function savePendingNightQuizConfig(
  room: GameRoom,
  config: NightQuizConfig,
): GameRoom {
  return {
    ...room,
    pendingNightQuizConfig: normalizePendingNightQuizConfig(config),
  };
}

export function setNightQuizPreviewForRole(
  room: GameRoom,
  role: Role,
  enabled: boolean,
): GameRoom {
  return {
    ...room,
    nightQuizPreviewByRole: {
      ...normalizeNightQuizPreviewByRole(room.nightQuizPreviewByRole),
      [role]: enabled,
    },
  };
}

/**
 * 밤 시작에 쓸 퀴즈 설정.
 * 저장된 미션이 있으면 그대로 쓰고, 없으면 직전 밤 설정/기본값으로 생성한다.
 */
export function resolveNightQuizConfig(room: GameRoom): NightQuizConfig {
  return (
    normalizePendingNightQuizConfig(room.pendingNightQuizConfig) ??
    buildAutoNightQuizConfig(room)
  );
}

/** Firebase에 없는 새 필드 기본값 보정 */
export function normalizeGameRoom(room: GameRoom): GameRoom {
  const players: Record<string, Player> = {};
  Object.entries(room.players ?? {}).forEach(([id, p]) => {
    if (!p) return;
    players[id] = {
      ...p,
      id: p.id ?? id,
      name: p.name ?? '학생',
      role: p.role ?? null,
      isAlive: p.isAlive !== false,
      nightTarget: p.nightTarget ?? null,
      partnerId: p.partnerId ?? null,
      avatarId: p.avatarId ?? 'M0',
      gender: p.gender ?? playerGenderFromAvatarId(p.avatarId ?? 'M0'),
      hasSelfHealed: p.hasSelfHealed === true,
    };
  });

  return {
    ...room,
    // 기존 방 데이터의 테마도 새 정책에 맞춰 마을로 통일한다.
    theme: 'VILLAGE',
    players,
    nightQuizState: normalizeNightQuizState(room.nightQuizState),
    pendingNightQuizConfig: normalizePendingNightQuizConfig(
      room.pendingNightQuizConfig,
    ),
    mafiaMissionState: room.mafiaMissionState ?? emptyMafiaMissionState(),
    pendingMafiaNightBuff: room.pendingMafiaNightBuff === true,
    isMafiaBuffActive: room.isMafiaBuffActive === true,
    currentCitizenMission: room.currentCitizenMission ?? null,
    mafiaMission: room.mafiaMission ?? null,
    missionSubmissions: room.missionSubmissions ?? {},
    missionPeerMap: room.missionPeerMap ?? {},
    missionOutcome: room.missionOutcome ?? null,
    currentHint: room.currentHint ?? null,
    nightResults: room.nightResults ?? null,
    morningRevealIndex: Math.max(0, room.morningRevealIndex ?? 0),
    morningIdentityStep: normalizeMorningIdentityStep(room.morningIdentityStep),
    gmEvent: room.gmEvent ?? null,
    votes: room.votes ?? {},
    matchEndsAt: room.matchEndsAt ?? null,
    voteEndsAt: room.voteEndsAt ?? null,
    talkEndsAt: room.talkEndsAt ?? null,
    voteTieResolution: room.voteTieResolution ?? 'RANDOM',
    revealDeathRoles: room.revealDeathRoles !== false,
    allowMafiaTargetMafia: room.allowMafiaTargetMafia !== false,
    mafiaChatEnabled: room.mafiaChatEnabled !== false,
    maxRounds: Math.max(1, room.maxRounds ?? 3),
    currentRound: Math.max(0, room.currentRound ?? 0),
    winnerSide: room.winnerSide ?? null,
    victoryTeam: room.victoryTeam ?? room.winnerSide ?? null,
    voteRevoteCandidates: room.voteRevoteCandidates ?? null,
    dayVoteResult: room.dayVoteResult ?? null,
    ghostChat: room.ghostChat ?? {},
    mafiaChat: room.mafiaChat ?? {},
    matchChats: room.matchChats ?? {},
    matchChatHistory: room.matchChatHistory ?? {},
    ghostPredictions: room.ghostPredictions ?? {},
    nicknameChangeRequest: normalizeNicknameChangeRequest(
      room.nicknameChangeRequest,
    ),
    pendingRoleAssignments: normalizePendingRoleAssignments(
      room.pendingRoleAssignments,
    ),
    roleCountConfig: normalizeRoleCountConfig(room.roleCountConfig),
    nightQuizPreviewByRole: normalizeNightQuizPreviewByRole(
      room.nightQuizPreviewByRole,
    ),
  };
}

function normalizeNightQuizPreviewByRole(
  raw: GameRoom['nightQuizPreviewByRole'] | null | undefined,
): Record<Role, boolean> {
  const defaults = defaultNightQuizPreviewByRole();
  if (!raw || typeof raw !== 'object') return defaults;
  return {
    CITIZEN: raw.CITIZEN === true,
    MAFIA: raw.MAFIA === true,
    DOCTOR: raw.DOCTOR === true,
    POLICE: raw.POLICE === true,
    REPORTER: raw.REPORTER === true,
    SPIRITUALIST: raw.SPIRITUALIST === true,
  };
}

function normalizeMorningIdentityStep(
  raw: GameRoom['morningIdentityStep'] | null | undefined,
): GameRoom['morningIdentityStep'] {
  if (
    raw === 'TEASE' ||
    raw === 'REVEAL_MAFIA_CHECK' ||
    raw === 'REVEAL_FULL_ROLE'
  ) {
    return raw;
  }
  return 'NONE';
}

function normalizeRoleCountConfig(
  raw: GameRoom['roleCountConfig'] | null | undefined,
): GameRoom['roleCountConfig'] {
  if (!raw || typeof raw !== 'object') return null;
  const clamp = (n: unknown) =>
    Math.max(0, Math.min(99, Math.floor(Number(n) || 0)));
  return {
    MAFIA: clamp(raw.MAFIA),
    DOCTOR: clamp(raw.DOCTOR),
    POLICE: clamp(raw.POLICE),
    REPORTER: clamp(raw.REPORTER),
    SPIRITUALIST: clamp(raw.SPIRITUALIST),
  };
}

function normalizePendingRoleAssignments(
  raw: Record<string, Role | null> | null | undefined,
): Record<string, Role | null> | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, Role | null> = {};
  let hasAny = false;
  Object.entries(raw).forEach(([id, role]) => {
    if (!id) return;
    hasAny = true;
    out[id] =
      role === 'CITIZEN' ||
      role === 'MAFIA' ||
      role === 'DOCTOR' ||
      role === 'POLICE' ||
      role === 'REPORTER' ||
      role === 'SPIRITUALIST'
        ? role
        : null;
  });
  return hasAny ? out : null;
}

/** 교사 화면용: 대기 중에는 pending, 시작 후에는 player.role */
export function resolvedRoleForPlayer(
  room: GameRoom,
  playerId: string,
): Role | null {
  if (room.gameState === 'WAITING') {
    const pending = room.pendingRoleAssignments?.[playerId];
    if (pending !== undefined) return pending;
  }
  return room.players?.[playerId]?.role ?? null;
}

function normalizeNicknameChangeRequest(
  raw: NicknameChangeRequest | null | undefined,
): NicknameChangeRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const playerId = String(raw.playerId ?? '').trim();
  const previousName = String(raw.previousName ?? '').trim();
  if (!playerId || !previousName) return null;
  return {
    playerId,
    previousName,
    requestedAt: Number(raw.requestedAt) || Date.now(),
  };
}

export function playerList(room: GameRoom): Player[] {
  return Object.values(room.players ?? {});
}

export function alivePlayers(room: GameRoom): Player[] {
  return playerList(room).filter((p) => p.isAlive);
}

/** 대기 화면: 학생 퇴장 */
export function removePlayerFromRoom(
  room: GameRoom,
  playerId: string,
): GameRoom {
  if (room.gameState !== 'WAITING') return room;
  if (!room.players?.[playerId]) return room;
  const players = { ...room.players };
  delete players[playerId];
  const nicknameChangeRequest =
    room.nicknameChangeRequest?.playerId === playerId
      ? null
      : room.nicknameChangeRequest ?? null;
  return { ...room, players, nicknameChangeRequest };
}

/**
 * 닉네임 재설정 검증.
 * - 다른 학생과 중복 불가
 * - 요청 직전(또는 forbiddenPrevious) 닉네임 재사용 불가
 */
export function validateNicknameChange(
  room: GameRoom,
  playerId: string,
  nextName: string,
  forbiddenPrevious?: string | null,
): string | null {
  if (room.gameState !== 'WAITING') {
    return '게임이 시작된 뒤에는 닉네임을 바꿀 수 없습니다.';
  }
  const player = room.players?.[playerId];
  if (!player) return '해당 학생을 찾을 수 없습니다.';
  const trimmed = nextName.trim();
  if (trimmed.length < 1 || trimmed.length > 12) {
    return '닉네임은 1~12자로 입력해 주세요.';
  }

  const fromRequest =
    room.nicknameChangeRequest?.playerId === playerId
      ? room.nicknameChangeRequest.previousName.trim()
      : '';
  const blockedPrevious =
    (forbiddenPrevious ?? '').trim() || fromRequest || player.name.trim();

  if (blockedPrevious && trimmed === blockedPrevious) {
    return '이전에 사용하던 닉네임은 다시 사용할 수 없습니다.';
  }
  const duplicate = playerList(room).some(
    (p) => p.id !== playerId && p.name.trim() === trimmed,
  );
  if (duplicate) {
    return '이미 다른 친구가 사용 중인 닉네임입니다.';
  }
  return null;
}

/** 교사: 특정 학생에게 닉네임 재설정 요청 발송 */
export function requestNicknameChangeInRoom(
  room: GameRoom,
  playerId: string,
): { room: GameRoom; error: string | null } {
  if (room.gameState !== 'WAITING') {
    return { room, error: '대기 중에만 닉네임 변경을 요청할 수 있습니다.' };
  }
  const player = room.players?.[playerId];
  if (!player) return { room, error: '해당 학생을 찾을 수 없습니다.' };
  return {
    room: {
      ...room,
      nicknameChangeRequest: {
        playerId,
        previousName: player.name.trim(),
        requestedAt: Date.now(),
      },
    },
    error: null,
  };
}

/**
 * 대기 화면: 닉네임 변경.
 * 빈 이름·길이 초과·다른 학생과 중복·직전 닉네임 재사용이면 변경하지 않는다.
 */
export function renamePlayerInRoom(
  room: GameRoom,
  playerId: string,
  nextName: string,
  options?: { forbiddenPrevious?: string | null; clearRequest?: boolean },
): { room: GameRoom; error: string | null } {
  const error = validateNicknameChange(
    room,
    playerId,
    nextName,
    options?.forbiddenPrevious,
  );
  if (error) return { room, error };
  const player = room.players?.[playerId];
  if (!player) return { room, error: '해당 학생을 찾을 수 없습니다.' };
  const trimmed = nextName.trim();
  const clearRequest =
    options?.clearRequest !== false &&
    room.nicknameChangeRequest?.playerId === playerId;
  return {
    room: {
      ...room,
      players: {
        ...room.players,
        [playerId]: { ...player, name: trimmed },
      },
      nicknameChangeRequest: clearRequest ? null : room.nicknameChangeRequest,
    },
    error: null,
  };
}

/** 학생: 교사 요청에 따라 닉네임 재설정 (트랜잭션) */
export async function submitNicknameChangeRequest(
  pin: string,
  playerId: string,
  nextName: string,
): Promise<void> {
  const trimmedPin = pin.replace(/\s/g, '');
  const db = getFirebaseDatabase();
  const roomRef = ref(db, `rooms/${trimmedPin}`);
  let fail: Error | null = null;

  const result = await runTransaction(roomRef, (raw) => {
    fail = null;
    if (!raw || typeof raw !== 'object') {
      fail = new Error('방이 없습니다.');
      return;
    }
    const room = normalizeGameRoom(raw as GameRoom);
    const request = room.nicknameChangeRequest;
    if (!request || request.playerId !== playerId) {
      fail = new Error('닉네임 변경 요청이 없거나 만료되었습니다.');
      return;
    }
    const renamed = renamePlayerInRoom(room, playerId, nextName, {
      forbiddenPrevious: request.previousName,
      clearRequest: true,
    });
    if (renamed.error) {
      fail = new Error(renamed.error);
      return;
    }
    return toFirebaseJson(renamed.room);
  });

  if (!result.committed) {
    throw fail ?? new Error('닉네임 변경에 실패했습니다. 다시 시도해 주세요.');
  }
}

/** 직업 랜덤 배정 후 DAY_TALK로 전환 (기본 프리셋) */
export function assignRolesAndStart(room: GameRoom): GameRoom {
  return startGameWithRoles(room, buildRoleDeck(playerList(room).length));
}

/** 직업 인원·라운드만 저장 (대기 유지). clearPending 시 미리보기 배정 제거 */
export function saveRoleSetup(
  room: GameRoom,
  counts: RoleCountConfig,
  maxRounds: number,
  options?: { clearPending?: boolean },
): GameRoom {
  return {
    ...room,
    roleCountConfig: counts,
    maxRounds: Math.max(1, Math.min(30, Math.floor(maxRounds) || 1)),
    pendingRoleAssignments: options?.clearPending
      ? null
      : room.pendingRoleAssignments,
  };
}

/**
 * 직접 배정 맵 전체를 pending 에 저장 (미배정은 null).
 * 학생 role 은 비공개 유지.
 */
export function saveManualRoleAssignments(
  room: GameRoom,
  assignments: Record<string, Role | null>,
  counts: RoleCountConfig,
  maxRounds: number,
): GameRoom {
  const pending: Record<string, Role | null> = {};
  const nextPlayers: Record<string, Player> = {};
  playerList(room).forEach((p) => {
    pending[p.id] = assignments[p.id] ?? null;
    nextPlayers[p.id] = {
      ...p,
      role: null,
    };
  });
  return {
    ...room,
    players: { ...room.players, ...nextPlayers },
    pendingRoleAssignments: pending,
    roleCountConfig: counts,
    maxRounds: Math.max(1, Math.min(30, Math.floor(maxRounds) || 1)),
  };
}

/** 인원수 지정 랜덤 배정만 수행 (대기 유지 — 교사 확인용, 학생 role 비공개) */
export function assignRolesByCounts(
  room: GameRoom,
  counts: RoleCountConfig,
): GameRoom {
  const players = playerList(room);
  const deck = buildRoleDeckFromCounts(players.length, counts);
  const pending: Record<string, Role | null> = {};
  const nextPlayers: Record<string, Player> = {};
  players.forEach((p, i) => {
    pending[p.id] = deck[i] ?? 'CITIZEN';
    nextPlayers[p.id] = {
      ...p,
      role: null,
      isAlive: true,
      nightTarget: null,
      partnerId: null,
      hasSelfHealed: false,
    };
  });
  return {
    ...room,
    players: nextPlayers,
    pendingRoleAssignments: pending,
  };
}

/** 수동 직업 맵을 pending 에만 저장 (대기 유지, 학생 화면 비공개) */
export function assignRolesManual(
  room: GameRoom,
  assignments: Record<string, Role | null>,
): GameRoom {
  const pending: Record<string, Role | null> = {
    ...(room.pendingRoleAssignments ?? {}),
  };
  const nextPlayers: Record<string, Player> = {};
  Object.values(room.players ?? {}).forEach((p) => {
    const hasAssignment = Object.prototype.hasOwnProperty.call(
      assignments,
      p.id,
    );
    if (hasAssignment) {
      pending[p.id] = assignments[p.id] ?? null;
    }
    nextPlayers[p.id] = {
      ...p,
      role: null,
    };
  });
  return {
    ...room,
    players: nextPlayers,
    pendingRoleAssignments: pending,
  };
}

/**
 * 교사 고정 배정 + 미배정 랜덤 → pending 에만 저장 (학생 role 비공개).
 */
export function assignRolesFixedThenRandom(
  room: GameRoom,
  fixedAssignments: Record<string, Role | null>,
  counts: RoleCountConfig,
): GameRoom {
  const players = playerList(room);
  const resolved = resolveAssignmentsWithRandomFill(
    players.map((p) => p.id),
    fixedAssignments,
    counts,
  );
  const nextPlayers: Record<string, Player> = {};
  players.forEach((p) => {
    nextPlayers[p.id] = {
      ...p,
      role: null,
      isAlive: true,
      nightTarget: null,
      partnerId: null,
      hasSelfHealed: false,
    };
  });
  return {
    ...room,
    players: nextPlayers,
    pendingRoleAssignments: resolved,
    roleCountConfig: counts,
  };
}

/** pending(또는 기존 role)을 실제 직업으로 공개하며 게임 시작 */
export function startAssignedGame(room: GameRoom): GameRoom {
  const players = playerList(room);
  const pending = room.pendingRoleAssignments;
  const nextPlayers: Record<string, Player> = {};
  players.forEach((p) => {
    const fromPending = pending?.[p.id];
    nextPlayers[p.id] = {
      ...p,
      role: fromPending ?? p.role ?? 'CITIZEN',
      isAlive: true,
      nightTarget: null,
      partnerId: null,
      hasSelfHealed: false,
    };
  });
  const mafiaCount = Object.values(nextPlayers).filter(
    (p) => p.role === 'MAFIA',
  ).length;
  const maxRounds =
    room.maxRounds && room.maxRounds > 0
      ? room.maxRounds
      : defaultMaxRoundsFromMafiaCount(Math.max(1, mafiaCount));
  return {
    ...room,
    players: nextPlayers,
    pendingRoleAssignments: null,
    gameState: 'DAY_TALK',
    votes: {},
    matchEndsAt: null,
    voteEndsAt: null,
    talkEndsAt: null,
    nightQuizState: null,
    pendingNightQuizConfig: room.pendingNightQuizConfig ?? null,
    mafiaMissionState: emptyMafiaMissionState(),
    pendingMafiaNightBuff: false,
    isMafiaBuffActive: false,
    missionOutcome: null,
    mafiaMission: null,
    missionSubmissions: {},
    missionPeerMap: {},
    nightResults: null,
    currentHint: null,
    gmEvent: null,
    currentCitizenMission: null,
    dayVoteResult: null,
    currentRound: 0,
    maxRounds,
    winnerSide: null,
    victoryTeam: null,
    ghostChat: {},
    mafiaChat: {},
    matchChats: {},
    matchChatHistory: {},
    ghostPredictions: {},
    nicknameChangeRequest: null,
  };
}

/**
 * 하단 '게임 시작'용: 전원 직업+마피아가 이미 배정돼 있으면 그대로 시작하고,
 * roleCountConfig 가 있으면 미배정을 그 인원에 맞게 채운 뒤 시작,
 * 아니면 기본 랜덤 배정으로 시작한다.
 */
export function startGamePreferringAssignedRoles(room: GameRoom): GameRoom {
  const players = playerList(room);
  const pending = room.pendingRoleAssignments;
  const roleOf = (id: string) =>
    pending?.[id] ?? room.players?.[id]?.role ?? null;
  const allAssigned =
    players.length > 0 && players.every((p) => roleOf(p.id) != null);
  const hasMafia = players.some((p) => roleOf(p.id) === 'MAFIA');
  if (allAssigned && hasMafia) {
    return startAssignedGame(room);
  }

  const counts = room.roleCountConfig;
  if (counts) {
    const fixed: Record<string, Role | null> = {};
    players.forEach((p) => {
      fixed[p.id] = roleOf(p.id);
    });
    return startAssignedGame(assignRolesFixedThenRandom(room, fixed, counts));
  }

  return assignRolesAndStart(room);
}

function startGameWithRoles(room: GameRoom, deck: Role[]): GameRoom {
  const players = playerList(room);
  const nextPlayers: Record<string, Player> = {};
  players.forEach((p, i) => {
    nextPlayers[p.id] = {
      ...p,
      role: deck[i] ?? 'CITIZEN',
      isAlive: true,
      nightTarget: null,
      partnerId: null,
      hasSelfHealed: false,
    };
  });
  const mafiaCount = Object.values(nextPlayers).filter(
    (p) => p.role === 'MAFIA',
  ).length;
  const maxRounds =
    room.maxRounds && room.maxRounds > 0
      ? room.maxRounds
      : defaultMaxRoundsFromMafiaCount(mafiaCount);
  return {
    ...room,
    players: nextPlayers,
    pendingRoleAssignments: null,
    gameState: 'DAY_TALK',
    votes: {},
    matchEndsAt: null,
    voteEndsAt: null,
    talkEndsAt: null,
    nightQuizState: null,
    pendingNightQuizConfig: room.pendingNightQuizConfig ?? null,
    mafiaMissionState: emptyMafiaMissionState(),
    pendingMafiaNightBuff: false,
    isMafiaBuffActive: false,
    missionOutcome: null,
    mafiaMission: null,
    missionSubmissions: {},
    missionPeerMap: {},
    nightResults: null,
    currentHint: null,
    gmEvent: null,
    currentCitizenMission: null,
    dayVoteResult: null,
    currentRound: 0,
    maxRounds,
    winnerSide: null,
    victoryTeam: null,
    ghostChat: {},
    mafiaChat: {},
    matchChats: {},
    matchChatHistory: {},
    ghostPredictions: {},
    nicknameChangeRequest: null,
  };
}

/** 인원 지정 랜덤 배정 + 즉시 시작 */
export function assignRolesByCountsAndStart(
  room: GameRoom,
  counts: RoleCountConfig,
): GameRoom {
  const deck = buildRoleDeckFromCounts(playerList(room).length, counts);
  return startGameWithRoles(room, deck);
}

/** 생존자 1:1 랜덤 매칭 + 30초 타이머 */
export function startMatchPhase(room: GameRoom): GameRoom {
  const alive = alivePlayers(room);
  const shuffled = [...alive].sort(() => Math.random() - 0.5);
  const nextPlayers: Record<string, Player> = { ...room.players };

  Object.keys(nextPlayers).forEach((id) => {
    nextPlayers[id] = { ...nextPlayers[id], partnerId: null };
  });

  for (let i = 0; i < shuffled.length; i += 2) {
    const a = shuffled[i];
    const b = shuffled[i + 1];
    if (!b) {
      nextPlayers[a.id] = { ...nextPlayers[a.id], partnerId: null };
      break;
    }
    nextPlayers[a.id] = { ...nextPlayers[a.id], partnerId: b.id };
    nextPlayers[b.id] = { ...nextPlayers[b.id], partnerId: a.id };
  }

  // 직전 매칭 채팅은 기록으로 보관 (교사 확인용)
  const history = { ...(room.matchChatHistory ?? {}) };
  const prev = room.matchChats ?? {};
  if (Object.keys(prev).length > 0) {
    const id = `round_${Date.now()}`;
    history[id] = {
      id,
      createdAt: Date.now(),
      chats: prev,
    };
  }

  return {
    ...room,
    players: nextPlayers,
    gameState: 'DAY_MATCH',
    matchEndsAt: Date.now() + 30_000,
    talkEndsAt: null,
    matchChats: {},
    matchChatHistory: history,
  };
}

export function startMissionPhase(room: GameRoom): GameRoom {
  // DAY_MISSION은 더 이상 사용하지 않음 — 밤 퀴즈로 대체
  return room;
}

/** 교사: 마피아 미션만 부여 (자동 진행 아님) */
export function assignMafiaMission(
  room: GameRoom,
  config: MafiaMissionAssignConfig,
): GameRoom {
  return {
    ...room,
    mafiaMissionState: buildMafiaMissionState(room, config),
  };
}

/** 교사: 마피아 미션 수동 판정 */
export function resolveMafiaMissionState(
  room: GameRoom,
  outcome: Exclude<MissionOutcome, 'PENDING' | null>,
): GameRoom {
  if (!room.mafiaMissionState?.active) return room;
  return {
    ...room,
    mafiaMissionState: {
      ...room.mafiaMissionState,
      outcome,
      active: false,
    },
    pendingMafiaNightBuff:
      outcome === 'SUCCESS' ? true : room.pendingMafiaNightBuff,
  };
}

function markMafiaMissionSuccess(room: GameRoom): GameRoom {
  if (!room.mafiaMissionState?.active) return room;
  if (room.mafiaMissionState.outcome === 'SUCCESS') return room;
  return {
    ...room,
    mafiaMissionState: {
      ...room.mafiaMissionState,
      outcome: 'SUCCESS',
      active: false,
    },
    pendingMafiaNightBuff: true,
  };
}

/** 미제출자를 시간초과 오답으로 표시 */
export function markUnansweredAsTimeout(room: GameRoom): GameRoom {
  const quiz = room.nightQuizState;
  if (!quiz) return room;

  const alive = Object.values(room.players ?? {}).filter((p) => p.isAlive);
  const submissions = { ...(quiz.submissions ?? {}) };
  let changed = false;
  let disruptAdds = 0;

  alive.forEach((p) => {
    if (submissions[p.id]) return;
    changed = true;
    submissions[p.id] = {
      playerId: p.id,
      answer: '(시간초과)',
      correct: false,
      submittedAt: Date.now(),
    };
    if (p.role === 'MAFIA') disruptAdds += 1;
  });

  if (!changed) return room;

  let mafiaMissionState = room.mafiaMissionState;
  if (
    mafiaMissionState?.active &&
    mafiaMissionState.type === 'NIGHT_DISRUPT' &&
    mafiaMissionState.outcome === 'PENDING' &&
    disruptAdds > 0
  ) {
    const progress =
      (mafiaMissionState.disruptProgress ?? 0) + disruptAdds;
    const target = mafiaMissionState.disruptTargetCount ?? 3;
    mafiaMissionState = {
      ...mafiaMissionState,
      disruptProgress: progress,
    };
    if (progress >= target) {
      return markMafiaMissionSuccess({
        ...room,
        nightQuizState: { ...quiz, submissions },
        mafiaMissionState,
      });
    }
  }

  return {
    ...room,
    nightQuizState: { ...quiz, submissions },
    mafiaMissionState,
  };
}

/** 밤 퀴즈 판정 (성공률 기준) — 미제출은 오답 처리 후 집계 */
export function finalizeNightQuiz(room: GameRoom): GameRoom {
  let next = markUnansweredAsTimeout(room);
  const quiz = next.nightQuizState;
  if (!quiz) return next;
  if (quiz.outcome === 'SUCCESS' || quiz.outcome === 'FAIL') return next;

  const stats = getNightQuizStats(next);
  const success = stats.successRate >= quiz.successThresholdPercent;
  next = {
    ...next,
    nightQuizState: {
      ...quiz,
      outcome: success ? 'SUCCESS' : 'FAIL',
      finalSuccessRate: stats.successRate,
      active: false,
    },
  };

  if (
    !success &&
    next.mafiaMissionState?.active &&
    next.mafiaMissionState.type === 'NIGHT_DISRUPT' &&
    next.mafiaMissionState.outcome === 'PENDING'
  ) {
    next = markMafiaMissionSuccess(next);
  }

  return next;
}

/** 타이머 종료 시 호출 — 미제출 오답 + 판정 */
export function resolveNightQuizTimeout(room: GameRoom): GameRoom {
  const quiz = room.nightQuizState;
  if (!quiz?.active) return room;
  if (Date.now() < quiz.endsAt) return room;
  return finalizeNightQuiz(room);
}

/** 학생 밤 퀴즈 제출 */
export function applyNightQuizSubmission(
  room: GameRoom,
  playerId: string,
  answer: string,
): GameRoom {
  if (room.gameState !== 'NIGHT') return room;
  const quiz = room.nightQuizState;
  if (!quiz?.active || quiz.outcome === 'SUCCESS' || quiz.outcome === 'FAIL') {
    return room;
  }
  const player = room.players[playerId];
  if (!player?.isAlive) return room;
  const submissions = quiz.submissions ?? {};
  if (submissions[playerId]) return room;

  const correct = isAnswerCorrect(quiz.answer, answer);
  const submission: MissionSubmission = {
    playerId,
    answer: answer.trim(),
    correct,
    submittedAt: Date.now(),
  };

  let next: GameRoom = {
    ...room,
    nightQuizState: {
      ...quiz,
      submissions: { ...submissions, [playerId]: submission },
    },
  };

  // 마피아 연속 방해 진행 (보조 지표 + 목표 도달 시 성공)
  const mms = next.mafiaMissionState;
  if (
    player.role === 'MAFIA' &&
    mms?.active &&
    mms.type === 'NIGHT_DISRUPT' &&
    mms.outcome === 'PENDING'
  ) {
    const progress = correct ? 0 : (mms.disruptProgress ?? 0) + 1;
    const target = mms.disruptTargetCount ?? 3;
    next = {
      ...next,
      mafiaMissionState: { ...mms, disruptProgress: progress },
    };
    if (!correct && progress >= target) {
      next = markMafiaMissionSuccess(next);
    }
  }

  const stats = getNightQuizStats(next);
  if (stats.pendingIds.length === 0) {
    next = finalizeNightQuiz(next);
  }

  return next;
}

export async function submitNightQuizAnswer(
  pin: string,
  playerId: string,
  answer: string,
): Promise<void> {
  const db = getFirebaseDatabase();
  const roomRef = ref(db, `rooms/${pin}`);
  const snap = await get(roomRef);
  if (!snap.exists()) throw new Error('방이 없습니다.');
  const next = applyNightQuizSubmission(
    normalizeGameRoom(snap.val() as GameRoom),
    playerId,
    answer,
  );
  await set(roomRef, toFirebaseJson(normalizeGameRoom(next)));
}

/**
 * 시간 종료 시: 선택만 한 답안이 있으면 제출한 뒤, 미제출자를 시간초과 처리하고 판정한다.
 */
export async function finalizeNightQuizOnTimeout(
  pin: string,
  playerId: string,
  selectedAnswer?: string | null,
): Promise<void> {
  const db = getFirebaseDatabase();
  const roomRef = ref(db, `rooms/${pin}`);
  const snap = await get(roomRef);
  if (!snap.exists()) throw new Error('방이 없습니다.');

  let room = normalizeGameRoom(snap.val() as GameRoom);
  const quiz = room.nightQuizState;
  if (!quiz?.active || quiz.outcome === 'SUCCESS' || quiz.outcome === 'FAIL') {
    return;
  }

  const trimmed = selectedAnswer?.trim() ?? '';
  const already = Boolean((quiz.submissions ?? {})[playerId]);
  if (trimmed && !already) {
    room = applyNightQuizSubmission(room, playerId, trimmed);
  }

  room = resolveNightQuizTimeout(room);
  await set(roomRef, toFirebaseJson(normalizeGameRoom(room)));
}

/** @deprecated */
export async function submitMissionAnswer(
  pin: string,
  playerId: string,
  answer: string,
): Promise<void> {
  return submitNightQuizAnswer(pin, playerId, answer);
}

export const VOTE_DURATION_MS = 15_000;
export const VOTE_EXTEND_MS = 15_000;
/** 투표 결과를 공개 화면에 보여 주는 시간. 교사가 먼저 넘길 수도 있다. */
export const VOTE_RESULT_DURATION_MS = 8_000;

/** 밤 퀴즈·직업 활동 동시 마감 안내 (교사·서브모니터·학생 공통) */
export const NIGHT_ACTIVITY_CLOSE_NOTICE =
  '퀴즈 시간이 끝나면 직업별 밤 활동도 함께 마감됩니다.';

/**
 * 낮 토론 시간 부여.
 * 만료되면 호스트가 자동으로 투표 단계로 전환한다.
 */
export function grantDiscussionTime(
  room: GameRoom,
  durationSec: number,
): GameRoom {
  if (room.gameState !== 'DAY_TALK') return room;
  const sec = Math.max(5, Math.min(600, Math.floor(durationSec) || 0));
  if (sec < 5) return room;
  return {
    ...room,
    talkEndsAt: Date.now() + sec * 1000,
  };
}

export function clearDiscussionTimer(room: GameRoom): GameRoom {
  if (!room.talkEndsAt) return room;
  return { ...room, talkEndsAt: null };
}

export function startVotePhase(room: GameRoom): GameRoom {
  return {
    ...room,
    gameState: 'DAY_VOTE',
    votes: {},
    matchEndsAt: null,
    talkEndsAt: null,
    voteEndsAt: Date.now() + VOTE_DURATION_MS,
    voteRevoteCandidates: null,
    dayVoteResult: null,
  };
}

export function setVoteTieResolution(
  room: GameRoom,
  mode: GameRoom['voteTieResolution'],
): GameRoom {
  return { ...room, voteTieResolution: mode };
}

export function setRevealDeathRoles(room: GameRoom, enabled: boolean): GameRoom {
  return { ...room, revealDeathRoles: enabled };
}

/** 마피아끼리(동료) 밤 지목 허용 여부 */
export function setAllowMafiaTargetMafia(
  room: GameRoom,
  enabled: boolean,
): GameRoom {
  return { ...room, allowMafiaTargetMafia: enabled };
}

/** 마피아 비밀 채팅 on/off */
export function setMafiaChatEnabled(
  room: GameRoom,
  enabled: boolean,
): GameRoom {
  return { ...room, mafiaChatEnabled: enabled };
}

export function setMaxRounds(room: GameRoom, maxRounds: number): GameRoom {
  return {
    ...room,
    maxRounds: Math.max(1, Math.min(30, Math.floor(maxRounds) || 1)),
  };
}

/** 기본 총 라운드 = 마피아 수 × 3 (최소 3) */
export function defaultMaxRoundsFromMafiaCount(mafiaCount: number): number {
  return Math.max(3, Math.max(1, mafiaCount) * 3);
}

export function countAssignedMafia(room: GameRoom): number {
  return playerList(room).filter((p) => p.role === 'MAFIA').length;
}

/** 투표 탈락 공지 문구 */
export function buildVoteDeathAnnouncement(
  name: string,
  role: Role | null,
  reveal: boolean,
): string {
  if (!reveal || !role) {
    return `${name} 님이 투표로 탈락했습니다.`;
  }
  return `${name} 님이 투표로 탈락했습니다. ${name} 님의 직업은 ${ROLE_LABELS[role]}입니다.`;
}

/** 밤 습격 탈락 공지 문구 */
export function buildNightDeathAnnouncement(
  name: string,
  role: Role | null,
  reveal: boolean,
): string {
  if (!reveal || !role) {
    return `지난밤 ${name} 님이 마피아에게 습격당했습니다.`;
  }
  return `지난밤 ${name} 님이 마피아에게 습격당했습니다. ${name} 님의 직업은 ${ROLE_LABELS[role]}이었습니다.`;
}

export function extendVoteTime(
  room: GameRoom,
  extraMs: number = VOTE_EXTEND_MS,
): GameRoom {
  const base = Math.max(Date.now(), room.voteEndsAt ?? Date.now());
  return {
    ...room,
    voteEndsAt: base + extraMs,
  };
}

/**
 * 투표 마감 — 최다 득표자 아웃.
 * 낮 마피아 미션(지정 탈락) 성공 시 다음 밤 멀티킬 예약.
 */
export function resolveDayVote(room: GameRoom): GameRoom {
  const tallies = tallyVotes(room);
  const entries = Object.entries(tallies).sort((a, b) => b[1] - a[1]);
  const isRevoteRound = room.voteRevoteCandidates !== null;

  let eliminatedId: string | null = null;
  let wasTie = false;

  if (entries.length >= 1 && entries[0][1] > 0) {
    const topCount = entries[0][1];
    const tied = entries.filter(([, c]) => c === topCount).map(([id]) => id);
    wasTie = tied.length > 1;

    if (wasTie) {
      if (room.voteTieResolution === 'REVOTE' && !isRevoteRound) {
        return {
          ...room,
          votes: {},
          voteEndsAt: Date.now() + VOTE_DURATION_MS,
          voteRevoteCandidates: tied,
          dayVoteResult: null,
        };
      }
      eliminatedId = tied[Math.floor(Math.random() * tied.length)] ?? null;
    } else {
      eliminatedId = tied[0] ?? null;
    }
  }

  const nextPlayers: Record<string, Player> = { ...room.players };
  let eliminatedRole: Role | null = null;
  if (eliminatedId && nextPlayers[eliminatedId]?.isAlive) {
    eliminatedRole = nextPlayers[eliminatedId].role;
    nextPlayers[eliminatedId] = {
      ...nextPlayers[eliminatedId],
      isAlive: false,
    };
  } else {
    eliminatedId = null;
  }

  const eliminatedName = eliminatedId
    ? (nextPlayers[eliminatedId]?.name ?? null)
    : null;
  const reveal = room.revealDeathRoles !== false;
  const announcement = eliminatedName
    ? buildVoteDeathAnnouncement(eliminatedName, eliminatedRole, reveal)
    : null;

  let next: GameRoom = {
    ...room,
    players: nextPlayers,
    gameState: 'VOTE_RESULT',
    votes: {},
    voteEndsAt: null,
    matchEndsAt: null,
    talkEndsAt: null,
    voteRevoteCandidates: null,
    dayVoteResult: {
      eliminatedPlayerId: eliminatedId,
      eliminatedName,
      eliminatedRole: reveal ? eliminatedRole : null,
      announcement,
      wasTie,
      wasRevote: isRevoteRound,
      tieResolution: room.voteTieResolution ?? 'RANDOM',
      tallies,
      ballots: { ...(room.votes ?? {}) },
      resolvedAt: Date.now(),
    },
  };

  const mms = next.mafiaMissionState;
  if (
    mms?.active &&
    mms.type === 'DAY_VOTE_ELIMINATE' &&
    mms.outcome === 'PENDING' &&
    eliminatedId &&
    mms.voteTargetPlayerId === eliminatedId
  ) {
    next = markMafiaMissionSuccess(next);
  }

  // 투표로 마피아 전멸 → 시민 승 / 마지막 라운드 낮 종료 → 마피아 승
  return evaluateGameEnd(next, { checkMaxRounds: true });
}

/** 직전 밤 설정(있으면)을 이어받거나 기본 수학 퀴즈로 밤 미션을 만든다. */
export function buildAutoNightQuizConfig(room: GameRoom): NightQuizConfig {
  const pending = room.pendingNightQuizConfig;
  const prev = room.nightQuizState;
  const rawMode = pending?.mode ?? prev?.mode;
  const mode: QuizMode =
    rawMode === 'KOREAN' || rawMode === 'GENERAL' || rawMode === 'MATH'
      ? rawMode
      : 'MATH';
  const grade = Math.min(
    6,
    Math.max(1, pending?.grade ?? prev?.grade ?? 3),
  ) as ElementaryGrade;
  const generated = generateQuizByMode(mode, { grade });
  return {
    mode,
    grade: mode === 'MATH' ? grade : null,
    question: generated.question,
    answer: generated.answer,
    choices: [...generated.choices],
    correctIndex: generated.correctIndex,
    timeLimitSec: Math.max(
      5,
      pending?.timeLimitSec ?? prev?.timeLimitSec ?? 45,
    ),
    successThresholdPercent: Math.min(
      100,
      Math.max(
        1,
        pending?.successThresholdPercent ??
          prev?.successThresholdPercent ??
          70,
      ),
    ),
    successHint:
      pending?.successHint?.trim() ||
      prev?.successHint?.trim() ||
      '마피아 중 한 명은 오늘 평소보다 말이 적을 수 있습니다.',
  };
}

/**
 * 낮 투표 종료 → (재투표/게임종료가 아니면) 투표 결과 발표 단계로 이동.
 * 밤 전환은 enterNightAfterVoteResult에서 별도로 수행한다.
 */
export function resolveDayVoteAndEnterNight(
  room: GameRoom,
  quizConfig?: NightQuizConfig,
): GameRoom {
  const afterVote = resolveDayVote(room);
  if (afterVote.gameState === 'DAY_VOTE' || afterVote.gameState === 'ENDED') {
    return afterVote;
  }

  return enterNightAfterVoteResult(afterVote, quizConfig);
}

/** 투표 결과 발표가 끝난 뒤에만 밤 세션으로 이동한다. */
export function enterNightAfterVoteResult(
  room: GameRoom,
  quizConfig?: NightQuizConfig,
): GameRoom {
  if (room.gameState !== 'VOTE_RESULT') return room;
  return startNightPhase(room, quizConfig ?? resolveNightQuizConfig(room));
}

export function dismissDayVoteResult(room: GameRoom): GameRoom {
  return { ...room, dayVoteResult: null };
}

/** 밤 시작 — 퀴즈 자동 생성 + 예약된 멀티킬 버프 적용 */
export function startNightPhase(
  room: GameRoom,
  quizConfig?: NightQuizConfig,
): GameRoom {
  // 이미 총 라운드를 모두 치렀으면 다음 밤으로 가지 않고 마피아 승 판정
  const pre = evaluateGameEnd(room, { checkMaxRounds: true });
  if (pre.gameState === 'ENDED') return pre;

  const cleared: Record<string, Player> = {};
  Object.values(room.players).forEach((p) => {
    cleared[p.id] = { ...p, nightTarget: null };
  });

  const config: NightQuizConfig =
    quizConfig ?? resolveNightQuizConfig(room);

  const activateBuff = room.pendingMafiaNightBuff === true;

  return {
    ...room,
    players: cleared,
    gameState: 'NIGHT',
    votes: {},
    matchEndsAt: null,
    voteEndsAt: null,
    talkEndsAt: null,
    nightResults: null,
    dayVoteResult: null,
    nightQuizState: createNightQuizState(room, config),
    isMafiaBuffActive: activateBuff,
    pendingMafiaNightBuff: false,
    currentRound: (room.currentRound ?? 0) + 1,
  };
}

/** 투표 집계: targetId → count */
export function tallyVotes(room: GameRoom): Record<string, number> {
  const tallies: Record<string, number> = {};
  Object.values(room.votes ?? {}).forEach((targetId) => {
    tallies[targetId] = (tallies[targetId] ?? 0) + 1;
  });
  return tallies;
}

export function deadPlayers(room: GameRoom): Player[] {
  return playerList(room).filter((p) => !p.isAlive);
}

const SESSION_KEY = 'xmafia_play_session';
const LS_PLAYER_ID = 'playerId';
const LS_ROOM_ID = 'roomId';

export interface PlaySession {
  pin: string;
  roomId: string;
  playerId: string;
  name: string;
}

export interface JoinRoomResult {
  session: PlaySession;
  room: GameRoom;
  player: Player;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

export function loadPlaySession(): PlaySession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as PlaySession;

    const playerId = localStorage.getItem(LS_PLAYER_ID);
    const roomId = localStorage.getItem(LS_ROOM_ID);
    if (playerId && roomId) {
      return { pin: roomId, roomId, playerId, name: '' };
    }
    return null;
  } catch {
    return null;
  }
}

export function savePlaySession(session: PlaySession) {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify(session);
  try {
    localStorage.setItem(SESSION_KEY, payload);
    localStorage.setItem(LS_PLAYER_ID, session.playerId);
    localStorage.setItem(LS_ROOM_ID, session.roomId);
    sessionStorage.setItem(SESSION_KEY, payload);
  } catch {
    /* private mode 등 */
  }
}

export function clearPlaySession() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LS_PLAYER_ID);
    localStorage.removeItem(LS_ROOM_ID);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function mapFirebaseError(err: unknown): Error {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: string }).code)
      : '';
  const message = err instanceof Error ? err.message : String(err);

  if (code === 'PERMISSION_DENIED' || message.includes('PERMISSION_DENIED')) {
    return new Error(
      '입장 실패: Firebase 보안 규칙이 쓰기를 거부했습니다. Realtime Database 규칙을 확인하세요.',
    );
  }
  if (message.includes('Firebase 환경변수')) {
    return err instanceof Error ? err : new Error(message);
  }
  if (message.includes('존재하지 않는')) {
    return err instanceof Error ? err : new Error(message);
  }
  return new Error(`입장 실패: ${message || '알 수 없는 오류'}`);
}

/** PIN으로 방 미리보기 (캐릭터·닉네임 목록) */
export async function peekRoom(pin: string): Promise<GameRoom | null> {
  const trimmedPin = pin.replace(/\s/g, '');
  if (!/^\d{4,6}$/.test(trimmedPin)) return null;
  try {
    const db = getFirebaseDatabase();
    const snap = await withTimeout(
      get(ref(db, `rooms/${trimmedPin}`)),
      10_000,
      '방 조회 시간 초과',
    );
    if (!snap.exists()) return null;
    return normalizeGameRoom(snap.val() as GameRoom);
  } catch {
    return null;
  }
}

/** PIN + 이름 + 캐릭터로 방 입장 (재접속 시 기존 직업·생존 상태 유지) */
export async function joinRoom(
  pin: string,
  name: string,
  avatarId: string,
): Promise<JoinRoomResult> {
  const trimmedPin = pin.replace(/\s/g, '');
  const trimmedName = name.trim();

  if (!/^\d{4,6}$/.test(trimmedPin)) {
    throw new Error('PIN은 4~6자리 숫자입니다.');
  }
  if (trimmedName.length < 1 || trimmedName.length > 12) {
    throw new Error('이름은 1~12자로 입력해 주세요.');
  }
  if (!isAvatarId(avatarId)) {
    throw new Error('캐릭터를 선택해 주세요.');
  }

  try {
    const db = getFirebaseDatabase();
    const roomRef = ref(db, `rooms/${trimmedPin}`);

    const snap = await withTimeout(
      get(roomRef),
      12_000,
      '입장 실패: Firebase 응답이 없습니다. 네트워크와 DATABASE_URL을 확인하세요.',
    );

    if (!snap.exists()) {
      throw new Error('존재하지 않는 방 코드입니다');
    }

    const room = normalizeGameRoom(snap.val() as GameRoom);
    const players = room.players ?? {};

    if (room.gameState === 'ENDED') {
      throw new Error('종료된 게임입니다. 선생님이 새 방을 만들 때까지 기다려 주세요.');
    }

    const saved = loadPlaySession();
    const bySavedId =
      saved &&
      (saved.roomId === trimmedPin || saved.pin === trimmedPin) &&
      players[saved.playerId]
        ? players[saved.playerId]
        : null;
    const byName = Object.values(players).find((p) => p.name === trimmedName) ?? null;
    const existing = bySavedId ?? byName;

    // 신규 입장은 대기 중만
    if (!existing && room.gameState && room.gameState !== 'WAITING') {
      throw new Error(
        '이미 시작한 방에는 새로 입장할 수 없습니다. 이전에 쓰던 닉네임으로 다시 들어와 주세요.',
      );
    }

    const playerId = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const player: Player = {
      id: playerId,
      name: trimmedName,
      role: null,
      isAlive: true,
      nightTarget: null,
      partnerId: null,
      avatarId,
      gender: playerGenderFromAvatarId(avatarId),
      hasSelfHealed: false,
    };

    // 캐릭터 점유 판정은 미리보기 데이터가 아니라 Firebase 트랜잭션에서 수행한다.
    // 따라서 두 학생이 같은 캐릭터를 거의 동시에 눌러도 먼저 커밋된 한 명만 성공한다.
    const playersRef = ref(db, `rooms/${trimmedPin}/players`);
    let resolvedPlayerId: string | null = null;
    let transactionError: Error | null = null;
    const transactionResult = await withTimeout(
      runTransaction(playersRef, (currentPlayers) => {
        transactionError = null;
        const latestPlayers =
          currentPlayers && typeof currentPlayers === 'object'
            ? (currentPlayers as Record<string, Player>)
            : {};
        const latestSavedPlayer =
          saved &&
          (saved.roomId === trimmedPin || saved.pin === trimmedPin) &&
          latestPlayers[saved.playerId]
            ? latestPlayers[saved.playerId]
            : null;
        const latestByName =
          Object.values(latestPlayers).find((candidate) => candidate?.name === trimmedName) ??
          null;
        const latestExisting = latestSavedPlayer ?? latestByName;

        if (latestExisting) {
          // 재접속은 역할·생존·밤 선택 등을 유지한다. 요청한 캐릭터가 이미
          // 다른 학생에게 선점됐으면 기존 캐릭터를 유지한다.
          resolvedPlayerId = latestExisting.id;
          const taken = takenAvatarIds(latestPlayers, latestExisting.id);
          const nextAvatar =
            !taken.has(avatarId) || latestExisting.avatarId === avatarId
              ? avatarId
              : latestExisting.avatarId;
          const updated: Player = {
            ...latestExisting,
            avatarId: nextAvatar,
            name: trimmedName || latestExisting.name,
          };
          return { ...latestPlayers, [latestExisting.id]: updated };
        }

        const taken = takenAvatarIds(latestPlayers);
        if (taken.has(avatarId)) {
          transactionError = new Error(
            '이미 다른 학생이 선택한 캐릭터입니다. 다른 캐릭터를 골라 주세요.',
          );
          return;
        }

        resolvedPlayerId = playerId;
        return { ...latestPlayers, [playerId]: player };
      }),
      12_000,
      '입장 실패: 캐릭터 선점 처리에 실패했습니다. Firebase 규칙을 확인하세요.',
    );

    if (!transactionResult.committed) {
      throw transactionError ?? new Error('캐릭터 선택이 취소되었습니다. 다시 시도해 주세요.');
    }

    const committedPlayers = normalizeGameRoom({
      ...room,
      players: (transactionResult.snapshot.val() as Record<string, Player> | null) ?? {},
    }).players;
    const resolvedPlayer =
      (resolvedPlayerId ? committedPlayers[resolvedPlayerId] : null) ?? player;
    const nextRoom: GameRoom = { ...room, players: committedPlayers };
    const session: PlaySession = {
      pin: trimmedPin,
      roomId: trimmedPin,
      playerId: resolvedPlayer.id,
      name: resolvedPlayer.name,
    };
    savePlaySession(session);

    return { session, room: nextRoom, player: resolvedPlayer };
  } catch (err) {
    throw mapFirebaseError(err);
  }
}

export async function setNightTarget(
  pin: string,
  playerId: string,
  targetId: string | null,
): Promise<void> {
  const trimmedPin = pin.replace(/\s/g, '');
  const db = getFirebaseDatabase();
  const roomSnap = await get(ref(db, `rooms/${trimmedPin}`));
  if (!roomSnap.exists()) throw new Error('방이 없습니다.');
  const room = normalizeGameRoom(roomSnap.val() as GameRoom);
  const actor = room.players[playerId];
  if (!actor) throw new Error('플레이어를 찾을 수 없습니다.');

  if (
    actor.role === 'DOCTOR' &&
    targetId === playerId &&
    actor.hasSelfHealed
  ) {
    throw new Error('자기 치료(자힐)는 게임당 1회만 사용할 수 있습니다.');
  }

  if (
    actor.role === 'MAFIA' &&
    targetId &&
    room.allowMafiaTargetMafia === false
  ) {
    const target = room.players[targetId];
    if (target?.role === 'MAFIA') {
      throw new Error(
        '지금은 마피아끼리 지목할 수 없습니다. 다른 대상을 선택해 주세요.',
      );
    }
  }

  await update(ref(db, `rooms/${trimmedPin}/players/${playerId}`), {
    nightTarget: targetId,
  });
}

export async function castVote(
  pin: string,
  voterId: string,
  targetId: string,
): Promise<void> {
  const db = getFirebaseDatabase();
  const snap = await get(ref(db, `rooms/${pin}`));
  const room = snap.val() as GameRoom | null;
  if (
    room?.voteRevoteCandidates &&
    !room.voteRevoteCandidates.includes(targetId)
  ) {
    throw new Error('재투표 대상만 선택할 수 있습니다.');
  }
  await update(ref(db, `rooms/${pin}/votes`), { [voterId]: targetId });
}

/** 학생 자발적 퇴장 — 본인만 방에서 제거 (다른 학생 게임은 유지) */
export async function leaveRoom(pin: string, playerId: string): Promise<void> {
  const trimmedPin = pin.replace(/\s/g, '');
  const db = getFirebaseDatabase();
  const roomRef = ref(db, `rooms/${trimmedPin}`);
  const snap = await withTimeout(
    get(roomRef),
    10_000,
    '퇴장 처리 시간 초과',
  );
  if (!snap.exists()) return;

  const room = normalizeGameRoom(snap.val() as GameRoom);
  const player = room.players[playerId];
  if (!player) return;

  const updates: Record<string, null> = {
    [`players/${playerId}`]: null,
    [`votes/${playerId}`]: null,
    [`ghostPredictions/${playerId}`]: null,
  };

  await withTimeout(
    update(roomRef, updates),
    10_000,
    '퇴장 처리에 실패했습니다.',
  );

  if (player.partnerId && room.players[player.partnerId]) {
    await update(ref(db, `rooms/${trimmedPin}/players/${player.partnerId}`), {
      partnerId: null,
    });
  }
}

export async function sendGhostChat(
  pin: string,
  message: {
    senderId: string;
    senderName: string;
    text: string;
    timestamp?: number;
  },
): Promise<void> {
  const trimmedPin = pin.replace(/\s/g, '');
  const text = message.text.trim();
  if (!text) return;

  const db = getFirebaseDatabase();
  const roomRef = ref(db, `rooms/${trimmedPin}`);
  const snap = await get(roomRef);
  if (!snap.exists()) throw new Error('방이 없습니다.');

  const room = normalizeGameRoom(snap.val() as GameRoom);
  const sender = room.players[message.senderId];
  if (!sender) throw new Error('플레이어를 찾을 수 없습니다.');
  if (sender.isAlive) {
    throw new Error('생존 학생은 유령 채팅을 사용할 수 없습니다.');
  }

  const timestamp = message.timestamp ?? Date.now();
  const chatRef = push(ref(db, `rooms/${trimmedPin}/ghostChat`));
  const payload: GhostChatMessage = {
    id: chatRef.key ?? `g_${timestamp}`,
    senderId: message.senderId,
    senderName: message.senderName || sender.name,
    text,
    timestamp,
    // 하위 호환 미러 필드
    playerId: message.senderId,
    playerName: message.senderName || sender.name,
    createdAt: timestamp,
  };
  await set(chatRef, toFirebaseJson(payload));
}

/** ghostChat 메시지 필드 정규화 (구/신 스키마 모두 지원) */
export function normalizeGhostMessage(raw: GhostChatMessage): GhostChatMessage {
  const senderId = raw.senderId || raw.playerId || '';
  const senderName = raw.senderName || raw.playerName || '유령';
  const timestamp = raw.timestamp ?? raw.createdAt ?? 0;
  return {
    id: raw.id,
    senderId,
    senderName,
    text: raw.text,
    timestamp,
    playerId: senderId,
    playerName: senderName,
    createdAt: timestamp,
  };
}

export function listGhostChatMessages(
  room: GameRoom,
): GhostChatMessage[] {
  return Object.values(room.ghostChat ?? {})
    .map(normalizeGhostMessage)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/** 생존 마피아 전용 비밀 채팅 */
export async function sendMafiaChat(
  pin: string,
  message: {
    senderId: string;
    senderName: string;
    text: string;
    timestamp?: number;
  },
): Promise<void> {
  const trimmedPin = pin.replace(/\s/g, '');
  const text = message.text.trim();
  if (!text) return;

  const db = getFirebaseDatabase();
  const roomRef = ref(db, `rooms/${trimmedPin}`);
  const snap = await get(roomRef);
  if (!snap.exists()) throw new Error('방이 없습니다.');

  const room = normalizeGameRoom(snap.val() as GameRoom);
  const sender = room.players[message.senderId];
  if (!sender) throw new Error('플레이어를 찾을 수 없습니다.');
  if (!sender.isAlive || sender.role !== 'MAFIA') {
    throw new Error('생존한 마피아만 비밀 채팅을 사용할 수 있습니다.');
  }
  if (room.mafiaChatEnabled === false) {
    throw new Error('교사가 마피아 비밀 채팅을 끄셨습니다.');
  }
  if (room.gameState === 'WAITING' || room.gameState === 'ENDED') {
    throw new Error('지금은 마피아 채팅을 사용할 수 없습니다.');
  }

  const timestamp = message.timestamp ?? Date.now();
  const chatRef = push(ref(db, `rooms/${trimmedPin}/mafiaChat`));
  const payload: MafiaChatMessage = {
    id: chatRef.key ?? `m_${timestamp}`,
    senderId: message.senderId,
    senderName: message.senderName || sender.name,
    text: text.slice(0, 200),
    timestamp,
  };
  await set(chatRef, toFirebaseJson(payload));
}

export function listMafiaChatMessages(room: GameRoom): MafiaChatMessage[] {
  return Object.values(room.mafiaChat ?? {}).sort(
    (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0),
  );
}

/** 1:1 매칭 페어 키 (정렬된 playerId) */
export function matchPairKey(a: string, b: string): string {
  return [a, b].sort().join('_');
}

export async function sendMatchChat(
  pin: string,
  pairKey: string,
  message: Omit<MatchChatMessage, 'id'>,
): Promise<void> {
  const db = getFirebaseDatabase();
  const chatRef = push(ref(db, `rooms/${pin}/matchChats/${pairKey}`));
  await set(chatRef, { ...message, id: chatRef.key });
}

export async function castGhostPrediction(
  pin: string,
  playerId: string,
  side: WinnerSide,
): Promise<void> {
  const db = getFirebaseDatabase();
  await update(ref(db, `rooms/${pin}/ghostPredictions`), { [playerId]: side });
}

/** 기자 취재 결과를 아침 속보로 기록 */
export async function publishReporterNews(
  pin: string,
  news: string,
): Promise<void> {
  const db = getFirebaseDatabase();
  await update(ref(db, `rooms/${pin}`), {
    'nightResults/reporterNews': news,
  });
}
