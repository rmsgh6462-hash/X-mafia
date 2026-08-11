'use client';

import { useEffect, useState } from 'react';
import { playGunshot, playMorningBirds } from '@/lib/audioManager';

const IMPACT_DELAY_MS = 500;
const FLASH_DURATION_MS = 420;
const MORNING_BIRD_DELAY_MS = 920;
const DEATH_REVEAL_DELAY_MS = 1450;

/**
 * 마피아 습격 사망 공개: 0.5초 긴장 후 총소리 + 하얀 플래시, 이후 사망 이미지 노출.
 */
export function useMafiaKillReveal(wasKilled: boolean, targetKey: string | null) {
  const [impactReady, setImpactReady] = useState(!wasKilled);
  const [showWhiteFlash, setShowWhiteFlash] = useState(false);

  useEffect(() => {
    if (!wasKilled) {
      setImpactReady(true);
      setShowWhiteFlash(false);
      return;
    }

    setImpactReady(false);
    setShowWhiteFlash(false);

    let birdTimer: number | null = null;
    let revealTimer: number | null = null;
    const impactTimer = window.setTimeout(() => {
      void playGunshot({
        onFlash: () => {
          setShowWhiteFlash(true);
          window.setTimeout(() => setShowWhiteFlash(false), FLASH_DURATION_MS);
        },
      });
      // 총소리 뒤 새소리가 들리고, 그 다음에 사망자 카드를 공개한다.
      birdTimer = window.setTimeout(() => {
        void playMorningBirds().catch(() => undefined);
      }, MORNING_BIRD_DELAY_MS - IMPACT_DELAY_MS);
      revealTimer = window.setTimeout(
        () => setImpactReady(true),
        DEATH_REVEAL_DELAY_MS - IMPACT_DELAY_MS,
      );
    }, IMPACT_DELAY_MS);

    return () => {
      window.clearTimeout(impactTimer);
      if (birdTimer !== null) window.clearTimeout(birdTimer);
      if (revealTimer !== null) window.clearTimeout(revealTimer);
    };
  }, [wasKilled, targetKey]);

  return { impactReady, showWhiteFlash };
}
