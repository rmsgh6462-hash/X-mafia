'use client';

import { useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { matchPairKey } from '@/lib/game/room';
import type { GameRoom, MatchChatMessage, Player } from '@/types/game';

type ChatSource = {
  kind: 'live' | 'history';
  label: string;
  chats: Record<string, Record<string, MatchChatMessage>>;
  roundId?: string;
};

function resolvePair(
  room: GameRoom,
  pairKey: string,
  chats: Record<string, Record<string, MatchChatMessage>>,
): { a: Player | null; b: Player | null; title: string } {
  const players = Object.values(room.players ?? {});

  for (const p of players) {
    if (p.partnerId && matchPairKey(p.id, p.partnerId) === pairKey) {
      const b = room.players[p.partnerId] ?? null;
      return { a: p, b, title: `${p.name} ↔ ${b?.name ?? '?'}` };
    }
  }

  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      if (matchPairKey(players[i].id, players[j].id) === pairKey) {
        return {
          a: players[i],
          b: players[j],
          title: `${players[i].name} ↔ ${players[j].name}`,
        };
      }
    }
  }

  const names = [
    ...new Set(
      Object.values(chats[pairKey] ?? {}).map((m) => m.playerName),
    ),
  ];
  if (names.length >= 2) {
    return { a: null, b: null, title: `${names[0]} ↔ ${names[1]}` };
  }

  return { a: null, b: null, title: '페어' };
}

function collectPairKeys(
  room: GameRoom,
  chats: Record<string, Record<string, MatchChatMessage>>,
  includeEmptyPartners: boolean,
): string[] {
  const keys = new Set(Object.keys(chats));
  if (includeEmptyPartners) {
    Object.values(room.players ?? {}).forEach((p) => {
      if (p.partnerId) keys.add(matchPairKey(p.id, p.partnerId));
    });
  }
  return [...keys];
}

export function MatchChatMonitor({
  room,
  live = false,
}: {
  room: GameRoom;
  /** 현재 매칭 진행 중 */
  live?: boolean;
}) {
  const liveChats = room.matchChats ?? {};
  const history = useMemo(
    () =>
      Object.values(room.matchChatHistory ?? {}).sort(
        (a, b) => b.createdAt - a.createdAt,
      ),
    [room.matchChatHistory],
  );

  const sources: ChatSource[] = useMemo(() => {
    const list: ChatSource[] = [];
    const hasLive = Object.keys(liveChats).length > 0 || live;
    if (hasLive) {
      list.push({
        kind: 'live',
        label: live ? '진행 중 (실시간)' : '직전 매칭',
        chats: liveChats,
      });
    }
    history.forEach((round, i) => {
      list.push({
        kind: 'history',
        label: `이전 기록 #${history.length - i}`,
        chats: round.chats,
        roundId: round.id,
      });
    });
    return list;
  }, [liveChats, history, live]);

  const [sourceIdx, setSourceIdx] = useState(0);
  const safeIdx = Math.min(sourceIdx, Math.max(0, sources.length - 1));
  const source = sources[safeIdx] ?? null;

  const pairKeys = useMemo(() => {
    if (!source) return [];
    return collectPairKeys(
      room,
      source.chats,
      live && source.kind === 'live',
    );
  }, [source, live, room]);

  const [activePair, setActivePair] = useState<string | null>(null);
  const selectedPair =
    activePair && pairKeys.includes(activePair) ? activePair : pairKeys[0] ?? null;

  const messages = useMemo(() => {
    if (!source || !selectedPair) return [] as MatchChatMessage[];
    return Object.values(source.chats[selectedPair] ?? {}).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
  }, [source, selectedPair]);

  if (sources.length === 0) return null;

  return (
    <section className="mt-6 w-full max-w-4xl rounded-2xl border border-amber-400/25 bg-stone-950/80 p-4 text-left shadow-xl backdrop-blur-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-sm font-black text-amber-200">
          <MessageCircle className="h-4 w-4" />
          매칭 채팅 {live ? '모니터' : '기록'}
          {live && (
            <span className="rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
              LIVE
            </span>
          )}
        </h3>
        {sources.length > 1 && (
          <select
            value={safeIdx}
            onChange={(e) => {
              setSourceIdx(Number(e.target.value));
              setActivePair(null);
            }}
            className="rounded-lg border border-white/15 bg-stone-900 px-2 py-1 text-xs text-white"
          >
            {sources.map((s, i) => (
              <option key={s.roundId ?? `${s.kind}-${i}`} value={i}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {pairKeys.length === 0 ? (
        <p className="text-sm text-white/45">
          {live
            ? '아직 채팅이 없습니다. 학생 대화를 기다리는 중…'
            : '저장된 채팅이 없습니다.'}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-[200px_1fr]">
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {pairKeys.map((key) => {
              const { title, a, b } = resolvePair(room, key, source!.chats);
              const count = Object.keys(source!.chats[key] ?? {}).length;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActivePair(key)}
                  className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition ${
                    selectedPair === key
                      ? 'bg-amber-400/20 ring-1 ring-amber-400/50'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex -space-x-2">
                    <CharacterAvatar
                      avatarId={a?.avatarId}
                      size={28}
                      isAlive={a?.isAlive ?? true}
                      previewOnHover
                    />
                    <CharacterAvatar
                      avatarId={b?.avatarId}
                      size={28}
                      isAlive={b?.isAlive ?? true}
                      previewOnHover
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-white">{title}</p>
                    <p className="text-white/40">{count}개 메시지</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex max-h-64 flex-col rounded-xl bg-black/35">
            <div className="border-b border-white/10 px-3 py-2 text-xs font-bold text-white/60">
              {selectedPair
                ? resolvePair(room, selectedPair, source!.chats).title
                : '페어 선택'}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
              {messages.length === 0 ? (
                <p className="py-4 text-center text-xs text-white/35">대화 없음</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="rounded-lg bg-white/5 px-2.5 py-1.5">
                    <p className="text-[10px] font-semibold text-amber-200/80">
                      {m.playerName}
                      <span className="ml-2 font-normal text-white/30">
                        {new Date(m.createdAt).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </p>
                    <p className="text-sm text-white/90">{m.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
