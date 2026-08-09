/** 초등 퀴즈 자동 생성기 */

import {
  fracMarkup,
  lcm,
  mixedMarkup,
} from '@/lib/game/fractionFormat';

export type QuizMode = 'MATH' | 'KOREAN' | 'GENERAL' | 'CUSTOM';
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

function pick<T>(items: T[]): T {
  return items[randInt(0, items.length - 1)];
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
  while (picked.length < 4) picked.push(`보기${picked.length + 1}`);
  const choices = picked.slice(0, 4) as [string, string, string, string];
  const correctIndex = choices.indexOf(correctStr);
  if (correctIndex < 0) {
    choices[0] = correctStr;
    return { question: '', answer: correctStr, choices, correctIndex: 0 };
  }
  return { question: '', answer: correctStr, choices, correctIndex };
}

function uniqueChoiceList(correct: string, distractors: string[]): GeneratedQuiz {
  const unique = [correct, ...distractors.filter((d) => d && d !== correct)];
  let guard = 0;
  while (unique.length < 4 && guard < 20) {
    unique.push(`보기${unique.length + 1}`);
    guard += 1;
  }
  const picked = shuffle(unique.slice(0, 4)) as string[];
  while (picked.length < 4) picked.push(`보기${picked.length + 1}`);
  const choices = picked.slice(0, 4) as [string, string, string, string];
  let correctIndex = choices.indexOf(correct);
  if (correctIndex < 0) {
    choices[0] = correct;
    correctIndex = 0;
  }
  return { question: '', answer: correct, choices, correctIndex };
}

/** 동분모 분수 덧셈 (진분수 / 대분수 결과) */
function generateSameDenFractionAdd(): GeneratedQuiz {
  const den = randInt(4, 12);
  const a = randInt(1, den - 1);
  const b = randInt(1, den - 1);
  const sum = a + b;
  const asMixed = sum >= den || Math.random() < 0.35;
  const ans = asMixed ? mixedMarkup(sum, den) : fracMarkup(sum, den);
  const wrong = [
    asMixed ? mixedMarkup(Math.abs(a - b) || 1, den) : fracMarkup(Math.abs(a - b) || 1, den),
    fracMarkup(sum, den + 1),
    fracMarkup(a + b + 1, den),
    mixedMarkup(sum + den, den),
  ].filter((w) => w !== ans);
  const q = uniqueChoiceList(ans, wrong);
  q.question = `${fracMarkup(a, den)} + ${fracMarkup(b, den)} = ?`;
  return q;
}

/** 가분수 → 대분수 변환 */
function generateImproperToMixed(): GeneratedQuiz {
  const den = randInt(3, 9);
  const whole = randInt(1, 4);
  const rem = randInt(1, den - 1);
  const improper = whole * den + rem;
  const ans = mixedMarkup(improper, den, false);
  const wrong = [
    mixedMarkup(improper + 1, den, false),
    mixedMarkup(whole * den + ((rem % (den - 1)) + 1), den, false),
    fracMarkup(improper, den + 1),
    String(whole),
  ].filter((w) => w !== ans);
  const q = uniqueChoiceList(ans, wrong);
  q.question = `가분수 ${fracMarkup(improper, den)} 을 대분수로 나타내세요.`;
  return q;
}

/** 대분수 → 가분수 변환 */
function generateMixedToImproper(): GeneratedQuiz {
  const den = randInt(3, 9);
  const whole = randInt(1, 4);
  const rem = randInt(1, den - 1);
  const improper = whole * den + rem;
  const ans = fracMarkup(improper, den);
  const wrong = [
    fracMarkup(improper + den, den),
    fracMarkup(whole + rem, den),
    fracMarkup(improper, den + 1),
    mixedMarkup(improper, den, false),
  ].filter((w) => w !== ans);
  const q = uniqueChoiceList(ans, wrong);
  q.question = `대분수 ${mixedMarkup(improper, den, false)} 을 가분수로 나타내세요.`;
  return q;
}

/** 학년별 문장제 */
function generateWordProblem(grade: ElementaryGrade): GeneratedQuiz {
  if (grade <= 2) {
    const total = randInt(8, 20);
    const eaten = randInt(2, Math.min(7, total - 1));
    const left = total - eaten;
    const item = pick(['사과', '연필', '스티커', '구슬']);
    const name = pick(['민수', '지아', '현우', '수아']);
    const q = buildChoices(left, [left + 1, left - 1, total + eaten, eaten]);
    q.question = `${item}가 ${total}개 있습니다. ${name}가 ${eaten}개를 가져갔다면 남은 ${item}는 몇 개일까요?`;
    return q;
  }

  if (grade === 3) {
    if (Math.random() < 0.5) {
      const each = randInt(3, 9);
      const packs = randInt(2, 8);
      const ans = each * packs;
      const item = pick(['공책', '사탕', '지우개']);
      const q = buildChoices(ans, [each + packs, each * (packs + 1), packs, ans + each]);
      q.question = `${item}가 한 상자에 ${each}개씩 들어 있습니다. ${packs}상자를 사면 ${item}는 모두 몇 개일까요?`;
      return q;
    }
    const price = randInt(100, 500);
    const buy = randInt(2, 6);
    const pay = price * buy + randInt(50, 200);
    const change = pay - price * buy;
    const q = buildChoices(change, [change + 10, change - 10, pay - price, price * buy]);
    q.question = `한 개에 ${price}원인 빵을 ${buy}개 사고 ${pay}원을 냈습니다. 거스름돈은 얼마일까요?`;
    return q;
  }

  if (grade === 4) {
    if (Math.random() < 0.5) {
      const speed = randInt(2, 9);
      const hours = randInt(2, 6);
      const ans = speed * hours;
      const q = buildChoices(ans, [speed + hours, speed * (hours + 1), hours, ans + speed]);
      q.question = `자동차가 한 시간에 ${speed}km를 갑니다. ${hours}시간 동안 가면 모두 몇 km를 갈까요?`;
      return q;
    }
    const length = randInt(24, 96);
    const pieces = [2, 3, 4, 6, 8].filter((d) => length % d === 0);
    const cut = pick(pieces.length ? pieces : [2, 3, 4]);
    const ans = length / cut;
    const q = buildChoices(ans, [ans + 1, ans - 1, length - cut, cut]);
    q.question = `${length}cm인 리본을 ${cut}도막으로 똑같이 나누면 한 도막은 몇 cm일까요?`;
    return q;
  }

  if (grade === 5) {
    // 분수 문장제: 전체의 a/b
    const den = pick([2, 3, 4, 5, 6, 8]);
    const num = randInt(1, den - 1);
    const total = den * randInt(2, 6);
    const ans = (total * num) / den;
    const item = pick(['학생', '사탕', '책']);
    const q = buildChoices(ans, [
      total - ans,
      Math.round(total / den),
      total * num,
      ans + den,
    ]);
    q.question = `${item} ${total}명의 ${fracMarkup(num, den)}은 몇 명일까요?`;
    return q;
  }

  // grade 6 — 비율·소수 문장제
  if (Math.random() < 0.5) {
    const price = Number((randInt(15, 45) / 10).toFixed(1));
    const count = randInt(2, 8);
    const ans = Number((price * count).toFixed(1));
    const q = buildChoices(ans, [
      Number((price + count).toFixed(1)),
      Number((price * (count + 1)).toFixed(1)),
      Number((price * count + 0.1).toFixed(1)),
      count,
    ]);
    q.question = `한 개에 ${price}kg인 과일을 ${count}개 담으면 모두 몇 kg일까요?`;
    return q;
  }
  const whole = randInt(20, 80);
  const percent = pick([10, 20, 25, 50]);
  const ans = (whole * percent) / 100;
  const q = buildChoices(ans, [whole - ans, percent, whole + percent, ans * 2]);
  q.question = `${whole}의 ${percent}%는 얼마일까요?`;
  return q;
}

/** 1~6학년 수학 사지선다 */
export function generateMathQuiz(grade: ElementaryGrade): GeneratedQuiz {
  // 전 학년 공통: 일정 비율로 문장제 출제
  const wordChance =
    grade <= 2 ? 0.35 : grade <= 4 ? 0.4 : grade === 5 ? 0.3 : 0.35;
  if (Math.random() < wordChance) {
    return generateWordProblem(grade);
  }

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
      const roll = Math.random();
      if (roll < 0.25) {
        const n = randInt(6, 24);
        const factors = [];
        for (let i = 1; i <= n; i += 1) if (n % i === 0) factors.push(i);
        const ans = factors.length;
        const q = buildChoices(ans, [ans + 1, ans - 1, n, Math.max(1, ans + 2)]);
        q.question = `${n}의 약수는 모두 몇 개인가?`;
        return q;
      }
      if (roll < 0.5) return generateSameDenFractionAdd();
      if (roll < 0.75) return generateImproperToMixed();
      return generateMixedToImproper();
    }
    case 6:
    default: {
      if (Math.random() < 0.35) {
        // 이분모 분수 덧셈 (통분)
        const den1 = pick([2, 3, 4, 5, 6]);
        let den2 = pick([2, 3, 4, 5, 6]);
        if (den2 === den1) den2 = den1 === 6 ? 4 : den1 + 1;
        const a = randInt(1, den1 - 1);
        const b = randInt(1, den2 - 1);
        const common = lcm(den1, den2);
        const sumNum = a * (common / den1) + b * (common / den2);
        const ans = mixedMarkup(sumNum, common, true);
        const wrong = [
          mixedMarkup(sumNum + 1, common, true),
          fracMarkup(a + b, den1),
          fracMarkup(sumNum, common + 1),
          mixedMarkup(
            Math.abs(a * (common / den1) - b * (common / den2)) || 1,
            common,
            true,
          ),
        ].filter((w) => w !== ans);
        const q = uniqueChoiceList(ans, wrong);
        q.question = `${fracMarkup(a, den1)} + ${fracMarkup(b, den2)} = ?`;
        return q;
      }
      if (Math.random() < 0.5) {
        const a = randInt(2, 9);
        const b = randInt(2, 9);
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

const GENERAL_BANK: Array<{
  question: string;
  answer: string;
  wrong: [string, string, string];
}> = [
  {
    question: '우리나라의 수도는 어디일까요?',
    answer: '서울',
    wrong: ['부산', '인천', '대전'],
  },
  {
    question: '태극기의 가운데 있는 문양의 이름은?',
    answer: '태극',
    wrong: ['무궁화', '해바라기', '연꽃'],
  },
  {
    question: '우리나라의 국화(나라꽃)는 무엇일까요?',
    answer: '무궁화',
    wrong: ['장미', '진달래', '개나리'],
  },
  {
    question: '지구에서 가장 큰 바다는?',
    answer: '태평양',
    wrong: ['대서양', '인도양', '북극해'],
  },
  {
    question: '태양계에서 지구와 가장 가까운 별은?',
    answer: '태양',
    wrong: ['달', '화성', '금성'],
  },
  {
    question: '물은 몇 도에서 얼기 시작할까요? (섭씨)',
    answer: '0도',
    wrong: ['10도', '32도', '100도'],
  },
  {
    question: '물은 몇 도에서 끓을까요? (섭씨, 보통 기압)',
    answer: '100도',
    wrong: ['0도', '50도', '80도'],
  },
  {
    question: '식물은 무엇을 해서 양분을 만들까요?',
    answer: '광합성',
    wrong: ['호흡', '소화', '증발'],
  },
  {
    question: '사람의 몸을 움직이는 데 꼭 필요한 기관은?',
    answer: '근육',
    wrong: ['손톱', '머리카락', '귀지'],
  },
  {
    question: '심장은 무엇을 온몸에 보낼까요?',
    answer: '피',
    wrong: ['공기', '물', '소리'],
  },
  {
    question: '무지개의 색깔은 보통 몇 가지로 말할까요?',
    answer: '7가지',
    wrong: ['3가지', '5가지', '10가지'],
  },
  {
    question: '하루는 몇 시간일까요?',
    answer: '24시간',
    wrong: ['12시간', '30시간', '60시간'],
  },
  {
    question: '1년은 보통 며칠일까요?',
    answer: '365일',
    wrong: ['300일', '360일', '400일'],
  },
  {
    question: '일주일은 며칠일까요?',
    answer: '7일',
    wrong: ['5일', '6일', '10일'],
  },
  {
    question: '우리나라에서 가장 긴 강은?',
    answer: '낙동강',
    wrong: ['한강', '금강', '영산강'],
  },
  {
    question: '서울을 가로질러 흐르는 강은?',
    answer: '한강',
    wrong: ['낙동강', '금강', '섬진강'],
  },
  {
    question: '독도는 어느 바다에 있는 섬일까요?',
    answer: '동해',
    wrong: ['서해', '남해', '황해'],
  },
  {
    question: '세종대왕이 만든 우리글의 이름은?',
    answer: '훈민정음',
    wrong: ['천자문', '이두', '향찰'],
  },
  {
    question: '불을 사용하기 시작한 시대는?',
    answer: '구석기 시대',
    wrong: ['조선 시대', '미래', '우주 시대'],
  },
  {
    question: '개미는 어느 동물 무리에 속할까요?',
    answer: '곤충',
    wrong: ['포유류', '조류', '어류'],
  },
  {
    question: '고래는 어느 동물 무리에 속할까요?',
    answer: '포유류',
    wrong: ['어류', '갑각류', '파충류'],
  },
  {
    question: '다음 중 척추동물인 것은?',
    answer: '개구리',
    wrong: ['지렁이', '해파리', '달팽이'],
  },
  {
    question: '지구를 도는 위성의 이름은?',
    answer: '달',
    wrong: ['화성', '금성', '태양'],
  },
  {
    question: '계절이 생기는 가장 큰 이유는?',
    answer: '지구가 기울어져 돌기 때문',
    wrong: ['달이 크기 때문', '바람이 불기 때문', '바다가 넓기 때문'],
  },
  {
    question: '신호등의 빨간색은 무엇을 의미할까요?',
    answer: '정지',
    wrong: ['출발', '주의', '좌회전'],
  },
  {
    question: '화재가 났을 때 가장 먼저 해야 할 일은?',
    answer: '큰 소리로 알리고 대피하기',
    wrong: ['사진을 찍기', '숨기', '불을 만지기'],
  },
  {
    question: '종이와 플라스틱을 분리수거하는 이유는?',
    answer: '자원을 다시 쓰기 위해',
    wrong: ['예쁘게 보이려고', '무게를 재려고', '색을 맞추려고'],
  },
  {
    question: '비타민 C가 많이 들어 있는 과일은?',
    answer: '귤',
    wrong: ['감자', '쌀', '빵'],
  },
  {
    question: '뼈와 뼈가 맞닿는 곳을 무엇이라 할까요?',
    answer: '관절',
    wrong: ['혈관', '신경', '피부'],
  },
  {
    question: '우리나라의 전통 옷 이름은?',
    answer: '한복',
    wrong: ['기모노', '치파오', '사리'],
  },
  {
    question: '김치의 주재료로 가장 많이 쓰이는 채소는?',
    answer: '배추',
    wrong: ['오이만', '토마토', '파인애플'],
  },
  {
    question: '나침반의 빨간 바늘은 보통 어느 쪽을 가리킬까요?',
    answer: '북쪽',
    wrong: ['남쪽', '동쪽', '서쪽'],
  },
  {
    question: '소리가 잘 전달되는 곳은?',
    answer: '물속',
    wrong: ['진공', '우주 공간', '아무것도 없는 곳'],
  },
  {
    question: '다음 중 재생 에너지인 것은?',
    answer: '태양광',
    wrong: ['석탄', '석유', '천연가스'],
  },
  {
    question: '피라미드는 어느 나라의 유적일까요?',
    answer: '이집트',
    wrong: ['중국', '일본', '브라질'],
  },
  {
    question: '세계 지도를 볼 때 위쪽은 보통 어느 방향일까요?',
    answer: '북쪽',
    wrong: ['남쪽', '동쪽', '서쪽'],
  },
  {
    question: '산소가 부족하면 사람은 어떻게 될까요?',
    answer: '숨쉬기 어려워진다',
    wrong: ['키가 커진다', '눈이 파래진다', '소리가 커진다'],
  },
  {
    question: '치아가 상하지 않게 하려면?',
    answer: '이를 닦는다',
    wrong: ['사탕만 먹는다', '물을 안 마신다', '이를 세게 부딪친다'],
  },
  {
    question: '대한민국의 법정 화폐 단위는?',
    answer: '원',
    wrong: ['달러', '엔', '유로'],
  },
  {
    question: '컴퓨터나 로봇을 움직이게 하는 명령의 이름은?',
    answer: '프로그램(코딩)',
    wrong: ['그림일기', '급식표', '출석부'],
  },
  {
    question: '지진이 났을 때 안전한 행동은?',
    answer: '책상 아래로 들어가 몸을 보호한다',
    wrong: ['엘리베이터를 탄다', '창문으로 뛰어내린다', '불을 켠다'],
  },
];

export function generateGeneralQuiz(): GeneratedQuiz {
  const item = GENERAL_BANK[randInt(0, GENERAL_BANK.length - 1)];
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
  if (mode === 'GENERAL') {
    return generateGeneralQuiz();
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
  GENERAL: '초등 상식 자동',
  CUSTOM: '교사 직접 출제',
};

export const TIME_LIMIT_PRESETS = [5, 10, 15, 30, 45, 60] as const;
