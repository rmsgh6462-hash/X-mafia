'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  Ghost,
  MessageSquare,
  Send,
  Shield,
  Stethoscope,
  Target,
  Users,
  Vote,
} from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { getNightQuizStats, mafiaMissionLabel } from '@/lib/game/missions';
import { ROLE_ACCENTS, ROLE_LABELS } from '@/lib/game/roles';
import {
  alivePlayers,
  castGhostPrediction,
  listGhostChatMessages,
  playerList,
  sendGhostChat,
} from '@/lib/game/room';
import type {
  GameRoom,
  GameState,
  GhostChatMessage,
  Player,
  Role,
  WinnerSide,
} from '@/types/game';

type GhostTab = 'overview' | 'night' | 'mission' | 'vote' | 'chat';

const STATE_LABELS: Record<GameState, string> = {
  WAITING: '대기 중',
  DAY_TALK: '낮 · 토론',
  DAY_MATCH: '낮 · 1:1 매칭',
  DAY_MISSION: '낮 · 미션',
  DAY_VOTE: '낮 · 투표',
  NIGHT: '밤',
  RESULT: '아침 결과',
  ENDED: '종료',
};

const NIGHT_ROLES: Role[] = [
  'MAFIA',
  'DOCTOR',
  'POLICE',
  'REPORTER',
  'SPIRITUALIST',
];

export function GhostMode({
  room,
  me,
  pin,
}: {
  room: GameRoom;
  me: Player;
  pin: string;
}) {
  const [tab, setTab] = useState<GhostTab>('overview');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const players = useMemo(() => playerList(room), [room]);
  const alive = useMemo(() => alivePlayers(room), [room]);
  const quizStats = useMemo(() => getNightQuizStats(room), [room]);

  const messages = useMemo(() => listGhostChatMessages(room), [room]);

  const predictions = room.ghostPredictions ?? {};
  const myPrediction = predictions[me.id] ?? null;
  const tally = useMemo(() => {
    const values = Object.values(predictions);
    return {
      CITIZEN: values.filter((v) => v === 'CITIZEN').length,
      MAFIA: values.filter((v) => v === 'MAFIA').length,
    };
  }, [predictions]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || me.isAlive) return;
    setSending(true);
    try {
      await sendGhostChat(pin, {
        senderId: me.id,
        senderName: me.name,
        text: trimmed,
      });
      setText('');
    } finally {
      setSending(false);
    }
  };

  const predict = async (side: WinnerSide) => {
    await castGhostPrediction(pin, me.id, side);
  };

  return (
    <div className="space-y-3">
      {/* 경고 배너 */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-700 to-fuchsia-900 px-4 py-3 ring-2 ring-violet-300/50 shadow-lg shadow-violet-950/40">
        <p className="flex items-start gap-2 text-sm font-black leading-snug text-white">
          <Ghost className="mt-0.5 h-5 w-5 shrink-0 text-violet-100" />
          <span>
            👻 유령 전용 관전 모드 (다른 생존자에게 비밀을 유설하지 마세요!)
          </span>
        </p>
        <p className="mt-1.5 pl-7 text-[11px] font-medium text-violet-100/80">
          전지적 시점 · 실시간 Firebase 동기화 · 생존자 화면에는 보이지 않음
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-xl bg-black/40 px-3 py-2 text-xs">
        <span className="font-bold text-white/70">
          {STATE_LABELS[room.gameState]}
        </span>
        <span className="font-semibold text-emerald-300/90">
          생존 {alive.length}/{players.length}
        </span>
      </div>

      {/* 탭 */}
      <div className="grid grid-cols-5 gap-1 rounded-xl bg-black/35 p-1">
        {(
          [
            ['overview', '직업', Users],
            ['night', '밤', Crosshair],
            ['mission', '미션', Target],
            ['vote', '투표', Vote],
            ['chat', '채팅', MessageSquare],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] font-bold transition ${
              tab === id
                ? 'bg-violet-500 text-white'
                : 'text-white/55 hover:bg-white/5'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <RolesBoard players={players} />}
      {tab === 'night' && <NightSpectatePanel room={room} me={me} />}
      {tab === 'mission' && (
        <MissionSpectatePanel room={room} stats={quizStats} />
      )}
      {tab === 'vote' && <VoteSpectatePanel room={room} />}
      {tab === 'chat' && (
        <GhostChatPanel
          me={me}
          messages={messages}
          text={text}
          setText={setText}
          sending={sending}
          onSend={() => void handleSend()}
          myPrediction={myPrediction}
          tally={tally}
          onPredict={(side) => void predict(side)}
        />
      )}
    </div>
  );
}

function RolesBoard({ players }: { players: Player[] }) {
  const sorted = [...players].sort((a, b) => {
    if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
    return a.name.localeCompare(b.name, 'ko');
  });

  return (
    <section className="rounded-2xl bg-black/35 p-3 ring-1 ring-white/10">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/50">
        <Users className="h-3.5 w-3.5" />
        전체 직업 · 생존 현황
      </h3>
      <ul className="max-h-80 space-y-1.5 overflow-y-auto">
        {sorted.map((p) => {
          const role = p.role;
          const accent = role ? ROLE_ACCENTS[role] : '#666';
          return (
            <li
              key={p.id}
              className="flex items-center gap-2.5 rounded-xl bg-white/5 px-2.5 py-2"
            >
              <CharacterAvatar
                avatarId={p.avatarId}
                isAlive={p.isAlive}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm font-bold ${
                    p.isAlive ? 'text-white' : 'text-white/40 line-through'
                  }`}
                >
                  {p.name}
                </p>
                <p className="text-[10px] text-white/45">
                  {p.isAlive ? '생존' : '탈락 · 유령'}
                </p>
              </div>
              <span
                className="shrink-0 rounded-md px-2 py-1 text-[11px] font-black text-white"
                style={{ backgroundColor: `${accent}cc` }}
              >
                {role ? ROLE_LABELS[role] : '???'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function nameOf(room: GameRoom, id: string | null | undefined): string {
  if (!id) return '미지정';
  return room.players[id]?.name ?? '???';
}

function NightSpectatePanel({
  room,
  me,
}: {
  room: GameRoom;
  me: Player;
}) {
  const isNight = room.gameState === 'NIGHT';
  const silenced = room.gmEvent === 'SILENCE_NIGHT';
  const nightResults = room.nightResults;
  const canSeePolice = me.role === 'POLICE';

  const groups = NIGHT_ROLES.map((role) => ({
    role,
    actors: playerList(room).filter((p) => p.role === role && (isNight ? p.isAlive : true)),
  })).filter((g) => g.actors.length > 0);

  // 밤이 아닐 때도 살아 있는 특수직업의 마지막 nightTarget은 아침 발표 시 null로 초기화됨.
  // RESULT / 직후엔 nightResults로 요약 표시.
  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-black/35 p-3 ring-1 ring-white/10">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/50">
          <Crosshair className="h-3.5 w-3.5" />
          밤 능력 행사 {isNight ? '(실시간)' : '(대기)'}
        </h3>
        {silenced && (
          <p className="mb-2 rounded-lg bg-slate-700/60 px-2 py-1.5 text-[11px] font-bold text-slate-100">
            정전 — 경찰·의사 능력 무효
          </p>
        )}
        {!isNight && !nightResults && (
          <p className="text-xs text-white/45">
            밤이 시작되면 마피아·의사·경찰의 지목이 여기 실시간으로 표시됩니다.
          </p>
        )}

        {isNight && (
          <ul className="space-y-2">
            {groups.map(({ role, actors }) =>
              actors
                .filter((a) => a.isAlive)
                .map((actor) => (
                  <NightActionRow
                    key={actor.id}
                    room={room}
                    actor={actor}
                    role={role}
                    silenced={silenced}
                    revealPoliceResult={canSeePolice}
                  />
                )),
            )}
            {groups.every((g) => g.actors.filter((a) => a.isAlive).length === 0) && (
              <p className="text-xs text-white/45">특수 직업이 없습니다.</p>
            )}
          </ul>
        )}

        {!isNight && nightResults?.actionLog && nightResults.actionLog.length > 0 && (
          <ul className="mb-2 space-y-2">
            <p className="text-[11px] font-bold text-white/50">지난 밤 지목 기록</p>
            {nightResults.actionLog.map((entry) => {
              const actor = room.players[entry.actorId];
              if (!actor) return null;
              return (
                <NightActionRow
                  key={entry.actorId}
                  room={room}
                  actor={{ ...actor, nightTarget: entry.targetId }}
                  role={entry.role}
                  silenced={false}
                  revealPoliceResult={canSeePolice}
                />
              );
            })}
          </ul>
        )}

        {nightResults && (room.gameState === 'RESULT' || nightResults.deadPlayerIds) && (
          <div className="mt-2 space-y-2 rounded-xl bg-red-950/40 p-3 ring-1 ring-red-400/25">
            <p className="text-xs font-black text-red-200">아침 발표 요약</p>
            <p className="text-xs text-white/75">
              희생:{' '}
              {nightResults.deadPlayerIds.length === 0
                ? '없음'
                : nightResults.deadPlayerIds
                    .map((id) => nameOf(room, id))
                    .join(', ')}
            </p>
            <p className="text-xs text-white/75">
              구출 성공:{' '}
              {nightResults.savedPlayerIds.length === 0
                ? '없음'
                : nightResults.savedPlayerIds
                    .map((id) => nameOf(room, id))
                    .join(', ')}
            </p>
            {nightResults.reporterNews && (
              <p className="text-xs text-sky-200">{nightResults.reporterNews}</p>
            )}
            {canSeePolice && nightResults.policeReport && (
              <p className="text-xs text-indigo-200">
                경찰 조사: {nightResults.policeReport.targetName} →{' '}
                {nightResults.policeReport.isMafia ? '마피아 O' : '마피아 X'}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function NightActionRow({
  room,
  actor,
  role,
  silenced,
  revealPoliceResult = false,
}: {
  room: GameRoom;
  actor: Player;
  role: Role;
  silenced: boolean;
  revealPoliceResult?: boolean;
}) {
  const blocked = silenced && (role === 'DOCTOR' || role === 'POLICE');
  const targetId = actor.nightTarget;
  const target = targetId ? room.players[targetId] : null;

  let actionLabel = '지목';
  let detail: string | null = null;
  let Icon = Target;

  if (role === 'MAFIA') {
    actionLabel = '암살 지목';
    Icon = Crosshair;
  } else if (role === 'DOCTOR') {
    actionLabel = '치료';
    Icon = Stethoscope;
    if (targetId && targetId === actor.id) detail = '자가 치료';
  } else if (role === 'POLICE') {
    actionLabel = '조사';
    Icon = Shield;
    if (target && !blocked && revealPoliceResult) {
      detail =
        target.role === 'MAFIA' ? '결과: 마피아 O' : '결과: 마피아 아님 X';
    } else if (target && !blocked) {
      detail = '조사 결과 — 경찰만 열람';
    }
  } else if (role === 'REPORTER') {
    actionLabel = '취재';
    // 실제 직업은 아침 전체 공개 이후(또는 확정 결과)에만 표시
    if (
      target?.role &&
      (room.gameState === 'RESULT' ||
        room.nightResults?.reporterTargetId === targetId)
    ) {
      detail = `직업: ${ROLE_LABELS[target.role]}`;
    }
  } else if (role === 'SPIRITUALIST') {
    actionLabel = '영혼 문의';
    if (target?.role) detail = `진짜 직업: ${ROLE_LABELS[target.role]}`;
  }

  return (
    <li className="flex items-start gap-2 rounded-xl bg-white/5 px-2.5 py-2">
      <CharacterAvatar avatarId={actor.avatarId} isAlive size={36} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-white">
          <Icon className="h-3.5 w-3.5 text-violet-300" />
          {actor.name}
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/70">
            {ROLE_LABELS[role]}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-white/65">
          {blocked
            ? '정전으로 행동 불가'
            : target
              ? `${actionLabel} → ${target.name}${
                  targetId === actor.id ? ' (자신)' : ''
                }`
              : `${actionLabel} 대기 중…`}
        </p>
        {detail && (
          <p className="mt-0.5 text-xs font-semibold text-amber-200">{detail}</p>
        )}
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
          blocked
            ? 'bg-slate-500/30 text-slate-200'
            : target
              ? 'bg-emerald-500/25 text-emerald-200'
              : 'bg-amber-500/20 text-amber-100'
        }`}
      >
        {blocked ? '무효' : target ? '완료' : '대기'}
      </span>
    </li>
  );
}

function MissionSpectatePanel({
  room,
  stats,
}: {
  room: GameRoom;
  stats: ReturnType<typeof getNightQuizStats>;
}) {
  const quiz = room.nightQuizState;
  const mms = room.mafiaMissionState;
  const showQuiz =
    quiz &&
    (room.gameState === 'NIGHT' ||
      room.gameState === 'RESULT' ||
      quiz.outcome === 'SUCCESS' ||
      quiz.outcome === 'FAIL');

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-indigo-950/45 p-3 ring-1 ring-indigo-400/25">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-200/80">
          밤 퀴즈 미션
        </h3>
        {!showQuiz || !quiz ? (
          <p className="text-xs text-white/45">
            진행 중인 시민 퀴즈가 없습니다. 밤이 시작되면 성공률·제출 현황이
            표시됩니다.
          </p>
        ) : (
          <>
            <p className="text-sm font-bold text-white">{quiz.question}</p>
            <p className="mt-1 text-xs text-white/60">
              기준 {quiz.successThresholdPercent}% · 현재{' '}
              <span className="font-black text-amber-300">
                {stats.successRate}%
              </span>{' '}
              ({stats.successCount}/{stats.aliveCount})
              {(quiz.outcome === 'SUCCESS' || quiz.outcome === 'FAIL') && (
                <span className="ml-1 font-bold text-white">
                  → {quiz.outcome === 'SUCCESS' ? '전체 성공' : '전체 실패'}
                </span>
              )}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-indigo-400 transition-all"
                style={{
                  width: `${Math.min(100, stats.successRate)}%`,
                }}
              />
            </div>
            <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
              {alivePlayers(room).map((p) => {
                const sub = quiz.submissions?.[p.id];
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-lg bg-black/30 px-2 py-1.5"
                  >
                    <CharacterAvatar avatarId={p.avatarId} size={28} />
                    <span className="min-w-0 flex-1 truncate text-xs font-bold">
                      {p.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        sub
                          ? sub.correct
                            ? 'text-emerald-300'
                            : 'text-red-300'
                          : 'text-white/40'
                      }`}
                    >
                      {sub
                        ? sub.correct
                          ? `정답 (${sub.answer})`
                          : `오답 (${sub.answer})`
                        : '미제출'}
                    </span>
                  </li>
                );
              })}
            </ul>
            {quiz.outcome === 'SUCCESS' && quiz.successHint && (
              <p className="mt-2 rounded-lg bg-amber-500/15 px-2 py-1.5 text-[11px] text-amber-100">
                힌트: {quiz.successHint}
              </p>
            )}
          </>
        )}
      </section>

      <section className="rounded-2xl bg-red-950/40 p-3 ring-1 ring-red-400/25">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-red-200/80">
          마피아 미션
        </h3>
        {!mms?.active && (!mms?.outcome || mms.outcome === null) ? (
          <p className="text-xs text-white/45">
            교사 부여 마피아 미션이 없습니다.
          </p>
        ) : (
          <>
            <p className="text-xs font-bold text-red-100">
              {mafiaMissionLabel(mms?.type ?? null)}
            </p>
            <p className="mt-1 text-sm text-white/85">
              {mms?.description || '—'}
            </p>
            {mms?.type === 'NIGHT_DISRUPT' && (
              <p className="mt-1 text-xs text-white/55">
                방해 진행 {mms.disruptProgress ?? 0}/
                {mms.disruptTargetCount ?? 3}
              </p>
            )}
            {mms?.type === 'DAY_VOTE_ELIMINATE' && mms.voteTargetPlayerId && (
              <p className="mt-1 text-xs text-white/55">
                탈락 목표: {nameOf(room, mms.voteTargetPlayerId)}
              </p>
            )}
            <p
              className={`mt-2 text-xs font-black ${
                mms?.outcome === 'SUCCESS'
                  ? 'text-emerald-300'
                  : mms?.outcome === 'FAIL'
                    ? 'text-red-300'
                    : 'text-amber-200'
              }`}
            >
              {mms?.outcome === 'SUCCESS'
                ? '성공 — 다음 밤 멀티킬 예약'
                : mms?.outcome === 'FAIL'
                  ? '실패'
                  : mms?.active
                    ? '진행 중'
                    : '대기'}
            </p>
            {room.pendingMafiaNightBuff && (
              <p className="mt-1 text-[11px] font-semibold text-red-300">
                보상: 다음 밤 멀티킬 버프 대기
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function VoteSpectatePanel({ room }: { room: GameRoom }) {
  const live = room.gameState === 'DAY_VOTE';
  const ballots = live
    ? room.votes ?? {}
    : room.dayVoteResult?.ballots ?? {};
  const entries = Object.entries(ballots);
  const alive = alivePlayers(room);
  const notVoted = live
    ? alive.filter((p) => !ballots[p.id])
    : [];

  return (
    <section className="rounded-2xl bg-black/35 p-3 ring-1 ring-white/10">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/50">
        <Vote className="h-3.5 w-3.5" />
        투표 상세 {live ? '(실시간)' : room.dayVoteResult ? '(최근 결과)' : ''}
      </h3>

      {room.voteRevoteCandidates && live && (
        <p className="mb-2 rounded-lg bg-amber-500/15 px-2 py-1.5 text-[11px] font-bold text-amber-100">
          동률 재투표 대상:{' '}
          {room.voteRevoteCandidates.map((id) => nameOf(room, id)).join(', ')}
        </p>
      )}

      {room.dayVoteResult && !live && (
        <p className="mb-2 text-xs text-white/70">
          탈락:{' '}
          <span className="font-black text-red-300">
            {room.dayVoteResult.eliminatedName ?? '없음'}
          </span>
          {room.dayVoteResult.wasTie ? ' · 동률 처리' : ''}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="text-xs text-white/45">
          {live
            ? '아직 투표가 없습니다. 표가 들어오는 대로 표시됩니다.'
            : '표시할 투표 내역이 없습니다. 투표가 시작되면 실시간으로 보입니다.'}
        </p>
      ) : (
        <ul className="max-h-64 space-y-1.5 overflow-y-auto">
          {entries.map(([voterId, targetId]) => {
            const voter = room.players[voterId];
            const target = room.players[targetId];
            return (
              <li
                key={voterId}
                className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-2 text-xs"
              >
                <CharacterAvatar
                  avatarId={voter?.avatarId ?? 'M0'}
                  isAlive={voter?.isAlive !== false}
                  size={28}
                />
                <span className="min-w-0 flex-1 truncate font-bold text-white">
                  {voter?.name ?? '?'}
                </span>
                <span className="text-white/40">→</span>
                <span className="truncate font-bold text-amber-200">
                  {target?.name ?? '?'}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {live && notVoted.length > 0 && (
        <p className="mt-2 text-[11px] text-white/45">
          미투표: {notVoted.map((p) => p.name).join(', ')}
        </p>
      )}
    </section>
  );
}

function formatChatTime(ts: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function GhostChatPanel({
  me,
  messages,
  text,
  setText,
  sending,
  onSend,
  myPrediction,
  tally,
  onPredict,
}: {
  me: Player;
  messages: GhostChatMessage[];
  text: string;
  setText: (v: string) => void;
  sending: boolean;
  onSend: () => void;
  myPrediction: WinnerSide | null;
  tally: { CITIZEN: number; MAFIA: number };
  onPredict: (side: WinnerSide) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-black/35 p-3 ring-1 ring-white/10">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
          승자 예측
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onPredict('CITIZEN')}
            className={`rounded-xl py-3 text-sm font-bold ${
              myPrediction === 'CITIZEN'
                ? 'bg-emerald-500 text-white'
                : 'bg-white/10 text-white'
            }`}
          >
            시민팀 ({tally.CITIZEN})
          </button>
          <button
            type="button"
            onClick={() => onPredict('MAFIA')}
            className={`rounded-xl py-3 text-sm font-bold ${
              myPrediction === 'MAFIA'
                ? 'bg-red-600 text-white'
                : 'bg-white/10 text-white'
            }`}
          >
            마피아팀 ({tally.MAFIA})
          </button>
        </div>
      </section>

      <section className="flex h-80 flex-col rounded-2xl bg-black/35 p-3 ring-1 ring-violet-400/25">
        <h3 className="mb-1 px-1 text-xs font-bold uppercase tracking-wider text-violet-200/80">
          👻 유령 전용 채팅방
        </h3>
        <p className="mb-2 rounded-lg bg-violet-500/15 px-2.5 py-2 text-[11px] font-semibold leading-snug text-violet-100/90">
          👻 유령끼리만 보이는 비밀 채팅입니다. 생존 학생에게 정답/직업을
          스포일러하지 마세요!
        </p>
        <div className="flex-1 space-y-2 overflow-y-auto px-1">
          {messages.length === 0 && (
            <p className="text-xs text-white/40">아직 메시지가 없습니다.</p>
          )}
          {messages.map((m) => {
            const mine = m.senderId === me.id;
            return (
              <div
                key={m.id}
                className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? 'ml-auto bg-violet-600 text-white'
                    : 'bg-white/10 text-white'
                }`}
              >
                <p className="flex items-center justify-between gap-2 text-[10px] font-semibold opacity-75">
                  <span>{m.senderName}</span>
                  <span className="font-normal tabular-nums opacity-80">
                    {formatChatTime(m.timestamp)}
                  </span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSend();
            }}
            placeholder="유령에게만 보이는 메시지..."
            maxLength={200}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-violet-400/50"
          />
          <button
            type="button"
            disabled={sending || !text.trim() || me.isAlive}
            onClick={onSend}
            className="rounded-xl bg-violet-500 px-3 text-white disabled:opacity-40"
            aria-label="전송"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
