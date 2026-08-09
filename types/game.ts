/** 마을 / 학교 테마 */
export type Theme = 'VILLAGE' | 'SCHOOL';

/** 플레이어 역할 */
export type Role =
  | 'CITIZEN'
  | 'MAFIA'
  | 'DOCTOR'
  | 'POLICE'
  | 'REPORTER'
  | 'SPIRITUALIST';

/** 게임 진행 상태 */
export type GameState =
  | 'WAITING'
  | 'DAY_TALK'
  | 'DAY_MATCH'
  | 'DAY_MISSION'
  | 'DAY_VOTE'
  | 'NIGHT'
  | 'RESULT'
  | 'ENDED';

/** 게임마스터가 발동하는 특수 이벤트 */
export type GmEvent = 'HINT_BOOST' | 'SILENCE_NIGHT' | 'REVIVE_NIGHT' | null;

/** 미션 승인 결과 */
export type MissionOutcome = 'PENDING' | 'SUCCESS' | 'FAIL' | null;

/** 유령 승자 예측 (시민팀 / 마피아팀) */
export type WinnerSide = 'CITIZEN' | 'MAFIA';

/** 유령 채팅 메시지 */
export interface GhostChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  createdAt: number;
}

/** 1:1 매칭 채팅 메시지 */
export interface MatchChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  createdAt: number;
}

/** 지난 매칭 라운드 채팅 스냅샷 */
export interface MatchChatRound {
  id: string;
  createdAt: number;
  chats: Record<string, Record<string, MatchChatMessage>>;
}

/** 퀴즈/미션 제출 */
export interface MissionSubmission {
  playerId: string;
  answer: string;
  correct: boolean;
  submittedAt: number;
}

/**
 * 밤 세션 전원 퀴즈 상태 (매 밤 자동)
 * Firebase: rooms/{pin}/nightQuizState
 */
export interface NightQuizState {
  active: boolean;
  /** MATH | KOREAN | CUSTOM */
  mode: 'MATH' | 'KOREAN' | 'CUSTOM';
  /** 수학 모드 학년 1~6 */
  grade: number | null;
  question: string;
  answer: string;
  /** 항상 4지선다 */
  choices: string[];
  /** 0~3 정답 인덱스 */
  correctIndex: number;
  timeLimitSec: number;
  /** 퀴즈 종료 시각 epoch ms */
  endsAt: number;
  /** 전체 성공 기준 성공률 0~100 */
  successThresholdPercent: number;
  /** 전체 성공 시 아침에 공개할 힌트 */
  successHint: string;
  /** playerId → 제출 */
  submissions: Record<string, MissionSubmission>;
  /** playerId → 공개할 타인 1명 */
  peerMap: Record<string, string>;
  /** 판정 결과 (아침 발표 전/후) */
  outcome: MissionOutcome;
  /** 판정 시점 성공률 */
  finalSuccessRate: number | null;
}

/** 마피아 미션 유형 — 교사 부여 시에만 */
export type MafiaMissionType = 'NIGHT_DISRUPT' | 'DAY_VOTE_ELIMINATE';

/**
 * 마피아 미션 상태 (교사 [마피아 미션 부여] 시에만 active)
 * Firebase: rooms/{pin}/mafiaMissionState
 */
export interface MafiaMissionState {
  active: boolean;
  type: MafiaMissionType | null;
  description: string;
  outcome: MissionOutcome;
  /** NIGHT_DISRUPT: 연속 오답 목표 (표시/보조) */
  disruptTargetCount?: number;
  disruptProgress?: number;
  /** DAY_VOTE_ELIMINATE 대상 */
  voteTargetPlayerId?: string | null;
}

/** @deprecated 하위 호환 — NightQuizState로 이관 */
export interface CitizenMission {
  question: string;
  answer: string;
  choices?: string[];
  timeLimitSec: number;
  successThresholdPercent: number;
  successHint: string;
  description?: string;
}

/** @deprecated 하위 호환 — MafiaMissionState로 이관 */
export interface MafiaMission {
  type: MafiaMissionType | 'DISRUPT_STREAK' | 'VOTE_ELIMINATE';
  description: string;
  outcome: MissionOutcome;
  disruptTargetCount?: number;
  disruptProgress?: number;
  voteTargetPlayerId?: string | null;
}

/** 낮 투표 결과 */
export interface DayVoteResult {
  eliminatedPlayerId: string | null;
  eliminatedName: string | null;
  wasTie: boolean;
  tallies: Record<string, number>;
  resolvedAt: number;
}

/** 밤 결과 요약 */
export interface NightResults {
  deadPlayerIds: string[];
  savedPlayerIds: string[];
  reporterNews: string | null;
  /** 밤 퀴즈 성공으로 공개되는 힌트 (아침 발표용) */
  quizHint: string | null;
  quizSuccessRate: number | null;
  quizOutcome: MissionOutcome;
}

/** 개별 플레이어 */
export interface Player {
  id: string;
  name: string;
  role: Role | null;
  isAlive: boolean;
  nightTarget: string | null;
  partnerId: string | null;
  avatarId: string;
  avatarIndex?: number;
}

/** 게임 룸 전체 상태 */
export interface GameRoom {
  roomId: string;
  pin: string;
  gameState: GameState;
  theme: Theme;
  players: Record<string, Player>;

  /** 밤 전원 퀴즈 */
  nightQuizState: NightQuizState | null;
  /** 마피아 미션 (교사 부여) */
  mafiaMissionState: MafiaMissionState | null;
  /** 마피아 미션 성공 → 다음 밤 멀티킬 예약 */
  pendingMafiaNightBuff: boolean;
  /** 이번 밤 멀티킬(각자 1명 공격) 활성 */
  isMafiaBuffActive: boolean;

  /** @deprecated */
  currentCitizenMission: CitizenMission | null;
  /** @deprecated */
  mafiaMission: MafiaMission | null;
  /** @deprecated */
  missionSubmissions: Record<string, MissionSubmission>;
  /** @deprecated */
  missionPeerMap: Record<string, string>;
  /** @deprecated */
  missionOutcome: MissionOutcome;

  currentHint: string | null;
  nightResults: NightResults | null;
  gmEvent: GmEvent;
  votes: Record<string, string>;
  matchEndsAt: number | null;
  voteEndsAt: number | null;
  dayVoteResult: DayVoteResult | null;
  createdAt: number;
  ghostChat: Record<string, GhostChatMessage>;
  matchChats: Record<string, Record<string, MatchChatMessage>>;
  matchChatHistory: Record<string, MatchChatRound>;
  ghostPredictions: Record<string, WinnerSide>;
}

/** 밤 시작 시 퀴즈 설정 */
export interface NightQuizConfig {
  mode: 'MATH' | 'KOREAN' | 'CUSTOM';
  grade?: number | null;
  question: string;
  answer: string;
  choices: string[];
  correctIndex: number;
  timeLimitSec: number;
  successThresholdPercent: number;
  successHint: string;
}

/** 마피아 미션 부여 설정 */
export interface MafiaMissionAssignConfig {
  type: MafiaMissionType;
  disruptTargetCount?: number;
  voteTargetPlayerId?: string | null;
}
