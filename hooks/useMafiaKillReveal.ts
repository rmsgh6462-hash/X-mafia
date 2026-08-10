'use client';

import { useEffect, useState } from 'react';
import { playGunshot } from '@/lib/audioManager';

const IMPACT_DELAY_MS = 500;
const FLASH_DURATION_MS = 420;

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

    const impactTimer = window.setTimeout(() => {
      void playGunshot({
        onFlash: () => {
          setShowWhiteFlash(true);
          window.setTimeout(() => setShowWhiteFlash(false), FLASH_DURATION_MS);
        },
      });
      setImpactReady(true);
    }, IMPACT_DELAY_MS);

    return () => window.clearTimeout(impactTimer);
  }, [wasKilled, targetKey]);

  return { impactReady, showWhiteFlash };
}
