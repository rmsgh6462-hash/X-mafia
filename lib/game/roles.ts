import type { Role } from '@/types/game';

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 인원수에 맞춰 직업 목록을 구성한 뒤 셔플 */
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

export const ROLE_LABELS: Record<Role, string> = {
  CITIZEN: '시민',
  MAFIA: 'X맨',
  DOCTOR: '의사',
  POLICE: '경찰',
  REPORTER: '기자',
  SPIRITUALIST: '영매',
};

export const ROLE_BLURBS: Record<Role, string> = {
  CITIZEN: '토론과 투표로 마피아를 찾아내세요.',
  MAFIA: '정체를 숨기고 밤에 대상을 지목하세요.',
  DOCTOR: '밤에 한 명을 선택해 살릴 수 있습니다.',
  POLICE: '밤에 한 명을 조사해 마피아 여부를 확인합니다.',
  REPORTER: '취재 대상을 고르면 다음 날 아침 속보가 공개됩니다.',
  SPIRITUALIST: '사망자의 진짜 직업을 확인할 수 있습니다.',
};

export const ROLE_ACCENTS: Record<Role, string> = {
  CITIZEN: '#3d7a4a',
  MAFIA: '#b33a3a',
  DOCTOR: '#2f6fed',
  POLICE: '#1f4b99',
  REPORTER: '#c47a1a',
  SPIRITUALIST: '#6b4c9a',
};
