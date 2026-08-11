'use client';

import { useEffect, useState } from 'react';
import { BriefcaseMedical, Newspaper, Search, Stethoscope } from 'lucide-react';
import {
  getEventIllustrationPath,
  type EventIllustrationKind,
} from '@/lib/characterUtils';

const LABELS: Record<EventIllustrationKind, string> = {
  doctor_confused: '익명의 당황한 의사 기록 일러스트',
  doctor_idle: '익명의 의사 미활동 일러스트',
  doctor_fail: '익명의 의사 구조 실패 일러스트',
  reporter_idle: '익명의 기자 미활동 일러스트',
  anonymous_reporter: 'X-마피아 신문사 익명 엠블럼',
};

export function EventIllustration({
  kind,
  size = 160,
  className = '',
}: {
  kind: EventIllustrationKind;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    let cancelled = false;
    const probe = new window.Image();
    probe.onload = () => {
      if (!cancelled) setFailed(false);
    };
    probe.onerror = () => {
      if (!cancelled) setFailed(true);
    };
    probe.src = getEventIllustrationPath(kind);
    return () => {
      cancelled = true;
    };
  }, [kind]);
  const isDoctor =
    kind === 'doctor_confused' || kind === 'doctor_idle' || kind === 'doctor_fail';
  const isReporter = !isDoctor;
  const Icon = isDoctor ? Stethoscope : kind === 'reporter_idle' ? Search : Newspaper;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[26%] border-2 ${
        isDoctor
          ? 'border-emerald-200/45 bg-emerald-950/70 text-emerald-100'
          : 'border-amber-200/45 bg-amber-950/70 text-amber-100'
      } ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={LABELS[kind]}
    >
      {!failed && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={getEventIllustrationPath(kind)}
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
          loading="eager"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      <div
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-3 text-center ${failed ? '' : 'opacity-0'}`}
      >
        <div
          className={`flex h-24 w-24 items-center justify-center rounded-full ring-1 ${
            isDoctor
              ? 'bg-emerald-300/10 text-emerald-100 ring-emerald-200/30'
              : 'bg-amber-300/10 text-amber-100 ring-amber-200/30'
          }`}
        >
          {isDoctor ? (
            <BriefcaseMedical className="h-12 w-12" strokeWidth={1.5} />
          ) : (
            <Icon className="h-12 w-12" strokeWidth={1.5} />
          )}
        </div>
        <span className="text-xs font-black leading-tight tracking-[0.12em]">
          {isReporter
            ? kind === 'anonymous_reporter'
              ? 'X-신문사'
              : 'ANONYMOUS'
            : kind === 'doctor_fail'
              ? 'MISSION FAILED'
              : kind === 'doctor_confused'
                ? 'NIGHT LOG'
                : 'MEDICAL LOG'}
        </span>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_26%,rgba(255,255,255,.18),transparent_42%),linear-gradient(to_top,rgba(2,6,23,.42),transparent_65%)]" />
    </div>
  );
}
