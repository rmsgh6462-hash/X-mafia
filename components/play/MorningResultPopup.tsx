'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Crosshair,
  HeartPulse,
  Radio,
  Sunrise,
} from 'lucide-react';
import { CharacterAvatar } from '@/components/play/CharacterAvatar';
import { MorningReporterNews } from '@/components/play/MorningReporterNews';
import { playerGenderFromAvatarId } from '@/lib/game/avatars';
import { playMorningEventSound } from '@/lib/game/audio';
import { ROLE_LABELS } from '@/lib/game/roles';
import type {
  ActiveMorningEvent,
  MorningEvent,
  NightResults,
  Player,
  PlayerGender,
} from '@/types/game';

const EVENT_ORDER: MorningEvent[] = [
  'MAFIA_KILL',
  'DOCTOR_DEFEND',
  'REPORTER_NEWS',
];

function sortMorningEvents(events: ActiveMorningEvent[]): ActiveMorningEvent[] {
  return [...events].sort(
    (a, b) => EVENT_ORDER.indexOf(a.event) - EVENT_ORDER.indexOf(b.event),
  );
}

function deadIdsOf(result: NightResults | null | undefined): string[] {
  return result?.deadPlayerIds ?? [];
}

function savedIdsOf(result: NightResults | null | undefined): string[] {
  return result?.savedPlayerIds ?? [];
}

function activeEventsOf(result: NightResults | null | undefined): ActiveMorningEvent[] {
  return result?.activeEvents ?? [];
}

/** 성별 payload → 플레이어 데이터 → 아바타 ID 순으로 안전하게 보정한다. */
function resolvePlayerGender(
  player: Player | null | undefined,
  explicitGender?: PlayerGender | null,
): PlayerGender {
  if (explicitGender === 'boy' || explicitGender === 'girl') return explicitGender;
  if (player?.gender === 'boy' || player?.gender === 'girl') return player.gender;
  return playerGenderFromAvatarId(player?.avatarId);
}

export function getDoctorRescueImage(gender: PlayerGender | null | undefined): string {
  return gender === 'girl'
    ? '/illustrations/doctor-rescue-girl.png'
    : '/illustrations/doctor-rescue-boy.png';
}

/** @deprecated 아침 연출은 CharacterAvatar만 사용. 하위 호환용 export */
export function getActiveMorningEvents(
  result: NightResults | null | undefined,
): ActiveMorningEvent[] {
  const events = activeEventsOf(result);
  if (events.length === 0) return [];
  return sortMorningEvents(
    events.filter((item) => EVENT_ORDER.includes(item.event)),
  );
}

export function getMorningEvents(
  result: NightResults | null | undefined,
): MorningEvent[] {
  if (!result) return [];

  const activeEvents = getActiveMorningEvents(result);
  if (activeEvents.length > 0) {
    return activeEvents.map(({ event }) => event);
  }

  const storedEvents = (result.morningEvents ?? []).filter((event) =>
    EVENT_ORDER.includes(event),
  );
  if (storedEvents.length > 0) {
    return [...storedEvents].sort(
      (a, b) => EVENT_ORDER.indexOf(a) - EVENT_ORDER.indexOf(b),
    );
  }
  if (result.morningEvent && EVENT_ORDER.includes(result.morningEvent)) {
    return [result.morningEvent];
  }

  // 이전 버전 결과 데이터도 새 연출을 사용할 수 있도록 추론한다.
  const deadPlayerIds = deadIdsOf(result);
  const savedPlayerIds = savedIdsOf(result);
  const doctorSavedId = result.doctorSavedPlayerId ?? null;
  const doctorDefended =
    result.isDoctorDefended ??
    (deadPlayerIds.length === 0 &&
      doctorSavedId != null &&
      savedPlayerIds.includes(doctorSavedId));
  const legacyEvents: MorningEvent[] = [];
  if (deadPlayerIds.length > 0) legacyEvents.push('MAFIA_KILL');
  if (doctorDefended) legacyEvents.push('DOCTOR_DEFEND');
  if (result.reporterNews && result.reporterTargetId) {
    legacyEvents.push('REPORTER_NEWS');
  }
  return legacyEvents;
}

export function MorningSequenceModal({
  open,
  events = [],
  activeEvents = [],
  result,
  players,
  revealRoles,
  onClose,
}: {
  open: boolean;
  /** 구버전 호환용 이벤트 타입 배열 */
  events?: MorningEvent[];
  /** 새 백엔드가 만든 조건부 순차 큐 */
  activeEvents?: ActiveMorningEvent[];
  result: NightResults | null | undefined;
  players: Record<string, Player>;
  revealRoles: boolean;
  onClose: () => void;
}) {
  const [eventIndex, setEventIndex] = useState(0);
  const onCloseRef = useRef(onClose);
  const sequence = useMemo<ActiveMorningEvent[]>(() => {
    if (activeEvents.length > 0) return sortMorningEvents(activeEvents);
    return (events.length > 0 ? events : getMorningEvents(result)).map((event) => {
      const deadPlayerIds = deadIdsOf(result);
      const targetId =
        event === 'DOCTOR_DEFEND'
          ? result?.doctorSavedPlayerId ?? null
          : event === 'REPORTER_NEWS'
            ? result?.reporterTargetId ?? null
            : deadPlayerIds[0] ?? null;
      const target = targetId ? players[targetId] : null;
      return {
        event,
        actorId: null,
        targetId,
        targetName: target?.name ?? null,
        targetGender: resolvePlayerGender(target),
        success:
          event === 'DOCTOR_DEFEND' ? result?.isDoctorDefended === true : undefined,
      };
    });
  }, [activeEvents, events, players, result]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const currentEvent = sequence[eventIndex] ?? null;
  const currentType = currentEvent?.event ?? null;
  const currentSuccess = currentEvent?.success;
  const isMafiaKill = currentType === 'MAFIA_KILL';
  useEffect(() => {
    if (!open || !currentType) return;
    // 특보 단계의 셔터·타자기 효과음은 신문 컴포넌트가 등장할 때 재생한다.
    if (currentType !== 'REPORTER_NEWS') {
      void playMorningEventSound(currentType, {
        success: currentSuccess,
      }).catch(() => {
        /* 오디오 실패는 연출을 막지 않는다 */
      });
    }
    const timer = window.setTimeout(() => {
      if (eventIndex >= sequence.length - 1) {
        setEventIndex(0);
        onCloseRef.current();
      } else {
        setEventIndex((index) => index + 1);
      }
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [open, currentType, currentSuccess, eventIndex, sequence.length]);

  // open 이어도 큐/결과가 없으면 렌더하지 않음 (훅 이후 early return)
  if (!open || !currentEvent || !result) return null;

  const lastEvent = eventIndex >= sequence.length - 1;
  const closePopup = () => {
    setEventIndex(0);
    onClose();
  };
  const nextOrClose = () => {
    if (lastEvent) {
      closePopup();
    } else {
      setEventIndex((index) => index + 1);
    }
  };

  return (
    <AnimatePresence>
      {open && (
      <motion.div
          key={`${currentType}-${eventIndex}`}
          className={`fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/80 px-3 py-8 sm:py-12 ${isMafiaKill ? 'morning-screen-shake' : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closePopup}
        >
          {isMafiaKill && (
            <div
              aria-hidden="true"
              className="morning-red-flash pointer-events-none fixed inset-0 z-[80] bg-red-600"
            />
          )}
          <motion.div
            key={`${currentType}-${eventIndex}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="morning-result-title"
            className="w-full max-w-md"
            initial={{ y: -28, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            onClick={(event) => event.stopPropagation()}
          >
            {currentType === 'REPORTER_NEWS' && (
              <MorningReporterNews
                targetName={
                  currentEvent.targetName ??
                  (currentEvent.targetId ? players[currentEvent.targetId]?.name : null) ??
                  (result.reporterTargetId
                    ? players[result.reporterTargetId]?.name
                    : null) ??
                  '학생'
                }
                role={
                  result.reporterTargetRole ??
                  (currentEvent.targetId ? players[currentEvent.targetId]?.role : null) ??
                  (result.reporterTargetId
                    ? players[result.reporterTargetId]?.role
                    : null)
                }
                targetAvatarId={
                  currentEvent.targetId
                    ? players[currentEvent.targetId]?.avatarId
                    : result.reporterTargetId
                      ? players[result.reporterTargetId]?.avatarId
                      : null
                }
                onClose={closePopup}
                onNext={nextOrClose}
                hasNext={!lastEvent}
              />
            )}
            {currentType === 'MAFIA_KILL' && (
              <MafiaKillPanel
                result={result}
                players={players}
                revealRoles={revealRoles}
                event={currentEvent}
                onClose={closePopup}
                onNext={nextOrClose}
                hasNext={!lastEvent}
              />
            )}
            {currentType === 'DOCTOR_DEFEND' &&
              (currentEvent.success === true ? (
                <DoctorDefendPanel
                  event={currentEvent}
                  players={players}
                  onClose={closePopup}
                  onNext={nextOrClose}
                  hasNext={!lastEvent}
                />
              ) : (
                <DoctorFailPanel
                  event={currentEvent}
                  players={players}
                  onClose={closePopup}
                  onNext={nextOrClose}
                  hasNext={!lastEvent}
                />
              ))}
          </motion.div>
          <button
            type="button"
            onClick={closePopup}
            className="fixed bottom-5 right-5 z-[95] rounded-full bg-black/75 px-4 py-2.5 text-xs font-black text-white ring-1 ring-white/25 transition hover:bg-black/90"
          >
            연출 건너뛰기
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 기존 호출부 호환용 이름 */
export const MorningResultPopup = MorningSequenceModal;

function PopupActions({
  onClose,
  onNext,
  hasNext,
  tone,
}: {
  onClose: () => void;
  onNext: () => void;
  hasNext: boolean;
  tone: 'news' | 'danger' | 'safe';
}) {
  const buttonClass = {
    news: 'bg-slate-900 text-amber-50 hover:bg-slate-800',
    danger: 'bg-red-100 text-red-950 hover:bg-white',
    safe: 'bg-white text-emerald-950 hover:bg-emerald-50',
  }[tone];

  return (
    <div className="flex gap-2 px-5 pb-5">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-black text-white transition hover:bg-white/20"
      >
        닫기
      </button>
      <button
        type="button"
        onClick={onNext}
        className={'flex-1 rounded-xl py-3 text-sm font-black transition ' + buttonClass}
      >
        {hasNext ? '다음 결과' : '확인'}
      </button>
    </div>
  );
}

function MafiaKillPanel({
  result,
  players,
  revealRoles,
  event,
  onClose,
  onNext,
  hasNext,
}: {
  result: NightResults;
  players: Record<string, Player>;
  revealRoles: boolean;
  event: ActiveMorningEvent;
  onClose: () => void;
  onNext: () => void;
  hasNext: boolean;
}) {
  const deadIds = deadIdsOf(result);
  const targetId = event.targetId ?? deadIds[0] ?? null;
  const firstDeadId = deadIds[0] ?? null;
  const target = targetId ? players[targetId] : undefined;
  const dead = firstDeadId ? players[firstDeadId] : target;
  const deadName = event.targetName ?? target?.name ?? dead?.name ?? '학생';
  const wasKilled = targetId ? deadIds.includes(targetId) : deadIds.length > 0;
  const deadRole = targetId
    ? result.deadRoles?.[targetId] ?? (revealRoles && wasKilled ? target?.role : null)
    : null;
  const displayAvatarId = target?.avatarId ?? dead?.avatarId;

  return (
    <motion.section
      className="morning-panel-shake relative overflow-hidden rounded-2xl border border-red-300/25 bg-[#0b0a19] text-white shadow-2xl shadow-red-950/60"
    >
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 via-violet-400 to-red-600 opacity-80" />
      <div className="relative overflow-hidden px-5 pb-6 pt-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(127,29,29,0.45),transparent_60%)]" />
        <div className="relative flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-red-200">
          <Radio className="h-4 w-4 animate-pulse" />
          Night Alert · Mafia Attack
          <Radio className="h-4 w-4 animate-pulse" />
        </div>
        <div className="relative mx-auto mt-4 w-full max-w-[360px] overflow-hidden rounded-2xl border border-red-300/30 bg-red-950/60 shadow-[0_0_36px_rgba(220,38,38,0.28)]">
          <div className="relative flex h-44 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(127,29,29,0.85),rgba(11,10,25,0.92)_70%)]">
            <CharacterAvatar
              avatarId={displayAvatarId}
              isAlive={!wasKilled}
              state={wasKilled ? 'dead' : null}
              size={108}
              className="relative z-10"
            />
            <div className="morning-crosshair-lock pointer-events-none absolute left-1/2 top-1/2 z-20 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-200/90 shadow-[0_0_18px_rgba(248,113,113,0.7)]">
              <span className="absolute left-1/2 top-0 h-5 w-px -translate-x-1/2 bg-red-100" />
              <span className="absolute bottom-0 left-1/2 h-5 w-px -translate-x-1/2 bg-red-100" />
              <span className="absolute left-0 top-1/2 h-px w-5 -translate-y-1/2 bg-red-100" />
              <span className="absolute right-0 top-1/2 h-px w-5 -translate-y-1/2 bg-red-100" />
              <Crosshair className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-red-100" />
            </div>
            {wasKilled && (
              <span className="morning-bullet-impact pointer-events-none absolute left-1/2 top-1/2 z-30 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#030308] ring-2 ring-red-200/90 shadow-[0_0_15px_5px_rgba(248,113,113,0.65)]" />
            )}
          </div>
          <div className="border-t border-red-300/20 bg-black/35 px-3 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-200/65">
              {wasKilled ? '피해 학생' : '공격 대상'}
            </p>
            <p className="mt-0.5 text-lg font-black text-white">{deadName}</p>
          </div>
        </div>
        <h2
          id="morning-result-title"
          className="relative mt-5 text-center text-2xl font-black leading-tight text-red-50"
        >
          {wasKilled ? (
            <>
              지난밤 {deadName} 님이
              <br />
              마피아의 습격을 받고 탈락했습니다...
            </>
          ) : (
            <>
              마피아의 공격이 감지되었습니다!
              <br />
              공격 대상은 {deadName} 님입니다.
            </>
          )}
        </h2>
        {deadIds.length > 1 && (
          <p className="relative mt-3 text-center text-xs font-bold text-red-200/80">
            추가 탈락자 {deadIds.length - 1}명
          </p>
        )}
        {deadRole && revealRoles && wasKilled && (
          <p className="relative mt-5 rounded-xl bg-red-950/80 px-4 py-3 text-center text-sm font-bold text-red-100 ring-1 ring-red-300/20">
            (탈락한 {deadName} 님의 직업은{' '}
            <span className="font-black text-amber-200">{ROLE_LABELS[deadRole]}</span>
            이었습니다.)
          </p>
        )}
        <p className="relative mt-5 text-center text-xs font-medium text-white/50">
          차가운 밤이 지나갔습니다. 생존자들은 서로를 믿어야 합니다.
        </p>
      </div>
      <PopupActions
        onClose={onClose}
        onNext={onNext}
        hasNext={hasNext}
        tone="danger"
      />
    </motion.section>
  );
}

function DoctorDefendPanel({
  event,
  players,
  onClose,
  onNext,
  hasNext,
}: {
  event: ActiveMorningEvent;
  players: Record<string, Player>;
  onClose: () => void;
  onNext: () => void;
  hasNext: boolean;
}) {
  const defended = event.success === true;
  const targetName = event.targetName ??
    (event.targetId ? players[event.targetId]?.name : null) ??
    '학생';
  const targetPlayer = event.targetId ? players[event.targetId] : null;
  const targetGender = resolvePlayerGender(targetPlayer, event.targetGender);
  const targetGenderLabel = targetGender === 'girl' ? '여학생' : '남학생';

  return (
    <motion.section className="overflow-hidden rounded-2xl border border-emerald-300/30 bg-emerald-950/95 text-white shadow-2xl shadow-emerald-950/60">
      <div className="relative flex h-56 flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_30%,rgba(16,185,129,0.35),rgba(6,78,59,0.95)_65%)]">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-emerald-950/90" />
        <div className="absolute inset-x-3 top-3 text-center">
          <p
            id="morning-result-title"
            className="text-balance text-lg font-black leading-tight text-white drop-shadow-[0_2px_8px_rgba(2,44,34,0.9)]"
          >
            {defended
              ? '의사가 시민을 무사히 살려냈습니다!'
              : '의사가 학생의 상태를 확인했습니다.'}
          </p>
        </div>
        <CharacterAvatar
          avatarId={targetPlayer?.avatarId}
          isAlive
          size={96}
          className="relative z-10 mt-6 ring-4 ring-emerald-300/50 shadow-[0_0_24px_rgba(52,211,153,0.45)]"
        />
        <div className="relative z-10 mt-3 rounded-full border border-emerald-100/50 bg-emerald-950/60 p-2 text-emerald-100">
          <HeartPulse className="h-7 w-7 drop-shadow-[0_0_12px_rgba(167,243,208,0.85)]" strokeWidth={1.8} />
        </div>
      </div>
      <div className="px-5 py-4 text-center">
        <p className="flex items-center justify-center gap-1.5 text-sm font-black text-emerald-100">
          <Sunrise className="h-4 w-4 text-amber-300" />
          {defended
            ? '(지난 밤 사망자는 없습니다.)'
            : `치료 대상: ${targetName}`}
        </p>
        <p className="mt-2 text-xs text-cyan-100/75">
          {defended
            ? `의사가 ${targetGenderLabel} 시민의 상태를 확인하고 응급 처치를 마쳤습니다.`
            : '의사가 치료 대상의 상태를 확인했습니다.'}
        </p>
        <p className="mt-2 text-[11px] font-bold text-emerald-200/75">
          구조 대상: {targetGenderLabel} · {targetName}
        </p>
        <div className="mt-3 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/70">
          <HeartPulse className="h-3 w-3" />
          Medical Rescue Complete
          <HeartPulse className="h-3 w-3" />
        </div>
      </div>
      <PopupActions
        onClose={onClose}
        onNext={onNext}
        hasNext={hasNext}
        tone="safe"
      />
    </motion.section>
  );
}

function DoctorFailPanel({
  event,
  players,
  onClose,
  onNext,
  hasNext,
}: {
  event: ActiveMorningEvent;
  players: Record<string, Player>;
  onClose: () => void;
  onNext: () => void;
  hasNext: boolean;
}) {
  const targetPlayer = event.targetId ? players[event.targetId] : null;
  const doctorPlayer = event.actorId ? players[event.actorId] : null;
  const displayPlayer = doctorPlayer ?? targetPlayer;
  const targetName = event.targetName ?? targetPlayer?.name ?? '학생';
  const doctorName = doctorPlayer?.name ?? '의사';

  return (
    <motion.section
      className="overflow-hidden rounded-2xl border border-amber-200/30 bg-slate-950/95 text-white shadow-2xl shadow-violet-950/70"
      initial={{ opacity: 0, rotate: -1.5, scale: 0.96 }}
      animate={{ opacity: 1, rotate: 0, scale: 1 }}
    >
      <div className="relative flex h-64 flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgba(124,58,237,0.42),rgba(15,23,42,0.98)_68%)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_20%,rgba(251,191,36,0.12)_48%,transparent_72%)]" />
        <div className="absolute inset-x-3 top-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-amber-200 sm:text-sm">
          <HeartPulse className="h-4 w-4" />
          Doctor Mission Failed
          <HeartPulse className="h-4 w-4" />
        </div>
        <CharacterAvatar
          avatarId={displayPlayer?.avatarId}
          isAlive
          state="doctor_fail"
          size={126}
          className="relative z-10 mt-6 ring-4 ring-amber-200/40 shadow-[0_0_28px_rgba(251,191,36,0.35)]"
        />
        <div className="relative z-10 mt-3 rounded-full border border-amber-100/45 bg-slate-950/70 px-4 py-1.5 text-sm font-black text-amber-100">
          {doctorName}의 치료 작전
        </div>
      </div>
      <div className="px-5 py-5 text-center">
        <h2 id="morning-result-title" className="text-2xl font-black text-amber-100">
          의사의 허탕!
        </h2>
        <p className="mt-3 text-sm font-bold leading-relaxed text-violet-100/85">
          의사가 밤새 분주히 움직였지만, 아무도 구하지 못했습니다...
        </p>
        <p className="mt-3 rounded-xl bg-white/5 px-4 py-3 text-xs font-black text-amber-100/80 ring-1 ring-amber-200/15">
          치료 대상: {targetName}
        </p>
      </div>
      <PopupActions
        onClose={onClose}
        onNext={onNext}
        hasNext={hasNext}
        tone="safe"
      />
    </motion.section>
  );
}
