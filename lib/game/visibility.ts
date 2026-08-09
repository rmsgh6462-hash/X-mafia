import { ROLE_LABELS } from '@/lib/game/roles';
import { playerList } from '@/lib/game/room';
import type { GameRoom, Player, Role } from '@/types/game';

/** 시민 특수 직업 — 동일 직업끼리도 서로 정체를 모름 */
const BLINDED_SAME_ROLE: Role[] = [
  'CITIZEN',
  'DOCTOR',
  'POLICE',
  'REPORTER',
  'SPIRITUALIST',
];

/**
 * 마피아 동료 목록 (본인 제외).
 * 시민 특수직업은 빈 배열 — 절대 동료를 노출하지 않음.
 */
export function getMafiaAllies(room: GameRoom, viewer: Player): Player[] {
  if (viewer.role !== 'MAFIA') return [];
  return playerList(room).filter(
    (p) => p.role === 'MAFIA' && p.id !== viewer.id,
  );
}

export function isMafiaViewer(viewer: Player | null | undefined): boolean {
  return viewer?.role === 'MAFIA';
}

/**
 * 관전자(viewer)가 target에게 보여줄 직업 배지.
 * - 본인: 실제 직업
 * - 마피아 → 다른 마피아: 「마피아」
 * - 그 외(동일 경찰/의사/기자 포함): 표시 없음 (블라인드)
 */
export function visibleRoleBadgeFor(
  viewer: Player | null | undefined,
  target: Player,
): string | null {
  if (!viewer) return null;

  if (viewer.id === target.id) {
    return target.role ? ROLE_LABELS[target.role] : null;
  }

  // 오직 마피아만 동료 정체 확인
  if (viewer.role === 'MAFIA' && target.role === 'MAFIA') {
    return ROLE_LABELS.MAFIA;
  }

  // 시민 특수직업 동일 직업끼리도 블라인드
  if (
    viewer.role &&
    BLINDED_SAME_ROLE.includes(viewer.role) &&
    target.role === viewer.role
  ) {
    return null;
  }

  return null;
}

/** 학생 화면에 노출해도 되는 대상인지 (마피아 동료만 true) */
export function canSeeTrueRole(
  viewer: Player | null | undefined,
  target: Player,
): boolean {
  if (!viewer) return false;
  if (viewer.id === target.id) return true;
  return viewer.role === 'MAFIA' && target.role === 'MAFIA';
}
