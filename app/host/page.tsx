'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Moon,
  Play,
  QrCode,
  ShieldAlert,
  Swords,
  Sunrise,
  Target,
  Users,
  Vote,
  Check,
  X,
  Volume2,
  HeartHandshake,
} from 'lucide-react';
import GameBackground, {
  type BackgroundPhase,
} from '@/components/GameBackground';
import { GmPanel } from '@/components/host/GmPanel';
import { isFirebaseConfigured } from '@/lib/firebase';
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
  createEmptyRoom,
  generatePin,
  patchRoom,
  playerList,
  resolveMission,
  saveRoom,
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

  const voteTallies = useMemo(() => (room ? tallyVotes(room) : {}), [room]);
  const totalVotes = useMemo(
    () => Object.values(voteTallies).reduce((a, b) => a + b, 0),
    [voteTallies],
  );

  // 클라이언트 join URL
  useEffect(() => {
    setJoinUrl(window.location.origin);
  }, []);

  // 매칭 타이머 틱
  useEffect(() => {
    if (room?.gameState !== 'DAY_MATCH' || !room.matchEndsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [room?.gameState, room?.matchEndsAt]);

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

          <div className="flex items-center gap-3 text-sm md:text-base">
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
                className="flex w-full max-w-5xl flex-col items-center gap-8 md:flex-row md:items-stretch md:justify-center md:gap-14"
              >
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
              </motion.div>
            ) : room.gameState === 'DAY_MATCH' ? (
              <StagePanel key="match" title="1:1 매칭">
                <div className="text-7xl font-black tabular-nums text-amber-300 md:text-8xl">
                  {matchRemainSec}
                </div>
                <p className="mt-2 text-white/80">초 남음 · 파트너와 대화하세요</p>
                <PartnerGrid room={room} />
              </StagePanel>
            ) : room.gameState === 'DAY_MISSION' ? (
              <StagePanel key="mission" title="미션 진행">
                <p className="max-w-2xl text-2xl font-bold leading-snug md:text-3xl">
                  {room.currentCitizenMission?.description ?? '미션 준비 중'}
                </p>
                <p className="mt-3 text-lg text-amber-200/90">
                  제한 {room.currentCitizenMission?.timeLimitSec ?? 0}초
                  {room.isMafiaBuffActive ? ' · 마피아 버프 활성' : ''}
                </p>
                {room.mafiaMission && (
                  <p className="mt-4 rounded-lg bg-red-950/50 px-4 py-2 text-sm text-red-100">
                    마피아 서브: {room.mafiaMission.description}
                  </p>
                )}
              </StagePanel>
            ) : room.gameState === 'DAY_VOTE' ? (
              <StagePanel key="vote" title="실시간 투표">
                <VoteBoard
                  room={room}
                  alive={alive}
                  tallies={voteTallies}
                  totalVotes={totalVotes}
                />
              </StagePanel>
            ) : room.gameState === 'NIGHT' ? (
              <StagePanel key="night" title="밤이 되었습니다">
                <Moon className="mx-auto h-16 w-16 text-red-300" />
                <p className="mt-4 text-xl text-white/85">
                  눈을 감고 능력을 사용할 차례입니다
                </p>
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
                <p className="text-xl text-white/85">
                  생존 {alive.length}명 · 토론을 진행하세요
                </p>
                {room.currentHint && (
                  <p className="mx-auto mt-4 max-w-xl rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-400/30">
                    공개 힌트: {room.currentHint}
                  </p>
                )}
                <PlayerChips room={room} />
              </StagePanel>
            )}
          </AnimatePresence>

          {error && (
            <p className="mt-6 max-w-xl rounded-lg bg-red-950/70 px-4 py-2 text-center text-sm text-red-100">
              {error}
            </p>
          )}
        </main>

        {/* 하단 교사 제어바 */}
        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-stone-950/80 px-3 py-3 backdrop-blur-xl md:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 md:gap-3">
            <ControlBtn
              icon={<Play className="h-4 w-4" />}
              label="게임 시작"
              disabled={!room || busy || room.gameState !== 'WAITING'}
              onClick={() => void runAction(assignRolesAndStart, 4)}
              accent="amber"
            />
            <ControlBtn
              icon={<Users className="h-4 w-4" />}
              label="1:1 매칭 발동"
              disabled={!room || busy || room.gameState === 'WAITING'}
              onClick={() => void runAction(startMatchPhase, 2)}
            />
            <ControlBtn
              icon={<Target className="h-4 w-4" />}
              label="미션 발동"
              disabled={!room || busy || room.gameState === 'WAITING'}
              onClick={() => void runAction(startMissionPhase, 2)}
            />
            <ControlBtn
              icon={<Check className="h-4 w-4" />}
              label="미션 성공"
              disabled={!room || busy || room.gameState !== 'DAY_MISSION'}
              onClick={() =>
                void runAction((r) => resolveMission(r, 'SUCCESS'))
              }
              accent="green"
            />
            <ControlBtn
              icon={<X className="h-4 w-4" />}
              label="미션 실패"
              disabled={!room || busy || room.gameState !== 'DAY_MISSION'}
              onClick={() => void runAction((r) => resolveMission(r, 'FAIL'))}
              accent="red"
            />
            <ControlBtn
              icon={<Vote className="h-4 w-4" />}
              label="투표 시작"
              disabled={!room || busy || room.gameState === 'WAITING'}
              onClick={() => void runAction(startVotePhase, 2)}
            />
            <ControlBtn
              icon={<Moon className="h-4 w-4" />}
              label="밤 시작"
              disabled={!room || busy || room.gameState === 'WAITING'}
              onClick={() => void runAction(startNightPhase, 2)}
              accent="night"
            />
            <ControlBtn
              icon={<Sunrise className="h-4 w-4" />}
              label="아침 발표"
              disabled={!room || busy || room.gameState !== 'NIGHT'}
              onClick={() => void handleResolveNight()}
              accent="amber"
            />
            <ControlBtn
              icon={<HeartHandshake className="h-4 w-4" />}
              label="부활 확정"
              disabled={!room || busy || !revivePending}
              onClick={() => void runAction(resolveReviveVote)}
              accent="green"
            />
            <ControlBtn
              icon={<Swords className="h-4 w-4" />}
              label="테스트 +1"
              disabled={!room || busy}
              onClick={() => {
                if (!room) return;
                const id = `demo_${Date.now()}`;
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
                      avatarIndex: playerCount % 8,
                    },
                  },
                };
                void commitRoom(next);
              }}
            />
          </div>
          <p className="mt-1 text-center text-[11px] text-white/40">
            <ShieldAlert className="mr-1 inline h-3 w-3" />
            사망자 직업은 화면에 ??? 로 표시됩니다 · 테스트 +1 로 입장 시뮬레이션
          </p>
        </footer>
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
                    <span className="text-2xl font-black text-white">
                      {p?.name ?? '???'}
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
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      {playerList(room).map((p) => (
        <span
          key={p.id}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            p.isAlive ? 'bg-white/15' : 'bg-black/50 text-white/45 line-through'
          }`}
        >
          {p.name}
          {!p.isAlive ? ' · ???' : ''}
        </span>
      ))}
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
