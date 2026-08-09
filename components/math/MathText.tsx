'use client';

import { parseMathText } from '@/lib/game/fractionFormat';

function StackedFraction({
  num,
  den,
  size = 'md',
}: {
  num: number;
  den: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const box =
    size === 'lg'
      ? 'min-w-[1.35em] text-[1.05em]'
      : size === 'sm'
        ? 'min-w-[1em] text-[0.92em]'
        : 'min-w-[1.15em] text-[0.98em]';
  const pad = size === 'lg' ? 'px-1' : 'px-0.5';

  return (
    <span
      className={`mx-[0.12em] inline-flex ${box} flex-col items-center align-middle font-black leading-none tabular-nums`}
      aria-label={`${den}분의 ${num}`}
    >
      <span className={`${pad} border-b-[1.5px] border-current pb-[0.12em]`}>{num}</span>
      <span className={`${pad} pt-[0.12em]`}>{den}</span>
    </span>
  );
}

function MixedFraction({
  whole,
  num,
  den,
  size = 'md',
}: {
  whole: number;
  num: number;
  den: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span
      className="mx-[0.08em] inline-flex items-center align-middle"
      aria-label={`${whole}과 ${den}분의 ${num}`}
    >
      <span className="font-black tabular-nums">{whole}</span>
      <StackedFraction num={num} den={den} size={size} />
    </span>
  );
}

/** 퀴즈 문항·보기 문자열의 분수/대분수를 세로 분수 형태로 렌더 */
export function MathText({
  text,
  className = '',
  size = 'md',
}: {
  text: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const tokens = parseMathText(text);

  return (
    <span className={`inline [text-wrap:pretty] ${className}`}>
      {tokens.map((token, index) => {
        if (token.type === 'text') {
          return <span key={index}>{token.value}</span>;
        }
        if (token.type === 'mixed') {
          return (
            <MixedFraction
              key={index}
              whole={token.whole}
              num={token.num}
              den={token.den}
              size={size}
            />
          );
        }
        return (
          <StackedFraction
            key={index}
            num={token.num}
            den={token.den}
            size={size}
          />
        );
      })}
    </span>
  );
}
