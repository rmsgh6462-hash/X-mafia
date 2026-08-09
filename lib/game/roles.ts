import type { Role } from '@/types/game';

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 인원수에 맞춰 직업 목록을 구성한 뒤 셔플 (기본 프리셋) */
export function buildRoleDeck(playerCount: number): Role[] {
  if (playerCount <= 0) return [];

  const roles: Role[] = [];
  const mafiaCount = Math.max(1, Math.floor(playerCount / 4));

  for (let i = 0; i < mafiaCount; i += 1) roles.push('MAFIA');
  if (playerCount >= 5) roles.push('DOCTOR');
  if (playerCount >= 6) roles.push('POLICE');
  if (playerCount >= 7) roles.push('REPORTER');
  if (playerCount >= 8) roles.push('SPIRITUALIST');
  while (roles.length < playerCount) roles.push('CITIZEN');

  return shuffle(roles).slice(0, playerCount);
}

/** 교사 지정 인원수로 직업 덱 생성 (나머지는 시민) */
export type RoleCountConfig = {
  MAFIA: number;
  DOCTOR: number;
  POLICE: number;
  REPORTER: number;
  SPIRITUALIST: number;
};

export const DEFAULT_ROLE_COUNTS: RoleCountConfig = {
  MAFIA: 1,
  DOCTOR: 1,
  POLICE: 1,
  REPORTER: 0,
  SPIRITUALIST: 0,
};

export function suggestedRoleCounts(playerCount: number): RoleCountConfig {
  return {
    MAFIA: Math.max(1, Math.floor(playerCount / 4)),
    DOCTOR: playerCount >= 5 ? 1 : 0,
    POLICE: playerCount >= 6 ? 1 : 0,
    REPORTER: playerCount >= 7 ? 1 : 0,
    SPIRITUALIST: playerCount >= 8 ? 1 : 0,
  };
}

export function specialRoleTotal(counts: RoleCountConfig): number {
  return (
    counts.MAFIA +
    counts.DOCTOR +
    counts.POLICE +
    counts.REPORTER +
    counts.SPIRITUALIST
  );
}

export function buildRoleDeckFromCounts(
  playerCount: number,
  counts: RoleCountConfig,
): Role[] {
  if (playerCount <= 0) return [];
  const special = specialRoleTotal(counts);
  if (special > playerCount) {
    throw new Error(
      `특수 직업 합(${special})이 전체 인원(${playerCount})보다 많습니다.`,
    );
  }

  const roles: Role[] = [];
  for (let i = 0; i < counts.MAFIA; i += 1) roles.push('MAFIA');
  for (let i = 0; i < counts.DOCTOR; i += 1) roles.push('DOCTOR');
  for (let i = 0; i < counts.POLICE; i += 1) roles.push('POLICE');
  for (let i = 0; i < counts.REPORTER; i += 1) roles.push('REPORTER');
  for (let i = 0; i < counts.SPIRITUALIST; i += 1) roles.push('SPIRITUALIST');
  while (roles.length < playerCount) roles.push('CITIZEN');

  return shuffle(roles);
}

export const ROLE_LABELS: Record<Role, string> = {
  CITIZEN: '시민',
  MAFIA: '마피아',
  DOCTOR: '의사',
  POLICE: '경찰',
  REPORTER: '기자',
  SPIRITUALIST: '영매',
};

export const ROLE_BLURBS: Record<Role, string> = {
  CITIZEN: '토론과 투표로 마피아를 찾아내세요.',
  MAFIA:
    '밤에 대상을 지목하세요. 다른 마피아 동료는 화면에 [마피아]로 표시됩니다. 같은 편을 죽일 수도 있습니다.',
  DOCTOR:
    '밤에 한 명을 치료합니다. 자힐은 게임당 1회만 가능합니다. 다른 의사와는 서로를 모릅니다.',
  POLICE:
    '밤에 한 명을 조사해 마피아 여부를 확인합니다. 결과는 경찰과 교사만 봅니다. 다른 경찰과는 서로를 모릅니다.',
  REPORTER:
    '취재 대상을 고르면 다음 날 아침 실제 직업이 전원에게 공개됩니다. 다른 기자와는 서로를 모릅니다.',
  SPIRITUALIST:
    '사망자의 진짜 직업을 확인할 수 있습니다. 다른 영매와는 서로를 모릅니다.',
};

export const ROLE_ACCENTS: Record<Role, string> = {
  CITIZEN: '#3d7a4a',
  MAFIA: '#b33a3a',
  DOCTOR: '#2f6fed',
  POLICE: '#1f4b99',
  REPORTER: '#c47a1a',
  SPIRITUALIST: '#6b4c9a',
};

export const ASSIGNABLE_ROLES: Role[] = [
  'CITIZEN',
  'MAFIA',
  'DOCTOR',
  'POLICE',
  'REPORTER',
  'SPIRITUALIST',
];
