'use client';

import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { ROLE_LABELS } from '@/lib/game/roles';
import { playerList } from '@/lib/game/room';
import { visibleRoleBadgeFor } from '@/lib/game/visibility';
import type { GameRoom, Player } from '@/types/game';

export function PlayerRoster({
  room,
  highlightId,
  compact = false,
  title = '참가자',
  showRoles = false,
  /** 학생 본인 — 있으면 마피아 동료만 배지 표시 (교사 showRoles와 별개) */
  viewer = null,
}: {
  room: GameRoom;
  highlightId?: string;
  compact?: boolean;
  title?: string;
  /** 교사 화면용 — 배정된 직업 전부 표시 */
  showRoles?: boolean;
  viewer?: Player | null;
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
          {list.map((p) => {
            const badge = showRoles
              ? p.role
                ? ROLE_LABELS[p.role]
                : null
              : visibleRoleBadgeFor(viewer, p);
            return (
              <PlayerChip
                key={p.id}
                player={p}
                highlight={p.id === highlightId}
                compact={compact}
                roleBadge={badge}
                mafiaAlly={
                  !showRoles &&
                  viewer?.role === 'MAFIA' &&
                  p.role === 'MAFIA' &&
                  p.id !== viewer.id
                }
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PlayerChip({
  player,
  highlight,
  compact,
  roleBadge,
  mafiaAlly,
}: {
  player: Player;
  highlight?: boolean;
  compact?: boolean;
  roleBadge?: string | null;
  mafiaAlly?: boolean;
}) {
  return (
    <li
      className={`flex flex-col items-center rounded-xl px-2 py-2 text-center ${
        highlight
          ? 'bg-amber-400/20 ring-1 ring-amber-400/50'
          : mafiaAlly
            ? 'bg-red-950/45 ring-1 ring-red-400/35'
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
      {roleBadge && (
        <span
          className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-black ${
            mafiaAlly || roleBadge === '마피아'
              ? 'bg-red-500/90 text-white'
              : 'text-amber-200/90'
          }`}
        >
          {mafiaAlly ? `[${roleBadge}]` : roleBadge}
        </span>
      )}
      {!player.isAlive && (
        <span className="text-[9px] font-semibold text-red-300/80">탈락</span>
      )}
    </li>
  );
}
