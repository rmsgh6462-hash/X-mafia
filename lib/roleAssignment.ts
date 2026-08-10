import {
  specialRoleTotal,
  type RoleCountConfig,
} from '@/lib/game/roles';
import type { Role } from '@/types/game';

/** Fisher–Yates 셔플 */
export function shuffleRoles<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** RoleConfig 수량으로 전체 직업 풀 생성 (나머지는 시민) */
export function buildRolePool(
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

  const pool: Role[] = [];
  for (let i = 0; i < counts.MAFIA; i += 1) pool.push('MAFIA');
  for (let i = 0; i < counts.DOCTOR; i += 1) pool.push('DOCTOR');
  for (let i = 0; i < counts.POLICE; i += 1) pool.push('POLICE');
  for (let i = 0; i < counts.REPORTER; i += 1) pool.push('REPORTER');
  for (let i = 0; i < counts.SPIRITUALIST; i += 1) pool.push('SPIRITUALIST');
  while (pool.length < playerCount) pool.push('CITIZEN');
  return pool;
}

export type RoleQuota = Record<Role, number>;

export function emptyRoleQuota(): RoleQuota {
  return {
    CITIZEN: 0,
    MAFIA: 0,
    DOCTOR: 0,
    POLICE: 0,
    REPORTER: 0,
    SPIRITUALIST: 0,
  };
}

/** 수동 지정된 직업 수량 집계 (미배정 null 제외) */
export function countFixedRoles(
  assignments: Record<string, Role | null | undefined>,
): RoleQuota {
  const quota = emptyRoleQuota();
  Object.values(assignments).forEach((role) => {
    if (role) quota[role] += 1;
  });
  return quota;
}

export function roleQuotaFromCounts(
  playerCount: number,
  counts: RoleCountConfig,
): RoleQuota {
  return {
    MAFIA: counts.MAFIA,
    DOCTOR: counts.DOCTOR,
    POLICE: counts.POLICE,
    REPORTER: counts.REPORTER,
    SPIRITUALIST: counts.SPIRITUALIST,
    CITIZEN: Math.max(0, playerCount - specialRoleTotal(counts)),
  };
}

const ROLE_ORDER: Role[] = [
  'MAFIA',
  'DOCTOR',
  'POLICE',
  'REPORTER',
  'SPIRITUALIST',
  'CITIZEN',
];

/**
 * 수동 배정이 설정된 직업 수량을 초과하는지 검사.
 * 초과 시 한국어 경고 메시지를 반환한다.
 */
export function validateFixedAssignmentsAgainstCounts(
  assignments: Record<string, Role | null | undefined>,
  counts: RoleCountConfig,
  playerCount: number,
): string | null {
  const fixed = countFixedRoles(assignments);
  const allowed = roleQuotaFromCounts(playerCount, counts);
  const overflows: string[] = [];

  for (const role of ROLE_ORDER) {
    if (fixed[role] > allowed[role]) {
      const labels: Record<Role, string> = {
        CITIZEN: '시민',
        MAFIA: '마피아',
        DOCTOR: '의사',
        POLICE: '경찰',
        REPORTER: '기자',
        SPIRITUALIST: '영매',
      };
      overflows.push(
        `${labels[role]} ${fixed[role]}명 지정 (설정 ${allowed[role]}명)`,
      );
    }
  }

  if (overflows.length === 0) return null;
  return `수동 배정이 설정된 직업 수량을 초과했습니다: ${overflows.join(', ')}`;
}

/**
 * 1) 교사 고정 배정 우선 적용 → 풀에서 차감
 * 2) 미배정 학생에게 남은 풀을 셔플해 1:1 배정
 */
export function resolveAssignmentsWithRandomFill(
  playerIds: string[],
  fixedAssignments: Record<string, Role | null | undefined>,
  counts: RoleCountConfig,
): Record<string, Role> {
  const pool = buildRolePool(playerIds.length, counts);
  const remaining = [...pool];
  const result: Record<string, Role> = {};
  const unassigned: string[] = [];

  for (const id of playerIds) {
    const fixed = fixedAssignments[id] ?? null;
    if (!fixed) {
      unassigned.push(id);
      continue;
    }
    const idx = remaining.indexOf(fixed);
    if (idx === -1) {
      throw new Error(
        validateFixedAssignmentsAgainstCounts(
          fixedAssignments,
          counts,
          playerIds.length,
        ) ?? '수동 배정이 직업 풀을 초과했습니다.',
      );
    }
    remaining.splice(idx, 1);
    result[id] = fixed;
  }

  if (unassigned.length !== remaining.length) {
    throw new Error(
      `남은 직업(${remaining.length})과 미배정 학생(${unassigned.length}) 수가 맞지 않습니다.`,
    );
  }

  const shuffled = shuffleRoles(remaining);
  unassigned.forEach((id, i) => {
    result[id] = shuffled[i] ?? 'CITIZEN';
  });

  return result;
}
