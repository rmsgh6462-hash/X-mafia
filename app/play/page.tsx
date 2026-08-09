'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { LogIn, Moon, Sun, Vote } from 'lucide-react';
import { AvatarPickerGrid } from '@/components/play/AvatarPicker';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { GhostMode } from '@/components/play/GhostMode';
import { MatchChatPanel } from '@/components/play/MatchChatPanel';
import { NightPanel } from '@/components/play/NightPanel';
import { PlayerRoster } from '@/components/play/PlayerRoster';
import { Popup } from '@/components/play/Popup';
import { RoleCard } from '@/components/play/RoleCard';
import { takenAvatarIds, type AvatarId } from '@/lib/game/avatars';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  alivePlayers,
  castVote,
  clearPlaySession,
  joinRoom,
  loadPlaySession,
  peekRoom,
  playerList,
  subscribeRoom,
  type PlaySession,
} from '@/lib/game/room';
import type { GameRoom, GameState, Player } from '@/types/game';

const STATE_LABELS: Record<GameState, string> = {
  WAITING: '대기 중',
  DAY_TALK: '낮 · 토론',
  DAY_MATCH: '낮 · 1:1 매칭',
  DAY_MISSION: '낮 · 미션',
  DAY_VOTE: '낮 · 투표',
  NIGHT: '밤',
  RESULT: '결과',
};

/** PC에서도 모바일 비율로 보이는 중앙 카드 셸 */
function PlayShell({
  children,
  tone = 'day',
}: {
  children: React.ReactNode;
  tone?: 'join' | 'day' | 'night' | 'ghost';
}) {
  const tones = {
    join: 'from-stone-900 via-stone-950 to-black',
    day: 'from-amber-950/90 via-stone-950 to-black',
    night: 'from-indigo-950 via-stone-950 to-black',
    ghost: 'from-violet-950 via-stone-950 to-black',
  };

  return (
    <div className="flex min-h-dvh items-stretch justify-center bg-stone-950 px-3 py-4 sm:items-center sm:px-6 sm:py-8">
      <div
        className={`flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b ${tones[tone]} text-white shadow-2xl shadow-black/50 sm:min-h-[720px] sm:max-h-[900px]`}
      >
        <div className="flex flex-1 flex-col overflow-y-auto px-5 py-6 sm:px-6 sm:py-7">
          {children}
        </div>
      </div>
    </div>
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
  const [newsOpen, setNewsOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('입장 실패');
  const [alertMessage, setAlertMessage] = useState('');
  const seenHintRef = useRef<string | null>(null);
  const seenNewsRef = useRef<string | null>(null);
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

    try {
      unsub = subscribeRoom(session.pin || session.roomId, (remote) => {
        if (cancelled) return;
        if (!remote) {
          // 방 삭제/미존재 — 직후 입장 레이스면 무시, 그 외 알림
          if (!joinGuardRef.current) {
            showAlert('입장 실패', '존재하지 않는 방 코드입니다');
            clearPlaySession();
            setSession(null);
            setRoom(null);
          }
          return;
        }

        setRoom(remote);
        joinGuardRef.current = false;

        const players = remote.players ?? {};
        if (!players[session.playerId]) {
          // 구독 첫 스냅샷 레이스 대비: 잠시 후 재확인하지 않고 낙관적 me 유지
          return;
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
  }, [session]);

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
    };
  }, [room, session, name, avatarId]);

  const lobbyTaken = useMemo(
    () => takenAvatarIds(lobbyRoom?.players),
    [lobbyRoom?.players],
  );

  useEffect(() => {
    if (!room || !me?.isAlive) return;
    if (!room.currentHint) return;
    const fromMission = room.missionOutcome === 'SUCCESS';
    const fromGm = room.gmEvent === 'HINT_BOOST';
    if ((fromMission || fromGm) && seenHintRef.current !== room.currentHint) {
      seenHintRef.current = room.currentHint;
      setHintOpen(true);
    }
  }, [room?.missionOutcome, room?.currentHint, room?.gmEvent, room, me?.isAlive]);

  useEffect(() => {
    if (!room || !me) return;
    const news = room.nightResults?.reporterNews;
    const isMorning =
      room.gameState === 'RESULT' ||
      room.gameState === 'DAY_TALK' ||
      room.gameState === 'DAY_MATCH' ||
      room.gameState === 'DAY_MISSION' ||
      room.gameState === 'DAY_VOTE';
    if (news && isMorning && seenNewsRef.current !== news) {
      seenNewsRef.current = news;
      setNewsOpen(true);
    }
  }, [room?.nightResults?.reporterNews, room?.gameState, room, me]);

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
        : '입장 실패';
      showAlert(title, message);
    } finally {
      setJoining(false);
    }
  };

  const partner = useMemo(() => {
    if (!me?.partnerId || !room) return null;
    return room.players?.[me.partnerId] ?? null;
  }, [me, room]);

  // 미입장: 로그인 폼
  if (!session) {
    return (
      <PlayShell tone="join">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400/90">
          X-Mafia
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">학생 입장</h1>
        <p className="mt-2 text-sm text-white/60">
          선생님 화면의 PIN 또는 QR로 접속하세요.
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
            <PlayerRoster room={lobbyRoom} compact title="이미 입장한 친구" />
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
              내 캐릭터 선택 (중복 불가 · 남 16 / 여 16)
            </span>
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3">
              <AvatarPickerGrid
                selectedId={avatarId}
                takenIds={lobbyTaken}
                onSelect={setAvatarId}
              />
            </div>
            {avatarId && (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
                <CharacterAvatar avatarId={avatarId} size={40} />
                <span className="text-sm text-white/70">선택됨</span>
              </div>
            )}
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
      <PlayShell tone="join">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400/90">
          X-Mafia
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">입장 중…</h1>
        <p className="mt-3 text-sm text-white/60">방 정보를 불러오는 중입니다.</p>
        <button
          type="button"
          className="mt-8 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold"
          onClick={() => {
            clearPlaySession();
            setSession(null);
            setRoom(null);
          }}
        >
          다시 입장하기
        </button>
      </PlayShell>
    );
  }

  const isNight = room.gameState === 'NIGHT';
  const isVote = room.gameState === 'DAY_VOTE';
  const isMission = room.gameState === 'DAY_MISSION';
  const isGhost = !me.isAlive;
  const shellTone = isGhost ? 'ghost' : isNight ? 'night' : 'day';
  const aliveCount = alivePlayers(room).length;
  const totalCount = playerList(room).length;

  return (
    <PlayShell tone={shellTone}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CharacterAvatar
            avatarId={me.avatarId}
            isAlive={me.isAlive}
            size={48}
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
          <p className="mt-1.5 text-xs font-bold text-emerald-300/90">
            생존 {aliveCount}/{totalCount}명
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-white/40">PIN {room.pin}</p>
        </div>
      </header>

      <main className="mt-6 flex flex-1 flex-col space-y-5">
        <PlayerRoster room={room} highlightId={me.id} compact />

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
                  className="flex flex-col items-center py-2"
                >
                  <RoleCard
                    role={me.role}
                    citizenMission={room.currentCitizenMission}
                    mafiaMission={room.mafiaMission}
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

            {isMission && room.currentCitizenMission && (
              <section className="rounded-2xl bg-sky-950/50 p-5 ring-1 ring-sky-400/25">
                <h3 className="text-sm font-black text-sky-100">낮 미션 수신</h3>
                <p className="mt-3 text-base font-bold leading-snug">
                  {room.currentCitizenMission.description}
                </p>
                <p className="mt-3 text-xs text-sky-100/70">
                  제한 {room.currentCitizenMission.timeLimitSec}초 · 성공 시 마피아
                  힌트 공개
                </p>
                {me.role === 'MAFIA' && room.mafiaMission && (
                  <p className="mt-4 rounded-xl bg-red-950/60 px-4 py-3 text-xs text-red-100 ring-1 ring-red-400/30">
                    X맨 비밀 미션: {room.mafiaMission.description}
                  </p>
                )}
              </section>
            )}

            {isVote && <VotePanel room={room} me={me} pin={session.pin} />}

            {room.gameState === 'RESULT' && (
              <MorningPanel room={room} me={me} pin={session.pin} />
            )}

            {isNight && me.role && (
              <NightPanel room={room} me={me} pin={session.pin} />
            )}

            {room.gameState === 'DAY_TALK' && me.role && (
              <section className="rounded-2xl bg-white/5 p-5 text-sm text-white/75 ring-1 ring-white/10">
                토론 시간입니다. 직업을 들키지 않도록 주의하세요.
                {me.role === 'MAFIA' && room.isMafiaBuffActive && (
                  <span className="mt-3 block font-semibold text-red-300">
                    멀티킬 보상 활성 — 밤에는 각자 독립 지목합니다.
                  </span>
                )}
              </section>
            )}
          </>
        )}
      </main>

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

      <Popup
        open={newsOpen}
        title="속보"
        accent="blue"
        onClose={() => setNewsOpen(false)}
      >
        <p className="text-base font-bold leading-snug">
          {room.nightResults?.reporterNews}
        </p>
        <p className="mt-2 text-xs text-white/50">기자 취재 결과 · 아침 방송</p>
      </Popup>

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
  const targets = alivePlayers(room).filter((p) => p.id !== me.id);
  const myVote = room.votes?.[me.id] ?? null;
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
          : '의심되는 사람을 선택하세요 (제한 15초)'}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {targets.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={busy || closed}
            onClick={() => void vote(p.id)}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-3 py-4 text-sm font-bold transition hover:brightness-110 disabled:opacity-40 ${
              myVote === p.id
                ? 'bg-amber-400 text-stone-900'
                : 'bg-white/10 text-white'
            }`}
          >
            <CharacterAvatar avatarId={p.avatarId} isAlive size={32} />
            <span className="truncate">{p.name}</span>
          </button>
        ))}
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
      {deadIds.length === 0 ? (
        <p className="text-sm text-emerald-200">지난밤 희생자 없음</p>
      ) : (
        <ul className="space-y-2">
          {deadIds.map((id) => (
            <li
              key={id}
              className="flex items-center justify-between rounded-xl bg-red-950/40 px-4 py-3 text-sm"
            >
              <span className="font-bold">{room.players[id]?.name ?? '???'}</span>
              <span className="font-mono text-xs text-white/45">???</span>
            </li>
          ))}
        </ul>
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
