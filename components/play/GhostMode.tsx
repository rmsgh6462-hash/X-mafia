'use client';

import { useMemo, useState } from 'react';
import { Ghost, Send } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/game/roles';
import {
  castGhostPrediction,
  playerList,
  sendGhostChat,
} from '@/lib/game/room';
import type { GameRoom, Player, WinnerSide } from '@/types/game';

export function GhostMode({
  room,
  me,
  pin,
}: {
  room: GameRoom;
  me: Player;
  pin: string;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const messages = useMemo(() => {
    return Object.values(room.ghostChat ?? {}).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
  }, [room.ghostChat]);

  const predictions = room.ghostPredictions ?? {};
  const myPrediction = predictions[me.id] ?? null;

  const tally = useMemo(() => {
    const values = Object.values(predictions);
    return {
      CITIZEN: values.filter((v) => v === 'CITIZEN').length,
      MAFIA: values.filter((v) => v === 'MAFIA').length,
    };
  }, [predictions]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await sendGhostChat(pin, {
        playerId: me.id,
        playerName: me.name,
        text: trimmed,
        createdAt: Date.now(),
      });
      setText('');
    } finally {
      setSending(false);
    }
  };

  const predict = async (side: WinnerSide) => {
    await castGhostPrediction(pin, me.id, side);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-2xl bg-violet-950/60 px-4 py-3 ring-1 ring-violet-400/30">
        <Ghost className="h-5 w-5 text-violet-200" />
        <div>
          <p className="text-sm font-black text-violet-100">유령 관전 모드</p>
          <p className="text-xs text-violet-100/70">생존자에게는 보이지 않습니다</p>
        </div>
      </div>

      {/* 전체 직업 공개 */}
      <section className="rounded-2xl bg-black/35 p-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
          전체 직업 공개
        </h3>
        <ul className="space-y-1.5">
          {playerList(room).map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
            >
              <span className={p.isAlive ? 'text-white' : 'text-white/45 line-through'}>
                {p.name}
              </span>
              <span className="font-bold text-amber-200">
                {p.role ? ROLE_LABELS[p.role] : '???'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 승자 예측 */}
      <section className="rounded-2xl bg-black/35 p-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
          승자 예측 미니 투표
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void predict('CITIZEN')}
            className={`rounded-xl py-3 text-sm font-bold ${
              myPrediction === 'CITIZEN'
                ? 'bg-emerald-500 text-white'
                : 'bg-white/10 text-white'
            }`}
          >
            시민팀 ({tally.CITIZEN})
          </button>
          <button
            type="button"
            onClick={() => void predict('MAFIA')}
            className={`rounded-xl py-3 text-sm font-bold ${
              myPrediction === 'MAFIA'
                ? 'bg-red-600 text-white'
                : 'bg-white/10 text-white'
            }`}
          >
            X맨팀 ({tally.MAFIA})
          </button>
        </div>
      </section>

      {/* 유령 채팅 */}
      <section className="flex h-64 flex-col rounded-2xl bg-black/35 p-3">
        <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-white/50">
          유령 채팅방
        </h3>
        <div className="flex-1 space-y-2 overflow-y-auto px-1">
          {messages.length === 0 && (
            <p className="text-xs text-white/40">아직 메시지가 없습니다.</p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.playerId === me.id
                  ? 'ml-auto bg-violet-600 text-white'
                  : 'bg-white/10 text-white'
              }`}
            >
              <p className="text-[10px] font-semibold opacity-70">{m.playerName}</p>
              <p>{m.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSend();
            }}
            placeholder="유령에게 메시지..."
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-violet-400/50"
          />
          <button
            type="button"
            disabled={sending || !text.trim()}
            onClick={() => void handleSend()}
            className="rounded-xl bg-violet-500 px-3 text-white disabled:opacity-40"
            aria-label="전송"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
