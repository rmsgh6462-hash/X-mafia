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
  Check,
  X,
  Volume2,
  HeartHandshake,
  Plus,
  Square,
} from 'lucide-react';
import GameBackground, {
  type BackgroundPhase,
} from '@/components/GameBackground';
import { GmPanel } from '@/components/host/GmPanel';
import { MatchChatMonitor } from '@/components/host/MatchChatMonitor';
import { NightActivityBoard } from '@/components/host/NightActivityBoard';
import { RoleAssignPanel } from '@/components/host/RoleAssignPanel';
import {
  RoleBoardPanel,
  RoleBoardToggle,
} from '@/components/host/RoleBoardPanel';
import { PlayerRoster } from '@/components/play/PlayerRoster';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { isFirebaseConfigured } from '@/lib/firebase';
import { firstFreeAvatarId } from '@/lib/game/avatars';
import { playPhaseBgm, speak, speakPhase, stopAllAudio } from '@/lib/game/audio';
import {
  dismissMorningResult,
  hasAliveSpiritualist,
  resolveNight,
  resolveReviveVote,
} from '@/lib/gameLogic';
import {
  alivePlayers,
  assignRolesAndStart,
  assignRolesByCounts,
  assignRolesByCountsAndStart,
  assignRolesManual,
  createEmptyRoom,
  deleteRoom,
  dismissDayVoteResult,
  endGameRoom,
  extendVoteTime,
  generatePin,
  patchRoom,
  playerList,
  resolveCitizenMission,
  resolveDayVote,
  resolveMafiaMission,
  saveRoom,
  startAssignedGame,
  startMatchPhase,
  startMissionPhase,
  startNightPhase,
  startVotePhase,
  subscribeRoom,
  tallyVotes,
} from '@/lib/game/room';
import type { GameRoom, GameState, Theme } from '@/types/game';

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
  NIGHT: '밤',
  RESULT: '결과',
  ENDED: '종료',
};

function formatPin(pin: string) {
  return pin.replace(/(\d{3})(\d{3})/, '$1 $2');
}

export default function HostPage() {
  const [theme, setTheme] = useState<Theme>('VILLAGE');
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [joinUrl, setJoinUrl] = useState('');
  const [audioReady, setAudioReady] = useState(false);
  const [roleBoardOpen, setRoleBoardOpen] = useState(false);
  const prevStateRef = useRef<GameState | null>(null);
  const roomIdRef = useRef<string | null>(null);

  const players = useMemo(() => (room ? playerList(room) : []), [room]);
  const alive = useMemo(() => (room ? alivePlayers(room) : []), [room]);
  const playerCount = players.length;
  const spiritualistAlive = useMemo(
    () => (room ? hasAliveSpiritualist(room) : false),
    [room],
  );
  const revivePending =
    room?.gameState === 'RESULT' && room.gmEvent === 'REVIVE_NIGHT';

  const matchRemainSec = useMemo(() => {
    if (!room?.matchEndsAt) return 0;
    return Math.max(0, Math.ceil((room.matchEndsAt - now) / 1000));
  }, [room?.matchEndsAt, now]);

  const voteRemainSec = useMemo(() => {
    if (!room?.voteEndsAt) return 0;
    return Math.max(0, Math.ceil((room.voteEndsAt - now) / 1000));
  }, [room?.voteEndsAt, now]);

  const voteTallies = useMemo(() => (room ? tallyVotes(room) : {}), [room]);
  const totalVotes = useMemo(
    () => Object.values(voteTallies).reduce((a, b) => a + b, 0),
    [voteTallies],
  );
  const voteAutoEndedRef = useRef<number | null>(null);

  // 클라이언트 join URL
  useEffect(() => {
    setJoinUrl(window.location.origin);
  }, []);

  // 매칭·투표 타이머 틱
  useEffect(() => {
    const needTick =
      (room?.gameState === 'DAY_MATCH' && room.matchEndsAt) ||
      (room?.gameState === 'DAY_VOTE' && room.voteEndsAt);
    if (!needTick) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [room?.gameState, room?.matchEndsAt, room?.voteEndsAt]);

  // Firebase 구독
  useEffect(() => {
    if (!roomIdRef.current) return;
    const roomId = roomIdRef.current;
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeRoom(roomId, (remote) => {
        if (remote) setRoom(remote);
      });
    } catch (e) {
      console.warn('Firebase subscribe failed, using local state', e);
    }
    return () => unsub?.();
  }, [room?.roomId]);

  // GameState 변경 → BGM + TTS
  useEffect(() => {
    if (!room || !audioReady) return;
    if (prevStateRef.current === room.gameState) return;
    prevStateRef.current = room.gameState;
    void playPhaseBgm(room.gameState);
    speakPhase(room.gameState);
  }, [room?.gameState, room, audioReady]);

  useEffect(() => () => stopAllAudio(), []);

  const commitRoom = useCallback(async (next: GameRoom) => {
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
      setError(
        'Firebase 동기화 실패 — 방이 DB에 저장되지 않아 학생 입장이 안 될 수 있습니다. .env.local과 DB 규칙을 확인하세요.',
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
      const name = next.dayVoteResult?.eliminatedName;
      if (name) {
        speak(`투표가 종료되었습니다. ${name} 님이 탈락했습니다.`);
      } else {
        speak('투표가 종료되었습니다. 탈락자는 없습니다.');
      }
    })();
  }, [room, now, commitRoom]);

  const enableAudio = useCallback(async () => {
    setAudioReady(true);
    if (room) {
      await playPhaseBgm(room.gameState);
      speak('오디오가 활성화되었습니다.');
    }
  }, [room]);

  const handleCreateRoom = async () => {
    if (!isFirebaseConfigured()) {
      setError(
        'Firebase가 설정되지 않았습니다. .env.local에 실제 Firebase 설정을 넣은 뒤 다시 시도하세요.',
      );
      speak('파이어베이스 설정이 필요합니다.');
      return;
    }
    setBusy(true);
    const pin = generatePin();
    const next = createEmptyRoom(theme, pin);
    await commitRoom(next);
    prevStateRef.current = null;
    setAudioReady(true);
    await playPhaseBgm('WAITING');
    speakPhase('WAITING');
    setBusy(false);
  };

  const handleThemeChange = async (nextTheme: Theme) => {
    setTheme(nextTheme);
    if (!room) return;
    const next = { ...room, theme: nextTheme };
    setRoom(next);
    try {
      await patchRoom(room.roomId, { theme: nextTheme });
    } catch {
      /* local ok */
    }
  };

  const runAction = async (factory: (r: GameRoom) => GameRoom, minPlayers = 0) => {
    if (!room) return;
    if (playerCount < minPlayers) {
      speak(`최소 ${minPlayers}명이 필요합니다.`);
      setError(`최소 ${minPlayers}명의 참가자가 필요합니다.`);
      return;
    }
    setBusy(true);
    setError(null);
    await commitRoom(factory(room));
    setBusy(false);
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
    const next = resolveNight(room);
    await commitRoom(next);
    const deadCount = next.nightResults?.deadPlayerIds.length ?? 0;
    speak(
      deadCount === 0
        ? '아침이 되었습니다. 지난밤 희생자는 없었습니다.'
        : `아침이 되었습니다. 지난밤 ${deadCount}명이 희생되었습니다.`,
    );
    setBusy(false);
  };

  const handleEndGame = async () => {
    if (!room) return;
    const ok = window.confirm(
      '게임을 종료할까요? 모든 학생 화면이 퇴장되며, 이 방은 닫힙니다.',
    );
    if (!ok) return;
    setBusy(true);
    try {
      const ended = endGameRoom(room);
      await commitRoom(ended);
      speak('게임이 종료되었습니다.');
      // 학생들이 ENDED를 받을 시간을 준 뒤 방 삭제
      window.setTimeout(() => {
        void (async () => {
          try {
            await deleteRoom(ended.roomId);
          } catch (e) {
            console.warn(e);
          }
          setRoom(null);
          roomIdRef.current = null;
          prevStateRef.current = null;
          setBusy(false);
        })();
      }, 1200);
    } catch (e) {
      console.warn(e);
      setError('게임 종료에 실패했습니다.');
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
          </div>

          <div className="flex items-center gap-2 rounded-full bg-black/40 p-1 backdrop-blur-md">
            <ThemeChip
              active={theme === 'VILLAGE'}
              onClick={() => void handleThemeChange('VILLAGE')}
              label="마을 테마 🏘️"
            />
            <ThemeChip
              active={theme === 'SCHOOL'}
              onClick={() => void handleThemeChange('SCHOOL')}
              label="학교 테마 🏫"
            />
          </div>

          <div className="flex items-center gap-2 text-sm md:text-base">
            {room && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-400/90 px-3 py-1.5 font-mono font-black tracking-wider text-stone-900 backdrop-blur-sm">
                PIN {formatPin(room.pin)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-md bg-black/35 px-3 py-1.5 backdrop-blur-sm">
              <Users className="h-4 w-4" />
              {playerCount}명
            </span>
            {!audioReady ? (
              <button
                type="button"
                onClick={() => void enableAudio()}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/90 px-3 py-1.5 font-semibold text-black transition hover:bg-amber-400"
              >
                <Volume2 className="h-4 w-4" />
                소리 켜기
              </button>
            ) : null}
          </div>
        </header>

        {/* 메인 스테이지 */}
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-44 pt-4 md:px-12">
          {room && room.gameState !== 'WAITING' && (
            <div className="absolute right-4 top-0 z-20 md:right-10">
              <GmPanel
                room={room}
                disabled={busy}
                spiritualistAlive={spiritualistAlive}
                onAnonymousTip={(h) => void handleAnonymousTip(h)}
                onSilenceNight={() => void handleSilenceNight()}
                onReviveNight={() => void handleReviveNight()}
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
                  <PlayerRoster room={room} title="입장한 학생" showRoles />
                  <RoleAssignPanel
                    room={room}
                    busy={busy}
                    onRandomAssign={(counts, startNow) => {
                      if (startNow) {
                        void runAction(
                          (r) => assignRolesByCountsAndStart(r, counts),
                          4,
                        );
                        speak('직업을 배정하고 게임을 시작합니다.');
                      } else {
                        void runAction((r) => assignRolesByCounts(r, counts));
                        speak('직업을 랜덤 배정했습니다.');
                      }
                    }}
                    onManualAssign={(assignments) => {
                      void runAction((r) => assignRolesManual(r, assignments));
                      speak('수동 직업 배정을 저장했습니다.');
                    }}
                    onStart={() => {
                      void runAction(startAssignedGame, 4);
                      speak('게임을 시작합니다.');
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
              <StagePanel key="mission" title="미션 진행">
                <div className="mx-auto grid w-full max-w-3xl gap-4 text-left md:grid-cols-2">
                  <MissionJudgeCard
                    title="시민 미션"
                    accent="citizen"
                    description={
                      room.currentCitizenMission?.description ?? '미션 준비 중'
                    }
                    meta={`제한 ${room.currentCitizenMission?.timeLimitSec ?? 0}초`}
                    outcome={room.missionOutcome}
                    busy={busy}
                    onSuccess={() =>
                      void runAction((r) => resolveCitizenMission(r, 'SUCCESS'))
                    }
                    onFail={() =>
                      void runAction((r) => resolveCitizenMission(r, 'FAIL'))
                    }
                  />
                  <MissionJudgeCard
                    title="마피아 미션"
                    accent="mafia"
                    description={
                      room.mafiaMission?.description ?? '미션 준비 중'
                    }
                    meta="성공 시 생존 마피아 각자 1명 공격 (서로 살해 가능)"
                    outcome={room.mafiaMission?.outcome ?? null}
                    busy={busy}
                    onSuccess={() =>
                      void runAction((r) => resolveMafiaMission(r, 'SUCCESS'))
                    }
                    onFail={() =>
                      void runAction((r) => resolveMafiaMission(r, 'FAIL'))
                    }
                  />
                </div>
                <p className="mt-5 text-sm text-white/55">
                  양쪽 판정이 끝나면 자동으로 토론으로 넘어갑니다.
                </p>
              </StagePanel>
            ) : room.gameState === 'DAY_VOTE' ? (
              <StagePanel key="vote" title="실시간 투표 · 15초">
                <div
                  className={`mb-6 font-black tabular-nums ${
                    voteRemainSec <= 5 ? 'text-red-300' : 'text-amber-300'
                  } text-6xl md:text-7xl`}
                >
                  {voteRemainSec}
                </div>
                <p className="mb-6 text-sm text-white/70">초 남음</p>
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
                      void runAction(resolveDayVote);
                      speak('투표를 종료합니다.');
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    <Square className="h-4 w-4" />
                    투표 종료
                  </button>
                </div>
              </StagePanel>
            ) : room.gameState === 'NIGHT' ? (
              <StagePanel key="night" title="밤 — 직업별 활동 모니터">
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Moon className="h-10 w-10 text-red-300" />
                  <p className="text-lg text-white/85">
                    학생 능력 사용을 실시간으로 확인하세요
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
                    멀티킬 버프 활성 — 마피아 각자 독립 지목
                  </p>
                )}

                <NightActivityBoard room={room} />

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleResolveNight()}
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-base font-black text-stone-900 hover:bg-amber-300 disabled:opacity-50"
                >
                  <Sunrise className="h-5 w-5" />
                  아침 발표 (밤 결과 연산)
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
                onDismiss={() => void runAction(dismissMorningResult)}
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
                        마피아 미션 성공 — 오늘 밤 멀티킬 버프 활성
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
                {room?.isMafiaBuffActive ? ' · 멀티킬 버프' : ''}
              </p>
              <div className="flex items-center gap-2">
                <RoleBoardToggle
                  open={roleBoardOpen}
                  disabled={!room}
                  onToggle={() => setRoleBoardOpen((v) => !v)}
                />
                {!audioReady && (
                  <button
                    type="button"
                    onClick={() => void enableAudio()}
                    className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/16"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    소리
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {!room && (
                <ControlBtn
                  icon={<QrCode className="h-4 w-4" />}
                  label="방 생성"
                  disabled={busy}
                  onClick={() => void handleCreateRoom()}
                  accent="amber"
                />
              )}

              {room?.gameState === 'WAITING' && (
                <>
                  <ControlBtn
                    icon={<Play className="h-4 w-4" />}
                    label="게임 시작"
                    disabled={busy}
                    onClick={() => void runAction(assignRolesAndStart, 4)}
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
                      label="미션"
                      disabled={busy}
                      onClick={() => void runAction(startMissionPhase, 2)}
                    />
                    <ControlBtn
                      icon={<Vote className="h-4 w-4" />}
                      label="투표"
                      disabled={busy}
                      onClick={() => void runAction(startVotePhase, 2)}
                    />
                    <ControlBtn
                      icon={<Moon className="h-4 w-4" />}
                      label="밤"
                      disabled={busy}
                      onClick={() => void runAction(startNightPhase, 2)}
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
                    }))
                  }
                />
              )}

              {room?.gameState === 'DAY_VOTE' && (
                <>
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
                        const name = next.dayVoteResult?.eliminatedName;
                        if (name) speak(`${name} 님이 탈락했습니다.`);
                        else speak('탈락자는 없습니다.');
                        return next;
                      });
                    }}
                    accent="red"
                  />
                </>
              )}

              {room?.gameState === 'NIGHT' && (
                <ControlBtn
                  icon={<Sunrise className="h-4 w-4" />}
                  label="아침 발표"
                  disabled={busy}
                  onClick={() => void handleResolveNight()}
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
      </div>
    </GameBackground>
  );
}

function ThemeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-bold transition md:text-base ${
        active
          ? 'bg-white text-stone-900 shadow'
          : 'text-white/75 hover:bg-white/10 hover:text-white'
      }`}
    >
      {label}
    </button>
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

function MissionJudgeCard({
  title,
  description,
  meta,
  outcome,
  accent,
  busy,
  onSuccess,
  onFail,
}: {
  title: string;
  description: string;
  meta: string;
  outcome: string | null;
  accent: 'citizen' | 'mafia';
  busy: boolean;
  onSuccess: () => void;
  onFail: () => void;
}) {
  const done = outcome === 'SUCCESS' || outcome === 'FAIL';
  const ring =
    accent === 'mafia'
      ? 'ring-red-400/30 bg-red-950/35'
      : 'ring-emerald-400/25 bg-emerald-950/30';

  return (
    <div className={`rounded-2xl p-4 ring-1 ${ring}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3
          className={`text-sm font-black ${
            accent === 'mafia' ? 'text-red-200' : 'text-emerald-200'
          }`}
        >
          {title}
        </h3>
        {done && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              outcome === 'SUCCESS'
                ? 'bg-emerald-500/25 text-emerald-200'
                : 'bg-red-500/25 text-red-200'
            }`}
          >
            {outcome === 'SUCCESS' ? '성공' : '실패'}
          </span>
        )}
      </div>
      <p className="text-base font-bold leading-snug text-white md:text-lg">
        {description}
      </p>
      <p className="mt-2 text-xs text-white/50">{meta}</p>
      {!done && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onSuccess}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-black text-white hover:bg-emerald-400 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            성공
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onFail}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-black text-white hover:bg-red-500 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            실패
          </button>
        </div>
      )}
    </div>
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
                size={52}
              />
              <span className="text-2xl font-black text-white">
                {eliminated.name}
              </span>
            </span>
            <span className="rounded-md bg-black/40 px-3 py-1 font-mono text-sm font-bold tracking-widest text-white/55">
              ???
            </span>
          </div>
          {result.wasTie && (
            <p className="text-sm text-amber-200/80">
              동점 — 최다 득표자 중 무작위로 1명 탈락
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
  onDismiss,
}: {
  room: GameRoom;
  revivePending: boolean;
  voteTallies: Record<string, number>;
  busy: boolean;
  onConfirmRevive: () => void;
  onDismiss: () => void;
}) {
  const deadIds = room.nightResults?.deadPlayerIds ?? [];
  const savedIds = room.nightResults?.savedPlayerIds ?? [];
  const news = room.nightResults?.reporterNews;

  return (
    <StagePanel title="아침 결과 발표">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        {deadIds.length === 0 ? (
          <motion.p
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-3xl font-black text-emerald-300 md:text-4xl"
          >
            지난밤, 희생자는 없었습니다
          </motion.p>
        ) : (
          <div>
            <p className="mb-4 text-lg text-white/70">지난밤 탈락자</p>
            <ul className="mx-auto flex max-w-lg flex-col gap-3">
              {deadIds.map((id, index) => {
                const p = room.players[id];
                return (
                  <motion.li
                    key={id}
                    initial={{ opacity: 0, x: -24, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    transition={{ delay: 0.35 + index * 0.45, duration: 0.55 }}
                    className="flex items-center justify-between rounded-xl bg-red-950/55 px-5 py-4 ring-1 ring-red-400/35"
                  >
                    <span className="flex items-center gap-3">
                      <CharacterAvatar
                        avatarId={p?.avatarId}
                        isAlive={false}
                        size={48}
                      />
                      <span className="text-2xl font-black text-white">
                        {p?.name ?? '???'}
                      </span>
                    </span>
                    <span className="rounded-md bg-black/40 px-3 py-1 font-mono text-sm font-bold tracking-widest text-white/55">
                      ???
                    </span>
                  </motion.li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-white/45">탈락자 직업은 비공개 (???)</p>
          </div>
        )}

        {savedIds.length > 0 && (
          <p className="text-sm text-sky-200/90">
            의사 구출로 살아난 지목: {savedIds.length}명
          </p>
        )}

        {news && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mx-auto max-w-xl rounded-xl bg-sky-950/50 px-4 py-3 text-left ring-1 ring-sky-400/30"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-sky-200/80">
              속보
            </p>
            <p className="mt-1 text-base font-semibold text-white">{news}</p>
          </motion.div>
        )}

        {revivePending && (
          <div className="mx-auto max-w-md rounded-xl bg-violet-950/50 p-4 ring-1 ring-violet-400/35">
            <p className="text-sm font-black text-violet-100">기회의 밤 · 부활 투표</p>
            <p className="mt-1 text-xs text-violet-100/70">
              학생 기기에서 부활시킬 사망자를 투표하세요
            </p>
            <ul className="mt-3 space-y-2 text-left">
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
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="rounded-xl bg-white px-6 py-3 text-sm font-black text-stone-900 hover:bg-stone-100 disabled:opacity-50"
          >
            낮 토론으로
          </button>
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
      <PlayerRoster room={room} compact title="플레이어" />
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
