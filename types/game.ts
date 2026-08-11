/** 유일한 게임 테마: 마을 */
export type Theme = 'VILLAGE';

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
  | 'VOTE_RESULT'
  | 'NIGHT'
  | 'RESULT'
  | 'ENDED';

/** 교사가 수동으로 진행하는 낮 투표 결과 공개 단계. */
export type VoteResultRevealStep =
  | 'ARREST'
  | 'MAFIA_TEASE'
  | 'MAFIA_RESULT'
  | 'FULL_ROLE';

/** 게임마스터가 발동하는 특수 이벤트 */
export type GmEvent = 'HINT_BOOST' | 'SILENCE_NIGHT' | 'REVIVE_NIGHT' | null;

/** 미션 승인 결과 */
export type MissionOutcome = 'PENDING' | 'SUCCESS' | 'FAIL' | null;

/** 아침 결과 팝업 연출 종류 */
export type MorningEvent =
  | 'DOCTOR_DEFEND'
  | 'DOCTOR_IDLE'
  | 'REPORTER_NEWS'
  | 'REPORTER_IDLE'
  | 'MAFIA_KILL';

/** 아침 순차 연출 큐에 전달하는 실제 밤 행동 스냅샷 */
export interface ActiveMorningEvent {
  event: MorningEvent;
  actorId: string | null;
  targetId: string | null;
  targetName?: string | null;
  /** 대상 학생 성별. 구버전 payload에는 없을 수 있어 클라이언트가 보정한다. */
  targetGender?: PlayerGender | null;
  /** 의사 연출만 사용 — 마피아 공격을 막았는지 */
  success?: boolean;
}

/** 유령 승자 예측 (시민팀 / 마피아팀) */
export type WinnerSide = 'CITIZEN' | 'MAFIA';

/** 유령 채팅 메시지 — rooms/{roomId}/ghostChat/{messageId} */
export interface GhostChatMessage {
  id: string;
  /** 발신자 playerId */
  senderId: string;
  senderName: string;
  text: string;
  /** epoch ms */
  timestamp: number;
  /** @deprecated 하위 호환 */
  playerId?: string;
  /** @deprecated 하위 호환 */
  playerName?: string;
  /** @deprecated 하위 호환 — timestamp 사용 */
  createdAt?: number;
}

/** 마피아 비밀 채팅 — rooms/{roomId}/mafiaChat/{messageId} */
export interface MafiaChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
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
  /** MATH | KOREAN | GENERAL | CUSTOM */
  mode: 'MATH' | 'KOREAN' | 'GENERAL' | 'CUSTOM';
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
  /** 교사 부여 시각 — 학생 전원 안내 팝업 키 */
  assignedAt?: number | null;
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

/** 투표 동률 처리 방식 */
export type VoteTieResolution = 'RANDOM' | 'REVOTE';

/** 낮 투표 결과 */
export interface DayVoteResult {
  eliminatedPlayerId: string | null;
  eliminatedName: string | null;
  /** 공개된 직업 (revealDeathRoles ON일 때) */
  eliminatedRole?: Role | null;
  /** 전원 공지 문구 */
  announcement?: string | null;
  wasTie: boolean;
  /** 재투표 라운드에서 확정된 탈락인지 */
  wasRevote?: boolean;
  tieResolution?: VoteTieResolution;
  tallies: Record<string, number>;
  /** voterId → targetId (유령 관전용 스냅샷) */
  ballots?: Record<string, string>;
  resolvedAt: number;
}

/** 밤 결과 요약 */
export interface NightResults {
  deadPlayerIds: string[];
  savedPlayerIds: string[];
  /** 생존·능력 사용 조건을 통과한 아침 연출 큐 (마피아 → 의사 → 기자) */
  activeEvents?: ActiveMorningEvent[];
  /** 새 아침 결과 팝업의 대표 이벤트 (구버전 데이터에는 없을 수 있음) */
  morningEvent?: MorningEvent | null;
  /** 한밤에 여러 공개 이벤트가 있으면 표시 순서를 보존한다 */
  morningEvents?: MorningEvent[];
  /** 습격 사망자 직업 (revealDeathRoles ON일 때 playerId → Role) */
  deadRoles?: Record<string, Role>;
  /** 전원 공지 문구 목록 */
  deathAnnouncements?: string[];
  /** 마피아의 팀킬로 확정 탈락한 대상 ID 목록 */
  mafiaFriendlyFirePlayerIds?: string[];
  /** 의사 최종 구출 대상 (동률 시 무작위 1명) */
  doctorSavedPlayerId?: string | null;
  doctorSaveWasTie?: boolean;
  /** 마피아의 공격 대상이 의사에게 보호되어 아침까지 생존했는지 */
  isDoctorDefended?: boolean;
  /** 전체 공개 — 기자 취재 (실제 직업 포함) */
  reporterNews: string | null;
  reporterTargetId?: string | null;
  reporterTargetRole?: Role | null;
  reporterWasTie?: boolean;
  /** 경찰·교사만 — 마피아 여부 조사 결과 */
  policeReport?: {
    targetId: string;
    targetName: string;
    isMafia: boolean;
    wasTie: boolean;
  } | null;
  /** 밤 퀴즈 성공으로 공개되는 힌트 (아침 발표용) */
  quizHint: string | null;
  quizSuccessRate: number | null;
  quizOutcome: MissionOutcome;
  /** 유령 관전용 — 아침 발표 직전 능력 지목 스냅샷 */
  actionLog?: Array<{
    actorId: string;
    role: Role;
    targetId: string | null;
  }>;
}

/** 개별 플레이어 */
export type PlayerGender = 'boy' | 'girl';

/** 교사가 학생에게 보낸 닉네임 재설정 요청 (Firebase 실시간) */
export interface NicknameChangeRequest {
  playerId: string;
  /** 요청 시점의 기존 닉네임 — 재사용 금지 */
  previousName: string;
  requestedAt: number;
}

export interface Player {
  id: string;
  name: string;
  role: Role | null;
  isAlive: boolean;
  nightTarget: string | null;
  partnerId: string | null;
  avatarId: string;
  /** 학생 캐릭터 성별. 이전 방 데이터에는 없을 수 있어 avatarId로 보정한다. */
  gender?: PlayerGender;
  avatarIndex?: number;
  /** 의사 자힐 1회 사용 여부 (게임 전체 1회) */
  hasSelfHealed?: boolean;
}

/** 게임 룸 전체 상태 */
export interface GameRoom {
  roomId: string;
  pin: string;
  gameState: GameState;
  theme: Theme;
  players: Record<string, Player>;

  /** 게임 시작 순간부터 대기 화면의 해질녘→밤→아침 전환을 동기화한다. */
  openingSequenceStartedAt?: number | null;
  /** 밤 결과가 집계된 순간부터 밤→아침 전환을 동기화한다. */
  morningTransitionStartedAt?: number | null;

  /** 밤 전원 퀴즈 */
  nightQuizState: NightQuizState | null;
  /**
   * 교사가 낮/투표 중에 미리 저장한 밤 미션 설정.
   * 투표 종료 후 밤으로 넘어갈 때 이 설정으로 퀴즈가 시작된다.
   */
  pendingNightQuizConfig: NightQuizConfig | null;
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
  /**
   * RESULT 단계 아침 공개 큐 인덱스 (0부터).
   * 교사가 다음을 눌러 사망자 → 의사 → 기자 순으로 수동 진행한다.
   */
  morningRevealIndex: number;
  /**
   * 사망자 직업 공개 세부 단계.
   * NONE(사망 안내) → TEASE(마피아가…) → REVEAL_MAFIA_CHECK(맞습니다/아닙니다) → REVEAL_FULL_ROLE(정체)
   */
  morningIdentityStep:
    | 'NONE'
    | 'TEASE'
    | 'REVEAL_MAFIA_CHECK'
    | 'REVEAL_FULL_ROLE';
  gmEvent: GmEvent;
  votes: Record<string, string>;
  matchEndsAt: number | null;
  voteEndsAt: number | null;
  /** 낮 토론 타이머 종료 시각 (부여 시에만). 만료 시 자동 투표 전환 */
  talkEndsAt: number | null;
  /** 동률 시 무작위 1명 탈락 | 동률자만 재투표 */
  voteTieResolution: VoteTieResolution;
  /** 탈락자 직업 즉시 공개 (ON=공개, OFF=탈락만 안내) */
  revealDeathRoles: boolean;
  /**
   * 마피아가 다른 마피아를 밤 지목할 수 있는지.
   * false면 동료 마피아는 선택 불가.
   */
  allowMafiaTargetMafia: boolean;
  /** 생존 마피아 비밀 채팅 사용 허용 (교사는 끄더라도 기존 대화 열람 가능) */
  mafiaChatEnabled: boolean;
  /** 총 진행 라운드 수 (기본: 마피아 수 × 3) */
  maxRounds: number;
  /** 현재 라운드 (밤 시작 시 증가, 0=시작 전) */
  currentRound: number;
  /** 게임 종료 시 승자 */
  winnerSide: WinnerSide | null;
  /** 게임 종료 시 승자 — 외부 연동용 명시적 별칭 */
  victoryTeam?: WinnerSide | null;
  /** 재투표 대상 playerId 목록 (null이면 일반 투표) */
  voteRevoteCandidates: string[] | null;
  dayVoteResult: DayVoteResult | null;
  /** VOTE_RESULT 화면을 교사의 다음 버튼과 공유한다. */
  voteResultStep: VoteResultRevealStep;
  createdAt: number;
  ghostChat: Record<string, GhostChatMessage>;
  /** 생존 마피아 전용 비밀 채팅 (교사는 모니터로 열람) */
  mafiaChat: Record<string, MafiaChatMessage>;
  matchChats: Record<string, Record<string, MatchChatMessage>>;
  matchChatHistory: Record<string, MatchChatRound>;
  ghostPredictions: Record<string, WinnerSide>;
  /**
   * 교사가 특정 학생에게 닉네임 재설정을 요청한 상태.
   * 해당 학생 클라이언트만 모달을 띄운다.
   */
  nicknameChangeRequest: NicknameChangeRequest | null;
  /**
   * 게임 시작 전 교사 확인용 직업 배정(학생 player.role 에는 넣지 않음).
   * 게임 시작 시 실제 players[].role 로 이전되고 null 로 비운다.
   */
  pendingRoleAssignments: Record<string, Role | null> | null;
  /**
   * 교사 직업 인원 설정. 하단 게임 시작 시 미배정 학생 랜덤 채움에 사용.
   */
  roleCountConfig: {
    MAFIA: number;
    DOCTOR: number;
    POLICE: number;
    REPORTER: number;
    SPIRITUALIST: number;
  } | null;
  /**
   * 직업별 밤 퀴즈 미리보기 허용. ON일 때만 해당 직업 학생에게 pending 퀴즈 노출.
   */
  nightQuizPreviewByRole: Record<Role, boolean>;
}

/** 밤 시작 시 퀴즈 설정 */
export interface NightQuizConfig {
  mode: 'MATH' | 'KOREAN' | 'GENERAL' | 'CUSTOM';
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
