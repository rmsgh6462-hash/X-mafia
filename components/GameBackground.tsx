'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { Theme } from '@/types/game';

export type BackgroundPhase = 'WAITING' | 'DAY' | 'NIGHT' | 'RESULT';

/** 게임 시작 시 모든 화면이 공유하는 해질녘→밤→아침 연출 길이 */
export const OPENING_SEQUENCE_DURATION_MS = 6500;
/** 밤 결과 집계 후 밤→아침 배경 전환 길이 */
export const MORNING_TRANSITION_DURATION_MS = 3200;

export interface GameBackgroundProps {
  theme: Theme;
  gameState: BackgroundPhase;
  /** @deprecated 떠다니는 픽셀 캐릭터는 제거됨. 호환용으로만 유지. */
  playerCount?: number;
  /** 대기/낮/밤 화면에 장면용 얼굴 가린 실루엣 표시 */
  sceneCast?: boolean;
  /** 게임 시작 시 해질녘→밤→아침 연출을 모든 화면에서 동기화하는 시각 */
  openingSequenceStartedAt?: number | null;
  /** 밤 결과 집계 시각. 짧은 밤→아침 전환을 동기화한다. */
  morningTransitionStartedAt?: number | null;
  className?: string;
  children?: React.ReactNode;
}

type SceneKey =
  | 'VILLAGE_DAY'
  | 'VILLAGE_DAY_CAST'
  | 'VILLAGE_DUSK'
  | 'VILLAGE_DUSK_CAST'
  | 'VILLAGE_NIGHT'
  | 'VILLAGE_NIGHT_CAST';

const SCENE_IMAGES: Record<SceneKey, { src: string; alt: string }> = {
  VILLAGE_DAY: {
    src: '/backgrounds/village-day.png',
    alt: '햇살이 비치는 평화로운 마을 광장',
  },
  VILLAGE_DAY_CAST: {
    src: '/backgrounds/village-day-cast.png',
    alt: '시민 실루엣들이 모여 토론하는 낮의 마을 광장',
  },
  VILLAGE_DUSK: {
    src: '/backgrounds/village-dusk.png',
    alt: '해질녘 안개가 내려앉은 마을 광장',
  },
  VILLAGE_DUSK_CAST: {
    src: '/backgrounds/village-dusk-cast.png',
    alt: '여섯 실루엣이 모여 있는 해질녘 안개 마을 광장',
  },
  VILLAGE_NIGHT: {
    src: '/backgrounds/village-night.png',
    alt: '달빛과 등불이 비치는 고요한 밤의 마을',
  },
  VILLAGE_NIGHT_CAST: {
    src: '/backgrounds/village-night-cast.png',
    alt: '마피아 실루엣이 도망가는 사람을 바라보는 밤의 마을',
  },
};

function resolveSceneKey(
  gameState: BackgroundPhase,
  withSceneCast: boolean,
): SceneKey {
  // 대기=해질녘, 낮·아침 발표=낮, 밤=밤 배경
  if (gameState === 'NIGHT') {
    return withSceneCast ? 'VILLAGE_NIGHT_CAST' : 'VILLAGE_NIGHT';
  }
  if (gameState === 'WAITING') {
    return withSceneCast ? 'VILLAGE_DUSK_CAST' : 'VILLAGE_DUSK';
  }
  return withSceneCast ? 'VILLAGE_DAY_CAST' : 'VILLAGE_DAY';
}

type OpeningStep = 'DUSK' | 'NIGHT' | 'DAWN';

function getOpeningStep(
  startedAt: number | null | undefined,
  now: number,
): OpeningStep | null {
  if (typeof startedAt !== 'number') return null;
  const elapsed = now - startedAt;
  if (elapsed < 0 || elapsed >= OPENING_SEQUENCE_DURATION_MS) return null;
  if (elapsed < 1400) return 'DUSK';
  if (elapsed < 4000) return 'NIGHT';
  return 'DAWN';
}

function isMorningNightStep(
  startedAt: number | null | undefined,
  now: number,
): boolean {
  if (typeof startedAt !== 'number') return false;
  const elapsed = now - startedAt;
  return elapsed >= 0 && elapsed < 850;
}

function OpeningSequenceOverlay({ step }: { step: OpeningStep | null }) {
  if (!step) return null;

  const copy = {
    DUSK: {
      eyebrow: 'X-MAFIA · TIME PASSES',
      title: '해질녘의 마을',
      message: '촛불이 하나둘 켜지고, 마을에 밤의 기척이 내려옵니다.',
    },
    NIGHT: {
      eyebrow: 'X-MAFIA · NIGHTFALL',
      title: '밤이 찾아옵니다',
      message: '모두가 잠든 밤, 각자의 시간이 시작됩니다.',
    },
    DAWN: {
      eyebrow: 'X-MAFIA · FIRST LIGHT',
      title: '새벽이 밝아옵니다',
      message: '마을이 깨어나고, 첫 번째 토론이 시작됩니다.',
    },
  }[step];

  return (
    <motion.div
      key={step}
      className="pointer-events-auto absolute inset-0 z-[40] flex items-center justify-center bg-slate-950/30 px-6 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.1, ease: 'easeInOut' }}
    >
      <motion.div
        className="max-w-xl text-center text-white drop-shadow-2xl"
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      >
        <p className="text-[10px] font-black tracking-[0.42em] text-amber-200/75 sm:text-xs">
          {copy.eyebrow}
        </p>
        <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-7xl">
          {copy.title}
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-sm font-semibold leading-relaxed text-white/75 sm:text-xl">
          {copy.message}
        </p>
        <div className="mx-auto mt-8 h-1 w-48 overflow-hidden rounded-full bg-white/15">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-200 via-white to-indigo-200"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.4, ease: 'linear' }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function getOverlayClass(gameState: BackgroundPhase): string {
  switch (gameState) {
    case 'WAITING':
      return 'bg-gradient-to-b from-indigo-950/20 via-amber-800/10 to-slate-950/25';
    case 'DAY':
      return 'bg-gradient-to-b from-sky-300/10 via-transparent to-amber-900/20';
    case 'NIGHT':
      return 'bg-gradient-to-b from-red-950/55 via-indigo-950/45 to-black/70';
    case 'RESULT':
      return 'bg-gradient-to-b from-amber-200/20 via-orange-100/10 to-amber-900/25';
    default:
      return 'bg-black/20';
  }
}

function MistLayer({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="mist"
          className="pointer-events-none absolute inset-0 z-[2]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: 'easeInOut' }}
        >
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 80% 50% at 50% 80%, rgba(180,40,40,0.25), transparent 70%), linear-gradient(180deg, transparent 20%, rgba(20,10,30,0.35) 100%)',
            }}
            animate={{ opacity: [0.55, 0.85, 0.6] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DuskMistLayer({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="dusk-mist"
          className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        >
          <motion.div
            className="absolute -inset-x-[15%] bottom-[8%] h-32"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(226,232,240,0.32), rgba(148,163,184,0.12) 42%, transparent 72%)',
              filter: 'blur(16px)',
            }}
            animate={{ x: ['-4%', '4%', '-4%'], opacity: [0.55, 0.88, 0.55] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            aria-hidden="true"
            className="absolute -inset-x-[22%] bottom-[20%] h-20"
            style={{
              background:
                'radial-gradient(ellipse at 30% 50%, rgba(241,245,249,0.18), transparent 58%), radial-gradient(ellipse at 72% 45%, rgba(226,232,240,0.14), transparent 55%)',
              filter: 'blur(22px)',
            }}
            animate={{ x: ['5%', '-5%', '5%'], opacity: [0.35, 0.7, 0.35] }}
            transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function GameBackground({
  theme,
  gameState,
  sceneCast = false,
  openingSequenceStartedAt = null,
  morningTransitionStartedAt = null,
  className = '',
  children,
}: GameBackgroundProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const endTimes = [
      typeof openingSequenceStartedAt === 'number'
        ? openingSequenceStartedAt + OPENING_SEQUENCE_DURATION_MS
        : null,
      typeof morningTransitionStartedAt === 'number'
        ? morningTransitionStartedAt + MORNING_TRANSITION_DURATION_MS
        : null,
    ].filter((value): value is number => value !== null);
    const endAt = Math.max(...endTimes, 0);
    if (endAt <= Date.now()) {
      setNow(Date.now());
      return;
    }

    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 100);
    const finish = window.setTimeout(() => {
      window.clearInterval(id);
      setNow(Date.now());
    }, endAt - Date.now() + 50);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(finish);
    };
  }, [openingSequenceStartedAt, morningTransitionStartedAt]);

  const openingStep = getOpeningStep(openingSequenceStartedAt, now);
  const morningNight =
    gameState === 'RESULT' &&
    isMorningNightStep(morningTransitionStartedAt, now);
  const visualPhase: BackgroundPhase = openingStep
    ? openingStep === 'NIGHT'
      ? 'NIGHT'
      : openingStep === 'DUSK'
        ? 'WAITING'
        : 'DAY'
    : morningNight
      ? 'NIGHT'
      : gameState;
  // 게임 시작 첫 밤에는 인물 없는 원본 밤 배경으로 전환해 밤의 시작을 분명하게 보여준다.
  const useSceneCast = sceneCast && openingStep !== 'NIGHT';
  const sceneKey = resolveSceneKey(visualPhase, useSceneCast);
  const scene = SCENE_IMAGES[sceneKey];
  const overlayClass = getOverlayClass(visualPhase);
  const isNight = visualPhase === 'NIGHT';
  const isWaiting = visualPhase === 'WAITING';

  return (
    <div
      className={'relative h-full w-full overflow-hidden bg-black ' + className}
      aria-hidden={!children}
    >
      {/* mode=wait: 대형 PNG 동시 디코딩으로 아침 전환 시 렌더러가 죽는 것을 방지 */}
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={sceneKey}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.2, ease: 'easeInOut' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={scene.src}
            alt={scene.alt}
            className="h-full w-full object-cover"
            decoding="async"
            fetchPriority={isNight ? 'high' : 'auto'}
            draggable={false}
          />
        </motion.div>
      </AnimatePresence>

      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={theme + '-' + gameState + '-overlay'}
          className={'absolute inset-0 z-[1] ' + overlayClass}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.8, ease: 'easeInOut' }}
        />
      </AnimatePresence>

      <MistLayer active={isNight} />
      <DuskMistLayer active={isWaiting} />

      <AnimatePresence>
        {isNight && (
          <motion.div
            key="blackout"
            className="pointer-events-none absolute inset-0 z-[3] bg-black"
            initial={{ opacity: 0.75 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {gameState === 'RESULT' && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-[2]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 40%, rgba(120, 53, 15, 0.28) 100%)',
          }}
        />
      )}

      <AnimatePresence mode="wait">
        <OpeningSequenceOverlay step={openingStep} />
      </AnimatePresence>

      {children && (
        <div className="relative z-[10] h-full w-full">{children}</div>
      )}
    </div>
  );
}
