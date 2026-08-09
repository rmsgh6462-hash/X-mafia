import type { GameRoom, Player } from '@/types/game';

const GENERIC_HINTS = [
  '마피아 중 한 명은 오늘 평소보다 말이 적습니다.',
  '마피아는 창가·복도 쪽 자리에 있을 가능성이 큽니다.',
  '마피아 중 적어도 한 명은 안경을 쓰고 있지 않습니다.',
  '마피아는 서로 너무 붙어 앉지 않았을 수 있습니다.',
  '방금 미션에서 유독 적극적이었던 사람을 위해 보세요.',
];

/** 미션 성공 시 시민에게 공개되는 마피아 힌트 */
export function generateMafiaHint(room: GameRoom): string {
  const players = Object.values(room.players ?? {}) as Player[];
  const mafia = players.filter((p) => p.role === 'MAFIA' && p.isAlive);

  if (mafia.length === 1) {
    const name = mafia[0].name;
    const masked =
      name.length <= 1 ? '?' : `${name[0]}${'*'.repeat(Math.min(name.length - 1, 3))}`;
    return `단서: 마피아의 이름 첫 글자는 "${masked[0]}" 입니다. (${masked})`;
  }
  if (mafia.length >= 2) {
    return `단서: 현재 생존 마피아은 ${mafia.length}명입니다. ${GENERIC_HINTS[Math.floor(Math.random() * GENERIC_HINTS.length)]}`;
  }
  return GENERIC_HINTS[Math.floor(Math.random() * GENERIC_HINTS.length)];
}
