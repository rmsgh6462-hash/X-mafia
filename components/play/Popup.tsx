'use client';

import { AnimatePresence, motion } from 'framer-motion';

export function Popup({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel = '확인',
  cancelLabel = '취소',
  confirmDisabled = false,
  accent = 'amber',
  centered = false,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  accent?: 'amber' | 'red' | 'blue' | 'violet' | 'emerald';
  /** 모바일에서도 화면 중앙에 배치할지 여부 */
  centered?: boolean;
}) {
  const accents = {
    amber: 'from-amber-500 to-orange-600',
    red: 'from-red-600 to-rose-800',
    blue: 'from-sky-600 to-blue-800',
    violet: 'from-violet-600 to-indigo-800',
    emerald: 'from-emerald-500 to-cyan-700',
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 z-50 flex justify-center bg-black/55 p-4 ${centered ? 'items-center' : 'items-end sm:items-center'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-stone-900 text-white shadow-2xl"
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`bg-gradient-to-r ${accents[accent]} px-5 py-3`}>
              <h3 className="text-base font-black tracking-tight">{title}</h3>
            </div>
            <div className="px-5 py-4 text-sm leading-relaxed text-white/90">
              {children}
            </div>
            <div className="px-5 pb-5">
              {onConfirm ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={confirmDisabled}
                    className="flex-1 rounded-xl bg-white/12 py-3 text-sm font-bold text-white transition hover:bg-white/18 disabled:opacity-50"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={confirmDisabled}
                    className="flex-1 rounded-xl bg-white py-3 text-sm font-bold text-stone-900 disabled:opacity-50"
                  >
                    {confirmLabel}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl bg-white py-3 text-sm font-bold text-stone-900"
                >
                  {confirmLabel}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
