'use client';

import { MoonStar } from 'lucide-react';
import { MathText } from '@/components/math/MathText';
import { QUIZ_MODE_LABELS } from '@/lib/game/quizGenerator';
import type { NightQuizConfig } from '@/types/game';

export function NightQuizPreviewCard({
  config,
  roleLabel,
}: {
  config: NightQuizConfig;
  roleLabel: string;
}) {
  return (
    <section
      className="rounded-2xl border border-indigo-400/30 bg-indigo-950/45 p-4 ring-1 ring-indigo-300/20"
      aria-label="밤 퀴즈 미리보기"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-200">
          <MoonStar className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-wider text-indigo-200/90">
            밤 퀴즈 미리보기 · {roleLabel}
          </p>
          <p className="mt-0.5 text-[11px] text-white/50">
            {QUIZ_MODE_LABELS[config.mode]} · 제한 {config.timeLimitSec}초 · 성공
            기준 {config.successThresholdPercent}%
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
        <p className="text-[11px] font-bold text-white/45">출제 문제</p>
        <div className="mt-2 text-base font-bold leading-relaxed text-white">
          <MathText text={config.question} />
        </div>
      </div>

      {config.choices.length >= 4 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {config.choices.map((choice, index) => (
            <li
              key={`${index}-${choice}`}
              className="rounded-lg bg-white/5 px-3 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/10"
            >
              <span className="mr-2 font-mono text-xs text-indigo-200">
                {index + 1}
              </span>
              <MathText text={choice} />
            </li>
          ))}
        </ul>
      )}

      {config.successHint?.trim() && (
        <p className="mt-3 rounded-lg bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100/90 ring-1 ring-amber-300/20">
          성공 시 힌트: {config.successHint}
        </p>
      )}

      <p className="mt-3 text-[11px] text-white/40">
        밤이 시작되면 같은 문제가 출제됩니다. 선생님이 수정하면 여기도 즉시
        바뀝니다.
      </p>
    </section>
  );
}
