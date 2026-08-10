'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  validateNicknameChange,
} from '@/lib/game/room';
import type { GameRoom, NicknameChangeRequest } from '@/types/game';

/** 교사 요청에 따른 학생 닉네임 재설정 모달 */
export function NicknameChangeModal({
  open,
  room,
  playerId,
  request,
  busy,
  onSubmit,
}: {
  open: boolean;
  room: GameRoom;
  playerId: string;
  request: NicknameChangeRequest;
  busy?: boolean;
  onSubmit: (nextName: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft('');
    setSubmitError(null);
    setSubmitting(false);
  }, [open, request.requestedAt, request.previousName]);

  const liveError = useMemo(() => {
    const trimmed = draft.trim();
    if (!trimmed) return null;
    return validateNicknameChange(
      room,
      playerId,
      trimmed,
      request.previousName,
    );
  }, [draft, room, playerId, request.previousName]);

  const canSubmit =
    draft.trim().length >= 1 && !liveError && !busy && !submitting;

  const handleSubmit = async () => {
    const trimmed = draft.trim();
    const err = validateNicknameChange(
      room,
      playerId,
      trimmed,
      request.previousName,
    );
    if (err) {
      setSubmitError(err);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(trimmed);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : '닉네임 변경에 실패했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const message = liveError ?? submitError;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="nickname-change-title"
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-stone-900 text-white shadow-2xl"
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <div className="bg-gradient-to-r from-sky-600 to-blue-800 px-5 py-3">
              <h3
                id="nickname-change-title"
                className="text-base font-black tracking-tight"
              >
                닉네임 재설정
              </h3>
            </div>
            <div className="space-y-4 px-5 py-4">
              <p className="text-sm leading-relaxed text-white/90">
                교사님이 닉네임 재설정을 요청했습니다.
              </p>
              <p className="text-xs text-white/45">
                이전 닉네임{' '}
                <span className="font-bold text-white/70">
                  {request.previousName}
                </span>
                은 다시 사용할 수 없습니다.
              </p>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-white/50">
                  새 닉네임
                </span>
                <input
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setSubmitError(null);
                  }}
                  maxLength={12}
                  autoFocus
                  autoComplete="off"
                  placeholder="새 닉네임 입력"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmit) {
                      e.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base font-bold text-white outline-none transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
                />
              </label>
              {message && (
                <p className="rounded-xl bg-red-950/70 px-3 py-2 text-xs font-semibold text-red-100">
                  {message}
                </p>
              )}
            </div>
            <div className="px-5 pb-5">
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => void handleSubmit()}
                className="w-full rounded-xl bg-white py-3 text-sm font-bold text-stone-900 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {submitting ? '저장 중…' : '확인'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
