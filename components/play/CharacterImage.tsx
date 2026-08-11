'use client';

import { useEffect, useMemo, useState, type ImgHTMLAttributes } from 'react';
import {
  getCharacterImageUrl,
  type CharacterState,
} from '@/lib/characterUtils';

type CharacterImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'onError'
> & {
  characterId: string;
  state?: CharacterState;
  /** 보안 뷰어 매핑으로 계산된 요청 URL. 누락 시 state로 생성한다. */
  imageUrl?: string;
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
  imageUrl,
  alt = '',
  onError,
  ...imageProps
}: CharacterImageProps) {
  const normalSrc = getCharacterImageUrl(characterId, 'normal');
  const requestedSrc = imageUrl ?? getCharacterImageUrl(characterId, state);
  const fallbackSources = useMemo(() => {
    const sources = [requestedSrc];

    // 허탕 전용 일러스트가 아직 없는 캐릭터는 의사 상태를 거쳐 기본 상태로 대체한다.
    if (state === 'doctor_fail') {
      sources.push(getCharacterImageUrl(characterId, 'doctor'));
    }
    if (state === 'doctor_idle') {
      sources.push(getCharacterImageUrl(characterId, 'doctor'));
    }
    if (state === 'reporter_idle') {
      sources.push(getCharacterImageUrl(characterId, 'reporter'));
    }
    if (state !== 'normal') {
      sources.push(normalSrc);
    }

    return [...new Set(sources)];
  }, [characterId, normalSrc, requestedSrc, state]);
  const [sourceIndex, setSourceIndex] = useState(0);

  const src = fallbackSources[sourceIndex] ?? normalSrc;
  const {
    className = '',
    onLoad: callerOnLoad,
    ...restImageProps
  } = imageProps;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const resetTimer = window.setTimeout(() => setSourceIndex(0), 0);
    return () => window.clearTimeout(resetTimer);
  }, [characterId, state, requestedSrc]);

  return (
    <>
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-800/90 animate-pulse"
        >
          <span className="h-1/4 w-1/4 rounded-full bg-slate-500/60" />
          <span className="h-1/3 w-1/2 rounded-t-[45%] bg-slate-500/45" />
        </div>
      )}
      <img
        {...restImageProps}
        src={src}
        alt={alt}
        className={`${className} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={(event) => {
          setLoaded(true);
          callerOnLoad?.(event);
        }}
        onError={(event) => {
          setLoaded(false);
          const nextIndex = sourceIndex + 1;
          if (nextIndex < fallbackSources.length) {
            setSourceIndex(nextIndex);
            return;
          }

          event.currentTarget.style.visibility = 'hidden';
          onError?.(event);
        }}
      />
    </>
  );
}

export type { CharacterImageProps };
