'use client';

export function ScreenFlashOverlay({
  active,
  variant = 'white',
}: {
  active: boolean;
  variant?: 'white' | 'red';
}) {
  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-[90] ${
        variant === 'white'
          ? 'morning-white-flash bg-white'
          : 'morning-red-flash bg-red-600'
      }`}
    />
  );
}
