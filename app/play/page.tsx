'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LogIn,
  Moon,
  Power,
  Sun,
  Vote,
} from 'lucide-react';
import GameBackground, {
  type BackgroundPhase,
} from '@/components/GameBackground';
import { AvatarPickerGrid } from '@/components/play/AvatarPicker';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { GhostMode } from '@/components/play/GhostMode';
import { GameResultPanel } from '@/components/play/GameResultPanel';
import { MatchChatPanel } from '@/components/play/MatchChatPanel';
import { MafiaChatPanel } from '@/components/play/MafiaChatPanel';
import {
  getActiveMorningEvents,
  getMorningEvents,
  MorningSequenceModal,
} from '@/components/play/MorningSequenceModal';
import {
  DayMafiaMissionBanner,
  NightSessionPanel,
} from '@/components/play/MissionPlayPanel';
import { PlayerRoster } from '@/components/play/PlayerRoster';
import { NicknameChangeModal } from '@/components/play/NicknameChangeModal';
import { Popup } from '@/components/play/Popup';
import { RoleCard } from '@/components/play/RoleCard';
import { RoleRevealAnimation } from '@/components/play/RoleRevealAnimation';
import { VoteResultModal } from '@/components/play/VoteResultModal';
import {
  isAvatarId,
  playerGenderFromAvatarId,
  takenAvatarIds,
  type AvatarId,
} from '@/lib/game/avatars';
import { isFirebaseConfigured } from '@/lib/firebase';
import { ROLE_LABELS } from '@/lib/game/roles';
import {
  alivePlayers,
  castVote,
  clearPlaySession,
  joinRoom,
  leaveRoom,
  loadPlaySession,
  peekRoom,
  playerList,
  savePlaySession,
  submitNicknameChangeRequest,
  subscribeRoom,
  type PlaySession,
} from '@/lib/game/room';
import { getMafiaAllies } from '@/lib/game/visibility';
import type { GameRoom, GameState, Player, Theme } from '@/types/game';

const STATE_LABELS: Record<GameState, string> = {
  WAITING: '대기 중',
  DAY_TALK: '낮 · 토론',
  DAY_MATCH: '낮 · 1:1 매칭',
  DAY_MISSION: '낮 · 미션',
  DAY_VOTE: '낮 · 투표',
  VOTE_RESULT: '낮 · 투표 결과',
  NIGHT: '밤',
  RESULT: '결과',
  ENDED: '종료',
};

function toBackgroundPhase(state: GameState | null | undefined): BackgroundPhase {
  if (!state || state === 'WAITING') return 'WAITING';
  if (state === 'NIGHT') return 'NIGHT';
  if (state === 'RESULT') return 'RESULT';
  return 'DAY';
}

/** PC에서도 모바일 비율로 보이는 중앙 카드 셸 + 테마/밤낮 배경 */
function PlayShell({
  children,
  theme = 'VILLAGE',
  phase = 'WAITING',
  playerCount = 0,
  panel = 'day',
}: {
  children: React.ReactNode;
  theme?: Theme;
  phase?: BackgroundPhase;
  playerCount?: number;
  panel?: 'join' | 'day' | 'night' | 'ghost';
}) {
  const panels = {
    join: 'bg-stone-950/72',
    day: 'bg-stone-950/68',
    night: 'bg-indigo-950/75',
    ghost: 'bg-violet-950/78',
  };

  return (
    <GameBackground
      theme={theme}
      gameState={phase}
      playerCount={phase === 'WAITING' ? Math.min(playerCount, 10) : 0}
      className="min-h-dvh"
    >
      <div className="flex min-h-dvh items-stretch justify-center px-3 py-4 sm:items-center sm:px-6 sm:py-8">
        <div
          className={`flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/15 ${panels[panel]} text-white shadow-2xl shadow-black/50 backdrop-blur-xl sm:min-h-[720px] sm:max-h-[900px]`}
        >
          <div className="flex flex-1 flex-col overflow-y-auto px-5 py-6 sm:px-6 sm:py-7">
            {children}
          </div>
        </div>
      </div>
    </GameBackground>
  );
}

function PlayPageInner() {
  const searchParams = useSearchParams();
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [session, setSession] = useState<PlaySession | null>(null);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [avatarId, setAvatarId] = useState<AvatarId | null>(null);
  const [lobbyRoom, setLobbyRoom] = useState<GameRoom | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [hintOpen, setHintOpen] = useState(false);
  const [policeOpen, setPoliceOpen] = useState(false);
  const [voteDeathOpen, setVoteDeathOpen] = useState(false);
  const [morningResultOpen, setMorningResultOpen] = useState(false);
  const [roleRevealOpen, setRoleRevealOpen] = useState(false);
  const [roleRevealComplete, setRoleRevealComplete] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('입장 실패');
  const [alertMessage, setAlertMessage] = useState('');
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const seenHintRef = useRef<string | null>(null);
  const seenPoliceRef = useRef<string | null>(null);
  const seenVoteDeathRef = useRef<number | null>(null);
  const seenMorningResultRef = useRef<string | null>(null);
  const seenRoleRevealRef = useRef<string | null>(null);
  const joinGuardRef = useRef(false);

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOpen(true);
    setError(message);
  };

  useEffect(() => {
    const q = searchParams.get('pin');
    if (q) setPin(q.replace(/\s/g, ''));
    const saved = loadPlaySession();
    if (saved) {
      setSession(saved);
      setPin(saved.pin || saved.roomId);
      if (saved.name) setName(saved.name);
    }
  }, [searchParams]);

  // PIN 입력 시 방 미리보기 (닉네임·사용중 캐릭터)
  useEffect(() => {
    if (session) return;
    const trimmed = pin.replace(/\s/g, '');
    if (trimmed.length < 4 || !isFirebaseConfigured()) {
      setLobbyRoom(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void peekRoom(trimmed).then((r) => {
        if (!cancelled) setLobbyRoom(r);
      });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [pin, session]);

  useEffect(() => {
    if (!session) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    const pin = session.pin || session.roomId;
    const playerId = session.playerId;

    try {
      unsub = subscribeRoom(pin, (remote) => {
        if (cancelled) return;
        if (!remote) {
          if (!joinGuardRef.current) {
            clearPlaySession();
            setSession(null);
            setRoom(null);
            showAlert('게임 종료', '선생님이 게임을 종료했거나 방이 닫혔습니다.');
          }
          return;
        }

        setRoom(remote);
        joinGuardRef.current = false;

        const players = remote.players ?? {};
        const remoteMe = players[playerId];
        if (!remoteMe) {
          // 구독 첫 스냅샷 레이스 대비: 잠시 후 재확인하지 않고 낙관적 me 유지
          return;
        }
        if (remoteMe.name) {
          setSession((prev) => {
            if (!prev || prev.name === remoteMe.name) return prev;
            const next = { ...prev, name: remoteMe.name };
            savePlaySession(next);
            return next;
          });
        }
      });
    } catch {
      showAlert(
        '입장 실패',
        'Firebase 연결에 실패했습니다. .env.local 설정을 확인하세요.',
      );
    }
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [session?.pin, session?.roomId, session?.playerId]);

  const me: Player | null = useMemo(() => {
    if (!session) return null;
    const fromRoom = room?.players?.[session.playerId];
    if (fromRoom) return fromRoom;
    // 입장 직후 / 구독 대기 중 낙관적 플레이어
    return {
      id: session.playerId,
      name: session.name || name || '학생',
      role: null,
      isAlive: true,
      nightTarget: null,
      partnerId: null,
      avatarId: avatarId ?? 'M0',
      gender: playerGenderFromAvatarId(avatarId ?? 'M0'),
    };
  }, [room, session, name, avatarId]);

  const morningEvents = useMemo(
    () => getMorningEvents(room?.nightResults),
    [room?.nightResults],
  );
  const morningActiveEvents = useMemo(
    () => getActiveMorningEvents(room?.nightResults),
    [room?.nightResults],
  );

  const lobbyTaken = useMemo(() => {
    const trimmed = name.trim();
    const mine =
      (lobbyRoom &&
        trimmed &&
        Object.values(lobbyRoom.players ?? {}).find((p) => p.name === trimmed)) ||
      null;
    return takenAvatarIds(lobbyRoom?.players, mine?.id);
  }, [lobbyRoom?.players, name]);

  // 재접속: 같은 닉네임이면 기존 캐릭터 자동 선택
  useEffect(() => {
    if (session || !lobbyRoom) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const mine = Object.values(lobbyRoom.players ?? {}).find(
      (p) => p.name === trimmed,
    );
    if (mine?.avatarId && isAvatarId(mine.avatarId)) {
      setAvatarId(mine.avatarId as AvatarId);
    }
  }, [name, lobbyRoom, session]);

  useEffect(() => {
    if (!room || !me?.isAlive) return;
    if (!room.currentHint) return;
    const fromQuiz =
      room.gameState === 'RESULT' &&
      room.nightResults?.quizOutcome === 'SUCCESS';
    const fromGm = room.gmEvent === 'HINT_BOOST';
    if ((fromQuiz || fromGm) && seenHintRef.current !== room.currentHint) {
      seenHintRef.current = room.currentHint;
      setHintOpen(true);
    }
  }, [
    room?.nightResults?.quizOutcome,
    room?.currentHint,
    room?.gmEvent,
    room?.gameState,
    room,
    me?.isAlive,
  ]);

  // 경찰 조사 — 경찰 역할에게만 팝업
  useEffect(() => {
    if (!room || !me || me.role !== 'POLICE') return;
    const report = room.nightResults?.policeReport;
    if (!report) return;
    const isMorning =
      room.gameState === 'RESULT' ||
      room.gameState === 'DAY_TALK' ||
      room.gameState === 'DAY_MATCH' ||
      room.gameState === 'DAY_MISSION' ||
      room.gameState === 'DAY_VOTE';
    const key = `${report.targetId}:${report.isMafia}:${report.wasTie}`;
    if (isMorning && seenPoliceRef.current !== key) {
      seenPoliceRef.current = key;
      setPoliceOpen(true);
    }
  }, [room?.nightResults?.policeReport, room?.gameState, room, me]);

  // 투표 탈락 공지 — 전원 팝업
  useEffect(() => {
    if (!room || !me) return;
    const result = room.dayVoteResult;
    if (!result?.announcement) return;
    if (seenVoteDeathRef.current === result.resolvedAt) return;
    seenVoteDeathRef.current = result.resolvedAt;
    setVoteDeathOpen(true);
  }, [room?.dayVoteResult, room, me]);

  // 아침 결과 공개 이벤트는 새 결과가 처음 도착한 순간 한 번만 보여 준다.
  useEffect(() => {
    if (
      !room ||
      !me ||
      room.gameState !== 'RESULT' ||
      (morningActiveEvents.length === 0 && morningEvents.length === 0)
    ) {
      if (room?.gameState !== 'RESULT') {
        seenMorningResultRef.current = null;
        setMorningResultOpen(false);
      }
      return;
    }
    const key = [
      room.roomId,
      room.currentRound,
      morningEvents.join(','),
      morningActiveEvents.map((e) => e.event).join(','),
      (room.nightResults?.deadPlayerIds ?? []).join(','),
    ].join('|');
    if (seenMorningResultRef.current === key) return;
    seenMorningResultRef.current = key;
    const timer = window.setTimeout(() => setMorningResultOpen(true), 350);
    return () => window.clearTimeout(timer);
  }, [
    room?.gameState,
    room?.nightResults,
    room,
    me,
    morningEvents,
    morningActiveEvents,
  ]);

  // 게임이 시작되어 역할이 처음 배정된 순간, 학생별 역할 공개 연출을 한 번만 보여 준다.
  useEffect(() => {
    if (!room || !me || room.gameState === 'WAITING' || !me.role) {
      if (room?.gameState === 'WAITING') {
        const resetTimer = window.setTimeout(() => {
          seenRoleRevealRef.current = null;
          setRoleRevealOpen(false);
          setRoleRevealComplete(false);
        }, 0);
        return () => window.clearTimeout(resetTimer);
      }
      return;
    }

    const key = `${room.roomId}:${me.id}:${me.role}`;
    if (seenRoleRevealRef.current === key) return;
    seenRoleRevealRef.current = key;

    const revealTimer = window.setTimeout(() => {
      setRoleRevealComplete(false);
      setRoleRevealOpen(true);
    }, 250);
    return () => window.clearTimeout(revealTimer);
  }, [room?.gameState, room?.roomId, me?.id, me?.role]);

  const handleJoin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (joining) return;
    setJoining(true);
    setError(null);
    setAlertOpen(false);

    if (!isFirebaseConfigured()) {
      showAlert(
        '입장 실패',
        'Firebase가 설정되지 않았습니다. 프로젝트 루트의 .env.local 에 실제 Firebase 키를 넣어 주세요.',
      );
      setJoining(false);
      return;
    }

    if (!avatarId) {
      showAlert('입장 실패', '캐릭터를 선택해 주세요.');
      setJoining(false);
      return;
    }

    try {
      joinGuardRef.current = true;
      const result = await joinRoom(pin, name, avatarId);
      setRoom(result.room);
      setSession(result.session);
      setName(result.session.name);
    } catch (err) {
      joinGuardRef.current = false;
      const message =
        err instanceof Error ? err.message : '입장 실패';
      const title = message.includes('존재하지 않는')
        ? '존재하지 않는 방 코드입니다'
        : message.includes('이미 다른 학생이 선택한 캐릭터')
          ? '캐릭터 선점 실패'
          : '입장 실패';
      showAlert(title, message);
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveGame = async () => {
    if (!session || leaving) return;
    setLeaving(true);
    try {
      await leaveRoom(session.pin || session.roomId, session.playerId);
    } catch (err) {
      console.warn('leaveRoom failed', err);
    }
    clearPlaySession();
    setSession(null);
    setRoom(null);
    setLeaveConfirmOpen(false);
    setLeaving(false);
    setPin('');
    setName('');
    setAvatarId(null);
  };

  const partner = useMemo(() => {
    if (!me?.partnerId || !room) return null;
    return room.players?.[me.partnerId] ?? null;
  }, [me, room]);

  const mafiaAllies = useMemo(() => {
    if (!room || !me || me.role !== 'MAFIA') return [];
    return getMafiaAllies(room, me);
  }, [room, me]);

  // 미입장: 로그인 폼
  if (!session) {
    return (
      <PlayShell
        theme={lobbyRoom?.theme ?? 'VILLAGE'}
        phase="WAITING"
        playerCount={lobbyRoom ? playerList(lobbyRoom).length : 0}
        panel="join"
      >
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400/90">
          X-Mafia
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">학생 입장</h1>
        <p className="mt-2 text-sm text-white/60">
          선생님 화면의 PIN 또는 QR로 접속하세요. 튕겼다면{' '}
          <span className="font-semibold text-amber-200/90">같은 닉네임</span>으로
          다시 들어오면 직업이 유지됩니다.
        </p>

        <form onSubmit={(e) => void handleJoin(e)} className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-white/50">
              PIN 코드
            </span>
            <input
              name="pin"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, '');
                setPin(next);
                if (next.length >= 6) {
                  nameInputRef.current?.focus();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  nameInputRef.current?.focus();
                }
              }}
              placeholder="123456"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-mono text-2xl tracking-[0.3em] text-white outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
              required
            />
          </label>

          {lobbyRoom && (
            <PlayerRoster room={lobbyRoom} compact title="이미 입장한 친구" collapsible />
          )}

          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-white/50">
              이름 (닉네임)
            </span>
            <input
              ref={nameInputRef}
              name="name"
              autoComplete="nickname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              maxLength={12}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base text-white outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
              required
            />
          </label>

          <div>
            <span className="mb-2 block text-xs font-semibold text-white/50">
              학생 캐릭터 선택 (성별 → 큰 화면에서 고르기 · 선착순 · 중복 불가)
            </span>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <AvatarPickerGrid
                selectedId={avatarId}
                takenIds={lobbyTaken}
                onSelect={setAvatarId}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-red-950/70 px-4 py-3 text-sm text-red-100">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={
              joining ||
              pin.length < 4 ||
              name.trim().length < 1 ||
              !avatarId
            }
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-4 text-base font-black text-stone-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogIn className="h-5 w-5" />
            {joining ? '접속 중…' : '입장'}
          </button>
        </form>

        <Popup
          open={alertOpen}
          title={alertTitle}
          accent="red"
          onClose={() => setAlertOpen(false)}
        >
          <p>{alertMessage}</p>
        </Popup>
      </PlayShell>
    );
  }

  // 세션은 있으나 룸 동기화 전 — 대기 UI
  if (!room || !me) {
    return (
      <PlayShell theme="VILLAGE" phase="WAITING" panel="join">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400/90">
          X-Mafia
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">입장 중…</h1>
        <p className="mt-3 text-sm text-white/60">방 정보를 불러오는 중입니다.</p>
        <button
          type="button"
          className="mt-8 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold"
          onClick={() => setLeaveConfirmOpen(true)}
        >
          다시 입장하기
        </button>
        <Popup
          open={leaveConfirmOpen}
          title="게임 종료"
          accent="red"
          onClose={() => setLeaveConfirmOpen(false)}
          onConfirm={() => void handleLeaveGame()}
          confirmLabel={leaving ? '종료 중…' : '정말 종료'}
          cancelLabel="취소"
          confirmDisabled={leaving}
        >
          <p>정말 게임을 종료하시겠습니까?</p>
          <p className="mt-2 text-white/60">
            본인만 게임에서 나가며, 다른 학생들의 게임은 계속 진행됩니다.
          </p>
        </Popup>
      </PlayShell>
    );
  }

  const isNight = room.gameState === 'NIGHT';
  const isVote = room.gameState === 'DAY_VOTE';
  const isGhost = !me.isAlive;
  const shellPanel = isGhost ? 'ghost' : isNight ? 'night' : 'day';
  const aliveCount = alivePlayers(room).length;
  const totalCount = playerList(room).length;
  const bgPhase = toBackgroundPhase(room.gameState);

  return (
    <PlayShell
      theme={room.theme}
      phase={bgPhase}
      playerCount={totalCount}
      panel={shellPanel}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CharacterAvatar
            avatarId={me.avatarId}
            isAlive={me.isAlive}
            state={me.isAlive ? null : 'dead'}
            size={48}
            previewOnHover
            role={me.role}
            viewerRole={me.role}
            targetPlayerId={me.id}
            viewerPlayerId={me.id}
          />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
              X-Mafia
            </p>
            <p className="text-lg font-black">{me.name}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
            {isNight ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            {STATE_LABELS[room.gameState]}
          </span>
          {room.gameState !== 'WAITING' && (
            <p className="mt-1.5 font-mono text-xs font-black tracking-wider text-amber-300">
              ROUND {Math.max(room.currentRound, 0)} / {room.maxRounds}
            </p>
          )}
          <p className="mt-1.5 text-xs font-bold text-emerald-300/90">
            생존 {aliveCount}/{totalCount}명
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-white/40">PIN {room.pin}</p>
          <button
            type="button"
            onClick={() => setLeaveConfirmOpen(true)}
            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-red-500/20 px-2.5 py-1 text-[11px] font-bold text-red-200 ring-1 ring-red-400/30 transition hover:bg-red-500/30"
          >
            <Power className="h-3 w-3" />
            게임 종료
          </button>
        </div>
      </header>

      <main className="mt-6 flex flex-1 flex-col space-y-5">
        {room.gameState === 'ENDED' ? (
          <GameResultPanel
            winnerSide={room.winnerSide ?? room.victoryTeam}
            players={room.players}
            currentPlayerId={me.id}
            round={room.currentRound}
            maxRounds={room.maxRounds}
            voteEliminatedPlayerId={room.dayVoteResult?.eliminatedPlayerId}
            mafiaEliminatedPlayerIds={room.nightResults?.deadPlayerIds}
          />
        ) : (
          <>
            <PlayerRoster
              room={room}
              highlightId={me.id}
              compact
              viewer={me}
              collapsible
              defaultCollapsed
            />

            {me.isAlive &&
              me.role === 'MAFIA' &&
              room.gameState !== 'WAITING' &&
              room.mafiaChatEnabled !== false && (
                <MafiaChatPanel room={room} me={me} pin={session.pin} />
              )}

            {isGhost ? (
              <GhostMode room={room} me={me} pin={session.pin} />
            ) : (
              <>
            <AnimatePresence mode="wait">
              {me.role && room.gameState !== 'WAITING' ? (
                <motion.div
                  key="role"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full py-2"
                >
                  <RoleCard
                    role={me.role}
                    avatarId={me.avatarId}
                    isAlive={me.isAlive}
                    revealed={roleRevealComplete}
                    nightQuiz={room.nightQuizState}
                    mafiaMission={room.mafiaMissionState}
                    mafiaAllies={mafiaAllies}
                    playerId={me.id}
                    viewerRole={me.role}
                    viewerPlayerId={me.id}
                  />
                </motion.div>
              ) : (
                <motion.section
                  key="waiting-role"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl bg-white/5 p-6 text-center ring-1 ring-white/10"
                >
                  <CharacterAvatar
                    avatarId={me.avatarId}
                    isAlive
                    size={72}
                    className="mx-auto"
                  />
                  <p className="mt-3 text-base font-bold">대기 중</p>
                  <p className="mt-2 text-sm text-white/60">
                    선생님이 게임을 시작하면 비밀 직업이 공개됩니다.
                  </p>
                  <p className="mt-4 text-xs text-white/40">
                    현재 {totalCount}명 입장 · 생존 {aliveCount}명
                  </p>
                </motion.section>
              )}
            </AnimatePresence>

            {room.gameState === 'DAY_MATCH' && (
              <>
                <section className="rounded-2xl bg-amber-500/15 p-4 ring-1 ring-amber-400/30">
                  <h3 className="text-sm font-black text-amber-100">1:1 매칭</h3>
                  <p className="mt-1 text-sm text-white/85">
                    파트너:{' '}
                    <span className="font-bold text-white">
                      {partner?.name ?? '대기 (홀수 인원)'}
                    </span>
                  </p>
                  {!partner && (
                    <p className="mt-2 text-xs text-white/50">
                      홀수 인원이라 파트너가 없습니다. 잠시 기다려 주세요.
                    </p>
                  )}
                </section>
                {partner && (
                  <MatchChatPanel
                    room={room}
                    me={me}
                    partner={partner}
                    pin={session.pin}
                  />
                )}
              </>
            )}

            {me.isAlive && (
              <DayMafiaMissionBanner room={room} me={me} />
            )}

            {isVote && <VotePanel room={room} me={me} pin={session.pin} />}

            {room.gameState === 'RESULT' && (
              <MorningPanel room={room} me={me} pin={session.pin} />
            )}

            {isNight && me.isAlive && (
              <NightSessionPanel room={room} me={me} pin={session.pin} />
            )}

            {room.gameState === 'DAY_TALK' && me.role && (
              <section className="rounded-2xl bg-white/5 p-5 text-sm text-white/75 ring-1 ring-white/10">
                토론 시간입니다. 직업을 들키지 않도록 주의하세요.
                {me.role === 'MAFIA' && room.pendingMafiaNightBuff && (
                  <span className="mt-3 block font-semibold text-red-300">
                    미션 보상 — 다음 밤에 각자 1명을 공격할 수 있습니다.
                  </span>
                )}
                {me.role === 'MAFIA' && room.isMafiaBuffActive && (
                  <span className="mt-3 block font-semibold text-red-300">
                    멀티킬 버프가 이번 밤에 적용됩니다.
                  </span>
                )}
              </section>
            )}
              </>
            )}
          </>
        )}
      </main>

      <RoleRevealAnimation
        open={roleRevealOpen && Boolean(me.role)}
        role={me.role ?? 'CITIZEN'}
        avatarId={me.avatarId}
        playerName={me.name}
        onClose={() => {
          setRoleRevealComplete(true);
          setRoleRevealOpen(false);
        }}
      />

      <Popup
        open={hintOpen}
        title="마피아 힌트 입수"
        accent="amber"
        onClose={() => setHintOpen(false)}
      >
        <p className="font-medium text-amber-100">{room.currentHint}</p>
        <p className="mt-2 text-xs text-white/50">
          시민 미션 성공 보상입니다. 힌트를 팀과 공유하세요.
        </p>
      </Popup>

      {room.nicknameChangeRequest?.playerId === me.id && (
        <NicknameChangeModal
          open={room.gameState === 'WAITING'}
          room={room}
          playerId={me.id}
          request={room.nicknameChangeRequest}
          onSubmit={async (nextName) => {
            await submitNicknameChangeRequest(session.pin, me.id, nextName);
            const nextSession = { ...session, name: nextName };
            savePlaySession(nextSession);
            setSession(nextSession);
          }}
        />
      )}

      <Popup
        open={policeOpen && me.role === 'POLICE'}
        title="경찰 조사 결과 · 비밀"
        accent="violet"
        onClose={() => setPoliceOpen(false)}
      >
        {room.nightResults?.policeReport ? (
          <>
            <p className="text-base font-bold leading-snug">
              {room.nightResults.policeReport.targetName} 님은{' '}
              {room.nightResults.policeReport.isMafia
                ? '마피아입니다. (O)'
                : '마피아가 아닙니다. (X)'}
            </p>
            {room.nightResults.policeReport.wasTie && (
              <p className="mt-2 text-xs text-amber-200/80">
                경찰 지목이 동률이어서 시스템이 무작위로 한 명을 조사했습니다.
              </p>
            )}
            <p className="mt-2 text-xs text-white/50">
              경찰과 교사만 볼 수 있습니다. 다른 학생에게 말하지 마세요.
            </p>
          </>
        ) : (
          <p>조사 결과가 없습니다.</p>
        )}
      </Popup>

      <VoteResultModal
        open={voteDeathOpen}
        result={room.dayVoteResult}
        eliminatedPlayer={
          room.dayVoteResult?.eliminatedPlayerId
            ? room.players[room.dayVoteResult.eliminatedPlayerId]
            : null
        }
        revealRoles={room.revealDeathRoles !== false}
        onClose={() => setVoteDeathOpen(false)}
      />

      <Popup
        open={alertOpen}
        title={alertTitle}
        accent="red"
        onClose={() => setAlertOpen(false)}
      >
        <p>{alertMessage}</p>
      </Popup>

      {morningResultOpen && (
        <MorningSequenceModal
          open={morningResultOpen}
          events={morningEvents}
          activeEvents={morningActiveEvents}
          result={room.nightResults}
          players={room.players}
          revealRoles={room.revealDeathRoles !== false}
          onClose={() => setMorningResultOpen(false)}
        />
      )}

      <Popup
        open={leaveConfirmOpen}
        title="게임 종료"
        accent="red"
        onClose={() => !leaving && setLeaveConfirmOpen(false)}
        onConfirm={() => void handleLeaveGame()}
        confirmLabel={leaving ? '종료 중…' : '정말 종료'}
        cancelLabel="취소"
        confirmDisabled={leaving}
      >
        <p>정말 게임을 종료하시겠습니까?</p>
        <p className="mt-2 text-white/60">
          본인만 게임에서 나가며, 다른 학생들의 게임은 계속 진행됩니다.
        </p>
      </Popup>
    </PlayShell>
  );
}

function VotePanel({
  room,
  me,
  pin,
}: {
  room: GameRoom;
  me: Player;
  pin: string;
}) {
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const revoteIds = room.voteRevoteCandidates;
  const targets = alivePlayers(room)
    .filter((p) => p.id !== me.id)
    .filter((p) => !revoteIds || revoteIds.includes(p.id));
  const myVote = room.votes?.[me.id] ?? null;
  const mafiaAllyIds =
    me.role === 'MAFIA'
      ? new Set(getMafiaAllies(room, me).map((p) => p.id))
      : new Set<string>();
  const remainSec = room.voteEndsAt
    ? Math.max(0, Math.ceil((room.voteEndsAt - now) / 1000))
    : 0;
  const closed = Boolean(room.voteEndsAt && now >= room.voteEndsAt);

  useEffect(() => {
    if (!room.voteEndsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [room.voteEndsAt]);

  const vote = async (targetId: string) => {
    if (closed) return;
    setBusy(true);
    try {
      await castVote(pin, me.id, targetId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl bg-stone-900/70 p-5 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-black">
          <Vote className="h-4 w-4 text-amber-300" />
          투표
        </h3>
        <span
          className={`rounded-full px-3 py-1 font-mono text-sm font-black tabular-nums ${
            remainSec <= 5
              ? 'bg-red-500/25 text-red-200'
              : 'bg-amber-400/20 text-amber-200'
          }`}
        >
          {remainSec}초
        </span>
      </div>
      <p className="mt-1 text-xs text-white/50">
        {closed
          ? '투표가 마감되었습니다. 결과를 기다려 주세요.'
          : revoteIds
            ? `동률 재투표 — ${revoteIds
                .map((id) => room.players[id]?.name ?? '?')
                .join(', ')} 중 선택 (15초)`
            : '의심되는 사람을 선택하세요 (제한 15초)'}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {targets.map((p) => {
          const isAlly = mafiaAllyIds.has(p.id);
          return (
          <button
            key={p.id}
            type="button"
            disabled={busy || closed}
            onClick={() => void vote(p.id)}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-3 py-4 text-sm font-bold transition hover:brightness-110 disabled:opacity-40 ${
              myVote === p.id
                ? 'bg-amber-400 text-stone-900'
                : isAlly
                  ? 'bg-red-950/50 text-white ring-1 ring-red-400/40'
                  : 'bg-white/10 text-white'
            }`}
          >
            <CharacterAvatar
              avatarId={p.avatarId}
              isAlive
              size={32}
              previewOnHover
            />
            <span className="truncate">{p.name}</span>
            {isAlly && (
              <span className="shrink-0 rounded bg-red-500 px-1 py-0.5 text-[9px] font-black text-white">
                [마피아]
              </span>
            )}
          </button>
          );
        })}
      </div>
    </section>
  );
}

function MorningPanel({
  room,
  me,
  pin,
}: {
  room: GameRoom;
  me: Player;
  pin: string;
}) {
  const [busy, setBusy] = useState(false);
  const deadIds = room.nightResults?.deadPlayerIds ?? [];
  const deadRoles = room.nightResults?.deadRoles ?? {};
  const deathAnnouncements = room.nightResults?.deathAnnouncements ?? [];
  const reveal = room.revealDeathRoles !== false;
  const reviveOpen = room.gmEvent === 'REVIVE_NIGHT' && deadIds.length > 0 && me.isAlive;
  const myVote = room.votes?.[me.id] ?? null;

  const voteRevive = async (targetId: string) => {
    setBusy(true);
    try {
      await castVote(pin, me.id, targetId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl bg-stone-900/70 p-5 ring-1 ring-white/10">
      <h3 className="text-sm font-black text-amber-100">아침 결과</h3>
      {room.nightResults?.quizOutcome &&
        room.nightResults.quizOutcome !== 'PENDING' && (
          <div className="rounded-xl bg-indigo-950/50 px-3 py-2 text-xs ring-1 ring-indigo-400/30">
            <p className="font-bold text-indigo-100">
              밤 퀴즈{' '}
              {room.nightResults.quizOutcome === 'SUCCESS' ? '성공' : '실패'}
              {room.nightResults.quizSuccessRate != null
                ? ` · ${room.nightResults.quizSuccessRate}%`
                : ''}
            </p>
            {room.nightResults.quizHint && (
              <p className="mt-1 text-sm text-amber-100">
                힌트: {room.nightResults.quizHint}
              </p>
            )}
          </div>
        )}
      {deadIds.length === 0 ? (
        <p className="text-sm text-emerald-200">지난밤 희생자 없음</p>
      ) : (
        <>
          <ul className="space-y-2">
            {deadIds.map((id) => {
              const role = deadRoles[id] ?? (reveal ? room.players[id]?.role : null);
              return (
                <li
                  key={id}
                  className="flex items-center justify-between rounded-xl bg-red-950/40 px-4 py-3 text-sm"
                >
                  <span className="font-bold">
                    {room.players[id]?.name ?? '???'}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-black ${
                      role
                        ? 'bg-amber-400/90 text-stone-900'
                        : 'font-mono text-white/45'
                    }`}
                  >
                    {role ? ROLE_LABELS[role] : '???'}
                  </span>
                </li>
              );
            })}
          </ul>
          {deathAnnouncements.map((line) => (
            <p
              key={line}
              className="rounded-xl bg-black/30 px-3 py-2 text-xs font-semibold text-white/85"
            >
              {line}
            </p>
          ))}
        </>
      )}

      {reviveOpen && (
        <div className="rounded-xl bg-violet-950/50 p-4 ring-1 ring-violet-400/30">
          <p className="text-xs font-bold text-violet-100">기회의 밤 · 부활 투표</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {deadIds.map((id) => (
              <button
                key={id}
                type="button"
                disabled={busy}
                onClick={() => void voteRevive(id)}
                className={`min-h-14 rounded-xl px-4 py-4 text-sm font-bold ${
                  myVote === id
                    ? 'bg-violet-500 text-white'
                    : 'bg-white/10 text-white'
                }`}
              >
                {room.players[id]?.name ?? '???'}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-stone-950 text-white">
          로딩 중…
        </div>
      }
    >
      <PlayPageInner />
    </Suspense>
  );
}
