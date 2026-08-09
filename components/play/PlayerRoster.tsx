'use client';

import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { ROLE_LABELS } from '@/lib/game/roles';
import { playerList } from '@/lib/game/room';
import type { GameRoom, Player } from '@/types/game';

export function PlayerRoster({
  room,
  highlightId,
  compact = false,
  title = '참가자',
  showRoles = false,
}: {
  room: GameRoom;
  highlightId?: string;
  compact?: boolean;
  title?: string;
  /** 교사 화면용 — 배정된 직업 표시 */
  showRoles?: boolean;
}) {
  const list = playerList(room).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const aliveCount = list.filter((p) => p.isAlive).length;

  return (
    <section
      className={`rounded-2xl bg-black/30 ring-1 ring-white/10 ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">
          {title}
        </h3>
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white/80">
          생존 {aliveCount}/{list.length}명
        </span>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-white/45">아직 입장한 학생이 없습니다.</p>
      ) : (
        <ul
          className={`grid gap-2 ${
            compact
              ? 'grid-cols-3 sm:grid-cols-4'
              : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
          }`}
        >
          {list.map((p) => (
            <PlayerChip
              key={p.id}
              player={p}
              highlight={p.id === highlightId}
              compact={compact}
              showRole={showRoles}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PlayerChip({
  player,
  highlight,
  compact,
  showRole,
}: {
  player: Player;
  highlight?: boolean;
  compact?: boolean;
  showRole?: boolean;
}) {
  return (
    <li
      className={`flex flex-col items-center rounded-xl px-2 py-2 text-center ${
        highlight
          ? 'bg-amber-400/20 ring-1 ring-amber-400/50'
          : player.isAlive
            ? 'bg-white/5'
            : 'bg-black/40'
      }`}
    >
      <CharacterAvatar
        avatarId={player.avatarId}
        isAlive={player.isAlive}
        size={compact ? 44 : 56}
      />
      <span
        className={`mt-1 w-full truncate text-xs font-bold ${
          player.isAlive ? 'text-white' : 'text-white/40 line-through'
        }`}
      >
        {player.name}
      </span>
      {showRole && player.role && (
        <span className="mt-0.5 text-[10px] font-semibold text-amber-200/90">
          {ROLE_LABELS[player.role]}
        </span>
      )}
      {!player.isAlive && (
        <span className="text-[9px] font-semibold text-red-300/80">탈락</span>
      )}
    </li>
  );
}
