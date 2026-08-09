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
  | 'RESULT';

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

/** 시민 미션 (설명 + 제한시간) */
export interface CitizenMission {
  /** 미션 설명 */
  description: string;
  /** 제한시간 (초) */
  timeLimitSec: number;
}

/** 마피아 서브 미션 */
export interface MafiaMission {
  /** 미션 설명 */
  description: string;
  /** 달성 여부 */
  isCompleted: boolean;
}

/** 밤 결과 요약 */
export interface NightResults {
  /** 사망한 플레이어 ID 목록 */
  deadPlayerIds: string[];
  /** 의사가 살린 플레이어 ID 목록 */
  savedPlayerIds: string[];
  /** 기자의 취재 속보 (없으면 null) */
  reporterNews: string | null;
}

/** 개별 플레이어 */
export interface Player {
  id: string;
  name: string;
  /** 역할 배정 전에는 null */
  role: Role | null;
  isAlive: boolean;
  /** 밤에 선택한 대상 플레이어 ID */
  nightTarget: string | null;
  /** 1:1 매칭 파트너 플레이어 ID */
  partnerId: string | null;
  /** 아바타 이미지 인덱스 */
  avatarIndex: number;
}

/** 게임 룸 전체 상태 (Realtime Database rooms/{roomId} 스키마) */
export interface GameRoom {
  roomId: string;
  /** 학생 입장용 PIN (보통 roomId와 동일) */
  pin: string;
  gameState: GameState;
  theme: Theme;
  /** 플레이어 맵 — key: playerId */
  players: Record<string, Player>;
  /** 현재 시민 미션 */
  currentCitizenMission: CitizenMission | null;
  /** 마피아 서브 미션 */
  mafiaMission: MafiaMission | null;
  /** 마피아 멀티킬 보상 활성화 여부 */
  isMafiaBuffActive: boolean;
  /** 공개된 마피아 힌트 */
  currentHint: string | null;
  /** 직전 밤 결과 */
  nightResults: NightResults | null;
  /** GM 특수 이벤트 */
  gmEvent: GmEvent;
  /** 투표: voterId → targetPlayerId */
  votes: Record<string, string>;
  /** 1:1 매칭 종료 시각 (epoch ms) */
  matchEndsAt: number | null;
  /** 미션 승인 상태 */
  missionOutcome: MissionOutcome;
  createdAt: number;
  /** 유령 전용 채팅 */
  ghostChat: Record<string, GhostChatMessage>;
  /** 유령 승자 예측 투표: playerId → side */
  ghostPredictions: Record<string, WinnerSide>;
}
