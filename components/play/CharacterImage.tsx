'use client';

import { useEffect, useMemo, useState, type ImgHTMLAttributes } from 'react';
import {
  getCharacterImage,
  type CharacterState,
} from '@/lib/characterUtils';

type CharacterImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'onError'
> & {
  characterId: string;
  state?: CharacterState;
  onError?: ImgHTMLAttributes<HTMLImageElement>['onError'];
};

/**
 * 상태 이미지가 없거나 로딩에 실패하면 같은 캐릭터의 normal.png로 한 번만
 * 안전하게 대체한다. normal.png까지 없을 때는 브라우저 기본 broken image를
 * 노출하지 않고 해당 이미지 요소를 숨긴다.
 */
export function CharacterImage({
  characterId,
  state = 'normal',
  alt = '',
  onError,
  ...imageProps
}: CharacterImageProps) {
  const normalSrc = getCharacterImage(characterId, 'normal');
  const requestedSrc = getCharacterImage(characterId, state);
  const fallbackSources = useMemo(() => {
    const sources = [requestedSrc];

    // 허탕 전용 일러스트가 아직 없는 캐릭터는 의사 상태를 거쳐 기본 상태로 대체한다.
    if (state === 'doctor_fail') {
      sources.push(getCharacterImage(characterId, 'doctor'));
    }
    if (state !== 'normal') {
      sources.push(normalSrc);
    }

    return [...new Set(sources)];
  }, [characterId, normalSrc, requestedSrc, state]);
  const [sourceIndex, setSourceIndex] = useState(0);

  const src = fallbackSources[sourceIndex] ?? normalSrc;

  useEffect(() => {
    const resetTimer = window.setTimeout(() => setSourceIndex(0), 0);
    return () => window.clearTimeout(resetTimer);
  }, [characterId, state, requestedSrc]);

  return (
    <img
      {...imageProps}
      src={src}
      alt={alt}
      onError={(event) => {
        const nextIndex = sourceIndex + 1;
        if (nextIndex < fallbackSources.length) {
          setSourceIndex(nextIndex);
          return;
        }

        event.currentTarget.style.visibility = 'hidden';
        onError?.(event);
      }}
    />
  );
}

export type { CharacterImageProps };
