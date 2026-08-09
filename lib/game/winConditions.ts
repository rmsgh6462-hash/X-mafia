import type { GameRoom, Player, WinnerSide } from '@/types/game';

function playersOf(room: GameRoom): Player[] {
  return Object.values(room.players ?? {});
}

function livingPlayers(room: GameRoom): Player[] {
  return playersOf(room).filter((p) => p.isAlive);
}

/** 생존 마피아 */
function livingMafia(room: GameRoom): Player[] {
  return livingPlayers(room).filter((p) => p.role === 'MAFIA');
}

/** 생존 시민 팀 (마피아가 아닌 모든 생존자: 시민·의사·경찰 등) */
function livingTown(room: GameRoom): Player[] {
  return livingPlayers(room).filter((p) => p.role !== 'MAFIA');
}

function endWithWinner(room: GameRoom, winnerSide: WinnerSide): GameRoom {
  return {
    ...room,
    gameState: 'ENDED',
    winnerSide,
    victoryTeam: winnerSide,
    matchEndsAt: null,
    voteEndsAt: null,
    voteRevoteCandidates: null,
    isMafiaBuffActive: false,
  };
}

/**
 * 최종 승리 조건 (우선순위 순):
 * 1. 생존 마피아 0명 → 시민 팀 승리 (라운드 무관 즉시)
 * 2. 생존 마피아 수 >= 생존 시민 수 → 마피아 팀 즉시 승리 (라운드 무관)
 * 3. (checkMaxRounds) 현재 라운드 ≥ maxRounds 이고 마피아 1명 이상 → 마피아 시간초과 승리
 */
export function evaluateGameEnd(
  room: GameRoom,
  options: { checkMaxRounds?: boolean } = {},
): GameRoom {
  if (room.gameState === 'ENDED') return room;

  const rolesAssigned = playersOf(room).some((p) => p.role != null);
  if (!rolesAssigned) return room;

  const mafiaCount = livingMafia(room).length;
  const townCount = livingTown(room).length;

  // 1) 시민 팀 승리: 마피아 전멸
  if (mafiaCount === 0) {
    return endWithWinner(room, 'CITIZEN');
  }

  // 2) 마피아 팀 즉시 승리: 마피아 수 >= 시민(비마피아) 수
  if (mafiaCount >= townCount) {
    return endWithWinner(room, 'MAFIA');
  }

  // 3) 마피아 시간초과 승리: Max Round 완전 종료 후에도 마피아 생존
  if (options.checkMaxRounds) {
    const max = Math.max(1, room.maxRounds ?? 3);
    const cur = room.currentRound ?? 0;
    if (cur >= max) {
      return endWithWinner(room, 'MAFIA');
    }
  }

  return room;
}

/** 별칭 — 호출부/문서에서 checkGameOver로 참조할 때 사용 */
export const checkGameOver = evaluateGameEnd;
