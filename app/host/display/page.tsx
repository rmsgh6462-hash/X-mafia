'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Clock3,
  Crosshair,
  HeartPulse,
  Monitor,
  Moon,
  Radio,
  ShieldCheck,
  Skull,
  Sparkles,
  Sun,
  Swords,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import GameBackground, { type BackgroundPhase } from '@/components/GameBackground';
import { HeaderPinQrPanel } from '@/components/common/HeaderPinQrPanel';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { EventIllustration } from '@/components/play/EventIllustration';
import { JailCaptureScene } from '@/components/play/JailCaptureScene';
import { NewspaperArticleModal } from '@/components/play/NewspaperArticleModal';
import {
  getDoctorRescueImage,
  getActiveMorningEvents,
  getMorningEvents,
} from '@/components/play/MorningSequenceModal';
import { isFirebaseConfigured } from '@/lib/firebase';
import { playerGenderFromAvatarId } from '@/lib/game/avatars';
import {
  getCharacterPronoun,
  getCharacterStateForRole,
} from '@/lib/characterUtils';
import { PublicMafiaKillScene } from '@/components/play/PublicMafiaKillScene';
import { playMorningEventSound, playReporterNewsSound } from '@/lib/game/audio';
import { ROLE_ACCENTS, ROLE_LABELS } from '@/lib/game/roles';
import {
  playerList,
  subscribeRoom,
} from '@/lib/game/room';
import type {
  ActiveMorningEvent,
  GameRoom,
  GameState,
  Player,
  PlayerGender,
  Role,
} from '@/types/game';

type IdentityRevealStep =
  | 'NONE'
  | 'TEASE'
  | 'REVEAL_MAFIA_CHECK'
  | 'REVEAL_FULL_ROLE';

function formatPin(pin: string) {
  return pin.replace(/(\d{3})(\d{3})/, '$1 $2');
}

const STATE_LABELS: Record<GameState, string> = {
  WAITING: '입장 대기',
  DAY_TALK: '낮',
  DAY_MATCH: '낮 · 1:1 매칭',
  DAY_MISSION: '낮 · 미션',
  DAY_VOTE: '낮 · 투표',
  VOTE_RESULT: '낮 · 투표 결과',
  NIGHT: '밤',
  RESULT: '아침 결과',
  ENDED: '게임 종료',
};

function toBackgroundPhase(state: GameState | null | undefined): BackgroundPhase {
  if (!state || state === 'WAITING') return 'WAITING';
  if (state === 'NIGHT') return 'NIGHT';
  if (state === 'RESULT' || state === 'ENDED') return 'RESULT';
  return 'DAY';
}

function resolveGender(
  player: Player | null | undefined,
  explicitGender?: PlayerGender | null,
): PlayerGender {
  if (explicitGender === 'boy' || explicitGender === 'girl') return explicitGender;
  if (player?.gender === 'boy' || player?.gender === 'girl') return player.gender;
  return playerGenderFromAvatarId(player?.avatarId);
}

/**
 * 공유 화면에는 교사·학생 비밀 정보가 남지 않도록 구독 직후 공개 상태만 보관한다.
 * Firebase 보안 규칙은 별도로 유지되어야 하며, 이 정리는 UI 계층의 추가 안전장치다.
 */
function toPublicRoom(source: GameRoom): GameRoom {
  const publicPlayers: Record<string, Player> = {};
  Object.entries(source.players ?? {}).forEach(([id, player]) => {
    publicPlayers[id] = {
      ...player,
      role: null,
      nightTarget: null,
      partnerId: null,
      hasSelfHealed: false,
    };
  });

  const publicNightResults = source.nightResults
    ? {
        ...source.nightResults,
        activeEvents: source.nightResults.activeEvents?.map((event) => {
          const doctorFailed =
            event.event === 'DOCTOR_DEFEND' && event.success !== true;
          return {
            event: event.event,
            // 공유 화면에서는 행동자와 허탕 대상 학생의 연결 정보를 제거한다.
            actorId: null,
            targetId: doctorFailed ? null : event.targetId,
            targetName: doctorFailed ? null : event.targetName ?? null,
            targetGender: doctorFailed ? null : event.targetGender ?? null,
            success: event.success,
          };
        }),
        deadRoles:
          source.revealDeathRoles !== false
            ? source.nightResults.deadRoles ?? {}
            : {},
        actionLog: undefined,
        policeReport: null,
        quizHint: null,
        quizSuccessRate: null,
        quizOutcome: null,
      }
    : null;

  const publicDayVoteResult = source.dayVoteResult
    ? {
        ...source.dayVoteResult,
        eliminatedRole:
          source.revealDeathRoles !== false
            ? source.dayVoteResult.eliminatedRole ?? null
            : null,
        ballots: undefined,
      }
    : null;

  const publicQuiz = source.nightQuizState
    ? {
        ...source.nightQuizState,
        question: '',
        answer: '',
        choices: [],
        correctIndex: -1,
        successHint: '',
        submissions: {},
      }
    : null;

  return {
    ...source,
    players: publicPlayers,
    nightQuizState: publicQuiz,
    pendingNightQuizConfig: null,
    mafiaMissionState: null,
    pendingMafiaNightBuff: false,
    isMafiaBuffActive: false,
    currentCitizenMission: null,
    mafiaMission: null,
    missionSubmissions: {},
    missionPeerMap: {},
    missionOutcome: null,
    currentHint: null,
    nightResults: publicNightResults,
    votes: {},
    voteRevoteCandidates: null,
    dayVoteResult: publicDayVoteResult,
    revealDeathRoles: source.revealDeathRoles !== false,
    ghostChat: {},
    matchChats: {},
    matchChatHistory: {},
    ghostPredictions: {},
    mafiaChat: {},
    pendingRoleAssignments: null,
  };
}

function fallbackPublicMorningEvents(
  room: GameRoom,
): ActiveMorningEvent[] {
  const result = room.nightResults;
  if (!result) return [];

  const active = getActiveMorningEvents(result);
  if (active.length > 0) return active;

  return getMorningEvents(result).map((event) => {
    const deadPlayerIds = result.deadPlayerIds ?? [];
    const isIdle = event === 'DOCTOR_IDLE' || event === 'REPORTER_IDLE';
    const targetId =
      isIdle
        ? null
        : event === 'DOCTOR_DEFEND'
        ? result.doctorSavedPlayerId ?? null
        : event === 'REPORTER_NEWS'
          ? result.reporterTargetId ?? null
          : deadPlayerIds[0] ?? null;
    const target = targetId ? room.players[targetId] : null;
    return {
      event,
      actorId: null,
      targetId,
      targetName: target?.name ?? null,
      targetGender: resolveGender(target),
      success: event === 'DOCTOR_DEFEND' ? result.isDoctorDefended === true : undefined,
    };
  });
}

function getTimerEnd(room: GameRoom | null): number | null {
  if (!room) return null;
  if (room.gameState === 'DAY_TALK') return room.talkEndsAt;
  if (room.gameState === 'DAY_MATCH') return room.matchEndsAt;
  if (room.gameState === 'DAY_VOTE') return room.voteEndsAt;
  if (
    room.gameState === 'NIGHT' &&
    room.nightQuizState?.active &&
    room.nightQuizState.outcome === 'PENDING'
  ) {
    return room.nightQuizState.endsAt;
  }
  return null;
}

function formatSeconds(value: number): string {
  return String(Math.max(0, value)).padStart(2, '0');
}

function phaseDescription(room: GameRoom): string {
  switch (room.gameState) {
    case 'WAITING':
      return '어두운 밤이 찾아오기 전, 하나둘 마을 광장에 촛불을 밝히며 사람들이 모여듭니다.';
    case 'DAY_TALK':
      return room.talkEndsAt
        ? '토론 시간이 진행 중입니다. 남은 시간 안에 단서를 나누세요.'
        : '마을 광장에서 자유롭게 단서를 나누고 토론하세요.';
    case 'DAY_MATCH':
      return '짝과 조용히 이야기를 나누며 서로의 단서를 확인하세요.';
    case 'DAY_MISSION':
      return '모두가 함께 진행하는 낮 미션 시간입니다.';
    case 'DAY_VOTE':
      return '마피아라고 생각되는 학생을 신중하게 선택하세요.';
    case 'VOTE_RESULT':
      return '낮 투표 결과를 확인한 뒤 밤 세션으로 이동합니다.';
    case 'NIGHT':
      return '고요한 밤의 장막 뒤에서 서늘한 선택들이 오갑니다. 당신에게 부여된 밤의 시간을 맞이하세요.';
    case 'RESULT':
      return '지난밤의 결과를 모두 함께 확인합니다.';
    case 'ENDED':
      return '이번 게임의 최종 결과입니다.';
  }
}

function PublicStats({ room }: { room: GameRoom }) {
  const players = playerList(room);
  const alive = players.filter((player) => player.isAlive).length;
  const eliminated = players.length - alive;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-black sm:gap-5 sm:text-lg">
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-950/70 px-4 py-2 text-emerald-100 ring-1 ring-emerald-300/35 backdrop-blur-md">
        <Users className="h-5 w-5" />
        생존 {alive}명
      </span>
      <span className="inline-flex items-center gap-2 rounded-full bg-red-950/70 px-4 py-2 text-red-100 ring-1 ring-red-300/35 backdrop-blur-md">
        <Skull className="h-5 w-5" />
        탈락 {eliminated}명
      </span>
    </div>
  );
}

function stageHeadline(state: GameState): string {
  if (state === 'NIGHT') return '밤이 되었습니다.';
  if (state === 'RESULT') return '아침이 되었습니다.';
  if (state === 'DAY_VOTE') return '투표 시간입니다.';
  if (state === 'VOTE_RESULT') return '투표 결과를 발표합니다.';
  if (
    state === 'DAY_TALK' ||
    state === 'DAY_MATCH' ||
    state === 'DAY_MISSION'
  ) {
    return '낮이 되었습니다.';
  }
  return STATE_LABELS[state];
}

const NIGHT_START_NOTICE =
  '고요한 밤의 장막 뒤에서 서늘한 선택들이 오갑니다. 당신에게 부여된 밤의 시간을 맞이하세요.';

function PublicStage({ room, now }: { room: GameRoom; now: number }) {
  const timerEnd = getTimerEnd(room);
  const remaining = timerEnd ? Math.max(0, Math.ceil((timerEnd - now) / 1000)) : 0;
  const isNight = room.gameState === 'NIGHT';

  return (
    <motion.section
      key={room.gameState}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="w-full max-w-4xl rounded-[2rem] border border-white/20 bg-slate-950/55 p-7 text-center shadow-2xl shadow-black/40 backdrop-blur-md sm:p-12"
    >
      <div className="flex items-center justify-center gap-3 text-sm font-black tracking-wide text-white/55 sm:text-base">
        {isNight ? <Moon className="h-5 w-5 text-indigo-200" /> : <Sun className="h-5 w-5 text-amber-200" />}
        {room.gameState === 'WAITING' ? '입장 대기' : null}
      </div>
      <h1 className="mt-5 text-balance text-5xl font-black tracking-tight text-white drop-shadow-lg sm:text-8xl">
        {stageHeadline(room.gameState)}
      </h1>
      {isNight ? (
        <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-relaxed text-white/55 sm:text-base">
          {NIGHT_START_NOTICE}
        </p>
      ) : (
        <p className={`mx-auto mt-5 max-w-2xl font-semibold text-white/75 ${room.gameState === 'WAITING' ? 'text-base sm:text-xl' : 'text-lg sm:text-2xl'}`}>
          {phaseDescription(room)}
        </p>
      )}

      {remaining > 0 && (
        <div className="mx-auto mt-9 max-w-md rounded-3xl bg-black/35 px-6 py-5 ring-1 ring-white/15">
          <p className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-white/55">
            <Clock3 className="h-4 w-4" />
            {room.gameState === 'DAY_TALK'
              ? '남은 토론 시간'
              : room.gameState === 'DAY_VOTE'
                ? '남은 투표 시간'
                : '남은 시간'}
          </p>
          <p className={`mt-2 font-mono text-8xl font-black tabular-nums sm:text-[10rem] ${remaining <= 5 ? 'text-red-300' : 'text-amber-200'}`}>
            {formatSeconds(remaining)}
          </p>
          {room.gameState === 'DAY_TALK' && (
            <p className="text-sm font-bold text-white/60">
              시간이 끝나면 투표가 시작됩니다
            </p>
          )}
          {room.gameState === 'NIGHT' && room.nightQuizState?.active && (
            <p className="text-sm font-bold text-white/60">밤 퀴즈 진행 중</p>
          )}
        </div>
      )}

    </motion.section>
  );
}

function PublicMorningEvent({
  event,
  room,
  avatarSize,
  identityStep = 'NONE',
}: {
  event: ActiveMorningEvent;
  room: GameRoom;
  avatarSize: number;
  identityStep?: IdentityRevealStep;
}) {
  const target = event.targetId ? room.players[event.targetId] : null;
  const targetName = event.targetName ?? target?.name ?? '학생';
  const targetGender = resolveGender(target, event.targetGender);
  const wasKilled = Boolean(
    event.targetId && (room.nightResults?.deadPlayerIds ?? []).includes(event.targetId),
  );
  const deadRole =
    event.event === 'MAFIA_KILL' && event.targetId
      ? room.nightResults?.deadRoles?.[event.targetId] ?? null
      : null;

  if (
    event.event === 'MAFIA_KILL' &&
    wasKilled &&
    deadRole &&
    identityStep !== 'NONE'
  ) {
    return (
      <PublicIdentityReveal
        avatarId={target?.avatarId}
        name={targetName}
        role={deadRole}
        step={identityStep}
        avatarSize={avatarSize}
        gender={targetGender}
      />
    );
  }

  if (event.event === 'MAFIA_KILL') {
    return (
      <PublicMafiaKillScene
        targetName={targetName}
        avatarId={target?.avatarId}
        avatarSize={avatarSize}
        wasKilled={wasKilled}
        targetKey={event.targetId ?? targetName}
      />
    );
  }

  if (event.event === 'DOCTOR_IDLE' || event.event === 'REPORTER_IDLE') {
    return (
      <PublicRoleIdle
        event={event}
        avatarSize={avatarSize}
        role={event.event === 'DOCTOR_IDLE' ? 'DOCTOR' : 'REPORTER'}
      />
    );
  }

  if (event.event === 'DOCTOR_DEFEND' && event.success !== true) {
    return (
      <motion.section
        key="public-doctor-fail"
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative min-h-[58vh] w-full max-w-7xl overflow-hidden rounded-[2rem] border border-amber-200/30 bg-slate-950/90 text-white shadow-2xl shadow-violet-950/70"
      >
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-violet-400 via-amber-200 to-violet-400" />
        <div className="relative grid min-h-[58vh] items-center gap-8 p-5 sm:p-8 lg:grid-cols-[1.15fr_1fr] lg:p-12">
          <div className="relative flex min-h-[50vh] items-center justify-center overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_50%_35%,rgba(124,58,237,0.42),rgba(15,23,42,0.98)_68%)] shadow-2xl shadow-violet-950/60">
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_20%,rgba(251,191,36,0.16)_48%,transparent_72%)]"
              animate={{ x: ['-18%', '18%', '-18%'] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <Sparkles className="absolute left-[18%] top-[18%] h-12 w-12 text-amber-200/70 animate-pulse" />
            <Sparkles className="absolute bottom-[20%] right-[18%] h-9 w-9 text-violet-200/65 animate-pulse" />
            <EventIllustration
              kind="doctor_fail"
              size={avatarSize}
              className="relative z-10 ring-8 ring-amber-200/30 shadow-[0_0_42px_rgba(251,191,36,0.3)]"
            />
          </div>
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center gap-3 text-sm font-black uppercase tracking-[0.3em] text-amber-200 lg:justify-start sm:text-lg">
              <HeartPulse className="h-7 w-7 animate-pulse" />
              의사 미션 실패
            </div>
            <h1 className="mt-6 text-balance text-4xl font-black leading-tight text-amber-50 sm:text-6xl">
              의사의 구조 실패!
            </h1>
            <p className="mt-5 text-lg font-bold leading-relaxed text-violet-100/85 sm:text-2xl">
              밤사이 의사가 분주히 움직였으나, 아무도 구하지 못했습니다...
            </p>
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-black/30 px-5 py-3 text-base font-black text-amber-100 ring-1 ring-amber-200/25 sm:text-xl">
              <HeartPulse className="h-5 w-5" />
              익명 구조 실패 기록
            </p>
          </div>
        </div>
      </motion.section>
    );
  }

  if (event.event === 'DOCTOR_DEFEND') {
    return (
      <motion.section
        key="public-doctor-defend"
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative min-h-[58vh] w-full max-w-7xl overflow-hidden rounded-[2rem] border border-emerald-300/35 bg-emerald-950/80 text-white shadow-2xl shadow-emerald-950/60"
      >
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-cyan-300 via-emerald-200 to-cyan-300" />
        <div className="relative grid min-h-[58vh] items-center gap-8 p-5 sm:p-8 lg:grid-cols-[1.35fr_1fr] lg:p-12">
          <div className="relative flex min-h-[50vh] items-center justify-center overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_50%_30%,rgba(16,185,129,0.35),rgba(6,78,59,0.95)_65%)] shadow-2xl shadow-emerald-950/60">
            {/* 성별별 마을 구조 장면을 메인 비주얼로 사용한다. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getDoctorRescueImage(targetGender)}
              alt={`${targetGender === 'girl' ? '여학생' : '남학생'} 구조 장면`}
              className="absolute inset-0 h-full w-full object-cover"
              decoding="async"
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-950/15 to-emerald-950/10" />
            <div className="absolute left-5 top-5 rounded-full bg-emerald-950/75 px-4 py-2 text-sm font-black text-emerald-100 ring-1 ring-emerald-200/40 sm:text-lg">
              {targetGender === 'girl' ? '여학생 구조' : '남학생 구조'}
            </div>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-2xl bg-emerald-950/75 p-2 ring-2 ring-emerald-200/45 shadow-2xl">
              <CharacterAvatar
                avatarId={target?.avatarId}
                isAlive
                state={null}
                size={Math.max(150, Math.round(avatarSize * 0.46))}
                className="relative z-10"
              />
            </div>
            <div className="absolute bottom-6 rounded-full border border-emerald-100/50 bg-emerald-950/60 p-3 text-emerald-100">
              <HeartPulse className="h-8 w-8" strokeWidth={1.8} />
            </div>
          </div>
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center gap-3 text-sm font-black uppercase tracking-[0.3em] text-emerald-100 lg:justify-start sm:text-lg">
              <ShieldCheck className="h-7 w-7 animate-pulse" />
              의사 구조 성공
            </div>
            <h1 className="mt-6 text-balance text-4xl font-black leading-tight text-emerald-50 sm:text-6xl">
              {event.success ? '의사가 시민을 무사히 살려냈습니다!' : '의사가 보호막을 펼쳤습니다!'}
            </h1>
            <p className="mt-5 text-lg font-bold leading-relaxed text-cyan-100/80 sm:text-2xl">
              {targetName} 님에게 치료가 진행되었습니다.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-black/25 px-4 py-2 text-sm font-black text-emerald-100 ring-1 ring-emerald-200/25 sm:text-base">
              <HeartPulse className="h-5 w-5" />
              {targetGender === 'girl' ? '여학생' : '남학생'} 구조 완료
            </p>
          </div>
        </div>
      </motion.section>
    );
  }

  const reporterRole = room.nightResults?.reporterTargetRole ?? null;
  return (
    <NewspaperArticleModal
      targetName={targetName}
      role={reporterRole}
      targetAvatarId={target?.avatarId}
      displayMode
      hideActions
      playSound={false}
    />
  );
}

function PublicRoleIdle({
  event,
  avatarSize,
  role,
}: {
  event: ActiveMorningEvent;
  avatarSize: number;
  role: 'DOCTOR' | 'REPORTER';
}) {
  const isDoctor = role === 'DOCTOR';
  const title = isDoctor
    ? '밤사이 의사는 아무도 지목하지 않고 조용히 넘겼습니다.'
    : '밤사이 기자는 아무도 지목하지 않고 조용히 넘겼습니다.';
  const message = isDoctor
    ? '이번 밤에는 의사 활동이 없었습니다.'
    : '이번 밤에는 기자 활동이 없었습니다.';

  return (
    <motion.section
      key={`public-${event.event}`}
      initial={{ opacity: 0, scale: 0.92, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={`relative min-h-[58vh] w-full max-w-7xl overflow-hidden rounded-[2rem] border text-white shadow-2xl ${
        isDoctor
          ? 'border-emerald-300/35 bg-[#071c1b]/95 shadow-emerald-950/70'
          : 'border-amber-200/35 bg-[#21160d]/95 shadow-amber-950/70'
      }`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${
          isDoctor
            ? 'bg-[radial-gradient(circle_at_30%_30%,rgba(52,211,153,.25),transparent_42%),linear-gradient(135deg,rgba(14,116,144,.24),transparent_60%)]'
            : 'bg-[radial-gradient(circle_at_30%_30%,rgba(251,191,36,.24),transparent_42%),linear-gradient(135deg,rgba(146,64,14,.28),transparent_60%)]'
        }`}
      />
      <div className="relative grid min-h-[58vh] items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1.05fr_1fr] lg:p-14">
        <div className={`relative flex min-h-[42vh] items-center justify-center overflow-hidden rounded-3xl border ${isDoctor ? 'border-emerald-200/25 bg-emerald-950/60' : 'border-amber-200/25 bg-amber-950/55'}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,.12),transparent_38%),linear-gradient(to_top,rgba(2,6,23,.8),transparent_65%)]" />
          <motion.div
            aria-hidden="true"
            className={`pointer-events-none absolute -inset-x-20 bottom-0 h-1/2 blur-2xl ${isDoctor ? 'bg-emerald-300/10' : 'bg-amber-200/10'}`}
            animate={{ x: ['-6%', '6%', '-6%'], opacity: [0.35, 0.7, 0.35] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <EventIllustration
            kind={isDoctor ? 'doctor_idle' : 'reporter_idle'}
            size={Math.max(240, Math.round(avatarSize * 0.72))}
            className="relative z-10"
          />
        </div>
        <div className="relative text-center lg:text-left">
          <div className={`flex items-center justify-center gap-3 text-sm font-black uppercase tracking-[0.3em] lg:justify-start sm:text-lg ${isDoctor ? 'text-emerald-200' : 'text-amber-200'}`}>
            {isDoctor ? <HeartPulse className="h-7 w-7" /> : <Radio className="h-7 w-7" />}
            {isDoctor ? '의사 밤 기록' : '기자 밤 기록'}
          </div>
          <h1 className="mt-6 text-balance text-4xl font-black leading-tight sm:text-6xl">
            {title}
          </h1>
          <p className="mt-5 text-lg font-bold leading-relaxed text-white/75 sm:text-2xl">
            {message}
          </p>
          <p className={`mt-6 inline-flex rounded-full px-5 py-3 text-base font-black ring-1 sm:text-xl ${isDoctor ? 'bg-emerald-400/10 text-emerald-100 ring-emerald-200/25' : 'bg-amber-400/10 text-amber-100 ring-amber-200/25'}`}>
            다음 밤에는 다시 능력을 사용할 수 있습니다.
          </p>
        </div>
      </div>
    </motion.section>
  );
}

function PublicIdentityReveal({
  avatarId,
  name,
  role,
  step,
  avatarSize,
  gender,
}: {
  avatarId?: string;
  name: string;
  role: Role;
  step: Exclude<IdentityRevealStep, 'NONE'>;
  avatarSize: number;
  gender?: PlayerGender | null;
}) {
  const isMafia = role === 'MAFIA';
  const isFullRole = step === 'REVEAL_FULL_ROLE';
  const isTease = step === 'TEASE';
  const accent = ROLE_ACCENTS[role];

  return (
    <motion.section
      key={`identity-reveal-${name}-${role}-${step}`}
      initial={{ opacity: 0, scale: 0.88, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={`relative flex min-h-[58vh] w-full max-w-5xl flex-col items-center justify-center overflow-hidden rounded-[2rem] border text-center text-white shadow-2xl ${
        isMafia && !isTease
          ? 'border-red-300/55 bg-[#19080b]/95 shadow-red-950/70'
          : isTease
            ? 'border-amber-300/45 bg-[#15100a]/95 shadow-amber-950/60'
            : 'border-sky-300/55 bg-[#071728]/95 shadow-sky-950/70'
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          background: `radial-gradient(circle at 50% 34%, ${accent}88, transparent 48%), linear-gradient(135deg, ${isMafia ? '#7f1d1d' : '#0c4a6e'}66, transparent 60%)`,
        }}
      />
      <div className="relative z-10 flex flex-col items-center px-6 py-10 sm:px-12">
        <p className={`text-xl font-black tracking-[0.24em] sm:text-3xl ${isMafia && !isTease ? 'text-red-200' : isTease ? 'text-amber-100' : 'text-sky-200'}`}>
          {name} 님은...
        </p>
        <div className={`relative mt-7 rounded-[2rem] p-3 ring-4 ${isMafia && !isTease ? 'bg-red-950/60 ring-red-300/35' : isTease ? 'bg-amber-950/50 ring-amber-200/30' : 'bg-sky-950/60 ring-sky-300/35'}`}>
          <CharacterAvatar
            avatarId={avatarId}
            isAlive
            role={role}
            revealRole={isFullRole}
            state={isFullRole ? getCharacterStateForRole(role) : 'dead'}
            size={Math.max(300, Math.round(avatarSize * 0.68))}
            className={`transition-all duration-500 ${isFullRole ? 'scale-105' : 'scale-95 blur-[4px] opacity-70'}`}
          />
          {!isFullRole && (
            <div className="absolute inset-0 flex items-center justify-center rounded-[2rem] bg-black/10">
              <span className="rounded-full bg-black/60 px-5 py-2 text-sm font-black tracking-[0.2em] text-white/80">
                {isTease ? '정체 추리 중' : '정체 확인 중'}
              </span>
            </div>
          )}
        </div>
        <motion.h1
          key={step}
          initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          className={`mt-8 text-balance text-4xl font-black leading-tight sm:text-6xl ${
            isFullRole
              ? isMafia
                ? 'text-red-100'
                : 'text-sky-100'
              : step === 'REVEAL_MAFIA_CHECK'
                ? isMafia
                  ? 'text-red-100'
                  : 'text-sky-100'
                : 'text-amber-50'
          }`}
        >
          {isFullRole
            ? `${getCharacterPronoun(gender)}의 정체는 ${ROLE_LABELS[role]}였습니다.`
            : isTease
              ? `${name} 님은... 마피아가`
              : `${name} 님은... 마피아가 ${isMafia ? '맞습니다!' : '아닙니다!'}`}
        </motion.h1>
        <p className="mt-5 text-base font-bold text-white/65 sm:text-xl">
          {isFullRole
            ? `직업 이미지 공개 · ${ROLE_LABELS[role]}`
            : isTease
              ? '교사가 다음을 누르면 결과가 공개됩니다.'
              : '교사가 다음을 누르면 정체가 공개됩니다.'}
        </p>
      </div>
    </motion.section>
  );
}

function PublicConnectedRoster({ room }: { room: GameRoom }) {
  const players = useMemo(
    () =>
      playerList(room)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [room],
  );

  if (players.length === 0) {
    return (
      <section className="w-full max-w-6xl rounded-[1.75rem] border border-white/15 bg-black/40 px-5 py-8 text-center shadow-xl backdrop-blur-md sm:px-8">
        <p className="text-sm font-black tracking-wide text-white/50 sm:text-base">
          아직 입장한 학생이 없습니다
        </p>
        <p className="mt-2 text-xs font-semibold text-white/35 sm:text-sm">
          PIN 또는 QR로 접속하면 여기에 캐릭터와 닉네임이 나타납니다.
        </p>
      </section>
    );
  }

  const isWaiting = room.gameState === 'WAITING';
  const avatarSize = isWaiting ? 88 : 64;

  return (
    <section className="w-full max-w-6xl rounded-[1.75rem] border border-white/15 bg-black/40 p-4 shadow-xl backdrop-blur-md sm:p-6">
      <div className="mb-4 flex items-center justify-center gap-2 text-xs font-black tracking-[0.22em] text-amber-100/85 sm:text-sm">
        <Users className="h-4 w-4 text-amber-200" />
        접속한 학생
        <span className="rounded-full bg-amber-400/90 px-2.5 py-0.5 font-mono text-[11px] tracking-normal text-stone-900 sm:text-xs">
          {players.length}명
        </span>
      </div>
      <ul
        className={`grid justify-items-center gap-3 sm:gap-4 ${
          players.length <= 6
            ? 'grid-cols-3 sm:grid-cols-3 md:grid-cols-6'
            : players.length <= 12
              ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6'
              : 'grid-cols-4 sm:grid-cols-5 md:grid-cols-8'
        }`}
      >
        {players.map((player) => (
          <li
            key={player.id}
            className={`flex w-full max-w-[7.5rem] flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center ring-1 transition sm:max-w-[8.5rem] ${
              player.isAlive
                ? 'bg-white/5 ring-white/12'
                : 'bg-red-950/45 ring-red-300/25 opacity-80'
            }`}
          >
            <CharacterAvatar
              avatarId={player.avatarId}
              isAlive={player.isAlive}
              state={player.isAlive ? null : 'dead'}
              size={avatarSize}
            />
            <p
              className={`w-full truncate text-sm font-black sm:text-base ${
                player.isAlive ? 'text-white' : 'text-red-100/85'
              }`}
            >
              {player.name}
            </p>
            {!player.isAlive && (
              <span className="text-[10px] font-bold tracking-wide text-red-200/80">
                탈락
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PublicEliminatedStrip({ room }: { room: GameRoom }) {
  const eliminated = playerList(room).filter((player) => !player.isAlive).slice(-4);
  if (eliminated.length === 0) return null;

  return (
    <section className="w-full max-w-6xl rounded-2xl border border-red-300/25 bg-black/45 p-3 shadow-xl backdrop-blur-md sm:p-4">
      <div className="mb-2 flex items-center justify-center gap-2 text-xs font-black tracking-[0.2em] text-red-100/80 sm:text-sm">
        <Skull className="h-4 w-4" />
        탈락 학생
      </div>
      <div className="flex flex-wrap justify-center gap-3 sm:gap-5">
        {eliminated.map((player) => (
          <div key={player.id} className="flex items-center gap-2 rounded-xl bg-red-950/55 px-2 py-2 ring-1 ring-red-300/20 sm:gap-3 sm:px-3">
            <CharacterAvatar
              avatarId={player.avatarId}
              isAlive={false}
              size={48}
            />
            <span className="text-sm font-black text-red-50 sm:text-base">{player.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PublicVoteResult({
  room,
  avatarSize,
}: {
  room: GameRoom;
  avatarSize: number;
}) {
  const result = room.dayVoteResult;
  const eliminated = result?.eliminatedPlayerId
    ? room.players[result.eliminatedPlayerId]
    : null;
  const canRevealIdentity = Boolean(
    room.revealDeathRoles !== false && result?.eliminatedRole && eliminated,
  );
  const isMafia = result?.eliminatedRole === 'MAFIA';
  const voteStep = room.voteResultStep ?? 'ARREST';
  const isTease = voteStep === 'MAFIA_TEASE';
  const isMafiaResult = voteStep === 'MAFIA_RESULT';
  const isFullRole = voteStep === 'FULL_ROLE';
  const revealActualRole = Boolean(
    canRevealIdentity && (isMafiaResult || isFullRole),
  );
  const roleLabel =
    canRevealIdentity && result?.eliminatedRole
      ? ROLE_LABELS[result.eliminatedRole]
      : null;

  if (!result) return null;

  if (eliminated && canRevealIdentity && isFullRole) {
    return (
      <JailCaptureScene
        avatarId={eliminated.avatarId}
        name={eliminated.name}
        isMafia={isMafia}
        role={result.eliminatedRole}
        finalRoleReveal
        displayMode
      />
    );
  }

  return (
    <motion.section
      key={`vote-result-${result.resolvedAt}`}
      initial={{ opacity: 0, scale: 0.9, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="relative min-h-[58vh] w-full max-w-7xl overflow-hidden rounded-[2rem] border border-amber-300/45 bg-[#130b18]/95 text-white shadow-2xl shadow-black/70"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(245,158,11,0.22),transparent_42%),linear-gradient(115deg,rgba(127,29,29,0.55),transparent_45%,rgba(30,27,75,0.7))]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:repeating-linear-gradient(90deg,transparent_0,transparent_10%,rgba(248,113,113,0.3)_10.3%,transparent_10.7%,transparent_20%)]" />
      <div className="relative grid min-h-[58vh] items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:p-14">
        <div className="relative flex min-h-[50vh] items-center justify-center overflow-hidden rounded-3xl border border-amber-200/25 bg-[radial-gradient(circle_at_50%_38%,rgba(180,83,9,0.48),rgba(15,23,42,0.94)_70%)] shadow-2xl shadow-black/60">
          <div className="pointer-events-none absolute inset-0 z-20 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_8%,rgba(226,232,240,.03)_8.3%,rgba(226,232,240,.55)_8.8%,rgba(15,23,42,.92)_9.5%,transparent_10.6%,transparent_20%)] opacity-90" />
          <div className="pointer-events-none absolute inset-0 z-20 bg-[repeating-linear-gradient(0deg,transparent_0,transparent_18%,rgba(15,23,42,.48)_19%,transparent_20%)] opacity-70" />
          <div className="pointer-events-none absolute inset-x-[18%] top-[-12%] z-10 h-2/3 rounded-full bg-amber-100/25 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:repeating-linear-gradient(90deg,transparent_0,transparent_13%,rgba(226,232,240,0.22)_13.5%,rgba(226,232,240,0.22)_14%,transparent_14.5%,transparent_27%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/75 to-transparent" />
          {eliminated ? (
            <CharacterAvatar
              avatarId={eliminated.avatarId}
              isAlive
              role={result.eliminatedRole}
              revealRole={revealActualRole}
              state={revealActualRole && result.eliminatedRole
                ? getCharacterStateForRole(result.eliminatedRole)
                : 'normal'}
              size={avatarSize}
              className={`relative z-10 transition-all duration-500 ${isFullRole ? 'scale-105' : ''}`}
            />
          ) : (
            <Skull className="relative z-10 h-40 w-40 text-amber-200/75 sm:h-56 sm:w-56" />
          )}
          <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-5 py-2 text-lg font-black text-amber-100 ring-1 ring-amber-200/35 sm:text-2xl">
            {eliminated?.name ?? '체포된 학생 없음'}
          </div>
        </div>

        <div className="relative text-center lg:text-left">
          <div className="flex items-center justify-center gap-3 text-sm font-black uppercase tracking-[0.3em] text-amber-200 lg:justify-start sm:text-lg">
            <Radio className="h-7 w-7 animate-pulse" />
            투표 체포 결과
            <Radio className="h-7 w-7 animate-pulse" />
          </div>
          <h1 className="mt-6 text-balance text-5xl font-black leading-tight text-amber-50 sm:text-7xl">
            {eliminated ? '투표 체포 결과' : '투표 결과 발표'}
          </h1>
          <p className="mt-6 text-2xl font-black leading-relaxed text-white sm:text-4xl">
            {eliminated
              ? `투표 결과, ${eliminated.name} 님이 체포되어 감옥에 수감되었습니다.`
              : result.announcement ?? '이번 투표에서 체포된 학생은 없습니다.'}
          </p>
          {canRevealIdentity && result.eliminatedRole && voteStep !== 'ARREST' && (
            <motion.div
              key={voteStep}
              initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              className={`mt-7 rounded-2xl px-5 py-4 ring-1 ${
                isTease
                  ? 'bg-amber-950/70 text-amber-100 ring-amber-300/40'
                  : isMafia
                    ? 'bg-red-950/70 text-red-100 ring-red-300/40'
                    : 'bg-sky-950/70 text-sky-100 ring-sky-300/40'
              }`}
            >
              <p className="text-lg font-black sm:text-2xl">
                {isTease
                  ? `${eliminated?.name ?? '학생'} 님은 마피아가...`
                  : isMafiaResult
                    ? `${eliminated?.name ?? '학생'} 님은 마피아가... ${isMafia ? '맞습니다!' : '아닙니다!'}`
                    : `${eliminated?.name ?? '학생'} 님의 정체는 ${roleLabel}였습니다.`}
              </p>
              {isMafiaResult && (
                <p className="mt-2 text-sm font-bold text-white/70 sm:text-base">
                  교사가 다음을 누르면 구체적인 직업이 공개됩니다.
                </p>
              )}
              {isFullRole && (
                <p className="mt-2 text-sm font-bold text-white/70 sm:text-base">
                  직업 이미지 공개 · {roleLabel}
                </p>
              )}
            </motion.div>
          )}
          {result.wasTie && (
            <p className="mt-5 text-base font-bold text-amber-100/75 sm:text-xl">
              동률 처리 결과가 반영되었습니다.
            </p>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function PublicVictoryDisplay({ room }: { room: GameRoom }) {
  const winner = room.victoryTeam ?? room.winnerSide;
  const mafiaWon = winner === 'MAFIA';
  const image = mafiaWon
    ? '/illustrations/mafia-team-victory.png'
    : '/illustrations/citizen-team-victory.png';
  const players = playerList(room);
  const alive = players.filter((player) => player.isAlive).length;

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`w-full max-w-6xl overflow-hidden rounded-[2rem] border shadow-2xl ${mafiaWon ? 'border-red-300/40 bg-[#19080b]/90 shadow-red-950/60' : 'border-sky-300/45 bg-[#071728]/90 shadow-sky-950/60'}`}
    >
      <div className="relative h-[23rem] overflow-hidden sm:h-[34rem]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={mafiaWon ? '마피아 팀 승리 장면' : '시민 팀 승리 장면'}
          className="h-full w-full object-cover"
          decoding="async"
          draggable={false}
        />
        <div className={`absolute inset-0 ${mafiaWon ? 'bg-gradient-to-b from-black/15 via-red-950/25 to-[#19080b]' : 'bg-gradient-to-b from-sky-950/5 via-sky-950/10 to-[#071728]'} `} />
        <div className="absolute inset-x-4 bottom-8 text-center sm:bottom-12">
          <motion.div animate={{ scale: [1, 1.035, 1] }} transition={{ duration: 2.2, repeat: Infinity }} className="flex items-center justify-center gap-4">
            <Sparkles className={`h-7 w-7 ${mafiaWon ? 'text-red-300' : 'text-sky-200'}`} />
            <h1 className="text-balance text-5xl font-black text-white drop-shadow-[0_3px_14px_rgba(0,0,0,.8)] sm:text-8xl">
              {winner === 'MAFIA' ? '마피아 팀 승리!' : winner === 'CITIZEN' ? '시민 팀 승리!' : '게임 종료'}
            </h1>
            <Sparkles className={`h-7 w-7 ${mafiaWon ? 'text-red-300' : 'text-sky-200'}`} />
          </motion.div>
          <p className="mt-4 text-xl font-black text-white/90 sm:text-3xl">
            {mafiaWon ? '시민들을 완벽하게 속였습니다!' : '마피아를 모두 찾아냈습니다!'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4 px-6 py-5 text-base font-black text-white/80 sm:gap-8 sm:text-xl">
        <span className="inline-flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-200" />최종 결과</span>
        <span>생존 {alive}명</span>
        <span>탈락 {players.length - alive}명</span>
      </div>
    </motion.section>
  );
}

export default function HostDisplayPage() {
  const [roomId, setRoomId] = useState('');
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [displayAvatarSize, setDisplayAvatarSize] = useState(520);
  const [joinUrl, setJoinUrl] = useState('');
  const [pinQrExpanded, setPinQrExpanded] = useState(false);

  useEffect(() => {
    setJoinUrl(window.location.origin);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextRoomId = params.get('roomId') ?? params.get('pin') ?? '';
    const timer = window.setTimeout(() => setRoomId(nextRoomId), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    if (!isFirebaseConfigured()) {
      const timer = window.setTimeout(
        () => setError('Firebase가 설정되지 않아 실시간 디스플레이를 연결할 수 없습니다.'),
        0,
      );
      return () => window.clearTimeout(timer);
    }
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeRoom(roomId, (remote) => {
        if (remote) {
          setRoom(toPublicRoom(remote));
          setError(null);
        } else {
          setRoom(null);
          setError('해당 게임 방을 찾을 수 없습니다.');
        }
      });
    } catch {
      const timer = window.setTimeout(
        () => setError('Firebase 실시간 연결에 실패했습니다.'),
        0,
      );
      return () => window.clearTimeout(timer);
    }
    return () => unsubscribe?.();
  }, [roomId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const updateAvatarSize = () => {
      setDisplayAvatarSize(
        Math.max(320, Math.min(640, Math.floor(window.innerHeight * 0.52))),
      );
    };
    updateAvatarSize();
    window.addEventListener('resize', updateAvatarSize);
    return () => window.removeEventListener('resize', updateAvatarSize);
  }, []);

  const morningEvents = useMemo(
    () => (room ? fallbackPublicMorningEvents(room) : []),
    [room],
  );
  const morningIndex = Math.min(
    Math.max(0, room?.morningRevealIndex ?? 0),
    Math.max(0, morningEvents.length - 1),
  );
  const morningIdentityStep: IdentityRevealStep =
    room?.morningIdentityStep ?? 'NONE';
  const currentMorningEvent = morningEvents[morningIndex] ?? null;
  const showMorningSequence = room?.gameState === 'RESULT' && Boolean(currentMorningEvent);
  const showVoteResult =
    room?.gameState === 'VOTE_RESULT' && Boolean(room.dayVoteResult);

  useEffect(() => {
    if (!showMorningSequence || !currentMorningEvent) return;
    const eventType = currentMorningEvent.event;
    if (eventType === 'MAFIA_KILL') return;
    if (eventType === 'REPORTER_NEWS') {
      void playReporterNewsSound().catch(() => undefined);
      return;
    }
    void playMorningEventSound(eventType, {
      success: currentMorningEvent.success,
    }).catch(() => {
      // 자동 재생이 차단되어도 학생 공유 화면의 시각 연출은 계속 진행한다.
    });
  }, [currentMorningEvent, showMorningSequence, morningIdentityStep]);

  const phase = toBackgroundPhase(room?.gameState);

  return (
    <GameBackground
      theme="VILLAGE"
      gameState={phase}
      playerCount={room && phase === 'WAITING' ? playerList(room).length : 0}
      className="min-h-screen"
    >
      <div className="flex min-h-screen flex-col text-white">
        <header className="relative z-20 flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-10 sm:py-6">
          <div className="flex items-start gap-3">
            <Monitor className="h-7 w-7 shrink-0 text-amber-200 sm:h-9 sm:w-9" />
            <div>
              <p className="text-xl font-black tracking-tight sm:text-3xl">X-Mafia</p>
              <p className="text-[10px] font-black tracking-[0.25em] text-white/55 sm:text-xs">
                학생 공유 화면
              </p>
              {room && (
                <HeaderPinQrPanel
                  pin={room.pin}
                  joinUrl={joinUrl}
                  expanded={pinQrExpanded}
                  onToggle={() => setPinQrExpanded((v) => !v)}
                  variant="display"
                />
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-black sm:gap-3 sm:text-sm">
            {room && (
              <span className="rounded-full bg-black/35 px-3 py-1.5 ring-1 ring-white/15">
                {STATE_LABELS[room.gameState]}
              </span>
            )}
            {room && room.gameState !== 'WAITING' && (
              <span className="rounded-full bg-amber-400/90 px-3 py-1.5 font-mono text-stone-900">
                ROUND {room.currentRound} / {room.maxRounds}
              </span>
            )}
          </div>
        </header>

        <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-4 pb-8 pt-2 sm:gap-7 sm:px-8">
          {!room && !error && (
            <div className="rounded-3xl bg-black/45 px-8 py-10 text-center text-xl font-black ring-1 ring-white/15 backdrop-blur-md sm:px-16 sm:py-14 sm:text-3xl">
              <Wifi className="mx-auto mb-4 h-10 w-10 animate-pulse text-amber-200" />
              게임 방에 연결하는 중입니다…
            </div>
          )}
          {error && (
            <div className="rounded-3xl bg-red-950/75 px-8 py-10 text-center text-lg font-black text-red-100 ring-1 ring-red-300/30 sm:px-16 sm:py-14 sm:text-2xl">
              <WifiOff className="mx-auto mb-4 h-10 w-10 text-red-200" />
              {error}
              <p className="mt-3 text-sm font-semibold text-red-100/70">교사 화면에서 학생 공유 화면 창을 다시 열어 주세요.</p>
            </div>
          )}
          {room && <PublicStats room={room} />}
          {room && room.gameState === 'ENDED' ? (
            <PublicVictoryDisplay room={room} />
          ) : room && showMorningSequence && currentMorningEvent ? (
            <AnimatePresence mode="wait">
              <PublicMorningEvent
                key={`${currentMorningEvent.event}-${morningIndex}-${morningIdentityStep}`}
                event={currentMorningEvent}
                room={room}
                avatarSize={displayAvatarSize}
                identityStep={morningIdentityStep}
              />
            </AnimatePresence>
          ) : room && showVoteResult ? (
            <AnimatePresence mode="wait">
              <PublicVoteResult
                key={`vote-result-${room.dayVoteResult?.resolvedAt ?? 'pending'}`}
                room={room}
                avatarSize={displayAvatarSize}
              />
            </AnimatePresence>
          ) : room ? (
            <>
              <PublicStage room={room} now={now} />
              <PublicConnectedRoster room={room} />
            </>
          ) : null}
          {room && room.gameState !== 'WAITING' && (
            <PublicEliminatedStrip room={room} />
          )}
        </main>

        <footer className="relative z-20 px-5 pb-4 text-center text-[10px] font-bold tracking-wide text-white/45 sm:text-xs">
          소리(나레이션·배경음)는 교사 화면에서 켜고 끌 수 있습니다. 교사가 진행하면 학생 공유 화면이 실시간으로 전환됩니다.
        </footer>
      </div>
    </GameBackground>
  );
}
