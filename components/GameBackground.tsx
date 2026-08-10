'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { Theme } from '@/types/game';

export type BackgroundPhase = 'WAITING' | 'DAY' | 'NIGHT' | 'RESULT';

export interface GameBackgroundProps {
  theme: Theme;
  gameState: BackgroundPhase;
  /** @deprecated 떠다니는 픽셀 캐릭터는 제거됨. 호환용으로만 유지. */
  playerCount?: number;
  className?: string;
  children?: React.ReactNode;
}

type SceneKey = 'VILLAGE_DAY' | 'VILLAGE_NIGHT';

const SCENE_IMAGES: Record<SceneKey, { src: string; alt: string }> = {
  VILLAGE_DAY: {
    src: '/backgrounds/village-day.png',
    alt: '햇살이 비치는 평화로운 마을 광장',
  },
  VILLAGE_NIGHT: {
    src: '/backgrounds/village-night.png',
    alt: '달빛과 등불이 비치는 고요한 밤의 마을',
  },
};

function resolveSceneKey(gameState: BackgroundPhase): SceneKey {
  // 밤만 밤 배경, 아침 발표(RESULT)·낮·대기는 아침(낮) 배경
  return gameState === 'NIGHT' ? 'VILLAGE_NIGHT' : 'VILLAGE_DAY';
}

function getOverlayClass(gameState: BackgroundPhase): string {
  switch (gameState) {
    case 'WAITING':
      return 'bg-gradient-to-b from-sky-900/10 via-amber-100/15 to-emerald-900/25';
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

export default function GameBackground({
  theme,
  gameState,
  className = '',
  children,
}: GameBackgroundProps) {
  const sceneKey = resolveSceneKey(gameState);
  const scene = SCENE_IMAGES[sceneKey];
  const overlayClass = getOverlayClass(gameState);
  const isNight = gameState === 'NIGHT';

  return (
    <div
      className={'relative h-full w-full overflow-hidden bg-black ' + className}
      aria-hidden={!children}
    >
      {/* mode=wait: 대형 PNG 동시 디코딩으로 아침 전환 시 렌더러가 죽는 것을 방지 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={sceneKey}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
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

      <AnimatePresence mode="wait">
        <motion.div
          key={theme + '-' + gameState + '-overlay'}
          className={'absolute inset-0 z-[1] ' + overlayClass}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />
      </AnimatePresence>

      <MistLayer active={isNight} />

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

      {children && (
        <div className="relative z-[10] h-full w-full">{children}</div>
      )}
    </div>
  );
}
