/** 퀴즈 문항·보기용 분수/대분수 마크업 및 변환 */

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function lcm(a: number, b: number): number {
  if (!a || !b) return Math.abs(a || b);
  return Math.abs(a * b) / gcd(a, b);
}

export function reduceFraction(num: number, den: number): { num: number; den: number } {
  if (den === 0) return { num, den: 1 };
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

/** 진분수 `{{3/8}}` */
export function fracMarkup(num: number, den: number, reduce = false): string {
  const f = reduce ? reduceFraction(num, den) : { num, den };
  return `{{${f.num}/${f.den}}}`;
}

/** 대분수 `{{1 2/3}}` — 가분수는 자동 변환, 정수는 숫자만 */
export function mixedMarkup(num: number, den: number, reduce = true): string {
  if (den <= 0) return String(num);
  const f = reduce ? reduceFraction(num, den) : { num, den };
  if (f.num === 0) return '0';
  if (f.den === 1) return String(f.num);
  if (f.num < f.den) return `{{${f.num}/${f.den}}}`;
  const whole = Math.floor(f.num / f.den);
  const rem = f.num % f.den;
  if (rem === 0) return String(whole);
  return `{{${whole} ${rem}/${f.den}}}`;
}

/** 가분수 형태 유지 `{{8/5}}` */
export function improperMarkup(num: number, den: number, reduce = false): string {
  return fracMarkup(num, den, reduce);
}

export type MathToken =
  | { type: 'text'; value: string }
  | { type: 'fraction'; num: number; den: number }
  | { type: 'mixed'; whole: number; num: number; den: number };

/**
 * 퀴즈 문자열을 토큰으로 분해한다.
 * 1) 명시 마크업 `{{1 2/3}}`, `{{3/8}}`
 * 2) 일반 슬래시 `1 2/3`, `3/8` (교사 직접 출제·구버전 호환)
 */
export function parseMathText(input: string): MathToken[] {
  if (!input) return [{ type: 'text', value: '' }];

  const tokens: MathToken[] = [];
  // 마크업 우선, 그다음 대분수 평문, 그다음 진/가분수 평문
  // lookbehind 없이: 마크업 → 대분수 평문 → 일반 분수 평문
  const re =
    /\{\{(\d+)\s+(\d+)\/(\d+)\}\}|\{\{(\d+)\/(\d+)\}\}|(\d+)\s+(\d+)\/(\d+)|(\d+)\/(\d+)/g;

  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    if (match.index > last) {
      tokens.push({ type: 'text', value: input.slice(last, match.index) });
    }
    if (match[1] != null && match[2] != null && match[3] != null) {
      tokens.push({
        type: 'mixed',
        whole: Number(match[1]),
        num: Number(match[2]),
        den: Number(match[3]),
      });
    } else if (match[4] != null && match[5] != null) {
      tokens.push({
        type: 'fraction',
        num: Number(match[4]),
        den: Number(match[5]),
      });
    } else if (match[6] != null && match[7] != null && match[8] != null) {
      tokens.push({
        type: 'mixed',
        whole: Number(match[6]),
        num: Number(match[7]),
        den: Number(match[8]),
      });
    } else if (match[9] != null && match[10] != null) {
      tokens.push({
        type: 'fraction',
        num: Number(match[9]),
        den: Number(match[10]),
      });
    }
    last = match.index + match[0].length;
  }
  if (last < input.length) {
    tokens.push({ type: 'text', value: input.slice(last) });
  }
  return tokens.length > 0 ? tokens : [{ type: 'text', value: input }];
}
