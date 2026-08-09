import {
  get,
  onValue,
  push,
  ref,
  set,
  update,
  type Unsubscribe,
} from 'firebase/database';
import { getFirebaseDatabase } from '@/lib/firebase';
import { generateMafiaHint } from '@/lib/game/hints';
import { buildRoleDeck } from '@/lib/game/roles';
import type {
  GameRoom,
  GhostChatMessage,
  MissionOutcome,
  Player,
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
    missionOutcome: null,
    createdAt: Date.now(),
    ghostChat: {},
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

/** 직업 랜덤 배정 후 DAY_TALK로 전환 */
export function assignRolesAndStart(room: GameRoom): GameRoom {
  const players = playerList(room);
  const deck = buildRoleDeck(players.length);
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
    missionOutcome: null,
    currentCitizenMission: null,
    mafiaMission: null,
    nightResults: null,
    currentHint: null,
    isMafiaBuffActive: false,
    gmEvent: null,
  };
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

  return {
    ...room,
    players: nextPlayers,
    gameState: 'DAY_MATCH',
    matchEndsAt: Date.now() + 30_000,
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
    missionOutcome: 'PENDING',
    currentCitizenMission: mission,
    mafiaMission: { description: mafiaDesc, isCompleted: false },
  };
}

export function resolveMission(
  room: GameRoom,
  outcome: Exclude<MissionOutcome, 'PENDING' | null>,
): GameRoom {
  if (outcome === 'SUCCESS') {
    return {
      ...room,
      missionOutcome: outcome,
      currentHint: generateMafiaHint(room),
      gameState: 'DAY_TALK',
    };
  }

  return {
    ...room,
    missionOutcome: outcome,
    isMafiaBuffActive: true,
    gameState: 'DAY_TALK',
  };
}

export function startVotePhase(room: GameRoom): GameRoom {
  return {
    ...room,
    gameState: 'DAY_VOTE',
    votes: {},
    matchEndsAt: null,
  };
}

export function startNightPhase(room: GameRoom): GameRoom {
  const cleared: Record<string, Player> = {};
  Object.values(room.players).forEach((p) => {
    cleared[p.id] = { ...p, nightTarget: null };
  });

  // gmEvent(정전/기회의 밤)는 이번 밤 동안 유지
  return {
    ...room,
    players: cleared,
    gameState: 'NIGHT',
    votes: {},
    matchEndsAt: null,
    nightResults: null,
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

/** PIN + 이름으로 방 입장 — rooms/{pin}/players/{playerId} 에 set */
export async function joinRoom(pin: string, name: string): Promise<JoinRoomResult> {
  const trimmedPin = pin.replace(/\s/g, '');
  const trimmedName = name.trim();

  if (!/^\d{4,6}$/.test(trimmedPin)) {
    throw new Error('PIN은 4~6자리 숫자입니다.');
  }
  if (trimmedName.length < 1 || trimmedName.length > 12) {
    throw new Error('이름은 1~12자로 입력해 주세요.');
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

    if (room.gameState && room.gameState !== 'WAITING') {
      throw new Error('이미 시작한 방에는 입장할 수 없습니다.');
    }

    const existing = Object.values(players).find((p) => p.name === trimmedName);
    if (existing) {
      const session: PlaySession = {
        pin: trimmedPin,
        roomId: trimmedPin,
        playerId: existing.id,
        name: trimmedName,
      };
      savePlaySession(session);
      return {
        session,
        room: { ...room, players: { ...players, [existing.id]: existing } },
        player: existing,
      };
    }

    const playerId = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const player: Player = {
      id: playerId,
      name: trimmedName,
      role: null,
      isAlive: true,
      nightTarget: null,
      partnerId: null,
      avatarIndex: Object.keys(players).length % 8,
    };

    const playerRef = ref(db, `rooms/${trimmedPin}/players/${playerId}`);
    await withTimeout(
      set(playerRef, player),
      12_000,
      '입장 실패: 플레이어 저장에 실패했습니다. Firebase 규칙을 확인하세요.',
    );

    // 저장 확인
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
