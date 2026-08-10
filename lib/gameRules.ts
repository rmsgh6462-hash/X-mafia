/** 인원수에 따라 교사가 처음 보는 직업 배치 추천값. */
export interface RoleConfig {
  mafia: number;
  doctor: number;
  police: number;
  reporter: number;
  shaman: number;
  citizen: number;
}

/**
 * 참여 인원에 맞는 기본 직업 프리셋을 반환한다.
 * 시민 수는 특수 직업을 배치한 뒤 남는 인원으로 자동 계산한다.
 */
export function getDefaultRoleConfig(totalPlayers: number): RoleConfig {
  let mafia = Math.max(2, Math.floor(totalPlayers * 0.25));
  const doctor = totalPlayers >= 26 ? 2 : 1;
  const police = 1;
  let reporter = totalPlayers >= 11 ? 1 : 0;
  let shaman = totalPlayers >= 16 ? 1 : 0;

  // 최소 인원 예외 처리 (8명 미만일 경우)
  if (totalPlayers < 8) {
    mafia = 1;
    reporter = 0;
    shaman = 0;
  }

  const specialRolesSum = mafia + doctor + police + reporter + shaman;
  const citizen = Math.max(0, totalPlayers - specialRolesSum);

  return { mafia, doctor, police, reporter, shaman, citizen };
}
