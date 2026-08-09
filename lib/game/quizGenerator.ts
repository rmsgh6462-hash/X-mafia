/** 초등 퀴즈 자동 생성기 */

export type QuizMode = 'MATH' | 'KOREAN' | 'CUSTOM';
export type ElementaryGrade = 1 | 2 | 3 | 4 | 5 | 6;

export interface GeneratedQuiz {
  question: string;
  /** 정답 텍스트 (choices 중 하나) */
  answer: string;
  /** 항상 4지선다 */
  choices: [string, string, string, string];
  /** 0~3 정답 인덱스 */
  correctIndex: number;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildChoices(correct: number | string, distractors: Array<number | string>): GeneratedQuiz {
  const correctStr = String(correct);
  const unique = [
    correctStr,
    ...distractors.map(String).filter((d) => d !== correctStr),
  ];
  while (unique.length < 4) {
    const n =
      typeof correct === 'number'
        ? correct + randInt(-5, 8)
        : `${correctStr}${randInt(1, 9)}`;
    const s = String(n);
    if (!unique.includes(s) && s !== correctStr) unique.push(s);
  }
  const picked = shuffle(unique.slice(0, 4)) as string[];
  // ensure 4
  while (picked.length < 4) picked.push(`보기${picked.length + 1}`);
  const choices = picked.slice(0, 4) as [string, string, string, string];
  const correctIndex = choices.indexOf(correctStr);
  if (correctIndex < 0) {
    choices[0] = correctStr;
    return { question: '', answer: correctStr, choices, correctIndex: 0 };
  }
  return { question: '', answer: correctStr, choices, correctIndex };
}

/** 1~6학년 수학 사지선다 */
export function generateMathQuiz(grade: ElementaryGrade): GeneratedQuiz {
  switch (grade) {
    case 1: {
      const op = Math.random() < 0.5 ? '+' : '-';
      let a = randInt(1, 9);
      let b = randInt(1, 9);
      if (op === '-' && a < b) [a, b] = [b, a];
      const ans = op === '+' ? a + b : a - b;
      const q = buildChoices(ans, [ans + 1, ans - 1, ans + 2, Math.abs(ans - 2)]);
      q.question = `${a} ${op} ${b} = ?`;
      return q;
    }
    case 2: {
      if (Math.random() < 0.45) {
        const a = randInt(2, 9);
        const b = randInt(2, 9);
        const ans = a * b;
        const q = buildChoices(ans, [ans + a, ans - b, a * (b + 1), (a + 1) * b]);
        q.question = `${a} × ${b} = ? (구구단)`;
        return q;
      }
      const op = Math.random() < 0.5 ? '+' : '-';
      let a = randInt(10, 99);
      let b = randInt(10, 50);
      if (op === '-' && a < b) [a, b] = [b, a];
      const ans = op === '+' ? a + b : a - b;
      const q = buildChoices(ans, [ans + 10, ans - 10, ans + 1, ans - 1]);
      q.question = `${a} ${op} ${b} = ?`;
      return q;
    }
    case 3: {
      if (Math.random() < 0.4) {
        const b = randInt(2, 9);
        const quot = randInt(2, 9);
        const a = b * quot;
        const q = buildChoices(quot, [quot + 1, quot - 1, b, a - b]);
        q.question = `${a} ÷ ${b} = ?`;
        return q;
      }
      const op = Math.random() < 0.5 ? '+' : '-';
      let a = randInt(100, 999);
      let b = randInt(100, 500);
      if (op === '-' && a < b) [a, b] = [b, a];
      const ans = op === '+' ? a + b : a - b;
      const q = buildChoices(ans, [ans + 100, ans - 10, ans + 10, ans - 100]);
      q.question = `${a} ${op} ${b} = ?`;
      return q;
    }
    case 4: {
      if (Math.random() < 0.5) {
        const a = randInt(12, 48);
        const b = randInt(2, 9);
        const c = randInt(2, 9);
        const ans = a + b * c;
        const q = buildChoices(ans, [
          (a + b) * c,
          a * b + c,
          a + b + c,
          a - b * c,
        ]);
        q.question = `${a} + ${b} × ${c} = ? (혼합계산)`;
        return q;
      }
      const a = randInt(1000, 9999);
      const b = randInt(100, 999);
      const ans = a - b;
      const q = buildChoices(ans, [ans + 100, ans - 100, a + b, b - (a % 100)]);
      q.question = `${a} - ${b} = ?`;
      return q;
    }
    case 5: {
      if (Math.random() < 0.5) {
        const n = randInt(6, 24);
        const factors = [];
        for (let i = 1; i <= n; i += 1) if (n % i === 0) factors.push(i);
        const ans = factors.length;
        const q = buildChoices(ans, [ans + 1, ans - 1, n, Math.max(1, ans + 2)]);
        q.question = `${n}의 약수는 모두 몇 개인가?`;
        return q;
      }
      // 분수 가감: 동분모
      const den = randInt(4, 12);
      const a = randInt(1, den - 1);
      const b = randInt(1, den - a);
      const ansNum = a + b;
      const ans = `${ansNum}/${den}`;
      const q = buildChoices(ans, [
        `${a + b}/${den + 1}`,
        `${Math.abs(a - b)}/${den}`,
        `${a}/${den + b}`,
        `${ansNum}/${den * 2}`,
      ]);
      q.question = `${a}/${den} + ${b}/${den} = ?`;
      return q;
    }
    case 6:
    default: {
      if (Math.random() < 0.5) {
        const a = randInt(2, 9);
        const b = randInt(2, 9);
        // a:b 간단히 — a/b 비에서 a가 b의 몇 배?
        const ans = Number((a / b).toFixed(2));
        const q = buildChoices(ans, [
          Number((b / a).toFixed(2)),
          a / b + 1,
          a * b,
          Number(((a + b) / b).toFixed(2)),
        ]);
        q.question = `${a} : ${b} 에서 앞수가 뒷수의 몇 배인가? (소수 둘째 자리)`;
        return q;
      }
      const a = Number((randInt(11, 99) / 10).toFixed(1));
      const b = Number((randInt(11, 99) / 10).toFixed(1));
      const ans = Number((a * b).toFixed(2));
      const q = buildChoices(ans, [
        Number((a + b).toFixed(2)),
        Number((a * b + 0.1).toFixed(2)),
        Number((a * b - 0.1).toFixed(2)),
        Number(((a * 10 * b) / 10).toFixed(1)),
      ]);
      q.question = `${a} × ${b} = ? (소수 곱셈)`;
      return q;
    }
  }
}

const KOREAN_BANK: Array<{
  question: string;
  answer: string;
  wrong: [string, string, string];
}> = [
  {
    question: '다음 중 올바른 표기는?',
    answer: '안 되다',
    wrong: ['안되다', '안돼다', '않되다'],
  },
  {
    question: '"된다/돼다" — 올바른 것은?',
    answer: '해도 된다',
    wrong: ['해도 돼다', '해도 됀다', '해도 않된다'],
  },
  {
    question: '다음 중 맞춤법이 옳은 것은?',
    answer: '금세',
    wrong: ['금새', '금쎄', '금세이'],
  },
  {
    question: '다음 중 올바른 표기는?',
    answer: '며칠',
    wrong: ['몇일', '몇닐', '며찔'],
  },
  {
    question: '"않/안" — 올바른 문장은?',
    answer: '가지 않다',
    wrong: ['가지 안다', '가지안하다', '가이 않다'],
  },
  {
    question: '속담: 가는 말이 고와야 오는 말이 ○○다',
    answer: '곱다',
    wrong: ['좋다', '맵다', '달다'],
  },
  {
    question: '속담: 원숭이도 ○○에서 떨어진다',
    answer: '나무',
    wrong: ['산', '지붕', '바위'],
  },
  {
    question: '초성 퀴즈: ㄱㅅㄷ (우리나라 수도)',
    answer: '서울특별시',
    wrong: ['경기도', '강원도', '세종시'],
  },
  {
    question: '다음 중 띄어쓰기가 올바른 것은?',
    answer: '할 수 있다',
    wrong: ['할수 있다', '할 수있다', '할수있다'],
  },
  {
    question: '다음 중 맞춤법이 옳은 것은?',
    answer: '웬일',
    wrong: ['왠일', '웬닐', '왠닐'],
  },
  {
    question: '"되/돼" — 올바른 것은?',
    answer: '무엇을 해도',
    wrong: ['무엇을 하되', '무엇을 하돼', '무엇을 해되'],
  },
  {
    question: '속담: 티끌 모아 ○○',
    answer: '태산',
    wrong: ['대산', '금산', '백산'],
  },
];

export function generateKoreanQuiz(): GeneratedQuiz {
  const item = KOREAN_BANK[randInt(0, KOREAN_BANK.length - 1)];
  const choices = shuffle([item.answer, ...item.wrong]) as [
    string,
    string,
    string,
    string,
  ];
  return {
    question: item.question,
    answer: item.answer,
    choices,
    correctIndex: choices.indexOf(item.answer),
  };
}

export function buildCustomQuiz(
  question: string,
  choices: [string, string, string, string],
  correctIndex: number,
): GeneratedQuiz {
  const idx = Math.min(3, Math.max(0, correctIndex));
  return {
    question: question.trim(),
    answer: choices[idx],
    choices,
    correctIndex: idx,
  };
}

export function generateQuizByMode(
  mode: QuizMode,
  opts: {
    grade?: ElementaryGrade;
    custom?: {
      question: string;
      choices: [string, string, string, string];
      correctIndex: number;
    };
  } = {},
): GeneratedQuiz {
  if (mode === 'MATH') {
    return generateMathQuiz(opts.grade ?? 3);
  }
  if (mode === 'KOREAN') {
    return generateKoreanQuiz();
  }
  if (opts.custom) {
    return buildCustomQuiz(
      opts.custom.question,
      opts.custom.choices,
      opts.custom.correctIndex,
    );
  }
  return generateMathQuiz(3);
}

export const QUIZ_MODE_LABELS: Record<QuizMode, string> = {
  MATH: '초등 수학 (학년별 자동)',
  KOREAN: '국어·맞춤법 자동',
  CUSTOM: '교사 직접 출제',
};

export const TIME_LIMIT_PRESETS = [30, 45, 60] as const;
