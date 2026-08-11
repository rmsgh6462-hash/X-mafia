'use client';

import { motion } from 'framer-motion';

export type SceneCastPhase = 'WAITING' | 'DAY' | 'NIGHT';

const CAST = [
  { id: 'mafia', label: '얼굴을 가린 마피아' },
  { id: 'citizen', label: '얼굴을 가린 시민' },
  { id: 'spiritualist', label: '얼굴을 가린 영매사' },
  { id: 'police', label: '얼굴을 가린 경찰' },
  { id: 'doctor', label: '얼굴을 가린 의사' },
  { id: 'reporter', label: '얼굴을 가린 기자' },
] as const;

const WAITING_LAYOUT = [
  'left-[-1rem] rotate-[-5deg] opacity-90',
  'left-[14%] hidden rotate-[-3deg] opacity-80 sm:block',
  'left-[29%] hidden rotate-[2deg] opacity-80 sm:block',
  'right-[29%] hidden rotate-[-2deg] opacity-80 sm:block',
  'right-[14%] hidden rotate-[3deg] opacity-80 sm:block',
  'right-[-1rem] rotate-[5deg] opacity-90',
];

function SceneImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      className={className}
      loading="eager"
      decoding="async"
      draggable={false}
    />
  );
}

function WaitingCast() {
  return (
    <>
      <div className="absolute inset-x-[4%] bottom-[1%] h-16 rounded-[50%] bg-slate-950/35 blur-2xl" />
      <div className="absolute inset-x-0 bottom-0 h-[32%] bg-gradient-to-t from-slate-950/35 via-transparent to-transparent" />
      {CAST.map((character, index) => (
        <motion.div
          key={character.id}
          className={`absolute bottom-0 h-[clamp(14rem,32vw,27rem)] w-[clamp(8rem,18vw,16rem)] ${WAITING_LAYOUT[index]}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: index * 0.07, ease: 'easeOut' }}
        >
          <SceneImage
            src={`/images/scene-cast/${character.id}.png`}
            alt={character.label}
            className="h-full w-full object-contain drop-shadow-[0_1.2rem_1.5rem_rgba(0,0,0,0.65)]"
          />
        </motion.div>
      ))}
    </>
  );
}

function DiscussionCast() {
  return (
    <>
      <div className="absolute inset-x-[8%] bottom-[3%] h-24 rounded-[50%] bg-amber-950/35 blur-3xl" />
      <motion.div
        className="absolute bottom-[-1.25rem] left-1/2 w-[min(96vw,78rem)] -translate-x-1/2 opacity-90"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 0.9, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <SceneImage
          src="/images/scene-cast/discussion-citizens.png"
          alt="서로 마주 보고 이야기하는 시민 실루엣들"
          className="h-auto w-full object-contain drop-shadow-[0_1.2rem_1.5rem_rgba(0,0,0,0.6)]"
        />
      </motion.div>
    </>
  );
}

function NightCast() {
  return (
    <>
      <div className="absolute inset-x-[10%] bottom-[4%] h-32 rounded-[50%] bg-red-950/45 blur-3xl" />
      <motion.div
        className="absolute bottom-[-1rem] left-1/2 w-[min(92vw,74rem)] -translate-x-1/2 opacity-95"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 0.95, scale: 1 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      >
        <SceneImage
          src="/images/scene-cast/night-mafia-chase.png"
          alt="밤길에서 도망가는 실루엣을 바라보는 마피아 실루엣"
          className="h-auto w-full object-contain drop-shadow-[0_1.4rem_1.8rem_rgba(0,0,0,0.8)]"
        />
      </motion.div>
    </>
  );
}

export function SceneCharacterDecor({ phase }: { phase: SceneCastPhase }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[4] overflow-hidden"
      aria-hidden="true"
    >
      {phase === 'WAITING' && <WaitingCast />}
      {phase === 'DAY' && <DiscussionCast />}
      {phase === 'NIGHT' && <NightCast />}
    </div>
  );
}
