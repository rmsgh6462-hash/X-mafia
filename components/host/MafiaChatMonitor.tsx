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
    <section className="mt-4 w-full max-w-4xl rounded-2xl border border-red-400/35 bg-red-950/45 p-4 text-left shadow-xl backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <h3 className="flex items-center gap-2 text-sm font-black text-red-100">
          <Lock className="h-4 w-4" />
          마피아 비밀 채팅 모니터링
          <span className="rounded-md bg-red-500/35 px-2 py-0.5 text-[10px] font-bold text-red-50">
            {messages.length}개 · 생존 마피아 {mafiaAlive}명
            {chatEnabled ? '' : ' · OFF'}
          </span>
        </h3>
        <span className="text-xs font-bold text-red-200/70">
          {open ? '접기' : '펼치기'} · 읽기 전용
        </span>
      </button>

      {open && (
        <div className="mt-3 flex max-h-72 flex-col rounded-xl bg-black/40">
          <p className="border-b border-white/10 px-3 py-2 text-[11px] text-red-100/65">
            {chatEnabled
              ? '생존 마피아끼리만 쓰는 비밀 채팅입니다. 시민·유령 화면에는 보이지 않지만, 교사에게는 항상 표시됩니다.'
              : '현재 OFF — 학생은 채팅을 쓰거나 볼 수 없습니다. 아래에서 기존 대화를 계속 확인할 수 있습니다. (GM 패널에서 다시 켤 수 있습니다)'}
          </p>
          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.length === 0 ? (
              <p className="py-6 text-center text-xs text-white/35">
                아직 마피아 채팅이 없습니다.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg bg-red-500/10 px-2.5 py-1.5 ring-1 ring-red-400/20"
                >
                  <p className="text-[10px] font-semibold text-red-200/90">
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
