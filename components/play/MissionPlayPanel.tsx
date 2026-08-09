'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Send, Sparkles } from 'lucide-react';
import { MathText } from '@/components/math/MathText';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { NightPanel } from '@/components/play/NightPanel';
import { getNightQuizStats } from '@/lib/game/missions';
import {
  normalizeGameRoom,
  resolveNightQuizTimeout,
  saveRoom,
  submitNightQuizAnswer,
} from '@/lib/game/room';
import type { GameRoom, Player } from '@/types/game';

type NightTab = 'quiz' | 'ability';

/** 밤: 퀴즈 + 특수능력 탭 */
export function NightSessionPanel({
  room,
  me,
  pin,
}: {
  room: GameRoom;
  me: Player;
  pin: string;
}) {
  const hasAbility =
    me.role === 'MAFIA' ||
    me.role === 'DOCTOR' ||
    me.role === 'POLICE' ||
    me.role === 'REPORTER' ||
    me.role === 'SPIRITUALIST';

  const [tab, setTab] = useState<NightTab>('quiz');

  return (
    <div className="space-y-3">
      {hasAbility && (
        <div className="flex gap-1 rounded-xl bg-black/30 p-1">
          <TabBtn
            active={tab === 'quiz'}
            onClick={() => setTab('quiz')}
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label="퀴즈 풀기"
          />
          <TabBtn
            active={tab === 'ability'}
            onClick={() => setTab('ability')}
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="특수 능력"
          />
        </div>
      )}

      {tab === 'quiz' || !hasAbility ? (
        <NightQuizPlayPanel room={room} me={me} pin={pin} />
      ) : (
        <NightPanel room={room} me={me} pin={pin} />
      )}

      {me.role === 'MAFIA' &&
        room.mafiaMissionState?.active &&
        room.mafiaMissionState.type === 'NIGHT_DISRUPT' && (
          <div className="rounded-xl bg-red-950/50 px-3 py-2 text-xs text-red-100 ring-1 ring-red-400/30">
            <p className="font-black">마피아 밤 미션</p>
            <p className="mt-1">{room.mafiaMissionState.description}</p>
            <p className="mt-1 opacity-70">
              오답·시간초과로 방해 ·{' '}
              {room.mafiaMissionState.disruptProgress ?? 0}/
              {room.mafiaMissionState.disruptTargetCount ?? 3}
            </p>
          </div>
        )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition ${
        active
          ? 'bg-amber-400 text-stone-900'
          : 'text-white/60 hover:bg-white/10 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function NightQuizPlayPanel({
  room,
  me,
  pin,
}: {
  room: GameRoom;
  me: Player;
  pin: string;
}) {
  const quiz = room.nightQuizState;
  const submission = quiz?.submissions?.[me.id];
  const stats = useMemo(() => getNightQuizStats(room), [room]);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const peerId = quiz?.peerMap?.[me.id];
  const peer = peerId ? room.players[peerId] : null;
  const peerSub = peerId ? quiz?.submissions?.[peerId] : null;

  const remainSec = quiz?.endsAt
    ? Math.max(0, Math.ceil((quiz.endsAt - now) / 1000))
    : 0;
  const progress =
    quiz && quiz.timeLimitSec > 0
      ? Math.max(0, Math.min(1, (quiz.endsAt - now) / (quiz.timeLimitSec * 1000)))
      : 0;

  // 타이머 틱
  useEffect(() => {
    if (!quiz?.active || quiz.outcome !== 'PENDING') return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [quiz?.active, quiz?.outcome, quiz?.endsAt]);

  // 시간 초과 → 서버에 타임아웃 판정 요청 (한 번)
  useEffect(() => {
    if (!quiz?.active || quiz.outcome !== 'PENDING') return;
    if (now < quiz.endsAt) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = resolveNightQuizTimeout(normalizeGameRoom(room));
        if (!cancelled && next !== room) {
          await saveRoom(next);
        }
      } catch {
        /* host가 처리할 수 있음 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [now, quiz?.endsAt, quiz?.active, quiz?.outcome, pin, room]);

  if (!quiz) {
    return (
      <section className="rounded-2xl bg-indigo-950/40 p-4 ring-1 ring-indigo-400/20">
        <p className="text-sm text-white/60">밤 퀴즈 준비 중…</p>
      </section>
    );
  }

  const choices = (quiz.choices ?? []).slice(0, 4);
  while (choices.length < 4) choices.push(`보기${choices.length + 1}`);

  const handleSubmit = async () => {
    if (!answer.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await submitNightQuizAnswer(pin, me.id, answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출 실패');
    } finally {
      setBusy(false);
    }
  };

  const timedOut = remainSec <= 0 && quiz.outcome === 'PENDING';

  return (
    <section className="space-y-3 rounded-2xl bg-indigo-950/45 p-4 ring-1 ring-indigo-400/25">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-indigo-100">밤 미션 · 퀴즈</h3>
          <p className="mt-2 text-base font-bold leading-snug text-white">
            <MathText text={quiz.question} size="lg" />
          </p>
        </div>
        <div
          className={`rounded-xl px-3 py-2 text-center ${
            remainSec <= 5 ? 'bg-red-500/30' : 'bg-black/35'
          }`}
        >
          <p className="text-[10px] text-white/45">남은 시간</p>
          <p className="text-xl font-black tabular-nums text-amber-300">
            {remainSec}
          </p>
        </div>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${
            remainSec <= 5 ? 'bg-red-500' : 'bg-amber-400'
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="rounded-xl bg-black/30 px-3 py-2">
        <p className="text-xs text-white/50">전체 성공률</p>
        <p className="text-2xl font-black tabular-nums text-amber-300">
          {quiz.finalSuccessRate ?? stats.successRate}%
        </p>
        <p className="text-[11px] text-white/40">
          제출 {stats.submittedCount}/{stats.aliveCount} · 기준{' '}
          {quiz.successThresholdPercent}%
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniStatus
          name={me.name}
          avatarId={me.avatarId}
          label="나"
          status={
            submission ? (submission.correct ? 'success' : 'fail') : 'pending'
          }
        />
        <MiniStatus
          name={peer?.name ?? '???'}
          avatarId={peer?.avatarId}
          label="다른 학생"
          status={
            peerSub ? (peerSub.correct ? 'success' : 'fail') : 'pending'
          }
        />
      </div>

      {!submission && quiz.active && quiz.outcome === 'PENDING' && !timedOut ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2">
            {choices.map((c, i) => (
              <button
                key={`${i}-${c}`}
                type="button"
                disabled={busy}
                onClick={() => setAnswer(c)}
                className={`rounded-xl px-3 py-3.5 text-left text-sm font-bold transition ${
                  answer === c
                    ? 'bg-amber-400 text-stone-900 ring-2 ring-amber-200'
                    : 'bg-white/10 text-white hover:bg-white/16'
                }`}
              >
                <span className="mr-2 text-white/40">{i + 1}.</span>
                <MathText text={c} />
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button
            type="button"
            disabled={busy || !answer.trim()}
            onClick={() => void handleSubmit()}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 text-sm font-black text-stone-900 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {busy ? '제출 중…' : '제출'}
          </button>
        </div>
      ) : submission ? (
        <p
          className={`rounded-xl px-3 py-3 text-center text-sm font-bold ${
            submission.correct
              ? 'bg-emerald-500/20 text-emerald-200'
              : 'bg-red-500/20 text-red-200'
          }`}
        >
          {submission.correct ? '정답!' : '오답'}
          {submission.answer === '(시간초과)' ? ' (시간초과)' : ''}
        </p>
      ) : timedOut ? (
        <p className="rounded-xl bg-red-500/20 px-3 py-3 text-center text-sm font-bold text-red-200">
          시간 초과 — 오답 처리됩니다
        </p>
      ) : null}
    </section>
  );
}

function MiniStatus({
  name,
  avatarId,
  label,
  status,
}: {
  name: string;
  avatarId?: string;
  label: string;
  status: 'pending' | 'success' | 'fail';
}) {
  const tone =
    status === 'success'
      ? 'ring-emerald-400/40 bg-emerald-950/40'
      : status === 'fail'
        ? 'ring-red-400/40 bg-red-950/40'
        : 'ring-white/10 bg-white/5';
  return (
    <div className={`rounded-xl p-3 text-center ring-1 ${tone}`}>
      <p className="mb-1 text-[10px] font-bold text-white/40">{label}</p>
      <CharacterAvatar avatarId={avatarId} size={40} className="mx-auto" />
      <p className="mt-1 truncate text-xs font-bold">{name}</p>
      <p className="text-[11px] text-white/60">
        {status === 'success' ? '성공' : status === 'fail' ? '실패' : '대기'}
      </p>
    </div>
  );
}

export function DayMafiaMissionBanner({
  room,
  me,
}: {
  room: GameRoom;
  me: Player;
}) {
  const mms = room.mafiaMissionState;
  if (
    me.role !== 'MAFIA' ||
    !mms?.active ||
    mms.type !== 'DAY_VOTE_ELIMINATE' ||
    mms.outcome !== 'PENDING'
  ) {
    return null;
  }
  return (
    <section className="rounded-2xl bg-red-950/50 p-4 text-xs text-red-100 ring-1 ring-red-400/35">
      <p className="font-black">마피아 낮 미션</p>
      <p className="mt-1 text-sm">{mms.description}</p>
    </section>
  );
}
