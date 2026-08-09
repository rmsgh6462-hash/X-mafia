'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Clock3,
  Crosshair,
  HeartPulse,
  Monitor,
  Moon,
  Newspaper,
  Radio,
  ShieldCheck,
  Skull,
  Sparkles,
  Sun,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import GameBackground, { type BackgroundPhase } from '@/components/GameBackground';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import {
  getActiveMorningEvents,
  getMorningEvents,
} from '@/components/play/MorningSequenceModal';
import { isFirebaseConfigured } from '@/lib/firebase';
import { playerGenderFromAvatarId } from '@/lib/game/avatars';
import { playMorningEventSound, playPhaseBgm, stopAllAudio } from '@/lib/game/audio';
import { ROLE_LABELS } from '@/lib/game/roles';
import { playerList, subscribeRoom } from '@/lib/game/room';
import { playVictorySound } from '@/lib/utils/sound';
import type {
  ActiveMorningEvent,
  GameRoom,
  GameState,
  Player,
  PlayerGender,
} from '@/types/game';

const STATE_LABELS: Record<GameState, string> = {
  WAITING: '입장 대기',
  DAY_TALK: '낮 · 토론',
  DAY_MATCH: '낮 · 1:1 매칭',
  DAY_MISSION: '낮 · 미션',
  DAY_VOTE: '낮 · 투표',
  NIGHT: '밤 세션',
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
        activeEvents: source.nightResults.activeEvents?.map((event) => ({
          event: event.event,
          actorId: null,
          targetId: event.targetId,
          targetName: event.targetName ?? null,
          targetGender: event.targetGender ?? null,
          success: event.success,
        })),
        deadRoles: {},
        actionLog: undefined,
        policeReport: null,
        quizHint: null,
        quizSuccessRate: null,
        quizOutcome: null,
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
    dayVoteResult: null,
    revealDeathRoles: false,
    ghostChat: {},
    matchChats: {},
    matchChatHistory: {},
    ghostPredictions: {},
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
    const targetId =
      event === 'DOCTOR_DEFEND'
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
      return '학생들이 캐릭터를 선택하고 입장하기를 기다리고 있습니다.';
    case 'DAY_TALK':
      return '마을 광장에서 자유롭게 단서를 나누고 토론하세요.';
    case 'DAY_MATCH':
      return '짝과 조용히 이야기를 나누며 서로의 단서를 확인하세요.';
    case 'DAY_MISSION':
      return '모두가 함께 진행하는 낮 미션 시간입니다.';
    case 'DAY_VOTE':
      return '마피아라고 생각되는 학생을 신중하게 선택하세요.';
    case 'NIGHT':
      return room.nightQuizState?.active
        ? '밤 퀴즈를 풀고, 해당 직업은 능력을 사용하세요.'
        : '마을이 잠들었습니다. 밤의 행동이 진행 중입니다.';
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

function PublicStage({ room, now }: { room: GameRoom; now: number }) {
  const timerEnd = getTimerEnd(room);
  const remaining = timerEnd ? Math.max(0, Math.ceil((timerEnd - now) / 1000)) : 0;
  const isNight = room.gameState === 'NIGHT';

  return (
    <motion.section
      key={room.gameState}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="w-full max-w-5xl rounded-[2rem] border border-white/20 bg-slate-950/55 p-7 text-center shadow-2xl shadow-black/40 backdrop-blur-md sm:p-12"
    >
      <div className="flex items-center justify-center gap-3 text-sm font-black uppercase tracking-[0.28em] text-white/55 sm:text-base">
        {isNight ? <Moon className="h-5 w-5 text-indigo-200" /> : <Sun className="h-5 w-5 text-amber-200" />}
        {room.gameState === 'WAITING' ? 'X-MAFIA LOBBY' : 'PUBLIC GAME DISPLAY'}
      </div>
      <h1 className="mt-5 text-balance text-5xl font-black tracking-tight text-white drop-shadow-lg sm:text-8xl">
        {STATE_LABELS[room.gameState]}
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold text-white/75 sm:text-2xl">
        {phaseDescription(room)}
      </p>

      {remaining > 0 && (
        <div className="mx-auto mt-9 max-w-md rounded-3xl bg-black/35 px-6 py-5 ring-1 ring-white/15">
          <p className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-white/55">
            <Clock3 className="h-4 w-4" />
            남은 시간
          </p>
          <p className={`mt-2 font-mono text-8xl font-black tabular-nums sm:text-[10rem] ${remaining <= 5 ? 'text-red-300' : 'text-amber-200'}`}>
            {formatSeconds(remaining)}
          </p>
          {room.gameState === 'NIGHT' && room.nightQuizState?.active && (
            <p className="text-sm font-bold text-white/60">밤 퀴즈 진행 중</p>
          )}
        </div>
      )}

      {room.gameState === 'WAITING' && (
        <div className="mx-auto mt-9 flex max-w-2xl items-center justify-center gap-3 rounded-2xl bg-white/10 px-5 py-4 text-base font-bold text-white/75 ring-1 ring-white/15 sm:text-xl">
          <Monitor className="h-6 w-6 text-amber-200" />
          선생님 화면에서 게임을 시작하면 이 화면도 자동으로 전환됩니다.
        </div>
      )}
    </motion.section>
  );
}

function PublicMorningEvent({
  event,
  room,
}: {
  event: ActiveMorningEvent;
  room: GameRoom;
}) {
  const target = event.targetId ? room.players[event.targetId] : null;
  const targetName = event.targetName ?? target?.name ?? '학생';
  const targetGender = resolveGender(target, event.targetGender);
  const wasKilled = Boolean(
    event.targetId && (room.nightResults?.deadPlayerIds ?? []).includes(event.targetId),
  );

  if (event.event === 'MAFIA_KILL') {
    return (
      <motion.section
        key="public-mafia-kill"
        initial={{ opacity: 0, scale: 0.9, x: 24 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        className="morning-panel-shake relative w-full max-w-6xl overflow-hidden rounded-[2rem] border border-red-300/35 bg-[#0a0816]/85 text-white shadow-2xl shadow-red-950/60"
      >
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-red-700 via-rose-300 to-red-700" />
        <div className="grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1.25fr_1fr] lg:p-14">
          <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-3xl border border-red-200/25 bg-[radial-gradient(circle_at_50%_45%,rgba(127,29,29,0.85),rgba(11,10,25,0.92)_70%)] shadow-2xl shadow-red-950/50 sm:h-[25rem]">
            <CharacterAvatar
              avatarId={target?.avatarId}
              isAlive={!wasKilled}
              size={140}
              className="relative z-10"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-red-950/20" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-red-100 drop-shadow-[0_0_18px_rgba(248,113,113,.9)]">
              <Crosshair className="h-24 w-24 sm:h-36 sm:w-36" strokeWidth={1.2} />
            </div>
            <div className="absolute bottom-4 left-4 rounded-full bg-black/65 px-4 py-2 text-sm font-black text-red-100 ring-1 ring-red-200/25 sm:text-lg">
              {targetName}
            </div>
          </div>
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center gap-3 text-sm font-black uppercase tracking-[0.3em] text-red-200 lg:justify-start sm:text-lg">
              <Swords className="h-6 w-6 animate-pulse" />
              Mafia Attack Alert
            </div>
            <h1 className="mt-6 text-balance text-4xl font-black leading-tight text-red-50 sm:text-6xl">
              {wasKilled ? `${targetName} 님이 탈락했습니다` : '마피아의 공격이 감지되었습니다'}
            </h1>
            <p className="mt-5 text-lg font-bold leading-relaxed text-red-100/75 sm:text-2xl">
              {wasKilled
                ? '지난밤 마을에서 공격을 받아 더 이상 게임에 참여할 수 없습니다.'
                : `${targetName} 님이 공격 대상이었지만 아직 생존해 있습니다.`}
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
        className="relative w-full max-w-6xl overflow-hidden rounded-[2rem] border border-emerald-300/35 bg-emerald-950/80 text-white shadow-2xl shadow-emerald-950/60"
      >
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-cyan-300 via-emerald-200 to-cyan-300" />
        <div className="relative grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1.3fr_1fr] lg:p-14">
          <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_50%_30%,rgba(16,185,129,0.35),rgba(6,78,59,0.95)_65%)] shadow-2xl shadow-emerald-950/60 sm:h-[25rem]">
            <CharacterAvatar
              avatarId={target?.avatarId}
              isAlive
              size={140}
              className="relative z-10 ring-4 ring-emerald-300/45"
            />
            <div className="absolute bottom-6 rounded-full border border-emerald-100/50 bg-emerald-950/60 p-3 text-emerald-100">
              <HeartPulse className="h-8 w-8" strokeWidth={1.8} />
            </div>
          </div>
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center gap-3 text-sm font-black uppercase tracking-[0.3em] text-emerald-100 lg:justify-start sm:text-lg">
              <ShieldCheck className="h-7 w-7 animate-pulse" />
              Doctor Rescue
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
  const roleLabel = reporterRole ? ROLE_LABELS[reporterRole] : '확인된 직업';

  return (
    <motion.section
      key="public-reporter-news"
      initial={{ opacity: 0, y: -24, rotate: -1.5, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      className="relative w-full max-w-5xl overflow-hidden rounded-[0.5rem] border-[8px] border-[#6f211b] bg-[#ead9b7] text-[#2b2017] shadow-2xl shadow-black/70"
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        animate={{ backgroundPosition: ['0% 0%', '15% 8%', '-10% 14%', '0% 0%'] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 22%, rgba(93,54,24,.3) 0 1px, transparent 1.5px), repeating-linear-gradient(8deg, rgba(102,65,31,.1) 0 1px, transparent 1px 7px)',
          backgroundSize: '17px 19px, 100% 100%',
        }}
      />
      <div className="relative border-b-4 border-[#6f211b] bg-[#8d2b20] px-6 py-5 text-center text-[#fff6dc] sm:px-10">
        <p className="flex items-center justify-center gap-3 text-lg font-black tracking-[0.25em] sm:text-2xl">
          <Radio className="h-6 w-6 animate-pulse" />
          X-마피아 신문 특보 · EXTRA EDITION
          <Radio className="h-6 w-6 animate-pulse" />
        </p>
      </div>
      <div className="relative px-6 py-8 text-center sm:px-12 sm:py-12">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-[#8d2b20] sm:text-lg">
          REPORTER&apos;S EXCLUSIVE · 전원 공개
        </p>
        <h1 className="mt-5 text-balance font-serif text-4xl font-black leading-none sm:text-7xl">
          {targetName}의 충격적 정체 밝혀져!
        </h1>
        <div className="mx-auto mt-8 grid max-w-3xl items-center gap-7 border-y-4 border-double border-[#2b2017]/80 py-7 sm:grid-cols-[14rem_1fr] sm:text-left">
          <div className="mx-auto w-44 border-[5px] border-[#d7bd8c] bg-[#d7bd8c] p-2 shadow-xl sm:w-56">
            <CharacterAvatar
              avatarId={target?.avatarId}
              isAlive
              size={160}
              className="mx-auto"
            />
          </div>
          <div>
            <p className="text-xl font-bold text-[#594431] sm:text-2xl">{targetName} 님의 진짜 직업은</p>
            <p className="mt-2 font-serif text-5xl font-black text-[#8d2b20] sm:text-7xl">{roleLabel}</p>
            <p className="mt-2 text-xl font-bold text-[#594431] sm:text-2xl">인 것으로 확인되었습니다.</p>
          </div>
        </div>
        <p className="text-sm font-black text-[#6f211b]/75 sm:text-base">특종 제보 · 기자단 · 본 특보는 모든 참가자에게 공개됩니다.</p>
      </div>
    </motion.section>
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
  const [audioReady, setAudioReady] = useState(false);
  const [morningIndex, setMorningIndex] = useState(0);
  const morningSoundRef = useRef<string | null>(null);
  const victorySoundRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRoomId(params.get('roomId') ?? params.get('pin') ?? '');
  }, []);

  useEffect(() => {
    if (!roomId) return;
    if (!isFirebaseConfigured()) {
      setError('Firebase가 설정되지 않아 실시간 디스플레이를 연결할 수 없습니다.');
      return;
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
      setError('Firebase 실시간 연결에 실패했습니다.');
    }
    return () => unsubscribe?.();
  }, [roomId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => stopAllAudio(), []);

  const morningEvents = useMemo(
    () => (room ? fallbackPublicMorningEvents(room) : []),
    [room],
  );
  const morningKey = useMemo(
    () => [
      room?.roomId,
      room?.currentRound,
      room?.gameState,
      morningEvents.map((event) => `${event.event}:${event.targetId ?? ''}`).join(','),
      (room?.nightResults?.deadPlayerIds ?? []).join(','),
    ].join('|'),
    [morningEvents, room?.currentRound, room?.gameState, room?.nightResults?.deadPlayerIds, room?.roomId],
  );
  const currentMorningEvent = morningEvents[morningIndex] ?? null;
  const showMorningSequence = room?.gameState === 'RESULT' && Boolean(currentMorningEvent);

  useEffect(() => {
    setMorningIndex(0);
    morningSoundRef.current = null;
  }, [morningKey]);

  useEffect(() => {
    if (room?.gameState !== 'RESULT' || !currentMorningEvent) return;
    const soundKey = `${morningKey}:${morningIndex}`;
    if (morningSoundRef.current !== soundKey) {
      morningSoundRef.current = soundKey;
      if (audioReady) {
        void playMorningEventSound(currentMorningEvent.event).catch(() => {
          /* 오디오 차단 시 시각 연출은 계속한다 */
        });
      }
    }
    const timer = window.setTimeout(() => {
      setMorningIndex((index) => (index + 1 < morningEvents.length ? index + 1 : morningEvents.length));
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [audioReady, currentMorningEvent, morningEvents.length, morningIndex, morningKey, room?.gameState]);

  useEffect(() => {
    if (!room || !audioReady) return;
    void playPhaseBgm(room.gameState).catch(() => {
      /* 오디오 정책에 막혀도 화면 동기화는 유지한다 */
    });
  }, [audioReady, room?.gameState]);

  useEffect(() => {
    const winner = room?.victoryTeam ?? room?.winnerSide;
    if (!room || room.gameState !== 'ENDED' || !winner) return;
    const key = `${room.roomId}:${room.currentRound}:${winner}`;
    if (victorySoundRef.current === key || !audioReady) return;
    victorySoundRef.current = key;
    void playVictorySound(winner);
  }, [audioReady, room]);

  const enableAudio = async () => {
    setAudioReady(true);
    if (room) {
      try {
        await playPhaseBgm(room.gameState);
      } catch {
        /* 브라우저 정책에 따라 무음으로 계속 표시 */
      }
    }
  };

  const phase = toBackgroundPhase(room?.gameState);
  const connected = Boolean(room);

  return (
    <GameBackground theme="VILLAGE" gameState={phase} playerCount={room && phase === 'WAITING' ? playerList(room).length : 0} className="min-h-screen">
      <div className="flex min-h-screen flex-col text-white">
        <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-10 sm:py-6">
          <div className="flex items-center gap-3">
            <Monitor className="h-7 w-7 text-amber-200 sm:h-9 sm:w-9" />
            <div>
              <p className="text-xl font-black tracking-tight sm:text-3xl">X-Mafia</p>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/55 sm:text-xs">Public Display · 학생 공유 화면</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-black sm:gap-3 sm:text-sm">
            {room && <span className="rounded-full bg-black/35 px-3 py-1.5 ring-1 ring-white/15">{STATE_LABELS[room.gameState]}</span>}
            {room && room.gameState !== 'WAITING' && <span className="rounded-full bg-amber-400/90 px-3 py-1.5 font-mono text-stone-900">ROUND {room.currentRound} / {room.maxRounds}</span>}
            {audioReady ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/25 px-3 py-1.5 text-emerald-100 ring-1 ring-emerald-200/25"><Volume2 className="h-4 w-4" /> 소리 켜짐</span>
            ) : (
              <button type="button" onClick={() => void enableAudio()} className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-stone-950 shadow-lg transition hover:bg-amber-300" title="서브 모니터에서 효과음을 재생하려면 한 번 눌러 주세요."><VolumeX className="h-4 w-4" /> 소리 켜기</button>
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
              <p className="mt-3 text-sm font-semibold text-red-100/70">교사 화면에서 서브 모니터 창을 다시 열어 주세요.</p>
            </div>
          )}
          {room && <PublicStats room={room} />}
          {room && room.gameState === 'ENDED' ? (
            <PublicVictoryDisplay room={room} />
          ) : room && showMorningSequence && currentMorningEvent ? (
            <AnimatePresence mode="wait">
              <PublicMorningEvent key={`${currentMorningEvent.event}-${morningIndex}`} event={currentMorningEvent} room={room} />
            </AnimatePresence>
          ) : room ? (
            <PublicStage room={room} now={now} />
          ) : null}
          {room && <PublicEliminatedStrip room={room} />}
        </main>

        <footer className="relative z-20 px-5 pb-4 text-center text-[10px] font-bold tracking-wide text-white/45 sm:text-xs">
          교사 화면에서 게임을 진행하면 이 화면이 실시간으로 자동 전환됩니다.
        </footer>
      </div>
    </GameBackground>
  );
}
