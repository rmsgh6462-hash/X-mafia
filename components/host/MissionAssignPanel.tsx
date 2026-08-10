'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Crosshair, RefreshCw, Target, X } from 'lucide-react';
import { MathText } from '@/components/math/MathText';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import {
  QUIZ_MODE_LABELS,
  TIME_LIMIT_PRESETS,
  generateQuizByMode,
  type ElementaryGrade,
  type GeneratedQuiz,
  type QuizMode,
} from '@/lib/game/quizGenerator';
import { buildMafiaMissionState, getNightQuizStats } from '@/lib/game/missions';
import { alivePlayers } from '@/lib/game/room';
import { ROLE_LABELS } from '@/lib/game/roles';
import type {
  GameRoom,
  MafiaMissionAssignConfig,
  MafiaMissionType,
  NightQuizConfig,
  Role,
} from '@/types/game';

const NIGHT_QUIZ_PREVIEW_ROLES: Role[] = [
  'MAFIA',
  'DOCTOR',
  'POLICE',
  'REPORTER',
  'SPIRITUALIST',
];

/** 교사: 직업별 밤 퀴즈 미리보기 ON/OFF */
export function NightQuizPreviewTogglePanel({
  previewByRole,
  busy,
  onToggle,
}: {
  previewByRole: Record<Role, boolean>;
  busy?: boolean;
  onToggle: (role: Role, enabled: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4 ring-1 ring-white/10">
      <p className="text-sm font-black text-white">직업별 밤 퀴즈 미리보기</p>
      <p className="mt-1 text-xs text-white/55">
        ON인 직업만 밤 전에 저장된 퀴즈를 학생 화면에서 미리 볼 수 있습니다.
        저장된 퀴즈가 바뀌면 학생 화면도 즉시 갱신됩니다.
      </p>
      <ul className="mt-3 space-y-2">
        {NIGHT_QUIZ_PREVIEW_ROLES.map((role) => (
          <li
            key={role}
            className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5"
          >
            <span className="text-sm font-bold text-white">
              {ROLE_LABELS[role]} 퀴즈 미리보기
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggle(role, !previewByRole[role])}
              className={`rounded-full px-3 py-1 text-xs font-black transition ${
                previewByRole[role]
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/10 text-white/60'
              } disabled:opacity-40`}
            >
              {previewByRole[role] ? 'ON' : 'OFF'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 밤 시작 전: 퀴즈 모드·학년·힌트·제한시간 + 출제 미리보기 (저장) */
export function NightQuizConfigForm({
  busy,
  onSave,
  onCancel,
  pendingBuff,
  initialConfig,
}: {
  busy?: boolean;
  pendingBuff?: boolean;
  initialConfig?: NightQuizConfig | null;
  onSave: (config: NightQuizConfig) => void;
  onCancel?: () => void;
}) {
  const seed = initialConfig ?? null;
  const [mode, setMode] = useState<QuizMode>(seed?.mode ?? 'MATH');
  const [grade, setGrade] = useState<ElementaryGrade>(
    (seed?.grade === 1 ||
    seed?.grade === 2 ||
    seed?.grade === 3 ||
    seed?.grade === 4 ||
    seed?.grade === 5 ||
    seed?.grade === 6
      ? seed.grade
      : 3) as ElementaryGrade,
  );
  const [timeLimitSec, setTimeLimitSec] = useState(seed?.timeLimitSec ?? 45);
  const [threshold, setThreshold] = useState(
    seed?.successThresholdPercent ?? 70,
  );
  const [hint, setHint] = useState(
    seed?.successHint?.trim() ||
      '마피아 중 한 명은 오늘 평소보다 말이 적을 수 있습니다.',
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const [customQ, setCustomQ] = useState(
    seed?.mode === 'CUSTOM' ? seed.question : '',
  );
  const [c0, setC0] = useState(
    seed?.mode === 'CUSTOM' ? (seed.choices[0] ?? '') : '',
  );
  const [c1, setC1] = useState(
    seed?.mode === 'CUSTOM' ? (seed.choices[1] ?? '') : '',
  );
  const [c2, setC2] = useState(
    seed?.mode === 'CUSTOM' ? (seed.choices[2] ?? '') : '',
  );
  const [c3, setC3] = useState(
    seed?.mode === 'CUSTOM' ? (seed.choices[3] ?? '') : '',
  );
  const [correctIndex, setCorrectIndex] = useState(
    seed?.mode === 'CUSTOM' ? seed.correctIndex : 0,
  );

  const lockedQuiz: GeneratedQuiz | null = useMemo(() => {
    if (mode === 'CUSTOM') return null;
    if (
      refreshKey === 0 &&
      seed &&
      seed.mode === mode &&
      seed.question &&
      Array.isArray(seed.choices) &&
      seed.choices.length >= 4 &&
      (mode !== 'MATH' || (seed.grade ?? null) === grade)
    ) {
      return {
        question: seed.question,
        answer: seed.answer,
        choices: [
          seed.choices[0] ?? '',
          seed.choices[1] ?? '',
          seed.choices[2] ?? '',
          seed.choices[3] ?? '',
        ] as [string, string, string, string],
        correctIndex: seed.correctIndex,
      };
    }
    return generateQuizByMode(mode, { grade });
    // refreshKey로 교사 요청 시에만 새 문제 고정
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, grade, refreshKey, seed]);

  const customPreview: GeneratedQuiz | null =
    mode === 'CUSTOM' &&
    customQ.trim() &&
    c0.trim() &&
    c1.trim() &&
    c2.trim() &&
    c3.trim()
      ? {
          question: customQ.trim(),
          answer: [c0, c1, c2, c3][correctIndex]?.trim() ?? '',
          choices: [
            c0.trim(),
            c1.trim(),
            c2.trim(),
            c3.trim(),
          ] as [string, string, string, string],
          correctIndex,
        }
      : null;

  const preview = mode === 'CUSTOM' ? customPreview : lockedQuiz;

  const canSave =
    mode !== 'CUSTOM'
      ? Boolean(lockedQuiz) && Boolean(hint.trim())
      : Boolean(customPreview) && Boolean(hint.trim());

  const handleSave = () => {
    if (!preview) return;
    onSave({
      mode,
      grade: mode === 'MATH' ? grade : null,
      question: preview.question,
      answer: preview.answer,
      choices: [...preview.choices],
      correctIndex: preview.correctIndex,
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
      {seed && (
        <p className="rounded-xl bg-emerald-950/45 px-3 py-2 text-xs font-bold text-emerald-100 ring-1 ring-emerald-400/30">
          저장된 밤 미션이 있습니다. 수정 후 다시 저장하면 투표 종료 시 이
          설정으로 밤이 시작됩니다.
        </p>
      )}

      <div>
        <p className="mb-2 text-xs font-bold text-white/50">퀴즈 출제 모드</p>
        <div className="grid gap-2">
          {(['MATH', 'KOREAN', 'GENERAL', 'CUSTOM'] as QuizMode[]).map((m) => (
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
                onChange={() => {
                  setMode(m);
                  setRefreshKey((k) => k + 1);
                }}
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
                onClick={() => {
                  setGrade(g);
                  setRefreshKey((k) => k + 1);
                }}
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
        </div>
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
          <p className="text-[11px] leading-relaxed text-white/45">
            분수는 <span className="font-mono text-white/70">1/5</span>, 대분수는{' '}
            <span className="font-mono text-white/70">2 1/3</span>처럼 입력하면
            미리보기에 세로 분수로 표시됩니다.
          </p>
        </div>
      )}

      {preview && (
        <div className="rounded-2xl bg-indigo-950/60 p-4 ring-1 ring-indigo-400/35">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-wider text-indigo-200">
              출제 미리보기
            </p>
            {mode !== 'CUSTOM' && (
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-white/20"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                다른 문제 보기
              </button>
            )}
          </div>
          <p className="text-base font-bold text-white">
            <MathText text={preview.question} size="lg" />
          </p>
          <ul className="mt-3 space-y-1.5">
            {preview.choices.map((choice, i) => (
              <li
                key={`${choice}-${i}`}
                className={`rounded-lg px-3 py-2 text-sm ${
                  i === preview.correctIndex
                    ? 'bg-emerald-500/25 font-bold text-emerald-100 ring-1 ring-emerald-400/40'
                    : 'bg-black/25 text-white/75'
                }`}
              >
                {i + 1}. <MathText text={choice} />
                {i === preview.correctIndex ? ' · 정답' : ''}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-white/45">
            저장하면 투표가 끝난 뒤 이 문제가 학생에게 출제됩니다.
          </p>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold text-white/50">제한 시간</p>
        <div className="flex flex-wrap gap-2">
          {TIME_LIMIT_PRESETS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTimeLimitSec(t)}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${
                timeLimitSec === t
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white/10 text-white'
              }`}
            >
              {t}초
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-white/50">
          직접 입력
          <input
            type="number"
            min={5}
            max={300}
            value={timeLimitSec}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              setTimeLimitSec(Math.max(5, Math.min(300, Math.floor(n))));
            }}
            className="w-24 rounded-lg border border-white/15 bg-stone-900 px-2 py-1.5 font-mono text-sm font-bold text-white"
          />
          <span>초 (5–300)</span>
        </label>
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
          disabled={busy || !canSave}
          onClick={handleSave}
          className="flex-1 rounded-xl bg-indigo-500 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          밤 미션 저장
        </button>
      </div>
    </div>
  );
}

/** 교사: 마피아 미션 부여 + 사전 미리보기 */
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
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!alive.some((p) => p.id === voteTargetId)) {
      setVoteTargetId(alive[0]?.id ?? '');
    }
  }, [alive, voteTargetId]);

  const config: MafiaMissionAssignConfig = {
    type,
    disruptTargetCount: disruptCount,
    voteTargetPlayerId:
      type === 'DAY_VOTE_ELIMINATE' ? voteTargetId || null : null,
  };

  const preview = useMemo(
    () => buildMafiaMissionState(room, config),
    // room identity + form fields
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room, type, disruptCount, voteTargetId],
  );

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

      <div className="rounded-2xl bg-red-950/45 p-4 ring-1 ring-red-400/35">
        <p className="mb-2 text-xs font-black uppercase tracking-wider text-red-200">
          미션 미리보기
        </p>
        <p className="text-sm font-bold text-white">{preview.description}</p>
        <p className="mt-2 text-[11px] text-white/45">
          아래 버튼으로 부여하면 마피아 학생 화면에 이 내용이 표시됩니다.
        </p>
      </div>

      {!showConfirm ? (
        <button
          type="button"
          disabled={busy || (type === 'DAY_VOTE_ELIMINATE' && !voteTargetId)}
          onClick={() => setShowConfirm(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600/80 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          <Target className="h-4 w-4" />
          미리보기 확인 후 부여
        </button>
      ) : (
        <div className="space-y-2 rounded-xl bg-black/40 p-3 ring-1 ring-white/15">
          <p className="text-sm font-bold text-amber-200">
            이 미션을 마피아에게 부여할까요?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-bold"
            >
              취소
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onAssign(config);
                setShowConfirm(false);
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-black text-white disabled:opacity-50"
            >
              <Crosshair className="h-4 w-4" />
              미션 부여
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 밤 퀴즈 실시간 모니터 */
export function NightQuizMonitor({
  room,
  busy,
  now = Date.now(),
}: {
  room: GameRoom;
  busy?: boolean;
  now?: number;
}) {
  void busy;
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
                : quiz.mode === 'GENERAL'
                  ? '초등 상식'
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
        <p className="text-lg font-black text-white">
          <MathText text={quiz.question} size="lg" />
        </p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {quiz.choices.map((c, i) => (
            <li
              key={i}
              className={`rounded-lg px-3 py-2 text-sm ${
                done && i === quiz.correctIndex
                  ? 'bg-emerald-500/30 text-emerald-100'
                  : 'bg-black/30 text-white/80'
              }`}
            >
              {i + 1}. <MathText text={c} />
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/5 py-3">
          <p className="text-2xl font-black">{stats.submittedCount}</p>
          <p className="text-[10px] text-white/45">제출</p>
        </div>
        <div className="rounded-xl bg-white/5 py-3">
          <p className="text-2xl font-black text-emerald-300">
            {stats.successCount}
          </p>
          <p className="text-[10px] text-white/45">정답</p>
        </div>
        <div className="rounded-xl bg-white/5 py-3">
          <p className="text-2xl font-black text-amber-300">
            {Math.round(stats.successRate)}%
          </p>
          <p className="text-[10px] text-white/45">성공률</p>
        </div>
      </div>

      <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
        {alive.map((p) => {
          const sub = quiz.submissions?.[p.id];
          return (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5"
            >
              <span className="inline-flex items-center gap-2 font-bold">
                <CharacterAvatar
                  avatarId={p.avatarId}
                  size={24}
                  isAlive
                  previewOnHover
                />
                {p.name}
              </span>
              {!sub ? (
                <span className="text-white/40">대기</span>
              ) : sub.correct ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <X className="h-4 w-4 text-red-400" />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
