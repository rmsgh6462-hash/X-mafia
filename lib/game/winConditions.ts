import type { GameRoom, Player, WinnerSide } from '@/types/game';

function playersOf(room: GameRoom): Player[] {
  return Object.values(room.players ?? {});
}

function livingMafia(room: GameRoom): Player[] {
  return playersOf(room).filter((p) => p.isAlive && p.role === 'MAFIA');
}

function endWithWinner(room: GameRoom, winnerSide: WinnerSide): GameRoom {
  return {
    ...room,
    gameState: 'ENDED',
    winnerSide,
    matchEndsAt: null,
    voteEndsAt: null,
    voteRevoteCandidates: null,
    isMafiaBuffActive: false,
  };
}

/**
 * 생존 마피아 0명 → 시민 승리.
 * checkMaxRounds 시: 현재 라운드 ≥ 총 라운드이고 마피아 생존 → 마피아 승리.
 */
export function evaluateGameEnd(
  room: GameRoom,
  options: { checkMaxRounds?: boolean } = {},
): GameRoom {
  if (room.gameState === 'ENDED') return room;

  const mafiaAlive = livingMafia(room);
  const rolesAssigned = playersOf(room).some((p) => p.role != null);
  if (rolesAssigned && mafiaAlive.length === 0) {
    return endWithWinner(room, 'CITIZEN');
  }

  if (options.checkMaxRounds) {
    const max = Math.max(1, room.maxRounds ?? 3);
    const cur = room.currentRound ?? 0;
    if (cur >= max && mafiaAlive.length > 0) {
      return endWithWinner(room, 'MAFIA');
    }
  }

  return room;
}
