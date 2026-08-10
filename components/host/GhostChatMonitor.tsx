'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Ghost } from 'lucide-react';
import { listGhostChatMessages } from '@/lib/game/room';
import type { GameRoom } from '@/types/game';

function formatTime(ts: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** 교사 — 유령 채팅 읽기 전용 실시간 모니터 */
export function GhostChatMonitor({ room }: { room: GameRoom }) {
  const [open, setOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = useMemo(() => listGhostChatMessages(room), [room]);
  const ghostCount = useMemo(
    () => Object.values(room.players ?? {}).filter((p) => !p.isAlive).length,
    [room.players],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (ghostCount === 0 && messages.length === 0) {
    return (
      <section className="w-full rounded-2xl border border-violet-400/20 bg-violet-950/35 px-3 py-2.5 text-left">
        <h3 className="flex items-center gap-1.5 text-xs font-black text-violet-100/80">
          <Ghost className="h-3.5 w-3.5" />
          유령 채팅 모니터링
        </h3>
        <p className="mt-1 text-[10px] leading-snug text-violet-100/50">
          탈락한 학생이 생기면 유령 대화가 여기에 표시됩니다.
        </p>
      </section>
    );
  }

  return (
    <section className="w-full rounded-2xl border border-violet-400/30 bg-violet-950/50 p-3 text-left shadow-xl backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <h3 className="flex flex-wrap items-center gap-1.5 text-xs font-black text-violet-100">
          <Ghost className="h-3.5 w-3.5 shrink-0" />
          유령 채팅
          <span className="rounded-md bg-violet-500/30 px-1.5 py-0.5 text-[10px] font-bold text-violet-100">
            {messages.length} · 유령 {ghostCount}
          </span>
        </h3>
        <span className="shrink-0 text-[10px] font-bold text-violet-200/70">
          {open ? '접기' : '펼치기'}
        </span>
      </button>

      {open && (
        <div className="mt-2 flex max-h-44 flex-col rounded-xl bg-black/40 lg:max-h-52">
          <p className="border-b border-white/10 px-2.5 py-1.5 text-[10px] leading-snug text-violet-100/60">
            유령 전용 · 생존 학생에게는 보이지 않음 · 읽기 전용
          </p>
          <div className="flex-1 space-y-1.5 overflow-y-auto px-2.5 py-2">
            {messages.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-white/35">
                아직 유령 채팅이 없습니다.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg bg-violet-500/10 px-2 py-1.5 ring-1 ring-violet-400/15"
                >
                  <p className="text-[10px] font-semibold text-violet-200/90">
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
