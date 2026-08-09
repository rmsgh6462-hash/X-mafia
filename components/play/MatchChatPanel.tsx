'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { matchPairKey, sendMatchChat } from '@/lib/game/room';
import type { GameRoom, Player } from '@/types/game';

export function MatchChatPanel({
  room,
  me,
  partner,
  pin,
}: {
  room: GameRoom;
  me: Player;
  partner: Player;
  pin: string;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);

  const pairKey = useMemo(
    () => matchPairKey(me.id, partner.id),
    [me.id, partner.id],
  );

  const messages = useMemo(() => {
    const raw = room.matchChats?.[pairKey] ?? {};
    return Object.values(raw).sort((a, b) => a.createdAt - b.createdAt);
  }, [room.matchChats, pairKey]);

  const remainSec = room.matchEndsAt
    ? Math.max(0, Math.ceil((room.matchEndsAt - now) / 1000))
    : 0;
  const closed = Boolean(room.matchEndsAt && now >= room.matchEndsAt);

  useEffect(() => {
    if (!room.matchEndsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [room.matchEndsAt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || closed || sending) return;
    setSending(true);
    try {
      await sendMatchChat(pin, pairKey, {
        playerId: me.id,
        playerName: me.name,
        text: trimmed.slice(0, 200),
        createdAt: Date.now(),
      });
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="flex flex-col rounded-2xl bg-amber-500/10 ring-1 ring-amber-400/30">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <MessageCircle className="h-4 w-4 shrink-0 text-amber-200" />
          <div className="min-w-0">
            <p className="text-sm font-black text-amber-100">1:1 채팅</p>
            <p className="truncate text-xs text-white/60">
              파트너: {partner.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CharacterAvatar avatarId={partner.avatarId} size={36} isAlive />
          <span
            className={`rounded-full px-2.5 py-1 font-mono text-xs font-black tabular-nums ${
              remainSec <= 5
                ? 'bg-red-500/25 text-red-200'
                : 'bg-amber-400/20 text-amber-100'
            }`}
          >
            {remainSec}초
          </span>
        </div>
      </div>

      <div className="flex h-56 flex-col gap-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="py-6 text-center text-xs text-white/40">
            직접 만나지 않아도 됩니다.
            <br />
            휴대폰으로 파트너와 대화해 보세요.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.playerId === me.id;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? 'rounded-br-md bg-amber-400 text-stone-900'
                    : 'rounded-bl-md bg-white/10 text-white'
                }`}
              >
                {!mine && (
                  <p className="mb-0.5 text-[10px] font-semibold opacity-60">
                    {m.playerName}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-white/10 p-3">
        <input
          value={text}
          disabled={closed}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={closed ? '채팅 시간이 끝났습니다' : '메시지 입력…'}
          maxLength={200}
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-amber-400/50 disabled:opacity-50"
        />
        <button
          type="button"
          disabled={closed || sending || !text.trim()}
          onClick={() => void handleSend()}
          className="rounded-xl bg-amber-400 px-3 text-stone-900 disabled:opacity-40"
          aria-label="전송"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
