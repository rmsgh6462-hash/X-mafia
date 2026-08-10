'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Send } from 'lucide-react';
import { listMafiaChatMessages, sendMafiaChat } from '@/lib/game/room';
import type { GameRoom, Player } from '@/types/game';

function formatTime(ts: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 생존 마피아 전용 비밀 채팅 (학생) */
export function MafiaChatPanel({
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
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = useMemo(() => listMafiaChatMessages(room), [room]);
  const allyCount = useMemo(
    () =>
      Object.values(room.players ?? {}).filter(
        (p) => p.isAlive && p.role === 'MAFIA',
      ).length,
    [room.players],
  );

  useEffect(() => {
    if (!collapsed) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, collapsed]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendMafiaChat(pin, {
        senderId: me.id,
        senderName: me.name,
        text: trimmed,
      });
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-red-400/35 bg-red-950/45 p-3 ring-1 ring-red-500/20">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-red-100">
          <Lock className="h-3.5 w-3.5" />
          마피아 비밀 채팅
          <span className="rounded bg-red-500/40 px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal">
            {allyCount}명 · {messages.length}개
          </span>
        </h3>
        <span className="text-[11px] font-bold text-red-100/60">
          {collapsed ? '펼치기' : '접기'}
        </span>
      </button>

      {!collapsed && (
        <>
          <p className="mt-2 rounded-lg bg-black/30 px-2.5 py-2 text-[11px] font-semibold leading-snug text-red-100/85">
            생존 마피아끼리만 보이는 비밀 대화입니다. 교사 화면에는 실시간으로
            표시됩니다.
          </p>
          <div className="mt-2 flex h-56 flex-col rounded-xl bg-black/40">
            <div className="flex-1 space-y-2 overflow-y-auto px-2.5 py-2">
              {messages.length === 0 ? (
                <p className="py-8 text-center text-xs text-white/35">
                  아직 메시지가 없습니다. 동료와 작전을 짜 보세요.
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.senderId === me.id;
                  return (
                    <div
                      key={m.id}
                      className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? 'ml-auto bg-red-600 text-white'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      {!mine && (
                        <p className="mb-0.5 text-[10px] font-bold text-red-200/90">
                          {m.senderName}
                        </p>
                      )}
                      <p>{m.text}</p>
                      <p
                        className={`mt-0.5 text-[9px] ${
                          mine ? 'text-white/60' : 'text-white/40'
                        }`}
                      >
                        {formatTime(m.timestamp)}
                      </p>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
            <div className="flex gap-2 border-t border-white/10 p-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 200))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                maxLength={200}
                placeholder="동료에게 메시지…"
                className="min-w-0 flex-1 rounded-xl border border-white/15 bg-stone-950 px-3 py-2 text-sm text-white outline-none focus:border-red-400/50"
              />
              <button
                type="button"
                disabled={sending || !text.trim()}
                onClick={() => void handleSend()}
                className="inline-flex items-center justify-center rounded-xl bg-red-500 px-3 text-white hover:bg-red-400 disabled:opacity-40"
                aria-label="전송"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
          {error && (
            <p className="mt-2 text-[11px] font-semibold text-red-200">{error}</p>
          )}
        </>
      )}
    </section>
  );
}
