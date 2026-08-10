import type { Role } from '@/types/game';

export type CharacterState =
  | 'normal'
  | 'doctor'
  | 'police'
  | 'reporter'
  | 'mafia'
  | 'shaman'
  | 'doctor_fail'
  | 'dead'
  | 'arrested';

export const CHARACTER_STATES: CharacterState[] = [
  'normal',
  'doctor',
  'police',
  'reporter',
  'mafia',
  'shaman',
  'doctor_fail',
  'dead',
  'arrested',
];

/** 캐릭터 상태별 정적 이미지 경로를 만든다. 실제 파일 누락은 렌더러에서 normal로 보정한다. */
export function getCharacterImage(
  characterId: string,
  state: CharacterState = 'normal',
): string {
  return `/images/characters/${characterId}/${state}.png`;
}

/** 직업을 캐릭터 상태 이미지로 변환한다. 시민은 기본 이미지를 사용한다. */
export function getCharacterStateForRole(
  role: Role | null | undefined,
): CharacterState {
  switch (role) {
    case 'DOCTOR':
      return 'doctor';
    case 'POLICE':
      return 'police';
    case 'REPORTER':
      return 'reporter';
    case 'MAFIA':
      return 'mafia';
    case 'SPIRITUALIST':
      return 'shaman';
    default:
      return 'normal';
  }
}
