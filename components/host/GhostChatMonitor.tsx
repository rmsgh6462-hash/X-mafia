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
      <section className="mt-4 w-full max-w-4xl rounded-2xl border border-violet-400/20 bg-violet-950/35 px-4 py-3 text-left">
        <h3 className="flex items-center gap-2 text-sm font-black text-violet-100/80">
          <Ghost className="h-4 w-4" />
          👻 유령 채팅 실시간 모니터링
        </h3>
        <p className="mt-1 text-[11px] text-violet-100/50">
          탈락한 학생이 생기면 유령끼리의 대화가 여기에 실시간으로 표시됩니다.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-4 w-full max-w-4xl rounded-2xl border border-violet-400/30 bg-violet-950/50 p-4 text-left shadow-xl backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <h3 className="flex items-center gap-2 text-sm font-black text-violet-100">
          <Ghost className="h-4 w-4" />
          👻 유령 채팅 실시간 모니터링
          <span className="rounded-md bg-violet-500/30 px-2 py-0.5 text-[10px] font-bold text-violet-100">
            {messages.length}개 · 유령 {ghostCount}명
          </span>
        </h3>
        <span className="text-xs font-bold text-violet-200/70">
          {open ? '접기' : '펼치기'} · 읽기 전용
        </span>
      </button>

      {open && (
        <div className="mt-3 flex max-h-72 flex-col rounded-xl bg-black/40">
          <p className="border-b border-white/10 px-3 py-2 text-[11px] text-violet-100/60">
            유령 학생끼리만 쓰는 비밀 채팅입니다. 생존 학생 화면에는 표시되지
            않습니다.
          </p>
          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.length === 0 ? (
              <p className="py-6 text-center text-xs text-white/35">
                아직 유령 채팅이 없습니다.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg bg-violet-500/10 px-2.5 py-1.5 ring-1 ring-violet-400/15"
                >
                  <p className="text-[10px] font-semibold text-violet-200/90">
                    {m.senderName}
                    <span className="ml-2 font-normal text-white/35">
                      {formatTime(m.timestamp)}
                    </span>
                  </p>
                  <p className="text-sm text-white/90">{m.text}</p>
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
