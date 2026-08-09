import {
  get,
  onValue,
  push,
  ref,
  remove,
  set,
  update,
  type Unsubscribe,
} from 'firebase/database';
import { getFirebaseDatabase } from '@/lib/firebase';
import { isAvatarId, takenAvatarIds } from '@/lib/game/avatars';
import { generateMafiaHint } from '@/lib/game/hints';
import {
  buildRoleDeck,
  buildRoleDeckFromCounts,
  type RoleCountConfig,
} from '@/lib/game/roles';
import type {
  GameRoom,
  GhostChatMessage,
  MatchChatMessage,
  MissionOutcome,
  Player,
  Role,
  Theme,
  WinnerSide,
} from '@/types/game';

const MISSION_POOL = [
  { description: '교실을 한 바퀴 돌며 하이파이브 10회 하기', timeLimitSec: 90 },
  { description: '짝과 함께 사자성어 3개 말하기', timeLimitSec: 60 },
  { description: '다 함께 숨소리만으로 박수 박자 맞추기', timeLimitSec: 45 },
  { description: '칠판에 마을(학교) 지도 그리기', timeLimitSec: 120 },
];

const MAFIA_MISSION_POOL = [
  '선생님 몰래 지정된 물건 옮기기',
  '토론 중 특정 단어를 3회 사용하기',
  '다른 마피아와 눈빛으로만 신호 주고받기',
];

export function createEmptyRoom(theme: Theme, pin: string): GameRoom {
  return {
    roomId: pin,
    pin,
    gameState: 'WAITING',
    theme,
    players: {},
    currentCitizenMission: null,
    mafiaMission: null,
    isMafiaBuffActive: false,
    currentHint: null,
    nightResults: null,
    gmEvent: null,
    votes: {},
    matchEndsAt: null,
    voteEndsAt: null,
    missionOutcome: null,
    dayVoteResult: null,
    createdAt: Date.now(),
    ghostChat: {},
    matchChats: {},
    matchChatHistory: {},
    ghostPredictions: {},
  };
}

export function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function saveRoom(room: GameRoom): Promise<void> {
  try {
    const db = getFirebaseDatabase();
    await set(ref(db, `rooms/${room.roomId}`), room);
  } catch (err) {
    console.error('saveRoom failed', err);
    throw err instanceof Error
      ? err
      : new Error('방 저장에 실패했습니다.');
  }
}

/** 교사: 게임 종료 — 학생 기기에서 퇴장 처리 */
export function endGameRoom(room: GameRoom): GameRoom {
  return {
    ...room,
    gameState: 'ENDED',
    matchEndsAt: null,
    voteEndsAt: null,
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
    onData(snap.exists() ? (snap.val() as GameRoom) : null);
  });
}

export function playerList(room: GameRoom): Player[] {
  return Object.values(room.players ?? {});
}

export function alivePlayers(room: GameRoom): Player[] {
  return playerList(room).filter((p) => p.isAlive);
}

/** 직업 랜덤 배정 후 DAY_TALK로 전환 (기본 프리셋) */
export function assignRolesAndStart(room: GameRoom): GameRoom {
  return startGameWithRoles(room, buildRoleDeck(playerList(room).length));
}

/** 인원수 지정 랜덤 배정만 수행 (대기 유지 — 교사 확인용) */
export function assignRolesByCounts(
  room: GameRoom,
  counts: RoleCountConfig,
): GameRoom {
  const players = playerList(room);
  const deck = buildRoleDeckFromCounts(players.length, counts);
  const nextPlayers: Record<string, Player> = {};
  players.forEach((p, i) => {
    nextPlayers[p.id] = {
      ...p,
      role: deck[i] ?? 'CITIZEN',
      isAlive: true,
      nightTarget: null,
      partnerId: null,
    };
  });
  return { ...room, players: nextPlayers };
}

/** 수동 직업 맵 적용 (대기 유지) */
export function assignRolesManual(
  room: GameRoom,
  assignments: Record<string, Role | null>,
): GameRoom {
  const nextPlayers: Record<string, Player> = {};
  Object.values(room.players ?? {}).forEach((p) => {
    const role = assignments[p.id];
    nextPlayers[p.id] = {
      ...p,
      role: role === undefined ? p.role : role,
    };
  });
  return { ...room, players: nextPlayers };
}

/** 이미 배정된 직업으로 게임 시작 (미배정 있으면 시민 처리) */
export function startAssignedGame(room: GameRoom): GameRoom {
  const players = playerList(room);
  const nextPlayers: Record<string, Player> = {};
  players.forEach((p) => {
    nextPlayers[p.id] = {
      ...p,
      role: p.role ?? 'CITIZEN',
      isAlive: true,
      nightTarget: null,
      partnerId: null,
    };
  });
  return {
    ...room,
    players: nextPlayers,
    gameState: 'DAY_TALK',
    votes: {},
    matchEndsAt: null,
    voteEndsAt: null,
    missionOutcome: null,
    mafiaMission: null,
    nightResults: null,
    currentHint: null,
    isMafiaBuffActive: false,
    gmEvent: null,
    currentCitizenMission: null,
    dayVoteResult: null,
  };
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
    };
  });
  return {
    ...room,
    players: nextPlayers,
    gameState: 'DAY_TALK',
    votes: {},
    matchEndsAt: null,
    voteEndsAt: null,
    missionOutcome: null,
    mafiaMission: null,
    nightResults: null,
    currentHint: null,
    isMafiaBuffActive: false,
    gmEvent: null,
    currentCitizenMission: null,
    dayVoteResult: null,
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
    matchChats: {},
    matchChatHistory: history,
  };
}

export function startMissionPhase(room: GameRoom): GameRoom {
  const mission = MISSION_POOL[Math.floor(Math.random() * MISSION_POOL.length)];
  const mafiaDesc =
    MAFIA_MISSION_POOL[Math.floor(Math.random() * MAFIA_MISSION_POOL.length)];

  return {
    ...room,
    gameState: 'DAY_MISSION',
    matchEndsAt: null,
    voteEndsAt: null,
    missionOutcome: 'PENDING',
    currentCitizenMission: mission,
    mafiaMission: { description: mafiaDesc, outcome: 'PENDING' },
    // 이번 미션 라운드부터 다시 판정 (이전 버프 초기화)
    isMafiaBuffActive: false,
  };
}

function isMissionSideDone(outcome: MissionOutcome): boolean {
  return outcome === 'SUCCESS' || outcome === 'FAIL';
}

function finishMissionIfReady(room: GameRoom): GameRoom {
  const citizenDone = isMissionSideDone(room.missionOutcome);
  const mafiaDone = isMissionSideDone(room.mafiaMission?.outcome ?? null);
  if (!citizenDone || !mafiaDone) return room;
  return {
    ...room,
    gameState: 'DAY_TALK',
  };
}

/** 시민 미션 성공/실패 — 성공 시 마피아 힌트 공개 */
export function resolveCitizenMission(
  room: GameRoom,
  outcome: Exclude<MissionOutcome, 'PENDING' | null>,
): GameRoom {
  const next: GameRoom = {
    ...room,
    missionOutcome: outcome,
    currentHint:
      outcome === 'SUCCESS' ? generateMafiaHint(room) : room.currentHint,
  };
  return finishMissionIfReady(next);
}

/** 마피아 미션 성공/실패 — 성공 시 밤 멀티킬 버프 (각자 1명, 서로 살해 가능) */
export function resolveMafiaMission(
  room: GameRoom,
  outcome: Exclude<MissionOutcome, 'PENDING' | null>,
): GameRoom {
  if (!room.mafiaMission) {
    return room;
  }
  const next: GameRoom = {
    ...room,
    mafiaMission: { ...room.mafiaMission, outcome },
    isMafiaBuffActive: outcome === 'SUCCESS',
  };
  return finishMissionIfReady(next);
}

/** @deprecated 시민 미션만 판정 — resolveCitizenMission 사용 */
export function resolveMission(
  room: GameRoom,
  outcome: Exclude<MissionOutcome, 'PENDING' | null>,
): GameRoom {
  return resolveCitizenMission(room, outcome);
}

export const VOTE_DURATION_MS = 15_000;
export const VOTE_EXTEND_MS = 15_000;

export function startVotePhase(room: GameRoom): GameRoom {
  return {
    ...room,
    gameState: 'DAY_VOTE',
    votes: {},
    matchEndsAt: null,
    voteEndsAt: Date.now() + VOTE_DURATION_MS,
    dayVoteResult: null,
  };
}

/** 투표 시간 +15초 (남은 시간 기준, 이미 지났으면 지금부터) */
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
 * 동점이면 동점자 중 1명을 무작위로 아웃.
 * 표가 없으면 아웃 없음.
 */
export function resolveDayVote(room: GameRoom): GameRoom {
  const tallies = tallyVotes(room);
  const entries = Object.entries(tallies).sort((a, b) => b[1] - a[1]);

  let eliminatedId: string | null = null;
  let wasTie = false;

  if (entries.length >= 1 && entries[0][1] > 0) {
    const topCount = entries[0][1];
    const tied = entries.filter(([, c]) => c === topCount).map(([id]) => id);
    wasTie = tied.length > 1;
    eliminatedId = tied[Math.floor(Math.random() * tied.length)] ?? null;
  }

  const nextPlayers: Record<string, Player> = { ...room.players };
  if (eliminatedId && nextPlayers[eliminatedId]?.isAlive) {
    nextPlayers[eliminatedId] = {
      ...nextPlayers[eliminatedId],
      isAlive: false,
    };
  } else {
    eliminatedId = null;
  }

  return {
    ...room,
    players: nextPlayers,
    gameState: 'DAY_TALK',
    votes: {},
    voteEndsAt: null,
    matchEndsAt: null,
    dayVoteResult: {
      eliminatedPlayerId: eliminatedId,
      eliminatedName: eliminatedId
        ? (nextPlayers[eliminatedId]?.name ?? null)
        : null,
      wasTie,
      tallies,
      resolvedAt: Date.now(),
    },
  };
}

export function dismissDayVoteResult(room: GameRoom): GameRoom {
  return { ...room, dayVoteResult: null };
}

export function startNightPhase(room: GameRoom): GameRoom {
  const cleared: Record<string, Player> = {};
  Object.values(room.players).forEach((p) => {
    cleared[p.id] = { ...p, nightTarget: null };
  });

  // gmEvent(정전/기회의 밤)는 이번 밤 동안 유지
  // isMafiaBuffActive는 마피아 미션 성공 버프를 밤까지 유지
  return {
    ...room,
    players: cleared,
    gameState: 'NIGHT',
    votes: {},
    matchEndsAt: null,
    voteEndsAt: null,
    nightResults: null,
    dayVoteResult: null,
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
    return snap.val() as GameRoom;
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

    const room = snap.val() as GameRoom;
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

    if (existing) {
      // 재접속: 역할·생존·밤 선택 등 유지, 이름/캐릭터만 필요 시 갱신
      const taken = takenAvatarIds(players, existing.id);
      const nextAvatar =
        !taken.has(avatarId) || existing.avatarId === avatarId
          ? avatarId
          : existing.avatarId;
      if (taken.has(avatarId) && existing.avatarId !== avatarId) {
        // 다른 캐릭터를 골랐지만 점유됨 → 기존 캐릭터 유지
      }
      const updated: Player = {
        ...existing,
        avatarId: nextAvatar,
        name: trimmedName || existing.name,
      };
      await withTimeout(
        set(ref(db, `rooms/${trimmedPin}/players/${existing.id}`), updated),
        12_000,
        '입장 실패: 플레이어 갱신에 실패했습니다.',
      );
      const session: PlaySession = {
        pin: trimmedPin,
        roomId: trimmedPin,
        playerId: existing.id,
        name: updated.name,
      };
      savePlaySession(session);
      return {
        session,
        room: {
          ...room,
          players: { ...players, [existing.id]: updated },
        },
        player: updated,
      };
    }

    // 신규 입장은 대기 중만
    if (room.gameState && room.gameState !== 'WAITING') {
      throw new Error(
        '이미 시작한 방에는 새로 입장할 수 없습니다. 이전에 쓰던 닉네임으로 다시 들어와 주세요.',
      );
    }

    const taken = takenAvatarIds(players);
    if (taken.has(avatarId)) {
      throw new Error('이미 다른 학생이 선택한 캐릭터입니다. 다른 캐릭터를 골라 주세요.');
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
    };

    const playerRef = ref(db, `rooms/${trimmedPin}/players/${playerId}`);
    await withTimeout(
      set(playerRef, player),
      12_000,
      '입장 실패: 플레이어 저장에 실패했습니다. Firebase 규칙을 확인하세요.',
    );

    const verify = await withTimeout(
      get(playerRef),
      8_000,
      '입장 실패: 저장 확인에 실패했습니다.',
    );
    if (!verify.exists()) {
      throw new Error('입장 실패: 플레이어가 데이터베이스에 저장되지 않았습니다.');
    }

    const nextPlayers = { ...players, [playerId]: player };
    const nextRoom: GameRoom = { ...room, players: nextPlayers };
    const session: PlaySession = {
      pin: trimmedPin,
      roomId: trimmedPin,
      playerId,
      name: trimmedName,
    };
    savePlaySession(session);

    return { session, room: nextRoom, player };
  } catch (err) {
    throw mapFirebaseError(err);
  }
}

export async function setNightTarget(
  pin: string,
  playerId: string,
  targetId: string | null,
): Promise<void> {
  const db = getFirebaseDatabase();
  await update(ref(db, `rooms/${pin}/players/${playerId}`), {
    nightTarget: targetId,
  });
}

export async function castVote(
  pin: string,
  voterId: string,
  targetId: string,
): Promise<void> {
  const db = getFirebaseDatabase();
  await update(ref(db, `rooms/${pin}/votes`), { [voterId]: targetId });
}

export async function sendGhostChat(
  pin: string,
  message: Omit<GhostChatMessage, 'id'>,
): Promise<void> {
  const db = getFirebaseDatabase();
  const chatRef = push(ref(db, `rooms/${pin}/ghostChat`));
  await set(chatRef, { ...message, id: chatRef.key });
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
