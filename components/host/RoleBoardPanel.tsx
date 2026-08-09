'use client';

import { Eye, EyeOff, X } from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { ROLE_ACCENTS, ROLE_LABELS } from '@/lib/game/roles';
import { playerList } from '@/lib/game/room';
import type { GameRoom, Role } from '@/types/game';

const ROLE_ORDER: Role[] = [
  'MAFIA',
  'DOCTOR',
  'POLICE',
  'REPORTER',
  'SPIRITUALIST',
  'CITIZEN',
];

export function RoleBoardPanel({
  room,
  open,
  onClose,
}: {
  room: GameRoom;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const players = playerList(room).sort((a, b) =>
    a.name.localeCompare(b.name, 'ko'),
  );
  const byRole = ROLE_ORDER.map((role) => ({
    role,
    list: players.filter((p) => p.role === role),
  })).filter((g) => g.list.length > 0);
  const unassigned = players.filter((p) => !p.role);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm md:items-center">
      <div
        role="dialog"
        aria-label="학생별 역할"
        className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-stone-950 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-base font-black text-amber-100">
              학생별 역할 (교사 전용)
            </h2>
            <p className="text-xs text-white/45">
              대형 화면에 오래 두지 마세요 · 학생에게 보이지 않게 주의
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(88vh-4rem)] space-y-4 overflow-y-auto p-4">
          {players.every((p) => !p.role) ? (
            <p className="py-8 text-center text-sm text-white/50">
              아직 역할이 배정되지 않았습니다. 게임 시작 후 확인할 수 있습니다.
            </p>
          ) : (
            <>
              {byRole.map(({ role, list }) => (
                <section key={role}>
                  <h3
                    className="mb-2 text-xs font-bold uppercase tracking-wider"
                    style={{ color: ROLE_ACCENTS[role] }}
                  >
                    {ROLE_LABELS[role]} · {list.length}명
                  </h3>
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {list.map((p) => (
                      <li
                        key={p.id}
                        className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${
                          p.isAlive ? 'bg-white/5' : 'bg-black/40 opacity-70'
                        }`}
                      >
                        <CharacterAvatar
                          avatarId={p.avatarId}
                          isAlive={p.isAlive}
                          size={40}
                        />
                        <div className="min-w-0">
                          <p
                            className={`truncate text-sm font-bold ${
                              p.isAlive ? 'text-white' : 'text-white/45 line-through'
                            }`}
                          >
                            {p.name}
                          </p>
                          <p className="text-[10px] text-white/40">
                            {p.isAlive ? '생존' : '탈락'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {unassigned.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-bold text-white/40">
                    미배정 · {unassigned.length}명
                  </h3>
                  <ul className="flex flex-wrap gap-2">
                    {unassigned.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-lg bg-white/5 px-2 py-1 text-xs text-white/60"
                      >
                        {p.name}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function RoleBoardToggle({
  open,
  onToggle,
  disabled,
}: {
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-40 ${
        open
          ? 'bg-amber-400 text-stone-900'
          : 'bg-white/10 text-white hover:bg-white/16'
      }`}
    >
      {open ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      역할
    </button>
  );
}
