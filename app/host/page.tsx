'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Moon,
  Play,
  Power,
  QrCode,
  Swords,
  Sunrise,
  Target,
  Timer,
  Users,
  Vote,
  Volume2,
  VolumeX,
  HeartHandshake,
  Monitor,
  Plus,
  Square,
} from 'lucide-react';
import GameBackground, {
  type BackgroundPhase,
} from '@/components/GameBackground';
import { HeaderPinQrPanel } from '@/components/common/HeaderPinQrPanel';
import { GmPanel } from '@/components/host/GmPanel';
import { GhostChatMonitor } from '@/components/host/GhostChatMonitor';
import { MatchChatMonitor } from '@/components/host/MatchChatMonitor';
import { MafiaChatMonitor } from '@/components/host/MafiaChatMonitor';
import {
  MafiaMissionAssignForm,
  NightQuizConfigForm,
  NightQuizMonitor,
  NightQuizPreviewTogglePanel,
} from '@/components/host/MissionAssignPanel';
import { HostLobbyRoster } from '@/components/host/HostLobbyRoster';
import { NightActivityBoard } from '@/components/host/NightActivityBoard';
import { RoleAssignPanel } from '@/components/host/RoleAssignPanel';
import {
  getActiveMorningEvents,
  getMorningEvents,
  MorningSequenceModal,
} from '@/components/play/MorningSequenceModal';
import { GameResultPanel } from '@/components/play/GameResultPanel';
import {
  RoleBoardPanel,
} from '@/components/host/RoleBoardPanel';
import { PlayerRoster } from '@/components/play/PlayerRoster';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { isFirebaseConfigured } from '@/lib/firebase';
import { firstFreeAvatarId, playerGenderFromAvatarId } from '@/lib/game/avatars';
import {
  playPhaseBgm,
  setBgmEnabled,
  setNarrationEnabled,
  speak,
  speakPhase,
  stopAllAudio,
} from '@/lib/game/audio';
import { ROLE_LABELS } from '@/lib/game/roles';
import {
  advanceMorningReveal,
  dismissMorningResult,
  hasAliveSpiritualist,
  resolveNight,
  resolveReviveVote,
} from '@/lib/gameLogic';
import {
  alivePlayers,
  assignMafiaMission,
  assignRolesFixedThenRandom,
  createEmptyRoom,
  deleteRoom,
  dismissDayVoteResult,
  enterNightAfterVoteResult,
  endGameRoom,
  extendVoteTime,
  generatePin,
  grantDiscussionTime,
  NIGHT_ACTIVITY_CLOSE_NOTICE,
  playerList,
  removePlayerFromRoom,
  requestNicknameChangeInRoom,
  resolveDayVote,
  VOTE_RESULT_DURATION_MS,
  resolveMafiaMissionState,
  restartGameRoom,
  saveManualRoleAssignments,
  savePendingNightQuizConfig,
  saveRoleSetup,
  saveRoom,
  setNightQuizPreviewForRole,
  setVoteTieResolution,
  setRevealDeathRoles,
  setAllowMafiaTargetMafia,
  setMafiaChatEnabled,
  startGamePreferringAssignedRoles,
  startMatchPhase,
  startVotePhase,
  subscribeRoom,
  tallyVotes,
} from '@/lib/game/room';
import type {
  GameRoom,
  GameState,
  MafiaMissionAssignConfig,
  NightQuizConfig,
  Theme,
} from '@/types/game';

function speakAfterVoteResolve(prev: GameRoom, next: GameRoom) {
  if (next.gameState === 'DAY_VOTE' && next.voteRevoteCandidates) {
    const names = next.voteRevoteCandidates
      .map((id) => next.players[id]?.name)
      .filter(Boolean)
      .join(', ');
    speak(`동률입니다. ${names} 님만 재투표합니다.`);
    return;
  }
  const announcement = next.dayVoteResult?.announcement;
  if (announcement) {
    speak(announcement);
  } else if (next.gameState !== 'ENDED') {
    speak('투표가 종료되었습니다. 탈락자는 없습니다.');
  }
  if (next.gameState === 'NIGHT') {
    window.setTimeout(() => speak('밤이 되었습니다. 퀴즈를 풀어 주세요.'), 1200);
  }
  if (next.gameState === 'ENDED') {
    speak(
      next.winnerSide === 'CITIZEN'
        ? '마피아를 모두 찾아냈습니다. 시민 팀의 승리입니다.'
        : '마피아 팀의 최종 승리입니다.',
    );
  }
}

function toBackgroundPhase(state: GameState): BackgroundPhase {
  if (state === 'WAITING') return 'WAITING';
  if (state === 'NIGHT') return 'NIGHT';
  if (state === 'RESULT') return 'RESULT';
  return 'DAY';
}

const STATE_LABELS: Record<GameState, string> = {
  WAITING: '대기 중',
  DAY_TALK: '낮 — 토론',
  DAY_MATCH: '낮 — 1:1 매칭',
  DAY_MISSION: '낮 — 미션',
  DAY_VOTE: '낮 — 투표',
  VOTE_RESULT: '낮 — 투표 결과',
  NIGHT: '밤',
  RESULT: '결과',
  ENDED: '종료',
};

function formatPin(pin: string) {
  return pin.replace(/(\d{3})(\d{3})/, '$1 $2');
}

export default function HostPage() {
  const theme: Theme = 'VILLAGE';
  const [room, setRoom] = useState<GameRoom | null>(null);
  const roomStateRef = useRef<GameRoom | null>(null);
  const hostWriteLockRef = useRef(false);
  const actionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [joinUrl, setJoinUrl] = useState('');
  const [bgmOn, setBgmOn] = useState(false);
  const [narrationOn, setNarrationOn] = useState(false);
  const [roleBoardOpen, setRoleBoardOpen] = useState(false);
  const [nightConfigOpen, setNightConfigOpen] = useState(false);
  const [mafiaMissionOpen, setMafiaMissionOpen] = useState(false);
  const [pinQrExpanded, setPinQrExpanded] = useState(false);
  const [morningSequenceOpen, setMorningSequenceOpen] = useState(false);
  const prevStateRef = useRef<GameState | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const seenMorningSequenceRef = useRef<string | null>(null);

  const players = useMemo(() => (room ? playerList(room) : []), [room]);
  const alive = useMemo(() => (room ? alivePlayers(room) : []), [room]);
  const playerCount = players.length;
  const spiritualistAlive = useMemo(
    () => (room ? hasAliveSpiritualist(room) : false),
    [room],
  );
  const revivePending =
    room?.gameState === 'RESULT' && room.gmEvent === 'REVIVE_NIGHT';
  const morningEvents = useMemo(
    () => getMorningEvents(room?.nightResults),
    [room?.nightResults],
  );
  const morningActiveEvents = useMemo(
    () => getActiveMorningEvents(room?.nightResults),
    [room?.nightResults],
  );

  const matchRemainSec = useMemo(() => {
    if (!room?.matchEndsAt) return 0;
    return Math.max(0, Math.ceil((room.matchEndsAt - now) / 1000));
  }, [room?.matchEndsAt, now]);

  const voteRemainSec = useMemo(() => {
    if (!room?.voteEndsAt) return 0;
    return Math.max(0, Math.ceil((room.voteEndsAt - now) / 1000));
  }, [room?.voteEndsAt, now]);

  const voteResultRemainSec = useMemo(() => {
    const resolvedAt = room?.dayVoteResult?.resolvedAt;
    if (room?.gameState !== 'VOTE_RESULT' || !resolvedAt) return 0;
    return Math.max(
      0,
      Math.ceil((resolvedAt + VOTE_RESULT_DURATION_MS - now) / 1000),
    );
  }, [room?.dayVoteResult?.resolvedAt, room?.gameState, now]);

  const voteTallies = useMemo(() => (room ? tallyVotes(room) : {}), [room]);
  const totalVotes = useMemo(
    () => Object.values(voteTallies).reduce((a, b) => a + b, 0),
    [voteTallies],
  );
  const voteAutoEndedRef = useRef<number | null>(null);
  const voteResultAutoEndedRef = useRef<number | null>(null);
  const talkAutoEndedRef = useRef<number | null>(null);

  // 클라이언트 join URL
  useEffect(() => {
    setJoinUrl(window.location.origin);
  }, []);

  // 매칭·투표·토론·밤퀴즈 타이머 틱
  useEffect(() => {
    const needTick =
      (room?.gameState === 'DAY_MATCH' && room.matchEndsAt) ||
      (room?.gameState === 'DAY_VOTE' && room.voteEndsAt) ||
      (room?.gameState === 'VOTE_RESULT' && room.dayVoteResult?.resolvedAt) ||
      (room?.gameState === 'DAY_TALK' && room.talkEndsAt) ||
      (room?.gameState === 'NIGHT' &&
        room.nightQuizState?.active &&
        room.nightQuizState.outcome === 'PENDING');
    if (!needTick) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [
    room?.gameState,
    room?.matchEndsAt,
    room?.voteEndsAt,
    room?.dayVoteResult?.resolvedAt,
    room?.talkEndsAt,
    room?.nightQuizState?.active,
    room?.nightQuizState?.outcome,
    room?.nightQuizState?.endsAt,
  ]);

  const nightAutoResolveRef = useRef<number | null>(null);

  // 밤 퀴즈 시간 종료 → 퀴즈 판정 + 아침 발표 자동 진행
  useEffect(() => {
    if (!room || room.gameState !== 'NIGHT') return;
    const quiz = room.nightQuizState;
    if (!quiz?.endsAt) return;
    if (now < quiz.endsAt) return;
    if (nightAutoResolveRef.current === quiz.endsAt) return;
    nightAutoResolveRef.current = quiz.endsAt;
    void runAction((r) => {
      if (r.gameState !== 'NIGHT') return r;
      return resolveNight(r);
    });
  }, [room, now]);

  // Firebase 구독 — 교사 저장 중에는 구독 스냅샷으로 직업을 덮어쓰지 않는다.
  useEffect(() => {
    if (!roomIdRef.current) return;
    const roomId = roomIdRef.current;
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeRoom(roomId, (remote) => {
        if (!remote) return;
        if (hostWriteLockRef.current) {
          // 저장 중에도 신규장 학생은 합치되, 로컬에 이미 있는 직업은 지킨다.
          const local = roomStateRef.current;
          if (local && local.gameState === 'WAITING') {
            const mergedPlayers: GameRoom['players'] = { ...remote.players };
            Object.values(local.players ?? {}).forEach((p) => {
              if (!p?.id) return;
              const remotePlayer = mergedPlayers[p.id];
              if (!remotePlayer) {
                mergedPlayers[p.id] = p;
                return;
              }
              if (p.role != null) {
                mergedPlayers[p.id] = { ...remotePlayer, role: p.role };
              }
            });
            const merged = {
              ...remote,
              players: mergedPlayers,
              pendingRoleAssignments:
                local.pendingRoleAssignments ?? remote.pendingRoleAssignments,
              roleCountConfig:
                local.roleCountConfig ?? remote.roleCountConfig,
              maxRounds: local.maxRounds || remote.maxRounds,
            };
            roomStateRef.current = merged;
            setRoom(merged);
            return;
          }
          return;
        }
        roomStateRef.current = remote;
        setRoom(remote);
      });
    } catch (e) {
      console.warn('Firebase subscribe failed, using local state', e);
    }
    return () => unsub?.();
  }, [room?.roomId]);

  // GameState 변경 → BGM + TTS (각각 켜져 있을 때만)
  useEffect(() => {
    if (!room) return;
    if (prevStateRef.current === room.gameState) return;
    prevStateRef.current = room.gameState;
    if (bgmOn) {
      void playPhaseBgm(room.gameState);
    }
    if (!narrationOn) return;
    if (room.gameState === 'ENDED') {
      if (room.winnerSide === 'MAFIA') {
        speak('마피아 팀의 최종 승리입니다.');
      } else if (room.winnerSide === 'CITIZEN') {
        speak('마피아를 모두 찾아냈습니다. 시민 팀의 승리입니다.');
      } else {
        speakPhase(room.gameState);
      }
    } else {
      speakPhase(room.gameState);
    }
  }, [room?.gameState, room, bgmOn, narrationOn]);

  useEffect(() => () => stopAllAudio(), []);

  const commitRoom = useCallback(async (next: GameRoom) => {
    roomStateRef.current = next;
    setRoom(next);
    roomIdRef.current = next.roomId;
    if (!isFirebaseConfigured()) {
      setError(
        'Firebase가 설정되지 않았습니다. .env.local에 실제 키를 넣어야 학생 입장이 가능합니다.',
      );
      return;
    }
    try {
      await saveRoom(next);
      setError(null);
    } catch (e) {
      console.warn(e);
      const detail =
        e instanceof Error && e.message ? e.message : '알 수 없는 오류';
      setError(
        `Firebase 동기화 실패 — ${detail}`,
      );
    }
  }, []);

  // 투표 시간 만료 → 자동 마감
  useEffect(() => {
    if (!room || room.gameState !== 'DAY_VOTE' || !room.voteEndsAt) return;
    if (Date.now() < room.voteEndsAt) return;
    if (voteAutoEndedRef.current === room.voteEndsAt) return;
    voteAutoEndedRef.current = room.voteEndsAt;
    void (async () => {
      const next = resolveDayVote(room);
      await commitRoom(next);
      speakAfterVoteResolve(room, next);
    })();
  }, [room, now, commitRoom]);

  // 투표 결과 발표가 끝나면 자동으로 밤으로 이동한다. 교사는 그 전에 직접 이동할 수 있다.
  useEffect(() => {
    if (!room || room.gameState !== 'VOTE_RESULT') return;
    const resolvedAt = room.dayVoteResult?.resolvedAt;
    if (!resolvedAt || now < resolvedAt + VOTE_RESULT_DURATION_MS) return;
    if (voteResultAutoEndedRef.current === resolvedAt) return;
    voteResultAutoEndedRef.current = resolvedAt;
    void runAction((current) => {
      const next = enterNightAfterVoteResult(current);
      if (next.gameState === 'NIGHT') {
        speak('밤이 되었습니다. 퀴즈와 직업 활동을 시작합니다.');
      }
      return next;
    });
  }, [room, now, commitRoom]);

  // 토론 시간 만료 → 자동 투표
  useEffect(() => {
    if (!room || room.gameState !== 'DAY_TALK' || !room.talkEndsAt) return;
    if (Date.now() < room.talkEndsAt) return;
    if (talkAutoEndedRef.current === room.talkEndsAt) return;
    talkAutoEndedRef.current = room.talkEndsAt;
    void (async () => {
      const next = startVotePhase(room);
      await commitRoom(next);
      speak('토론 시간이 끝났습니다. 투표를 시작합니다.');
    })();
  }, [room, now, commitRoom]);

  // 교사 대시보드는 MorningResultStage로 결과만 표시 (연출 모달은 학생/전광판용)
  useEffect(() => {
    if (room?.gameState !== 'RESULT') {
      seenMorningSequenceRef.current = null;
      setMorningSequenceOpen(false);
    }
  }, [room?.gameState]);

  const toggleBgm = useCallback(async () => {
    const next = !bgmOn;
    setBgmOn(next);
    await setBgmEnabled(next, next && room ? room.gameState : null);
  }, [bgmOn, room]);

  const toggleNarration = useCallback(async () => {
    const next = !narrationOn;
    setNarrationOn(next);
    await setNarrationEnabled(next);
    if (next) {
      speak('나레이션이 켜졌습니다.');
    }
  }, [narrationOn]);

  const handleCreateRoom = async () => {
    if (!isFirebaseConfigured()) {
      setError(
        'Firebase가 설정되지 않았습니다. .env.local에 실제 Firebase 설정을 넣은 뒤 다시 시도하세요.',
      );
      return;
    }
    setBusy(true);
    hostWriteLockRef.current = true;
    try {
      const pin = generatePin();
      const next = createEmptyRoom(theme, pin);
      await commitRoom(next);
      prevStateRef.current = null;
      setBgmOn(true);
      setNarrationOn(true);
      await setBgmEnabled(true, 'WAITING');
      await setNarrationEnabled(true);
      speakPhase('WAITING');
    } finally {
      hostWriteLockRef.current = false;
      setBusy(false);
    }
  };

  const runAction = (factory: (r: GameRoom) => GameRoom, minPlayers = 0) => {
    const job = async () => {
      const current = roomStateRef.current;
      if (!current) return;
      if (playerList(current).length < minPlayers) {
        speak(`최소 ${minPlayers}명이 필요합니다.`);
        setError(`최소 ${minPlayers}명의 참가자가 필요합니다.`);
        return;
      }
      setBusy(true);
      hostWriteLockRef.current = true;
      setError(null);
      try {
        const next = factory(roomStateRef.current ?? current);
        await commitRoom(next);
      } finally {
        hostWriteLockRef.current = false;
        setBusy(false);
      }
    };

    const queued = actionQueueRef.current.then(job, job);
    actionQueueRef.current = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  };

  const handleEnterNightAfterVoteResult = () => {
    void runAction((current) => {
      const next = enterNightAfterVoteResult(current);
      if (next.gameState === 'NIGHT') {
        speak('밤이 되었습니다. 퀴즈와 직업 활동을 시작합니다.');
      }
      return next;
    });
  };

  const handleAnonymousTip = async (hint: string) => {
    if (!room) return;
    const next: GameRoom = {
      ...room,
      currentHint: hint,
      gmEvent: 'HINT_BOOST',
    };
    await commitRoom(next);
    speak(`익명 제보. ${hint}`);
  };

  const handleSilenceNight = async () => {
    if (!room) return;
    const next: GameRoom = {
      ...room,
      gmEvent: room.gmEvent === 'SILENCE_NIGHT' ? null : 'SILENCE_NIGHT',
    };
    await commitRoom(next);
    if (next.gmEvent === 'SILENCE_NIGHT') {
      speak('정전이 발생했습니다. 이번 밤 경찰과 의사 능력이 무효화됩니다.');
    }
  };

  const handleReviveNight = async () => {
    if (!room || !hasAliveSpiritualist(room)) return;
    const next: GameRoom = {
      ...room,
      gmEvent: room.gmEvent === 'REVIVE_NIGHT' ? null : 'REVIVE_NIGHT',
    };
    await commitRoom(next);
    if (next.gmEvent === 'REVIVE_NIGHT') {
      speak('기회의 밤이 열렸습니다. 이번 밤 사망자에 대한 부활 투표가 진행됩니다.');
    }
  };

  const handleResolveNight = async () => {
    if (!room) return;
    setBusy(true);
    try {
      const next = resolveNight(room);
      await commitRoom(next);
      const deadCount = (next.nightResults?.deadPlayerIds ?? []).length;
      const lines = next.nightResults?.deathAnnouncements ?? [];
      if (lines && lines.length > 0) {
        speak(lines.join(' '));
      } else if (next.gameState === 'ENDED') {
        speak(
          next.winnerSide === 'CITIZEN'
            ? '마피아를 모두 찾아냈습니다. 시민 팀의 승리입니다.'
            : '마피아 팀의 최종 승리입니다.',
        );
      } else {
        speak(
          deadCount === 0
            ? '아침이 되었습니다. 지난밤 희생자는 없었습니다.'
            : `아침이 되었습니다. 지난밤 ${deadCount}명이 희생되었습니다.`,
        );
      }
    } catch (e) {
      console.error('resolveNight failed', e);
      setError(
        e instanceof Error
          ? `아침 발표 실패: ${e.message}`
          : '아침 발표 처리 중 오류가 발생했습니다.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleEndGame = async () => {
    if (!room) return;
    const ok = window.confirm(
      '게임을 종료하고 최종 결과 화면을 표시할까요?',
    );
    if (!ok) return;
    setBusy(true);
    try {
      const ended = endGameRoom(room);
      await commitRoom(ended);
      speak('게임이 종료되었습니다.');
    } catch (e) {
      console.warn(e);
      setError('게임 종료에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleRestartGame = async () => {
    if (!room) return;
    setBusy(true);
    try {
      await commitRoom(restartGameRoom(room));
      speak('방을 유지한 채 새 게임을 준비합니다.');
    } catch (e) {
      console.warn(e);
      setError('게임 재시작에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!room) return;
    const ok = window.confirm(
      '방을 삭제하고 모든 참가자를 내보낼까요? 이 작업은 되돌릴 수 없습니다.',
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteRoom(room.roomId);
      setRoom(null);
      roomIdRef.current = null;
      prevStateRef.current = null;
      speak('방을 삭제했습니다.');
    } catch (e) {
      console.warn(e);
      setError('방 삭제에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const qrValue = room
    ? `${joinUrl}/play?pin=${room.pin}`
    : joinUrl;

  const phase = room ? toBackgroundPhase(room.gameState) : 'WAITING';

  return (
    <GameBackground
      theme={theme}
      gameState={phase}
      playerCount={phase === 'WAITING' ? playerCount : 0}
      className="min-h-screen"
    >
      <div className="flex min-h-screen flex-col text-white">
        {/* 상단 바 */}
        <header className="relative z-20 flex items-center justify-between gap-4 px-6 py-4 md:px-10">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-black tracking-tight drop-shadow-md md:text-3xl">
              X-Mafia
            </div>
            {room && (
              <span className="rounded-md bg-black/35 px-3 py-1 text-sm font-medium backdrop-blur-sm">
                {STATE_LABELS[room.gameState]}
              </span>
            )}
            {room && room.gameState !== 'WAITING' && (
              <span className="rounded-md bg-amber-500/90 px-3 py-1 font-mono text-sm font-black tracking-wider text-stone-900">
                ROUND {Math.max(room.currentRound, 0)} / {room.maxRounds}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm md:text-base">
            {room && (
              <HeaderPinQrPanel
                pin={room.pin}
                joinUrl={joinUrl}
                expanded={pinQrExpanded}
                onToggle={() => setPinQrExpanded((v) => !v)}
                variant="host"
              />
            )}
            {room && (
              <button
                type="button"
                onClick={() => {
                  const displayWindow = window.open(
                    `/host/display?roomId=${encodeURIComponent(room.roomId)}`,
                    '_blank',
                    'width=1920,height=1080',
                  );
                  if (!displayWindow) {
                    setError('서브 모니터 창이 차단되었습니다. 브라우저의 팝업을 허용해 주세요.');
                    return;
                  }
                  displayWindow.focus();
                }}
                title="새 창을 빔프로젝터 쪽 모니터로 옮긴 뒤 F11을 누르면 전체 화면으로 볼 수 있습니다."
                aria-label="서브 모니터 화면 열기"
                className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/85 px-3 py-1.5 font-bold text-white shadow-lg transition hover:bg-sky-400"
              >
                <Monitor className="h-4 w-4" />
                <span className="hidden sm:inline">서브 모니터</span>
                <span className="sm:hidden">화면</span>
              </button>
            )}
            {room ? (
              <button
                type="button"
                onClick={() => setRoleBoardOpen((v) => !v)}
                title="역할 현황 보기"
                aria-pressed={roleBoardOpen}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 backdrop-blur-sm transition ${
                  roleBoardOpen
                    ? 'bg-amber-400/90 font-bold text-stone-900 ring-1 ring-amber-200/80'
                    : 'bg-black/35 hover:bg-white/15'
                }`}
              >
                <Users className="h-4 w-4" />
                {playerCount}명
                <span className="text-[10px] font-bold opacity-70">역할</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-black/35 px-3 py-1.5 backdrop-blur-sm">
                <Users className="h-4 w-4" />
                {playerCount}명
              </span>
            )}
            <button
              type="button"
              onClick={() => void toggleNarration()}
              title="나레이션(TTS) 켜기/끄기"
              aria-pressed={narrationOn}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${
                narrationOn
                  ? 'bg-emerald-500/85 text-white hover:bg-emerald-400'
                  : 'bg-black/40 text-white/80 hover:bg-white/15'
              }`}
            >
              {narrationOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              나레이션
            </button>
            <button
              type="button"
              onClick={() => void toggleBgm()}
              title="배경음·효과음 켜기/끄기"
              aria-pressed={bgmOn}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${
                bgmOn
                  ? 'bg-amber-500/90 text-stone-900 hover:bg-amber-400'
                  : 'bg-black/40 text-white/80 hover:bg-white/15'
              }`}
            >
              {bgmOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              배경음
            </button>
          </div>
        </header>

        {/* 메인 스테이지 */}
        <main
          className={`relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-44 pt-4 md:px-12 ${
            room && room.gameState !== 'WAITING'
              ? 'md:pl-[22rem] md:pr-[24rem]'
              : ''
          }`}
        >
          {room && room.gameState !== 'WAITING' && (
            <aside className="absolute left-3 top-0 z-20 flex max-h-[calc(100vh-11rem)] w-[min(100%,20rem)] flex-col gap-3 overflow-y-auto md:left-8 lg:w-80">
              <MafiaChatMonitor room={room} />
              <GhostChatMonitor room={room} />
            </aside>
          )}

          {room && room.gameState !== 'WAITING' && (
            <div className="absolute right-4 top-0 z-20 md:right-10">
              <GmPanel
                room={room}
                disabled={busy}
                spiritualistAlive={spiritualistAlive}
                onAnonymousTip={(h) => void handleAnonymousTip(h)}
                onSilenceNight={() => void handleSilenceNight()}
                onReviveNight={() => void handleReviveNight()}
                onVoteTieResolutionChange={(mode) => {
                  void runAction((r) => setVoteTieResolution(r, mode));
                  speak(
                    mode === 'REVOTE'
                      ? '동률 시 동률자만 재투표합니다.'
                      : '동률 시 무작위로 한 명이 탈락합니다.',
                  );
                }}
                onRevealDeathRolesChange={(enabled) => {
                  void runAction((r) => setRevealDeathRoles(r, enabled));
                  speak(
                    enabled
                      ? '탈락자 직업을 즉시 공개합니다.'
                      : '탈락자 직업을 비공개로 둡니다.',
                  );
                }}
                onAllowMafiaTargetMafiaChange={(enabled) => {
                  void runAction((r) => setAllowMafiaTargetMafia(r, enabled));
                  speak(
                    enabled
                      ? '마피아끼리 지목을 허용합니다.'
                      : '마피아끼리 지목을 금지합니다.',
                  );
                }}
                onMafiaChatEnabledChange={(enabled) => {
                  void runAction((r) => setMafiaChatEnabled(r, enabled));
                  speak(
                    enabled
                      ? '마피아 비밀 채팅을 켭니다.'
                      : '마피아 비밀 채팅을 끕니다.',
                  );
                }}
                onGrantDiscussionTime={(durationSec) => {
                  void runAction((r) => grantDiscussionTime(r, durationSec));
                  speak(`토론 시간 ${durationSec}초를 부여합니다.`);
                }}
              />
            </div>
          )}

          <AnimatePresence mode="wait">
            {!room ? (
              <motion.div
                key="lobby-empty"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="flex flex-col items-center gap-8 text-center"
              >
                <p className="max-w-xl text-lg text-white/85 drop-shadow md:text-xl">
                  대형 화면에 맞춰 방을 만들고, 학생들이 QR·PIN으로 입장합니다.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleCreateRoom()}
                  className="rounded-xl bg-amber-400 px-10 py-4 text-xl font-black text-stone-900 shadow-lg shadow-black/30 transition hover:bg-amber-300 disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-2">
                    <QrCode className="h-6 w-6" />
                    방 생성
                  </span>
                </button>
              </motion.div>
            ) : room.gameState === 'WAITING' ? (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex w-full max-w-5xl flex-col items-center"
              >
                <div className="flex w-full flex-col items-center gap-8 md:flex-row md:items-stretch md:justify-center md:gap-14">
                  <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-5 shadow-2xl shadow-black/40">
                    <QRCode value={qrValue} size={220} level="M" />
                    <p className="mt-3 text-xs font-medium text-stone-500">
                      학생 기기에서 스캔
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center text-center">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/70">
                      PIN CODE
                    </p>
                    <p className="mt-2 font-mono text-6xl font-black tracking-widest text-white drop-shadow-lg md:text-8xl">
                      {formatPin(room.pin)}
                    </p>
                    <p className="mt-4 text-lg text-white/80">
                      참가 대기 중 · {playerCount}명 입장
                    </p>
                  </div>
                </div>
                <div className="mt-8 w-full max-w-4xl space-y-4">
                  <HostLobbyRoster
                    room={room}
                    busy={busy}
                    onKick={(playerId) => {
                      void runAction((r) => removePlayerFromRoom(r, playerId));
                      speak('학생을 퇴장시켰습니다.');
                    }}
                    onRequestNicknameChange={(playerId) => {
                      const current = roomStateRef.current;
                      if (!current) return '방 정보가 없습니다.';
                      const preview = requestNicknameChangeInRoom(
                        current,
                        playerId,
                      );
                      if (preview.error) return preview.error;
                      void runAction((r) => {
                        const result = requestNicknameChangeInRoom(r, playerId);
                        return result.error ? r : result.room;
                      });
                      speak('닉네임 재설정을 요청했습니다.');
                      return null;
                    }}
                  />
                  <RoleAssignPanel
                    room={room}
                    busy={busy}
                    onSaveSetup={(counts, rounds, options) => {
                      void runAction((r) =>
                        saveRoleSetup(r, counts, rounds, options),
                      );
                    }}
                    onSaveAssignments={(assignments, counts, rounds) => {
                      void runAction((r) =>
                        saveManualRoleAssignments(
                          r,
                          assignments,
                          counts,
                          rounds,
                        ),
                      );
                    }}
                    onFillUnassigned={(assignments, counts, rounds) => {
                      void runAction((r) =>
                        assignRolesFixedThenRandom(
                          saveRoleSetup(r, counts, rounds),
                          assignments,
                          counts,
                        ),
                      );
                      speak('미배정 학생에게 직업을 랜덤 배정했습니다.');
                    }}
                  />
                </div>
              </motion.div>
            ) : room.gameState === 'DAY_MATCH' ? (
              <StagePanel key="match" title="1:1 매칭">
                <div className="text-7xl font-black tabular-nums text-amber-300 md:text-8xl">
                  {matchRemainSec}
                </div>
                <p className="mt-2 text-white/80">
                  초 남음 · 휴대폰 채팅으로 파트너와 대화하세요
                </p>
                <PartnerGrid room={room} />
              </StagePanel>
            ) : room.gameState === 'DAY_MISSION' ? (
              <StagePanel key="mission-legacy" title="미션">
                <p className="text-white/70">
                  시민 퀴즈는 이제 밤 미션으로 진행됩니다. 투표가 끝나면 저장해 둔 밤 미션이 시작됩니다.
                </p>
              </StagePanel>
            ) : room.gameState === 'DAY_VOTE' ? (
              <StagePanel
                key="vote"
                title={
                  room.voteRevoteCandidates
                    ? '동률 재투표 · 15초'
                    : '실시간 투표 · 15초'
                }
              >
                <div
                  className={`mb-6 font-black tabular-nums ${
                    voteRemainSec <= 5 ? 'text-red-300' : 'text-amber-300'
                  } text-6xl md:text-7xl`}
                >
                  {voteRemainSec}
                </div>
                <p className="mb-6 text-sm text-white/70">
                  {room.voteRevoteCandidates
                    ? `동률자만 재투표 · ${room.voteRevoteCandidates
                        .map((id) => room.players[id]?.name ?? '?')
                        .join(', ')}`
                    : '초 남음'}
                </p>
                <VoteBoard
                  room={room}
                  alive={alive}
                  tallies={voteTallies}
                  totalVotes={totalVotes}
                />
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setNightConfigOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-black text-white hover:bg-indigo-400 disabled:opacity-50"
                  >
                    <Moon className="h-4 w-4" />
                    {room.pendingNightQuizConfig ? '밤 미션 ✓' : '밤 미션'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void runAction(extendVoteTime);
                      speak('투표 시간을 십오 초 연장합니다.');
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-black text-white hover:bg-sky-400 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    +15초 연장
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void runAction((r) => {
                        const next = resolveDayVote(r);
                        speakAfterVoteResolve(r, next);
                        return next;
                      });
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    <Square className="h-4 w-4" />
                    투표 종료
                  </button>
                </div>
              </StagePanel>
            ) : room.gameState === 'VOTE_RESULT' ? (
              <StagePanel key="vote-result" title="투표 결과 발표">
                <div className="mx-auto max-w-2xl rounded-2xl bg-red-950/45 p-6 text-center ring-1 ring-red-300/25">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200/80">
                    투표 결과 · 서브모니터 연출 중
                  </p>
                  <p className="mt-4 text-2xl font-black text-white md:text-4xl">
                    {room.dayVoteResult?.announcement ?? '이번 투표에서 탈락자는 없습니다.'}
                  </p>
                  <p className="mt-4 text-sm font-bold text-white/60">
                    서브모니터에 체포 연출을 공개한 뒤 밤으로 이동합니다. 자동 전환까지 {voteResultRemainSec}초
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleEnterNightAfterVoteResult}
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-6 py-3 text-base font-black text-white shadow-lg shadow-indigo-950/40 hover:bg-indigo-400 disabled:opacity-50"
                >
                  <Moon className="h-5 w-5" />
                  밤으로 이동
                </button>
              </StagePanel>
            ) : room.gameState === 'NIGHT' ? (
              <StagePanel key="night" title="밤 — 퀴즈 · 직업 활동">
                {room.dayVoteResult && (
                  <div className="mb-5 rounded-xl bg-red-950/50 px-4 py-3 text-left ring-1 ring-red-400/30">
                    <p className="text-xs font-bold uppercase tracking-wider text-red-200/80">
                      낮 투표 결과
                    </p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {room.dayVoteResult.announcement ??
                        (room.dayVoteResult.eliminatedName
                          ? `${room.dayVoteResult.eliminatedName} 님 탈락`
                          : '탈락자 없음')}
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(dismissDayVoteResult)}
                      className="mt-2 text-xs font-bold text-white/55 underline hover:text-white"
                    >
                      공지 닫기
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Moon className="h-10 w-10 text-red-300" />
                  <p className="text-lg text-white/85">
                    전원 퀴즈 + 특수 직업 능력 모니터
                  </p>
                </div>
                {room.gmEvent === 'SILENCE_NIGHT' && (
                  <p className="mt-3 text-sm font-semibold text-slate-200">
                    정전 — 경찰·의사 능력 무효
                  </p>
                )}
                {room.gmEvent === 'REVIVE_NIGHT' && (
                  <p className="mt-3 text-sm font-semibold text-violet-200">
                    기회의 밤 — 사망자 부활 투표 예정
                  </p>
                )}
                {room.isMafiaBuffActive && (
                  <p className="mt-2 text-sm font-semibold text-red-300">
                    멀티킬 버프 — 마피아 각자 1명 독립 지목
                  </p>
                )}

                <div className="mt-6">
                  <NightQuizMonitor
                    room={room}
                    busy={busy}
                    now={now}
                  />
                </div>

                <NightActivityBoard room={room} />

                <p className="mx-auto mt-6 max-w-3xl text-center text-sm font-semibold text-indigo-100/85">
                  {NIGHT_ACTIVITY_CLOSE_NOTICE}
                </p>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void handleResolveNight();
                    speak('퀴즈와 직업별 밤 활동을 강제 마감합니다.');
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-base font-black text-stone-900 hover:bg-amber-300 disabled:opacity-50"
                >
                  <Sunrise className="h-5 w-5" />
                  퀴즈·직업 활동 강제 마감
                </button>
              </StagePanel>
            ) : room.gameState === 'RESULT' ? (
              <MorningResultStage
                key="result"
                room={room}
                revivePending={!!revivePending}
                voteTallies={voteTallies}
                busy={busy}
                onConfirmRevive={() => void runAction(resolveReviveVote)}
                onAdvanceReveal={() => void runAction(advanceMorningReveal)}
                onDismiss={() => void runAction(dismissMorningResult)}
              />
            ) : room.gameState === 'ENDED' ? (
              <GameResultPanel
                key="ended"
                winnerSide={room.winnerSide ?? room.victoryTeam}
                players={room.players}
                round={room.currentRound}
                maxRounds={room.maxRounds}
                voteEliminatedPlayerId={room.dayVoteResult?.eliminatedPlayerId}
                mafiaEliminatedPlayerIds={room.nightResults?.deadPlayerIds}
                isHost
                busy={busy}
                onRestart={() => void handleRestartGame()}
                onNewGame={() => void handleDeleteRoom()}
              />
            ) : (
              <StagePanel key="day" title={STATE_LABELS[room.gameState]}>
                {room.dayVoteResult ? (
                  <DayVoteResultBanner
                    room={room}
                    busy={busy}
                    onDismiss={() => void runAction(dismissDayVoteResult)}
                  />
                ) : (
                  <>
                    <p className="text-xl text-white/85">
                      생존 {alive.length}명 · 토론을 진행하세요
                    </p>
                    {room.isMafiaBuffActive && (
                      <p className="mt-2 text-sm font-semibold text-red-300">
                        다음 밤 멀티킬 예약됨 (또는 진행 중)
                      </p>
                    )}
                    {room.pendingMafiaNightBuff && (
                      <p className="mt-2 text-sm font-semibold text-red-300">
                        마피아 미션 보상 — 다음 밤 멀티킬 예약
                      </p>
                    )}
                    {room.currentHint && (
                      <p className="mx-auto mt-4 max-w-xl rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-400/30">
                        공개 힌트: {room.currentHint}
                      </p>
                    )}
                    <PlayerChips room={room} />
                  </>
                )}
              </StagePanel>
            )}
          </AnimatePresence>

          {/* 매칭 채팅: 실시간 + 종료 후에도 교사 확인 */}
          {room &&
            (room.gameState === 'DAY_MATCH' ||
              Object.keys(room.matchChats ?? {}).length > 0 ||
              Object.keys(room.matchChatHistory ?? {}).length > 0) && (
              <MatchChatMonitor
                room={room}
                live={room.gameState === 'DAY_MATCH'}
              />
            )}

          {error && (
            <p className="mt-6 max-w-xl rounded-lg bg-red-950/70 px-4 py-2 text-center text-sm text-red-100">
              {error}
            </p>
          )}
        </main>

        {/* 하단 교사 제어바 — 단계별 관련 버튼만 표시 */}
        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-stone-950/90 px-3 py-3 backdrop-blur-xl md:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                {room ? STATE_LABELS[room.gameState] : '방 대기'}
                {room?.pendingMafiaNightBuff
                  ? ' · 다음밤 멀티킬'
                  : room?.isMafiaBuffActive
                    ? ' · 멀티킬'
                    : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {room?.gameState === 'WAITING' && (
                <>
                  <ControlBtn
                    icon={<Play className="h-4 w-4" />}
                    label="게임 시작"
                    disabled={busy}
                    onClick={() => {
                      void runAction(startGamePreferringAssignedRoles, 4);
                      const assigned =
                        room &&
                        playerList(room).length >= 4 &&
                        (() => {
                          const pending = room.pendingRoleAssignments;
                          const roleOf = (id: string) =>
                            pending?.[id] ?? room.players?.[id]?.role ?? null;
                          return (
                            playerList(room).every((p) => roleOf(p.id) != null) &&
                            playerList(room).some((p) => roleOf(p.id) === 'MAFIA')
                          );
                        })();
                      speak(
                        assigned
                          ? '저장한 직업으로 게임을 시작합니다.'
                          : room?.roleCountConfig
                            ? '설정한 인원에 맞게 직업을 배정하고 게임을 시작합니다.'
                            : '직업을 랜덤 배정하고 게임을 시작합니다.',
                      );
                    }}
                    accent="amber"
                  />
                  <ControlBtn
                    icon={<Swords className="h-4 w-4" />}
                    label="테스트 +1"
                    disabled={busy}
                    onClick={() => {
                      if (!room) return;
                      const id = `demo_${Date.now()}`;
                      const avatarId = firstFreeAvatarId(room.players);
                      const next: GameRoom = {
                        ...room,
                        players: {
                          ...room.players,
                          [id]: {
                            id,
                            name: `학생${playerCount + 1}`,
                            role: null,
                            isAlive: true,
                            nightTarget: null,
                            partnerId: null,
                            avatarId,
                            gender: playerGenderFromAvatarId(avatarId),
                          },
                        },
                      };
                      void commitRoom(next);
                    }}
                  />
                </>
              )}

              {room?.gameState === 'DAY_TALK' && (
                  <>
                    <ControlBtn
                      icon={<Users className="h-4 w-4" />}
                      label="1:1 매칭"
                      disabled={busy}
                      onClick={() => void runAction(startMatchPhase, 2)}
                    />
                    <ControlBtn
                      icon={<Target className="h-4 w-4" />}
                      label="마피아 미션"
                      disabled={busy}
                      onClick={() => setMafiaMissionOpen(true)}
                    />
                    <ControlBtn
                      icon={<Vote className="h-4 w-4" />}
                      label="투표"
                      disabled={busy}
                      onClick={() => void runAction(startVotePhase, 2)}
                    />
                    <ControlBtn
                      icon={<Moon className="h-4 w-4" />}
                      label={room.pendingNightQuizConfig ? '밤 미션 ✓' : '밤 미션'}
                      disabled={busy}
                      onClick={() => setNightConfigOpen(true)}
                      accent="night"
                    />
                  </>
                )}

              {room?.gameState === 'DAY_MATCH' && (
                <ControlBtn
                  icon={<Users className="h-4 w-4" />}
                  label="토론으로"
                  disabled={busy}
                  onClick={() =>
                    void runAction((r) => ({
                      ...r,
                      gameState: 'DAY_TALK',
                      matchEndsAt: null,
                      talkEndsAt: null,
                    }))
                  }
                />
              )}

              {room?.gameState === 'DAY_VOTE' && (
                <>
                  <ControlBtn
                    icon={<Moon className="h-4 w-4" />}
                    label={room.pendingNightQuizConfig ? '밤 미션 ✓' : '밤 미션'}
                    disabled={busy}
                    onClick={() => setNightConfigOpen(true)}
                    accent="night"
                  />
                  <ControlBtn
                    icon={<Timer className="h-4 w-4" />}
                    label="+15초"
                    disabled={busy}
                    onClick={() => {
                      void runAction(extendVoteTime);
                      speak('투표 시간을 십오 초 연장합니다.');
                    }}
                    accent="amber"
                  />
                  <ControlBtn
                    icon={<Square className="h-4 w-4" />}
                    label="투표 종료·아웃"
                    disabled={busy}
                    onClick={() => {
                      void runAction((r) => {
                        const next = resolveDayVote(r);
                        speakAfterVoteResolve(r, next);
                        return next;
                      });
                    }}
                    accent="red"
                  />
                </>
              )}

              {room?.gameState === 'VOTE_RESULT' && (
                <ControlBtn
                  icon={<Moon className="h-4 w-4" />}
                  label={`밤으로 이동${voteResultRemainSec > 0 ? ` · ${voteResultRemainSec}초` : ''}`}
                  disabled={busy}
                  onClick={handleEnterNightAfterVoteResult}
                  accent="night"
                />
              )}

              {room?.gameState === 'NIGHT' && (
                <ControlBtn
                  icon={<Sunrise className="h-4 w-4" />}
                  label="강제 마감"
                  disabled={busy}
                  onClick={() => {
                    void handleResolveNight();
                    speak('퀴즈와 직업별 밤 활동을 강제 마감합니다.');
                  }}
                  accent="amber"
                />
              )}

              {revivePending && (
                <ControlBtn
                  icon={<HeartHandshake className="h-4 w-4" />}
                  label="부활 확정"
                  disabled={busy}
                  onClick={() => void runAction(resolveReviveVote)}
                  accent="green"
                />
              )}

              {room && room.gameState !== 'ENDED' && (
                <ControlBtn
                  icon={<Power className="h-4 w-4" />}
                  label="게임 종료"
                  disabled={busy}
                  onClick={() => void handleEndGame()}
                  accent="red"
                />
              )}
            </div>
          </div>
        </footer>

        {room && (
          <RoleBoardPanel
            room={room}
            open={roleBoardOpen}
            onClose={() => setRoleBoardOpen(false)}
          />
        )}

        {room && nightConfigOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm md:items-center">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-stone-950 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-black text-indigo-100">
                  밤 미션 설정
                </h2>
                <button
                  type="button"
                  onClick={() => setNightConfigOpen(false)}
                  className="rounded-lg px-2 py-1 text-sm text-white/60 hover:bg-white/10"
                >
                  닫기
                </button>
              </div>
              <NightQuizConfigForm
                key={
                  room.pendingNightQuizConfig
                    ? `${room.pendingNightQuizConfig.mode}-${room.pendingNightQuizConfig.question}`
                    : 'new-night-mission'
                }
                busy={busy}
                pendingBuff={!!room.pendingMafiaNightBuff}
                initialConfig={room.pendingNightQuizConfig}
                onCancel={() => setNightConfigOpen(false)}
                onSave={(config: NightQuizConfig) => {
                  setNightConfigOpen(false);
                  void runAction((r) => savePendingNightQuizConfig(r, config));
                  speak('밤 미션을 저장했습니다.');
                }}
              />
              <div className="mt-5">
                <NightQuizPreviewTogglePanel
                  previewByRole={room.nightQuizPreviewByRole}
                  busy={busy}
                  onToggle={(role, enabled) => {
                    void runAction((r) =>
                      setNightQuizPreviewForRole(r, role, enabled),
                    );
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {room && mafiaMissionOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm md:items-center">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-stone-950 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-black text-red-100">
                  마피아 미션 부여
                </h2>
                <button
                  type="button"
                  onClick={() => setMafiaMissionOpen(false)}
                  className="rounded-lg px-2 py-1 text-sm text-white/60 hover:bg-white/10"
                >
                  닫기
                </button>
              </div>
              <MafiaMissionAssignForm
                room={room}
                busy={busy}
                onAssign={(config: MafiaMissionAssignConfig) => {
                  setMafiaMissionOpen(false);
                  void runAction((r) => assignMafiaMission(r, config));
                  speak('마피아 미션이 부여되었습니다.');
                }}
              />
              {room.mafiaMissionState?.active && (
                <div className="mt-4 space-y-2 rounded-xl bg-white/5 p-3 text-xs">
                  <p className="font-bold text-white/70">현재 미션</p>
                  <p>{room.mafiaMissionState.description}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void runAction((r) =>
                          resolveMafiaMissionState(r, 'SUCCESS'),
                        );
                        setMafiaMissionOpen(false);
                      }}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white"
                    >
                      수동 성공
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void runAction((r) =>
                          resolveMafiaMissionState(r, 'FAIL'),
                        );
                        setMafiaMissionOpen(false);
                      }}
                      className="rounded-lg bg-red-700 px-3 py-1.5 font-bold text-white"
                    >
                      수동 실패
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {room && morningSequenceOpen && (
          <MorningSequenceModal
            open={morningSequenceOpen}
            events={morningEvents}
            activeEvents={morningActiveEvents}
            result={room.nightResults}
            players={room.players}
            revealRoles={room.revealDeathRoles !== false}
            controlledIndex={room.morningRevealIndex ?? 0}
            controlledIdentityStep={room.morningIdentityStep ?? 'NONE'}
            onClose={() => setMorningSequenceOpen(false)}
          />
        )}

      </div>
    </GameBackground>
  );
}

function StagePanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="w-full max-w-4xl rounded-2xl bg-black/45 px-6 py-8 text-center shadow-2xl backdrop-blur-md md:px-10 md:py-10"
    >
      <h2 className="mb-6 text-sm font-bold uppercase tracking-[0.3em] text-amber-200/90">
        {title}
      </h2>
      {children}
    </motion.div>
  );
}

function DayVoteResultBanner({
  room,
  busy,
  onDismiss,
}: {
  room: GameRoom;
  busy: boolean;
  onDismiss: () => void;
}) {
  const result = room.dayVoteResult;
  if (!result) return null;
  const eliminated = result.eliminatedPlayerId
    ? room.players[result.eliminatedPlayerId]
    : null;
  const reveal = room.revealDeathRoles !== false;
  const roleLabel =
    reveal && result.eliminatedRole
      ? ROLE_LABELS[result.eliminatedRole]
      : null;

  return (
    <div className="space-y-5">
      {eliminated ? (
        <>
          <p className="text-lg text-white/70">투표 탈락</p>
          <div className="mx-auto flex max-w-md items-center justify-between rounded-xl bg-red-950/55 px-5 py-4 ring-1 ring-red-400/35">
            <span className="flex items-center gap-3">
              <CharacterAvatar
                avatarId={eliminated.avatarId}
                isAlive={false}
                state="arrested"
                size={52}
                previewOnHover
              />
              <span className="text-2xl font-black text-white">
                {eliminated.name}
              </span>
            </span>
            <span
              className={`rounded-md px-3 py-1 font-mono text-sm font-bold tracking-widest ${
                roleLabel
                  ? 'bg-amber-400/90 text-stone-900'
                  : 'bg-black/40 text-white/55'
              }`}
            >
              {roleLabel ?? '???'}
            </span>
          </div>
          {result.announcement && (
            <p className="mx-auto max-w-xl text-base font-semibold text-white/90">
              {result.announcement}
            </p>
          )}
          {result.wasTie && (
            <p className="text-sm text-amber-200/80">
              {result.wasRevote
                ? '재투표 후에도 동률 — 무작위로 1명 탈락'
                : result.tieResolution === 'REVOTE'
                  ? '동률 — 재투표 후 확정'
                  : '동점 — 최다 득표자 중 무작위로 1명 탈락'}
            </p>
          )}
        </>
      ) : (
        <p className="text-3xl font-black text-emerald-300">투표 탈락자 없음</p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={onDismiss}
        className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-black text-stone-900 hover:bg-amber-300 disabled:opacity-50"
      >
        확인 · 토론 계속
      </button>
    </div>
  );
}

function MorningResultStage({
  room,
  revivePending,
  voteTallies,
  busy,
  onConfirmRevive,
  onAdvanceReveal,
  onDismiss,
}: {
  room: GameRoom;
  revivePending: boolean;
  voteTallies: Record<string, number>;
  busy: boolean;
  onConfirmRevive: () => void;
  onAdvanceReveal: () => void;
  onDismiss: () => void;
}) {
  const nr = room.nightResults;
  const deadIds = nr?.deadPlayerIds ?? [];
  const savedIds = nr?.savedPlayerIds ?? [];
  const deadRoles = nr?.deadRoles ?? {};
  const deathAnnouncements = nr?.deathAnnouncements ?? [];
  const reveal = room.revealDeathRoles !== false;
  const news = nr?.reporterNews;
  const policeReport = nr?.policeReport;
  const quizHint = nr?.quizHint;
  const quizRate = nr?.quizSuccessRate;
  const quizOutcome = nr?.quizOutcome;
  const actionLog = nr?.actionLog ?? [];
  const revealQueue = getActiveMorningEvents(nr);
  const revealTotal = revealQueue.length;
  const revealIndex = Math.min(
    Math.max(0, room.morningRevealIndex ?? 0),
    Math.max(0, revealTotal - 1),
  );
  const currentReveal = revealQueue[revealIndex] ?? null;
  const identityStep = room.morningIdentityStep ?? 'NONE';
  const canRevealIdentity = Boolean(
    currentReveal?.event === 'MAFIA_KILL' &&
      currentReveal.targetId &&
      reveal &&
      deadIds.includes(currentReveal.targetId) &&
      deadRoles[currentReveal.targetId],
  );
  const identityIncomplete =
    canRevealIdentity && identityStep !== 'REVEAL_FULL_ROLE';
  const canAdvanceReveal =
    revealTotal > 0 &&
    (identityIncomplete || revealIndex < revealTotal - 1);
  const revealStepLabel =
    currentReveal?.event === 'MAFIA_KILL'
      ? identityStep === 'NONE'
        ? '사망자 공개'
        : identityStep === 'TEASE'
          ? '마피아 여부 추리'
          : identityStep === 'REVEAL_MAFIA_CHECK'
            ? '마피아 여부 공개'
            : '정체 공개'
      : currentReveal?.event === 'DOCTOR_DEFEND'
        ? '의사 활약 공개'
        : currentReveal?.event === 'DOCTOR_IDLE'
          ? '의사 미행동 공개'
        : currentReveal?.event === 'REPORTER_NEWS'
          ? '기자 취재 공개'
          : currentReveal?.event === 'REPORTER_IDLE'
            ? '기자 미행동 공개'
          : null;

  const actionRows = actionLog
    .filter((entry) => entry.role !== 'CITIZEN')
    .map((entry) => {
      const actor = room.players[entry.actorId];
      const target = entry.targetId ? room.players[entry.targetId] : null;
      const actorName = actor?.name ?? '???';
      const targetName = entry.targetId
        ? (target?.name ?? '???')
        : '지목 없음';
      const roleLabel = ROLE_LABELS[entry.role];

      let actionLabel = '행동';
      let resultText = '—';
      let resultTone: 'neutral' | 'success' | 'danger' | 'info' = 'neutral';

      if (entry.role === 'MAFIA') {
        actionLabel = '습격';
        if (!entry.targetId) {
          resultText = '지목하지 않음';
        } else if (deadIds.includes(entry.targetId)) {
          resultText = `${targetName} 탈락`;
          resultTone = 'danger';
        } else if (
          savedIds.includes(entry.targetId) ||
          nr?.isDoctorDefended
        ) {
          resultText = `${targetName} — 의사 보호로 생존`;
          resultTone = 'success';
        } else {
          resultText = `${targetName} — 생존 (공격 미적용)`;
          resultTone = 'info';
        }
      } else if (entry.role === 'DOCTOR') {
        actionLabel = '치료';
        if (!entry.targetId) {
          resultText = '지목하지 않음';
        } else if (nr?.isDoctorDefended && nr.doctorSavedPlayerId === entry.targetId) {
          resultText = `${targetName} 보호 성공`;
          resultTone = 'success';
        } else if (savedIds.includes(entry.targetId)) {
          resultText = `${targetName} 구출됨`;
          resultTone = 'success';
        } else {
          resultText = `${targetName} 지목 (습격과 불일치 또는 무효)`;
          resultTone = 'info';
        }
        if (nr?.doctorSaveWasTie) {
          resultText += ' · 동률 추첨';
        }
      } else if (entry.role === 'POLICE') {
        actionLabel = '조사';
        if (!entry.targetId) {
          resultText = '조사하지 않음';
        } else if (policeReport && policeReport.targetId === entry.targetId) {
          resultText = policeReport.isMafia
            ? `${policeReport.targetName} → 마피아 O`
            : `${policeReport.targetName} → 마피아 X`;
          resultTone = policeReport.isMafia ? 'danger' : 'success';
          if (policeReport.wasTie) resultText += ' · 동률 추첨';
        } else {
          const t = target;
          resultText = t
            ? `${targetName} → ${t.role === 'MAFIA' ? '마피아 O' : '마피아 X'}`
            : `${targetName} 조사`;
          resultTone = t?.role === 'MAFIA' ? 'danger' : 'success';
        }
      } else if (entry.role === 'REPORTER') {
        actionLabel = '취재';
        if (!entry.targetId) {
          resultText = '취재하지 않음';
        } else if (nr?.reporterTargetId === entry.targetId && news) {
          const role =
            nr.reporterTargetRole != null
              ? ROLE_LABELS[nr.reporterTargetRole]
              : null;
          resultText = role
            ? `${targetName}의 직업은 ${role}`
            : news;
          resultTone = 'info';
          if (nr.reporterWasTie) resultText += ' · 동률 추첨';
        } else {
          resultText = `${targetName} 취재`;
          resultTone = 'info';
        }
      } else if (entry.role === 'SPIRITUALIST') {
        actionLabel = '영혼 문의';
        resultText = entry.targetId
          ? `${targetName} 문의`
          : '문의하지 않음';
        resultTone = 'info';
      }

      return {
        key: `${entry.actorId}-${entry.role}`,
        actorName,
        actorAvatar: actor?.avatarId,
        roleLabel,
        actionLabel,
        targetId: entry.targetId,
        targetName,
        targetAvatar: target?.avatarId,
        resultText,
        resultTone,
        skipped: !entry.targetId,
      };
    });

  const toneClass = {
    neutral: 'bg-white/10 text-white/80',
    success: 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/35',
    danger: 'bg-red-500/20 text-red-100 ring-1 ring-red-400/35',
    info: 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/30',
  } as const;

  return (
    <StagePanel title="아침 결과 발표">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-auto w-full max-w-3xl space-y-5 text-left"
      >
        {quizOutcome && quizOutcome !== 'PENDING' && (
          <div className="rounded-2xl bg-indigo-950/55 px-4 py-3 ring-1 ring-indigo-400/30">
            <p className="text-xs font-black uppercase tracking-wider text-indigo-200/80">
              밤 퀴즈
            </p>
            <p className="mt-1 text-base font-black text-white">
              {quizOutcome === 'SUCCESS' ? '성공' : '실패'}
              {quizRate != null ? ` · 정답률 ${quizRate}%` : ''}
            </p>
            {quizHint && (
              <p className="mt-2 rounded-xl bg-amber-400/15 px-3 py-2 text-sm font-semibold text-amber-100 ring-1 ring-amber-300/25">
                공개 힌트: {quizHint}
              </p>
            )}
          </div>
        )}

        <div className="rounded-2xl bg-black/35 px-4 py-4 ring-1 ring-white/12">
          <p className="mb-3 text-xs font-black uppercase tracking-wider text-amber-200/90">
            직업별 밤 행동 · 결과
          </p>
          {actionRows.length === 0 ? (
            <p className="text-sm text-white/55">기록된 특수 직업 행동이 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {actionRows.map((row) => (
                <li
                  key={row.key}
                  className="rounded-xl bg-white/5 px-3 py-3 ring-1 ring-white/10 sm:px-4"
                >
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <CharacterAvatar
                      avatarId={row.actorAvatar}
                      size={40}
                      isAlive
                      previewOnHover
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-white sm:text-base">
                        {row.actorName}
                        <span className="ml-2 rounded bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-black text-stone-900">
                          {row.roleLabel}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-white/55">
                        {row.actionLabel}
                        {!row.skipped && (
                          <>
                            {' → '}
                            <span className="text-white/90">{row.targetName}</span>
                          </>
                        )}
                      </p>
                    </div>
                    {!row.skipped && row.targetAvatar && (
                      <CharacterAvatar
                        avatarId={row.targetAvatar}
                        size={36}
                        isAlive={!(row.targetId && deadIds.includes(row.targetId))}
                        previewOnHover
                      />
                    )}
                  </div>
                  <p
                    className={`mt-2 rounded-lg px-3 py-2 text-sm font-bold ${toneClass[row.resultTone]}`}
                  >
                    결과: {row.resultText}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-black/35 px-4 py-4 text-center ring-1 ring-white/12">
          <p className="mb-3 text-xs font-black uppercase tracking-wider text-white/50">
            희생자
          </p>
          {deadIds.length === 0 ? (
            <p className="text-2xl font-black text-emerald-300 md:text-3xl">
              지난밤, 희생자는 없었습니다
            </p>
          ) : (
            <ul className="mx-auto flex max-w-lg flex-col gap-3 text-left">
              {deadIds.map((id, index) => {
                const p = room.players[id];
                const role = deadRoles[id] ?? (reveal ? p?.role : null);
                const roleLabel = role ? ROLE_LABELS[role] : null;
                return (
                  <motion.li
                    key={id}
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + index * 0.25, duration: 0.45 }}
                    className="flex items-center justify-between rounded-xl bg-red-950/55 px-4 py-3 ring-1 ring-red-400/35"
                  >
                    <span className="flex items-center gap-3">
                      <CharacterAvatar
                        avatarId={p?.avatarId}
                        isAlive={false}
                        size={48}
                        previewOnHover
                      />
                      <span className="text-xl font-black text-white">
                        {p?.name ?? '???'}
                      </span>
                    </span>
                    <span
                      className={`rounded-md px-3 py-1 font-mono text-sm font-bold tracking-widest ${
                        roleLabel
                          ? 'bg-amber-400/90 text-stone-900'
                          : 'bg-black/40 text-white/55'
                      }`}
                    >
                      {roleLabel ?? '???'}
                    </span>
                  </motion.li>
                );
              })}
            </ul>
          )}
          {deathAnnouncements.length > 0 && (
            <div className="mx-auto mt-4 max-w-xl space-y-2 text-left">
              {deathAnnouncements.map((line) => (
                <p
                  key={line}
                  className="rounded-xl bg-black/35 px-4 py-2 text-sm font-semibold text-white/90"
                >
                  {line}
                </p>
              ))}
            </div>
          )}
          {!reveal && deadIds.length > 0 && (
            <p className="mt-3 text-xs text-white/45">탈락자 직업은 비공개 (???)</p>
          )}
        </div>

        {news && (
          <div className="rounded-2xl bg-sky-950/50 px-4 py-3 ring-1 ring-sky-400/30">
            <p className="text-xs font-black uppercase tracking-wider text-sky-200/80">
              기자 속보 · 전체 공개
            </p>
            <p className="mt-1 text-base font-semibold text-white">{news}</p>
          </div>
        )}

        {policeReport && (
          <div className="rounded-2xl bg-indigo-950/55 px-4 py-3 ring-1 ring-indigo-400/35">
            <p className="text-xs font-black uppercase tracking-wider text-indigo-200/80">
              경찰 조사 요약 · 교사·경찰만
            </p>
            <p className="mt-1 text-base font-black text-white">
              {policeReport.targetName} →{' '}
              {policeReport.isMafia ? '마피아 O' : '마피아 X'}
            </p>
          </div>
        )}

        {revivePending && (
          <div className="rounded-xl bg-violet-950/50 p-4 ring-1 ring-violet-400/35">
            <p className="text-sm font-black text-violet-100">기회의 밤 · 부활 투표</p>
            <p className="mt-1 text-xs text-violet-100/70">
              학생 기기에서 부활시킬 사망자를 투표하세요
            </p>
            <ul className="mt-3 space-y-2">
              {deadIds.map((id) => (
                <li
                  key={id}
                  className="flex justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
                >
                  <span>{room.players[id]?.name ?? '???'}</span>
                  <span className="font-mono text-violet-200">
                    {voteTallies[id] ?? 0}표
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirmRevive}
              className="mt-4 w-full rounded-xl bg-violet-500 py-2.5 text-sm font-black text-white hover:bg-violet-400 disabled:opacity-50"
            >
              부활 확정
            </button>
          </div>
        )}

        {!revivePending && (
          <div className="space-y-3 text-center">
            {revealTotal > 0 && (
              <div className="rounded-2xl bg-amber-400/10 px-4 py-4 ring-1 ring-amber-300/25">
                <p className="text-xs font-black uppercase tracking-wider text-amber-200/80">
                  서브모니터 · 아침 공개
                </p>
                <p className="mt-1 text-base font-black text-white">
                  {revealStepLabel ?? '공개'} ({revealIndex + 1}/{revealTotal})
                </p>
                <p className="mt-1 text-xs text-white/55">
                  사망자 정체는 「마피아가」→「맞습니다/아닙니다」→「정체」순으로
                  다음을 눌러 공개합니다.
                </p>
                <button
                  type="button"
                  disabled={busy || !canAdvanceReveal}
                  onClick={onAdvanceReveal}
                  className="mt-3 rounded-xl bg-amber-400 px-6 py-3 text-sm font-black text-stone-900 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {canAdvanceReveal ? '다음' : '마지막 공개 중'}
                </button>
              </div>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={onDismiss}
              className="rounded-xl bg-white px-6 py-3 text-sm font-black text-stone-900 hover:bg-stone-100 disabled:opacity-50"
            >
              낮 토론으로
            </button>
          </div>
        )}
      </motion.div>
    </StagePanel>
  );
}

function ControlBtn({
  icon,
  label,
  onClick,
  disabled,
  accent = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: 'default' | 'amber' | 'green' | 'red' | 'night';
}) {
  const accents: Record<string, string> = {
    default: 'bg-white/10 hover:bg-white/20 text-white',
    amber: 'bg-amber-400 hover:bg-amber-300 text-stone-900',
    green: 'bg-emerald-500 hover:bg-emerald-400 text-white',
    red: 'bg-red-600 hover:bg-red-500 text-white',
    night: 'bg-indigo-950 hover:bg-indigo-900 text-red-100 ring-1 ring-red-500/40',
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-35 md:px-4 ${accents[accent]}`}
    >
      {icon}
      {label}
    </button>
  );
}

function PartnerGrid({ room }: { room: GameRoom }) {
  const pairs = useMemo(() => {
    const seen = new Set<string>();
    const result: { a: string; b: string | null }[] = [];
    alivePlayers(room).forEach((p) => {
      if (seen.has(p.id)) return;
      seen.add(p.id);
      if (p.partnerId) seen.add(p.partnerId);
      const partner = p.partnerId ? room.players[p.partnerId] : null;
      result.push({ a: p.name, b: partner?.name ?? null });
    });
    return result;
  }, [room]);

  return (
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      {pairs.map((pair) => (
        <span
          key={`${pair.a}-${pair.b}`}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm"
        >
          {pair.a} ↔ {pair.b ?? '대기'}
        </span>
      ))}
    </div>
  );
}

function PlayerChips({ room }: { room: GameRoom }) {
  return (
    <div className="mt-6">
      <PlayerRoster room={room} compact title="플레이어" showRoles />
    </div>
  );
}

function VoteBoard({
  room,
  alive,
  tallies,
  totalVotes,
}: {
  room: GameRoom;
  alive: ReturnType<typeof alivePlayers>;
  tallies: Record<string, number>;
  totalVotes: number;
}) {
  const rows = useMemo(() => {
    return playerList(room)
      .slice()
      .sort((a, b) => (tallies[b.id] ?? 0) - (tallies[a.id] ?? 0));
  }, [room, tallies]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 text-left">
      <p className="mb-2 text-center text-sm text-white/65">
        투표 {totalVotes} / 생존 {alive.length}
      </p>
      {rows.map((p) => {
        const count = tallies[p.id] ?? 0;
        const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
        return (
          <div key={p.id} className="flex items-center gap-3">
            <div className="w-28 truncate text-sm font-semibold md:w-36">
              {p.name}
              {!p.isAlive && (
                <span className="ml-1 text-xs text-red-300">사망 · ???</span>
              )}
            </div>
            <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className={`absolute inset-y-0 left-0 rounded-full ${
                  p.isAlive ? 'bg-amber-400' : 'bg-white/25'
                }`}
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
            <div className="w-10 text-right font-mono text-sm tabular-nums">
              {count}
            </div>
          </div>
        );
      })}
      <p className="mt-2 text-center text-xs text-white/45">
        사망자 직업은 비공개 (???)
      </p>
    </div>
  );
}
