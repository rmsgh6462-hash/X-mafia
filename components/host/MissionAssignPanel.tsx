'use client';

import { useMemo, useState } from 'react';
import { Check, Crosshair, Target, X } from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import {
  QUIZ_MODE_LABELS,
  TIME_LIMIT_PRESETS,
  generateQuizByMode,
  type ElementaryGrade,
  type QuizMode,
} from '@/lib/game/quizGenerator';
import { getNightQuizStats } from '@/lib/game/missions';
import { alivePlayers } from '@/lib/game/room';
import type {
  GameRoom,
  MafiaMissionAssignConfig,
  MafiaMissionType,
  NightQuizConfig,
} from '@/types/game';

/** 밤 시작 전: 퀴즈 모드·학년·힌트·제한시간 */
export function NightQuizConfigForm({
  busy,
  onStart,
  onCancel,
  pendingBuff,
}: {
  busy?: boolean;
  pendingBuff?: boolean;
  onStart: (config: NightQuizConfig) => void;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<QuizMode>('MATH');
  const [grade, setGrade] = useState<ElementaryGrade>(3);
  const [timeLimitSec, setTimeLimitSec] = useState(45);
  const [threshold, setThreshold] = useState(70);
  const [hint, setHint] = useState(
    '마피아 중 한 명은 오늘 평소보다 말이 적을 수 있습니다.',
  );

  // 직접 출제
  const [customQ, setCustomQ] = useState('');
  const [c0, setC0] = useState('');
  const [c1, setC1] = useState('');
  const [c2, setC2] = useState('');
  const [c3, setC3] = useState('');
  const [correctIndex, setCorrectIndex] = useState(0);

  const preview = useMemo(() => {
    if (mode === 'CUSTOM') return null;
    return generateQuizByMode(mode, { grade });
  }, [mode, grade]);

  const canStart =
    mode !== 'CUSTOM'
      ? true
      : customQ.trim() && c0.trim() && c1.trim() && c2.trim() && c3.trim();

  const handleStart = () => {
    const generated =
      mode === 'CUSTOM'
        ? generateQuizByMode('CUSTOM', {
            custom: {
              question: customQ,
              choices: [c0, c1, c2, c3],
              correctIndex,
            },
          })
        : generateQuizByMode(mode, { grade });

    onStart({
      mode,
      grade: mode === 'MATH' ? grade : null,
      question: generated.question,
      answer: generated.answer,
      choices: [...generated.choices],
      correctIndex: generated.correctIndex,
      timeLimitSec,
      successThresholdPercent: threshold,
      successHint: hint,
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 text-left">
      {pendingBuff && (
        <p className="rounded-xl bg-red-950/50 px-3 py-2 text-xs font-bold text-red-200 ring-1 ring-red-400/30">
          마피아 미션 보상 — 이번 밤 멀티킬(각자 1명 공격) 활성
        </p>
      )}

      <div>
        <p className="mb-2 text-xs font-bold text-white/50">퀴즈 출제 모드</p>
        <div className="grid gap-2">
          {(['MATH', 'KOREAN', 'CUSTOM'] as QuizMode[]).map((m) => (
            <label
              key={m}
              className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm ring-1 ${
                mode === m
                  ? 'bg-indigo-500/25 ring-indigo-400/50'
                  : 'bg-white/5 ring-white/10'
              }`}
            >
              <input
                type="radio"
                checked={mode === m}
                onChange={() => setMode(m)}
              />
              {QUIZ_MODE_LABELS[m]}
            </label>
          ))}
        </div>
      </div>

      {mode === 'MATH' && (
        <div>
          <p className="mb-2 text-xs font-bold text-white/50">학년</p>
          <div className="flex flex-wrap gap-2">
            {([1, 2, 3, 4, 5, 6] as ElementaryGrade[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGrade(g)}
                className={`rounded-lg px-3 py-2 text-sm font-bold ${
                  grade === g
                    ? 'bg-amber-400 text-stone-900'
                    : 'bg-white/10 text-white'
                }`}
              >
                {g}학년
              </button>
            ))}
          </div>
          {preview && (
            <p className="mt-2 rounded-lg bg-black/30 px-3 py-2 text-xs text-white/60">
              미리보기 예: {preview.question}
            </p>
          )}
        </div>
      )}

      {mode === 'KOREAN' && preview && (
        <p className="rounded-lg bg-black/30 px-3 py-2 text-xs text-white/60">
          미리보기 예: {preview.question}
        </p>
      )}

      {mode === 'CUSTOM' && (
        <div className="space-y-2">
          <textarea
            value={customQ}
            onChange={(e) => setCustomQ(e.target.value)}
            rows={2}
            placeholder="문제"
            className="w-full rounded-xl border border-white/15 bg-stone-900 px-3 py-2 text-sm"
          />
          {[c0, c1, c2, c3].map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
              />
              <input
                value={v}
                onChange={(e) => {
                  const setters = [setC0, setC1, setC2, setC3];
                  setters[i](e.target.value);
                }}
                placeholder={`보기 ${i + 1}`}
                className="flex-1 rounded-xl border border-white/15 bg-stone-900 px-3 py-2 text-sm"
              />
              <span className="text-[10px] text-white/40">
                {correctIndex === i ? '정답' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold text-white/50">제한 시간</p>
        <div className="flex gap-2">
          {TIME_LIMIT_PRESETS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTimeLimitSec(t)}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                timeLimitSec === t
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white/10 text-white'
              }`}
            >
              {t}초
            </button>
          ))}
        </div>
      </div>

      <label className="block text-xs text-white/50">
        성공 기준 {threshold}%
        <input
          type="range"
          min={40}
          max={100}
          step={5}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>

      <textarea
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        rows={2}
        className="w-full rounded-xl border border-white/15 bg-stone-900 px-3 py-2 text-sm"
        placeholder="미션 성공 시 아침 공개 힌트"
      />

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-bold"
          >
            취소
          </button>
        )}
        <button
          type="button"
          disabled={busy || !canStart || !hint.trim()}
          onClick={handleStart}
          className="flex-1 rounded-xl bg-indigo-500 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          밤 시작 · 미션 부여
        </button>
      </div>
    </div>
  );
}

/** 교사: 마피아 미션 부여 */
export function MafiaMissionAssignForm({
  room,
  busy,
  onAssign,
}: {
  room: GameRoom;
  busy?: boolean;
  onAssign: (config: MafiaMissionAssignConfig) => void;
}) {
  const alive = alivePlayers(room);
  const [type, setType] = useState<MafiaMissionType>('NIGHT_DISRUPT');
  const [disruptCount, setDisruptCount] = useState(3);
  const [voteTargetId, setVoteTargetId] = useState(alive[0]?.id ?? '');

  return (
    <div className="space-y-3 text-left">
      <p className="text-xs text-white/50">
        마피아 미션은 교사 부여 시에만 진행됩니다. 성공 시 다음 밤 멀티킬이
        예약됩니다.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          checked={type === 'NIGHT_DISRUPT'}
          onChange={() => setType('NIGHT_DISRUPT')}
        />
        [밤] 시민 미션 성공률 낮추기 (연속 방해)
      </label>
      {type === 'NIGHT_DISRUPT' && (
        <input
          type="number"
          min={1}
          max={10}
          value={disruptCount}
          onChange={(e) => setDisruptCount(Number(e.target.value) || 3)}
          className="ml-6 w-24 rounded-lg border border-white/15 bg-stone-900 px-2 py-1 text-sm"
        />
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          checked={type === 'DAY_VOTE_ELIMINATE'}
          onChange={() => setType('DAY_VOTE_ELIMINATE')}
        />
        [낮] 특정 플레이어 투표 탈락시키기
      </label>
      {type === 'DAY_VOTE_ELIMINATE' && (
        <select
          value={voteTargetId}
          onChange={(e) => setVoteTargetId(e.target.value)}
          className="ml-6 rounded-lg border border-white/15 bg-stone-900 px-2 py-1 text-sm"
        >
          {alive.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          onAssign({
            type,
            disruptTargetCount: disruptCount,
            voteTargetPlayerId:
              type === 'DAY_VOTE_ELIMINATE' ? voteTargetId || null : null,
          })
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-black text-white disabled:opacity-50"
      >
        <Target className="h-4 w-4" />
        마피아 미션 부여
      </button>
    </div>
  );
}

/** 밤 퀴즈 실시간 모니터 */
export function NightQuizMonitor({
  room,
  busy,
  now = Date.now(),
  onFinalize,
}: {
  room: GameRoom;
  busy?: boolean;
  now?: number;
  onFinalize: () => void;
}) {
  const quiz = room.nightQuizState;
  const stats = useMemo(() => getNightQuizStats(room), [room]);
  const alive = alivePlayers(room);
  const done = quiz?.outcome === 'SUCCESS' || quiz?.outcome === 'FAIL';
  const remainSec = quiz?.endsAt
    ? Math.max(0, Math.ceil((quiz.endsAt - now) / 1000))
    : 0;
  const progress =
    quiz && quiz.timeLimitSec > 0
      ? Math.max(0, Math.min(1, (quiz.endsAt - now) / (quiz.timeLimitSec * 1000)))
      : 0;

  if (!quiz) {
    return <p className="text-sm text-white/50">밤 퀴즈가 없습니다.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 text-left">
      <div className="rounded-xl bg-indigo-950/50 px-4 py-3 ring-1 ring-indigo-400/30">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-white/50">
          <span>
            {quiz.mode === 'MATH'
              ? `수학 ${quiz.grade ?? '?'}학년`
              : quiz.mode === 'KOREAN'
                ? '국어·맞춤법'
                : '직접 출제'}
          </span>
          <span className="font-black tabular-nums text-amber-300">
            {done ? '종료' : `${remainSec}초`}
          </span>
        </div>
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${
              remainSec <= 5 ? 'bg-red-500' : 'bg-indigo-400'
            }`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="text-sm font-bold text-indigo-100">{quiz.question}</p>
        <p className="mt-1 text-xs text-white/55">
          기준 {quiz.successThresholdPercent}% · 현재{' '}
          <span className="font-black text-amber-300">{stats.successRate}%</span>{' '}
          ({stats.successCount}/{stats.aliveCount})
          {done && (
            <span className="ml-2 font-bold text-white">
              → {quiz.outcome === 'SUCCESS' ? '전체 성공' : '전체 실패'}
            </span>
          )}
        </p>
      </div>

      <ul className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
        {alive.map((p) => {
          const sub = quiz.submissions?.[p.id];
          return (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2"
            >
              <CharacterAvatar avatarId={p.avatarId} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{p.name}</p>
                <p className="text-[11px] text-white/45">
                  {sub
                    ? sub.correct
                      ? '성공'
                      : `실패 (${sub.answer})`
                    : '미제출'}
                </p>
              </div>
              {sub?.correct ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : sub ? (
                <X className="h-4 w-4 text-red-400" />
              ) : null}
            </li>
          );
        })}
      </ul>

      {room.mafiaMissionState?.active && (
        <div className="rounded-xl bg-red-950/40 px-3 py-2 text-xs text-red-100 ring-1 ring-red-400/30">
          <p className="font-black">마피아 미션 진행 중</p>
          <p className="mt-1">{room.mafiaMissionState.description}</p>
        </div>
      )}

      {room.isMafiaBuffActive && (
        <p className="inline-flex items-center gap-1 text-xs font-bold text-red-300">
          <Crosshair className="h-3.5 w-3.5" />
          이번 밤 멀티킬 버프 활성
        </p>
      )}

      {!done && (
        <button
          type="button"
          disabled={busy}
          onClick={onFinalize}
          className="w-full rounded-xl bg-amber-400 py-3 text-sm font-black text-stone-900 disabled:opacity-50"
        >
          퀴즈 판정 확정 (현재 {stats.successRate}%)
        </button>
      )}
    </div>
  );
}
