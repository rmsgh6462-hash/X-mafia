'use client';

import { useState } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { playerList } from '@/lib/game/room';
import type { GameRoom } from '@/types/game';

/** 대기 화면 — 교사: 학생 퇴장·닉네임 변경 */
export function HostLobbyRoster({
  room,
  busy,
  onKick,
  onRename,
}: {
  room: GameRoom;
  busy?: boolean;
  onKick: (playerId: string) => void;
  onRename: (playerId: string, name: string) => string | null;
}) {
  const list = playerList(room).sort((a, b) =>
    a.name.localeCompare(b.name, 'ko'),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const beginEdit = (id: string, name: string) => {
    setEditingId(id);
    setDraft(name);
    setLocalError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft('');
    setLocalError(null);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const err = onRename(editingId, draft);
    if (err) {
      setLocalError(err);
      return;
    }
    cancelEdit();
  };

  return (
    <section className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">
          입장한 학생
        </h3>
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white/80">
          {list.length}명
        </span>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-white/45">아직 입장한 학생이 없습니다.</p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {list.map((p) => {
            const editing = editingId === p.id;
            return (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10"
              >
                <CharacterAvatar
                  avatarId={p.avatarId}
                  size={44}
                  isAlive
                  previewOnHover
                />
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <div className="flex flex-col gap-1.5">
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={12}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className="w-full rounded-lg border border-amber-400/50 bg-stone-950 px-2.5 py-1.5 text-sm font-bold text-white"
                      />
                      {localError && editing && (
                        <p className="text-[11px] font-semibold text-red-300">
                          {localError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="truncate text-sm font-bold text-white">
                      {p.name}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={commitEdit}
                        title="저장"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/90 text-white hover:bg-emerald-400 disabled:opacity-40"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={cancelEdit}
                        title="취소"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-40"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => beginEdit(p.id, p.name)}
                        title="닉네임 변경"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-sky-500/80 disabled:opacity-40"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const ok = window.confirm(
                            `${p.name} 님을 방에서 퇴장시킬까요?`,
                          );
                          if (ok) onKick(p.id);
                        }}
                        title="퇴장"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-red-500/90 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-white/40">
        연필 아이콘으로 닉네임 변경, 휴지통으로 퇴장시킬 수 있습니다.
      </p>
    </section>
  );
}
