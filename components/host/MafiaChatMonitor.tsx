'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { listMafiaChatMessages } from '@/lib/game/room';
import type { GameRoom } from '@/types/game';

function formatTime(ts: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** 교사 — 마피아 비밀 채팅 읽기 전용 실시간 모니터 */
export function MafiaChatMonitor({ room }: { room: GameRoom }) {
  const [open, setOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = useMemo(() => listMafiaChatMessages(room), [room]);
  const mafiaAlive = useMemo(
    () =>
      Object.values(room.players ?? {}).filter(
        (p) => p.isAlive && p.role === 'MAFIA',
      ).length,
    [room.players],
  );
  const chatEnabled = room.mafiaChatEnabled !== false;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (room.gameState === 'WAITING') return null;

  return (
    <section className="w-full rounded-2xl border border-red-400/35 bg-red-950/45 p-3 text-left shadow-xl backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <h3 className="flex flex-wrap items-center gap-1.5 text-xs font-black text-red-100">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          마피아 비밀 채팅
          <span className="rounded-md bg-red-500/35 px-1.5 py-0.5 text-[10px] font-bold text-red-50">
            {messages.length} · 마피아 {mafiaAlive}
            {chatEnabled ? '' : ' · OFF'}
          </span>
        </h3>
        <span className="shrink-0 text-[10px] font-bold text-red-200/70">
          {open ? '접기' : '펼치기'}
        </span>
      </button>

      {open && (
        <div className="mt-2 flex max-h-44 flex-col rounded-xl bg-black/40 lg:max-h-52">
          <p className="border-b border-white/10 px-2.5 py-1.5 text-[10px] leading-snug text-red-100/65">
            {chatEnabled
              ? '생존 마피아 전용 · 읽기 전용'
              : 'OFF — 학생 사용 불가 · 기록은 열람 가능'}
          </p>
          <div className="flex-1 space-y-1.5 overflow-y-auto px-2.5 py-2">
            {messages.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-white/35">
                아직 마피아 채팅이 없습니다.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg bg-red-500/10 px-2 py-1.5 ring-1 ring-red-400/20"
                >
                  <p className="text-[10px] font-semibold text-red-200/90">
                    {m.senderName}
                    <span className="ml-1.5 font-normal text-white/35">
                      {formatTime(m.timestamp)}
                    </span>
                  </p>
                  <p className="text-xs text-white/90">{m.text}</p>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </section>
  );
}
