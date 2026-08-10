'use client';

import { useState } from 'react';
import { Bolt, Crosshair, Eye, EyeOff, Ghost, Lock, MessageSquareWarning, Vote, ZapOff } from 'lucide-react';
import type { GameRoom, GmEvent, VoteTieResolution } from '@/types/game';

export function GmPanel({
  room,
  disabled,
  spiritualistAlive,
  onAnonymousTip,
  onSilenceNight,
  onReviveNight,
  onVoteTieResolutionChange,
  onRevealDeathRolesChange,
  onAllowMafiaTargetMafiaChange,
  onMafiaChatEnabledChange,
}: {
  room: GameRoom;
  disabled?: boolean;
  spiritualistAlive: boolean;
  onAnonymousTip: (hint: string) => void;
  onSilenceNight: () => void;
  onReviveNight: () => void;
  onVoteTieResolutionChange: (mode: VoteTieResolution) => void;
  onRevealDeathRolesChange: (enabled: boolean) => void;
  onAllowMafiaTargetMafiaChange: (enabled: boolean) => void;
  onMafiaChatEnabledChange: (enabled: boolean) => void;
}) {
  const [hint, setHint] = useState('');

  const active = room.gmEvent;
  const tieMode = room.voteTieResolution ?? 'RANDOM';
  const revealRoles = room.revealDeathRoles !== false;
  const allowMafiaTargetMafia = room.allowMafiaTargetMafia !== false;
  const mafiaChatEnabled = room.mafiaChatEnabled !== false;

  return (
    <aside className="w-full max-w-md rounded-2xl border border-amber-500/25 bg-stone-950/75 p-4 shadow-xl backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-black tracking-wide text-amber-200">
          GM 특수 제어 패널
        </h3>
        <GmBadge event={active} />
      </div>

      <div className="space-y-3">
        {/* 투표 동률 처리 */}
        <div className="rounded-xl bg-white/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-white/70">
            <Vote className="h-3.5 w-3.5 text-amber-300" />
            투표 동률 처리
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <TieModeButton
              active={tieMode === 'RANDOM'}
              disabled={disabled}
              label="무작위 1명 탈락"
              hint="동률자 중 랜덤"
              onClick={() => onVoteTieResolutionChange('RANDOM')}
            />
            <TieModeButton
              active={tieMode === 'REVOTE'}
              disabled={disabled}
              label="동률자 재투표"
              hint="동률자만 15초 재투표"
              onClick={() => onVoteTieResolutionChange('REVOTE')}
            />
          </div>
          {room.voteRevoteCandidates && (
            <p className="mt-2 text-[11px] font-medium text-amber-200/80">
              재투표 진행 중 ·{' '}
              {room.voteRevoteCandidates
                .map((id) => room.players[id]?.name ?? '?')
                .join(', ')}
            </p>
          )}
        </div>

        {/* 탈락자 직업 공개 */}
        <div className="rounded-xl bg-white/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-bold text-white/70">
              {revealRoles ? (
                <Eye className="h-3.5 w-3.5 text-amber-300" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 text-white/40" />
              )}
              탈락자 직업 즉시 공개
            </p>
            <button
              type="button"
              disabled={disabled}
              role="switch"
              aria-checked={revealRoles}
              onClick={() => onRevealDeathRolesChange(!revealRoles)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${
                revealRoles ? 'bg-amber-400' : 'bg-white/20'
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  revealRoles ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-white/45">
            {revealRoles
              ? 'ON — 투표·밤 탈락 시 실제 직업을 전원에게 공개'
              : 'OFF — 탈락 사실만 안내 (직업 ???)'}
          </p>
        </div>

        {/* 마피아끼리 지목 */}
        <div className="rounded-xl bg-white/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-bold text-white/70">
              <Crosshair className="h-3.5 w-3.5 text-red-300" />
              마피아끼리 지목
            </p>
            <button
              type="button"
              disabled={disabled}
              role="switch"
              aria-checked={allowMafiaTargetMafia}
              onClick={() =>
                onAllowMafiaTargetMafiaChange(!allowMafiaTargetMafia)
              }
              className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${
                allowMafiaTargetMafia ? 'bg-red-500' : 'bg-white/20'
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  allowMafiaTargetMafia ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-white/45">
            {allowMafiaTargetMafia
              ? 'ON — 마피아가 동료 마피아도 밤 지목 가능'
              : 'OFF — 동료 마피아는 지목 불가 (시민 측만 선택)'}
          </p>
        </div>

        {/* 마피아 비밀 채팅 */}
        <div className="rounded-xl bg-white/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-bold text-white/70">
              <Lock className="h-3.5 w-3.5 text-red-300" />
              마피아 비밀 채팅
            </p>
            <button
              type="button"
              disabled={disabled}
              role="switch"
              aria-checked={mafiaChatEnabled}
              onClick={() => onMafiaChatEnabledChange(!mafiaChatEnabled)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${
                mafiaChatEnabled ? 'bg-red-500' : 'bg-white/20'
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  mafiaChatEnabled ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-white/45">
            {mafiaChatEnabled
              ? 'ON — 생존 마피아끼리 비밀 채팅 사용'
              : 'OFF — 학생 채팅 숨김·전송 불가 (교사는 기록 열람 가능)'}
          </p>
        </div>

        {/* 익명 제보 */}
        <div className="rounded-xl bg-white/5 p-3">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-white/70">
            <MessageSquareWarning className="h-3.5 w-3.5 text-amber-300" />
            익명 제보
          </label>
          <textarea
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            rows={2}
            placeholder="힌트를 입력하세요…"
            className="w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-400/50"
          />
          <button
            type="button"
            disabled={disabled || !hint.trim()}
            onClick={() => {
              onAnonymousTip(hint.trim());
              setHint('');
            }}
            className="mt-2 w-full rounded-lg bg-amber-400 py-2 text-sm font-bold text-stone-900 disabled:opacity-40"
          >
            힌트 즉시 살포
          </button>
        </div>

        <button
          type="button"
          disabled={disabled || room.gameState === 'WAITING'}
          onClick={onSilenceNight}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-35 ${
            active === 'SILENCE_NIGHT'
              ? 'bg-slate-600 text-white ring-2 ring-slate-300/40'
              : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
          }`}
        >
          <ZapOff className="h-4 w-4" />
          정전 발생
          <span className="text-[11px] font-medium opacity-70">경찰·의사 무효</span>
        </button>

        <button
          type="button"
          disabled={disabled || !spiritualistAlive || room.gameState === 'WAITING'}
          onClick={onReviveNight}
          title={
            spiritualistAlive
              ? '기회의 밤 — 사망자 부활 투표 예정'
              : '생존 영매가 있을 때만 사용 가능'
          }
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${
            active === 'REVIVE_NIGHT'
              ? 'bg-violet-600 text-white ring-2 ring-violet-300/40'
              : 'bg-violet-950 text-violet-100 hover:bg-violet-900'
          }`}
        >
          <Ghost className="h-4 w-4" />
          기회의 밤
          {!spiritualistAlive && (
            <span className="text-[11px] font-medium opacity-70">영매 필요</span>
          )}
        </button>
      </div>
    </aside>
  );
}

function TieModeButton({
  active,
  disabled,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-3 py-2.5 text-left transition disabled:opacity-40 ${
        active
          ? 'bg-amber-400/20 ring-2 ring-amber-400/50'
          : 'bg-black/30 hover:bg-black/45'
      }`}
    >
      <span className="block text-xs font-bold text-white">{label}</span>
      <span className="block text-[10px] text-white/50">{hint}</span>
    </button>
  );
}

function GmBadge({ event }: { event: GmEvent }) {
  if (!event) {
    return (
      <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/45">
        이벤트 없음
      </span>
    );
  }

  const labels: Record<Exclude<GmEvent, null>, { text: string; className: string }> = {
    HINT_BOOST: {
      text: '익명 제보',
      className: 'bg-amber-500/20 text-amber-200',
    },
    SILENCE_NIGHT: {
      text: '정전',
      className: 'bg-slate-500/30 text-slate-100',
    },
    REVIVE_NIGHT: {
      text: '기회의 밤',
      className: 'bg-violet-500/25 text-violet-100',
    },
  };

  const item = labels[event];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${item.className}`}
    >
      <Bolt className="h-3 w-3" />
      {item.text}
    </span>
  );
}
