'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Sparkles, Trash2, Trophy, Users } from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { getCharacterStateForRole, type CharacterState } from '@/lib/characterUtils';
import { playVictorySound } from '@/lib/utils/sound';
import { ROLE_LABELS } from '@/lib/game/roles';
import type { Player, WinnerSide } from '@/types/game';

type GameResultPanelProps = {
  winnerSide: WinnerSide | null | undefined;
  players: Record<string, Player>;
  currentPlayerId?: string | null;
  round?: number;
  maxRounds?: number;
  isHost?: boolean;
  busy?: boolean;
  onRestart?: () => void;
  onNewGame?: () => void;
  voteEliminatedPlayerId?: string | null;
  mafiaEliminatedPlayerIds?: string[];
};

export function GameResultPanel({
  winnerSide,
  players,
  currentPlayerId,
  round,
  maxRounds,
  isHost = false,
  busy = false,
  onRestart,
  onNewGame,
  voteEliminatedPlayerId = null,
  mafiaEliminatedPlayerIds = [],
}: GameResultPanelProps) {
  const mafiaWon = winnerSide === 'MAFIA';
  const citizenWon = winnerSide === 'CITIZEN';
  const accent = mafiaWon
    ? {
        border: 'border-red-400/40',
        panel: 'bg-[#19080b]/92',
        title: 'text-red-100',
        highlight: 'text-red-300',
        button: 'bg-red-500 text-white hover:bg-red-400',
        softButton: 'bg-red-950/70 text-red-100 ring-red-300/25 hover:bg-red-900/80',
      }
    : {
        border: 'border-sky-300/45',
        panel: 'bg-[#071728]/92',
        title: 'text-sky-50',
        highlight: 'text-sky-200',
        button: 'bg-sky-400 text-slate-950 hover:bg-sky-300',
        softButton: 'bg-sky-950/70 text-sky-100 ring-sky-300/25 hover:bg-sky-900/80',
      };
  const title = mafiaWon
    ? '마피아 팀 승리!'
    : citizenWon
      ? '시민 팀 승리!'
      : '게임 종료';
  const subtitle = mafiaWon
    ? '(시민들을 완벽하게 속였습니다!)'
    : citizenWon
      ? '(마피아를 모두 소탕했습니다!)'
      : '(선생님이 게임을 종료했습니다.)';

  useEffect(() => {
    if (!winnerSide) return;
    void playVictorySound(winnerSide);
  }, [winnerSide]);

  const allPlayers = Object.values(players).sort((a, b) =>
    a.name.localeCompare(b.name, 'ko'),
  );
  const livingPlayers = allPlayers.filter((player) => player.isAlive);
  const eliminatedPlayers = allPlayers.filter((player) => !player.isAlive);
  const stateForPlayer = (player: Player): CharacterState => {
    if (player.isAlive) return getCharacterStateForRole(player.role);
    if (player.id === voteEliminatedPlayerId) return 'arrested';
    if (mafiaEliminatedPlayerIds.includes(player.id)) return 'dead';
    return 'dead';
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`w-full max-w-6xl overflow-hidden rounded-[2rem] border shadow-2xl shadow-black/50 ${accent.border} ${accent.panel}`}
    >
      <div className="relative h-[18rem] overflow-hidden sm:h-[23rem]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mafiaWon ? '/illustrations/mafia-team-victory.png' : '/illustrations/citizen-team-victory.png'}
          alt={mafiaWon ? '마피아 팀 승리 축하 장면' : '시민 팀 승리 축하 장면'}
          className="absolute inset-0 h-full w-full object-cover object-center"
          decoding="async"
          draggable={false}
        />
        <div
          className={`absolute inset-0 ${
            mafiaWon
              ? 'bg-gradient-to-b from-[#090307]/35 via-[#19060a]/30 to-[#19080b]/98'
              : 'bg-gradient-to-b from-sky-950/10 via-sky-950/10 to-[#071728]/98'
          }`}
        />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 py-4 text-xs font-black uppercase tracking-[0.24em] text-white/70 sm:px-8">
          <span className="inline-flex items-center gap-2">
            <Trophy className={`h-4 w-4 ${accent.highlight}`} />
            FINAL RESULT
          </span>
          <span className="rounded-full bg-black/30 px-3 py-1 backdrop-blur-sm">
            X-MAFIA
          </span>
        </div>
        <div className="absolute inset-x-4 bottom-7 text-center sm:bottom-9">
          <motion.div
            animate={{ scale: [1, 1.035, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className="flex items-center justify-center gap-3"
          >
            <Sparkles className={`h-6 w-6 ${accent.highlight}`} />
            <h1 className={`text-balance text-4xl font-black drop-shadow-[0_3px_12px_rgba(0,0,0,0.75)] sm:text-6xl ${accent.title}`}>
              {title}
            </h1>
            <Sparkles className={`h-6 w-6 ${accent.highlight}`} />
          </motion.div>
          <p className="mt-3 text-base font-bold text-white/85 drop-shadow-md sm:text-xl">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/20 px-4 py-3 ring-1 ring-white/10">
          <p className="inline-flex items-center gap-2 text-sm font-black text-white/85">
            <Users className={`h-4 w-4 ${accent.highlight}`} />
            최종 결과 · 생존 {livingPlayers.length}명 / 탈락 {eliminatedPlayers.length}명
          </p>
          {round != null && maxRounds != null && (
            <p className="font-mono text-xs font-bold tracking-wider text-white/50">
              ROUND {round} / {maxRounds}
            </p>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ResultRoster
            title="최종 생존자"
            players={livingPlayers}
            currentPlayerId={currentPlayerId}
            emptyLabel="생존자가 없습니다."
            tone={citizenWon ? 'safe' : 'neutral'}
            stateForPlayer={stateForPlayer}
          />
          <ResultRoster
            title="탈락자 · 직업 공개"
            players={eliminatedPlayers}
            currentPlayerId={currentPlayerId}
            emptyLabel="탈락자가 없습니다."
            tone="danger"
            stateForPlayer={stateForPlayer}
          />
        </div>

        {isHost ? (
          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy || !onNewGame}
              onClick={onNewGame}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black ring-1 transition disabled:cursor-not-allowed disabled:opacity-50 ${accent.softButton}`}
            >
              <Trash2 className="h-4 w-4" />
              새 게임 만들기 (방 삭제)
            </button>
            <button
              type="button"
              disabled={busy || !onRestart}
              onClick={onRestart}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${accent.button}`}
            >
              <RotateCcw className="h-4 w-4" />
              게임 재시작 (방 유지)
            </button>
          </div>
        ) : (
          <p className="border-t border-white/10 pt-4 text-center text-xs font-semibold text-white/50">
            결과를 확인했습니다. 선생님이 다음 게임을 준비하면 자동으로 대기 화면으로 이동합니다.
          </p>
        )}
      </div>
    </motion.section>
  );
}

function ResultRoster({
  title,
  players,
  currentPlayerId,
  emptyLabel,
  tone,
  stateForPlayer,
}: {
  title: string;
  players: Player[];
  currentPlayerId?: string | null;
  emptyLabel: string;
  tone: 'safe' | 'danger' | 'neutral';
  stateForPlayer: (player: Player) => CharacterState;
}) {
  const toneClass = {
    safe: 'border-emerald-300/25 bg-emerald-950/35',
    danger: 'border-red-300/25 bg-red-950/35',
    neutral: 'border-white/15 bg-white/5',
  }[tone];

  return (
    <section className={`rounded-2xl border p-4 ${toneClass}`}>
      <h2 className="mb-3 text-sm font-black tracking-wide text-white/85">{title}</h2>
      {players.length === 0 ? (
        <p className="rounded-xl bg-black/15 px-3 py-6 text-center text-sm text-white/45">
          {emptyLabel}
        </p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {players.map((player) => (
            <li
              key={player.id}
              className={`flex items-center justify-between gap-3 rounded-xl bg-black/25 px-3 py-2.5 ring-1 ring-white/8 ${
                player.id === currentPlayerId ? 'ring-2 ring-amber-300/80' : ''
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <CharacterAvatar
                  avatarId={player.avatarId}
                  isAlive={player.isAlive}
                  state={stateForPlayer(player)}
                  size={42}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-white">
                    {player.name}
                    {player.id === currentPlayerId && (
                      <span className="ml-1 text-[10px] font-bold text-amber-300">나</span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-white/45">
                    {player.isAlive ? '끝까지 생존' : '게임 중 탈락'}
                  </span>
                </span>
              </span>
              <span className="shrink-0 rounded-lg bg-black/30 px-2 py-1 text-xs font-black text-amber-100 ring-1 ring-white/10">
                {player.role ? ROLE_LABELS[player.role] : '직업 미공개'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
