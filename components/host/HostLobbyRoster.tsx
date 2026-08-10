'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { playerList } from '@/lib/game/room';
import type { GameRoom } from '@/types/game';

/** 대기 화면 — 교사: 그리드 카드 + 닉네임 재설정 요청·퇴장 */
export function HostLobbyRoster({
  room,
  busy,
  onKick,
  onRequestNicknameChange,
}: {
  room: GameRoom;
  busy?: boolean;
  onKick: (playerId: string) => void;
  onRequestNicknameChange: (playerId: string) => string | null;
}) {
  const list = playerList(room).sort((a, b) =>
    a.name.localeCompare(b.name, 'ko'),
  );
  const pendingId = room.nicknameChangeRequest?.playerId ?? null;

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
        <ul className="grid max-h-[28rem] grid-cols-3 gap-2 overflow-y-auto md:grid-cols-4 lg:grid-cols-5 md:gap-3">
          {list.map((p) => {
            const awaitingRename = pendingId === p.id;
            return (
              <li
                key={p.id}
                className={`relative flex flex-col items-center gap-2 rounded-2xl bg-white/5 px-2 py-3 text-center ring-1 transition ${
                  awaitingRename
                    ? 'ring-amber-400/70 bg-amber-400/10'
                    : 'ring-white/10'
                }`}
              >
                <CharacterAvatar
                  avatarId={p.avatarId}
                  state="normal"
                  size={56}
                  isAlive
                  previewOnHover
                />
                <p className="w-full truncate px-0.5 text-sm font-bold text-white">
                  {p.name}
                </p>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-300/95">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.85)]"
                    aria-hidden
                  />
                  {awaitingRename ? '변경 요청' : 'Waiting'}
                </span>
                <div className="mt-0.5 flex items-center gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const err = onRequestNicknameChange(p.id);
                      if (err) window.alert(err);
                    }}
                    title="닉네임 수정 요청"
                    aria-label={`${p.name} 닉네임 수정 요청`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-sky-500/80 disabled:opacity-40"
                  >
                    <Pencil className="h-3.5 w-3.5" />
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
                    aria-label={`${p.name} 퇴장`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-red-500/90 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-white/40">
        연필 아이콘으로 닉네임 재설정을 요청하고, 휴지통으로 퇴장시킬 수 있습니다.
      </p>
    </section>
  );
}
