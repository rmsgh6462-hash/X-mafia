import type {
  GameRoom,
  MafiaMissionAssignConfig,
  MafiaMissionState,
  MafiaMissionType,
  MissionSubmission,
  NightQuizConfig,
  NightQuizState,
  Player,
} from '@/types/game';

export const QUIZ_POOL: Array<{
  question: string;
  answer: string;
  choices?: string[];
  timeLimitSec: number;
}> = [
  {
    question: '대한민국의 수도는?',
    answer: '서울',
    choices: ['부산', '서울', '인천', '대전'],
    timeLimitSec: 60,
  },
  {
    question: '1 + 7 × 2 의 값은?',
    answer: '15',
    choices: ['14', '15', '16', '17'],
    timeLimitSec: 45,
  },
  {
    question: '무지개의 색은 모두 몇 가지인가? (숫자만)',
    answer: '7',
    choices: ['5', '6', '7', '8'],
    timeLimitSec: 45,
  },
  {
    question: '물이 얼면 무엇이 될까?',
    answer: '얼음',
    choices: ['김', '얼음', '구름', '비'],
    timeLimitSec: 40,
  },
  {
    question: '한글을 만든 왕은?',
    answer: '세종대왕',
    choices: ['세종대왕', '이순신', '광개토대왕', '장보고'],
    timeLimitSec: 60,
  },
  {
    question: '지구에서 가장 큰 바다의 이름은?',
    answer: '태평양',
    choices: ['대서양', '인도양', '태평양', '북극해'],
    timeLimitSec: 50,
  },
];

export function normalizeAnswer(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '');
}

export function isAnswerCorrect(expected: string, given: string): boolean {
  return normalizeAnswer(expected) === normalizeAnswer(given);
}

function aliveList(room: GameRoom): Player[] {
  return Object.values(room.players ?? {}).filter((p) => p.isAlive);
}

export function buildMissionPeerMap(room: GameRoom): Record<string, string> {
  const alive = aliveList(room);
  const map: Record<string, string> = {};
  alive.forEach((p, i) => {
    if (alive.length <= 1) {
      map[p.id] = p.id;
      return;
    }
    let peer = alive[Math.floor(Math.random() * alive.length)];
    let guard = 0;
    while (peer.id === p.id && guard < 24) {
      peer = alive[Math.floor(Math.random() * alive.length)];
      guard += 1;
    }
    if (peer.id === p.id) peer = alive[(i + 1) % alive.length];
    map[p.id] = peer.id;
  });
  return map;
}

export function createNightQuizState(
  room: GameRoom,
  config: NightQuizConfig,
): NightQuizState {
  const timeLimitSec = Math.max(15, config.timeLimitSec || 60);
  const choices = (config.choices ?? []).slice(0, 4);
  while (choices.length < 4) choices.push(`보기${choices.length + 1}`);

  return {
    active: true,
    mode: config.mode ?? 'MATH',
    grade: config.grade ?? null,
    question: config.question.trim(),
    answer: config.answer.trim(),
    choices,
    correctIndex: Math.min(
      3,
      Math.max(0, config.correctIndex ?? choices.indexOf(config.answer.trim())),
    ),
    timeLimitSec,
    endsAt: Date.now() + timeLimitSec * 1000,
    successThresholdPercent: Math.min(
      100,
      Math.max(1, config.successThresholdPercent || 70),
    ),
    successHint: config.successHint.trim(),
    submissions: {},
    peerMap: buildMissionPeerMap(room),
    outcome: 'PENDING',
    finalSuccessRate: null,
  };
}

export function emptyMafiaMissionState(): MafiaMissionState {
  return {
    active: false,
    type: null,
    description: '',
    outcome: null,
    disruptProgress: 0,
  };
}

export function buildMafiaMissionState(
  room: GameRoom,
  config: MafiaMissionAssignConfig,
): MafiaMissionState {
  if (config.type === 'NIGHT_DISRUPT') {
    const n = Math.max(1, config.disruptTargetCount ?? 3);
    return {
      active: true,
      type: 'NIGHT_DISRUPT',
      description: `[밤] 시민 미션 성공률 낮추기 — 연속 방해 (목표 ${n}회 오답)`,
      outcome: 'PENDING',
      disruptTargetCount: n,
      disruptProgress: 0,
    };
  }
  const target = config.voteTargetPlayerId
    ? room.players[config.voteTargetPlayerId]
    : null;
  const name = target?.name ?? '지정 플레이어';
  return {
    active: true,
    type: 'DAY_VOTE_ELIMINATE',
    description: `[낮] 이번 투표에서 [${name}] 탈락시키기`,
    outcome: 'PENDING',
    voteTargetPlayerId: config.voteTargetPlayerId ?? null,
    disruptProgress: 0,
  };
}

export function getNightQuizStats(room: GameRoom): {
  aliveCount: number;
  submittedCount: number;
  successCount: number;
  successRate: number;
  pendingIds: string[];
} {
  const quiz = room.nightQuizState;
  const alive = aliveList(room);
  const subs = quiz?.submissions ?? {};
  let successCount = 0;
  let submittedCount = 0;
  const pendingIds: string[] = [];

  alive.forEach((p) => {
    const s = subs[p.id];
    if (s) {
      submittedCount += 1;
      if (s.correct) successCount += 1;
    } else {
      pendingIds.push(p.id);
    }
  });

  const successRate =
    alive.length === 0 ? 0 : Math.round((successCount / alive.length) * 100);

  return {
    aliveCount: alive.length,
    submittedCount,
    successCount,
    successRate,
    pendingIds,
  };
}

/** @deprecated alias */
export function getMissionStats(room: GameRoom) {
  if (room.nightQuizState?.active) return getNightQuizStats(room);
  // legacy day mission fallback
  const alive = aliveList(room);
  const subs = room.missionSubmissions ?? {};
  let successCount = 0;
  let submittedCount = 0;
  const pendingIds: string[] = [];
  alive.forEach((p) => {
    const s = subs[p.id];
    if (s) {
      submittedCount += 1;
      if (s.correct) successCount += 1;
    } else pendingIds.push(p.id);
  });
  return {
    aliveCount: alive.length,
    submittedCount,
    successCount,
    successRate:
      alive.length === 0 ? 0 : Math.round((successCount / alive.length) * 100),
    pendingIds,
  };
}

export function mafiaMissionLabel(type: MafiaMissionType | null): string {
  if (type === 'NIGHT_DISRUPT') return '밤 · 성공률 낮추기';
  if (type === 'DAY_VOTE_ELIMINATE') return '낮 · 투표 탈락';
  return '없음';
}
