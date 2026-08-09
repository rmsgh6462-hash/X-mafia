'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import type { Theme } from '@/types/game';

export type BackgroundPhase = 'WAITING' | 'DAY' | 'NIGHT' | 'RESULT';

export interface GameBackgroundProps {
  theme: Theme;
  gameState: BackgroundPhase;
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
      return 'bg-gradient-to-b from-amber-900/35 via-black/30 to-black/65';
    default:
      return 'bg-black/20';
  }
}

function seeded(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function PixelCharacter({ index }: { index: number }) {
  const palette = [
    { body: '#E8A87C', accent: '#6B8E4E', hat: '#C45C26' },
    { body: '#F2C4A0', accent: '#4A7C59', hat: '#8B5A2B' },
    { body: '#D4A574', accent: '#5B7C99', hat: '#A0522D' },
    { body: '#E0B090', accent: '#9B6B9E', hat: '#5D4037' },
  ];
  const colors = palette[index % palette.length];
  const left = 6 + seeded(index + 1) * 88;
  const top = 18 + seeded(index + 7) * 55;
  const size = 42 + Math.floor(seeded(index + 3) * 22);
  const duration = 3.2 + seeded(index + 11) * 2.4;
  const delay = seeded(index + 17) * 1.8;
  const xDrift = (seeded(index + 23) - 0.5) * 28;

  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{ left: left + '%', top: top + '%', width: size, height: size }}
      initial={{ opacity: 0, y: 24, scale: 0.6 }}
      animate={{
        opacity: 1,
        y: [0, -14, 0, -8, 0],
        x: [0, xDrift, 0],
        scale: 1,
      }}
      exit={{ opacity: 0, y: -20, scale: 0.5 }}
      transition={{
        opacity: { duration: 0.45 },
        scale: { type: 'spring', stiffness: 220, damping: 16 },
        y: { duration, repeat: Infinity, ease: 'easeInOut', delay },
        x: { duration: duration * 1.35, repeat: Infinity, ease: 'easeInOut', delay },
      }}
    >
      <svg
        viewBox="0 0 16 16"
        width="100%"
        height="100%"
        style={{ imageRendering: 'pixelated' }}
        aria-hidden
      >
        <rect x="4" y="1" width="8" height="2" fill={colors.hat} />
        <rect x="3" y="3" width="10" height="1" fill={colors.hat} />
        <rect x="4" y="4" width="8" height="5" fill={colors.body} />
        <rect x="5" y="5" width="2" height="2" fill="#1a1a1a" />
        <rect x="9" y="5" width="2" height="2" fill="#1a1a1a" />
        <rect x="6" y="7" width="4" height="1" fill="#c4785a" />
        <rect x="4" y="9" width="8" height="4" fill={colors.accent} />
        <rect x="5" y="10" width="6" height="2" fill="#ffffff" opacity="0.35" />
        <rect x="4" y="13" width="3" height="3" fill="#2c2c2c" />
        <rect x="9" y="13" width="3" height="3" fill="#2c2c2c" />
      </svg>
    </motion.div>
  );
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
          <motion.div
            className="absolute -inset-x-[20%] inset-y-0"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
              filter: 'blur(28px)',
            }}
            animate={{ x: ['-15%', '15%', '-15%'] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function GameBackground({
  theme,
  gameState,
  playerCount = 0,
  className = '',
  children,
}: GameBackgroundProps) {
  const sceneKey = resolveSceneKey(gameState);
  const scene = SCENE_IMAGES[sceneKey];
  const overlayClass = getOverlayClass(gameState);
  const isNight = gameState === 'NIGHT';
  const showFloaters = gameState === 'WAITING' && playerCount > 0;

  const floaters = useMemo(
    () => Array.from({ length: Math.min(playerCount, 24) }, (_, i) => i),
    [playerCount],
  );

  return (
    <div
      className={'relative h-full w-full overflow-hidden bg-black ' + className}
      aria-hidden={!children}
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={sceneKey}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: [0.4, 0, 0.2, 1] }}
        >
          <Image
            src={scene.src}
            alt={scene.alt}
            fill
            priority
            quality={90}
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="sync">
        <motion.div
          key={theme + '-' + gameState + '-overlay'}
          className={'absolute inset-0 z-[1] ' + overlayClass}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
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
            transition={{ duration: 2.2, ease: 'easeOut' }}
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
              'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.65) 100%)',
          }}
        />
      )}

      <AnimatePresence>
        {showFloaters && (
          <div className="absolute inset-0 z-[4]">
            {floaters.map((index) => (
              <PixelCharacter key={index} index={index} />
            ))}
          </div>
        )}
      </AnimatePresence>

      {children && (
        <div className="relative z-[10] h-full w-full">{children}</div>
      )}
    </div>
  );
}
