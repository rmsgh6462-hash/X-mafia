import type { Role } from '@/types/game';

export type CharacterViewerRole = Role | 'TEACHER';

export type CharacterState =
  | 'normal'
  | 'doctor'
  | 'police'
  | 'reporter'
  | 'mafia'
  | 'shaman'
  | 'doctor_fail'
  | 'doctor_idle'
  | 'reporter_idle'
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
  'doctor_idle',
  'reporter_idle',
  'dead',
  'arrested',
];

/** 실제 플레이어를 가리지 않고 사용할 수 있는 공통 이벤트 일러스트. */
export type EventIllustrationKind =
  | 'doctor_idle'
  | 'doctor_fail'
  | 'reporter_idle'
  | 'anonymous_reporter';

const EVENT_ILLUSTRATION_PATHS: Record<EventIllustrationKind, string> = {
  doctor_idle: '/images/events/doctor_idle_generic.png',
  doctor_fail: '/images/events/doctor_fail_generic.png',
  reporter_idle: '/images/events/reporter_idle_generic.png',
  anonymous_reporter: '/images/events/anonymous_reporter.png',
};

export function getEventIllustrationPath(
  kind: EventIllustrationKind,
): string {
  return EVENT_ILLUSTRATION_PATHS[kind];
}

/** 캐릭터 상태별 정적 이미지 경로를 만든다. 실제 파일 누락은 렌더러에서 normal로 보정한다. */
export function getCharacterImage(
  characterId: string,
  state: CharacterState = 'normal',
): string {
  return `/images/characters/${characterId}/${state}.png`;
}

/** 공개 연출 코드에서 사용하는 명시적 URL 별칭. CharacterImage의 fallback은 동일하게 적용된다. */
export function getCharacterImageUrl(
  characterId: string,
  state: CharacterState = 'normal',
): string {
  return getCharacterImage(characterId, state);
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

/**
 * 직업 이미지 공개 여부를 결정한다.
 * - 교사: 모든 학생의 직업 상태 이미지를 볼 수 있다.
 * - 학생 본인: 자신의 직업 상태 이미지를 볼 수 있다.
 * - 다른 학생: 직업과 무관하게 normal 이미지만 본다.
 * 정보가 부족하면 안전하게 공개하지 않는 쪽으로 처리한다.
 */
export function canRevealCharacterRoleImage({
  viewerRole,
  targetPlayerId,
  viewerPlayerId,
}: {
  viewerRole?: CharacterViewerRole | null;
  targetPlayerId?: string | null;
  viewerPlayerId?: string | null;
}): boolean {
  if (viewerRole === 'TEACHER') return true;
  return Boolean(
    viewerPlayerId && targetPlayerId && viewerPlayerId === targetPlayerId,
  );
}

/**
 * 뷰어에 따라 직업 상태 이미지 URL을 안전하게 반환한다.
 * role이 없거나 권한이 없으면 항상 같은 캐릭터의 normal.png를 반환한다.
 */
export function getSecuredCharacterImageUrl(
  avatarId: string,
  playerRole: Role | null | undefined,
  viewerRole: CharacterViewerRole | null | undefined,
  targetPlayerId: string | null | undefined,
  viewerPlayerId: string | null | undefined,
  revealRole = false,
): string {
  const state = revealRole ||
    canRevealCharacterRoleImage({
      viewerRole,
      targetPlayerId,
      viewerPlayerId,
    })
    ? getCharacterStateForRole(playerRole)
    : 'normal';
  return getCharacterImage(avatarId, state);
}

/** URL과 동일한 기준으로 CharacterAvatar의 상태를 계산할 때 사용한다. */
export function getSecuredCharacterState(
  playerRole: Role | null | undefined,
  viewerRole: CharacterViewerRole | null | undefined,
  targetPlayerId: string | null | undefined,
  viewerPlayerId: string | null | undefined,
  revealRole = false,
): CharacterState {
  return revealRole ||
    canRevealCharacterRoleImage({
      viewerRole,
      targetPlayerId,
      viewerPlayerId,
    })
    ? getCharacterStateForRole(playerRole)
    : 'normal';
}
