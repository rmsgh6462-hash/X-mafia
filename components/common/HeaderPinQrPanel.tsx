'use client';

import QRCode from 'react-qr-code';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function HeaderPinQrPanel({
  pin,
  joinUrl,
  expanded,
  onToggle,
  variant = 'host',
}: {
  pin: string;
  joinUrl: string;
  expanded: boolean;
  onToggle: () => void;
  variant?: 'host' | 'display';
}) {
  const formattedPin = pin.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  const playUrl = `${joinUrl.replace(/\/$/, '')}/play?pin=${pin}`;
  const qrSize = variant === 'display' ? 240 : 80;

  const pinButtonClass =
    variant === 'display'
      ? 'inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-amber-400/95 px-3 py-1 font-mono text-sm font-black tracking-wider text-stone-950 transition hover:bg-amber-300 sm:text-base'
      : 'inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-amber-400/90 px-3 py-1.5 font-mono font-black tracking-wider text-stone-900 backdrop-blur-sm transition hover:bg-amber-300';

  return (
    <div className={variant === 'display' ? 'relative mt-2' : 'flex flex-col items-end'}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={expanded ? 'QR 코드 접기' : 'QR 코드 펼치기'}
        title={expanded ? 'QR 코드 접기' : 'QR 코드 펼치기'}
        className={pinButtonClass}
      >
        PIN {formattedPin}
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 opacity-80" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" />
        )}
      </button>

      {expanded && (
        <div
          className={`mt-2 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-white/25 ${
            variant === 'display'
              ? 'absolute left-1/2 top-full z-50 mt-1 w-[min(82vw,20rem)] -translate-x-1/2'
              : ''
          }`}
        >
          <div className="flex justify-center">
            <QRCode value={playUrl} size={qrSize} level="M" />
          </div>
          <p className="mt-2 truncate text-center text-[10px] font-mono text-stone-500">
            {playUrl}
          </p>
        </div>
      )}
    </div>
  );
}
