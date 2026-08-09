'use client';

import { getAvatarDef, type AvatarId } from '@/lib/game/avatars';

/** 고품질 벡터 캐릭터 — 남/여 16종, 생존·사망 포즈 */
export function CharacterAvatar({
  avatarId,
  isAlive = true,
  size = 64,
  className = '',
  showLabel = false,
}: {
  avatarId: string | null | undefined;
  isAlive?: boolean;
  size?: number;
  className?: string;
  showLabel?: boolean;
}) {
  const def = getAvatarDef(avatarId);
  const idx = Number(def.id.slice(1)) || 0;
  const uid = `av_${def.id}`;

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        className="overflow-visible drop-shadow-md"
        aria-hidden
      >
        <defs>
          <radialGradient id={`${uid}_skin`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="45%" stopColor={def.skin} />
            <stop offset="100%" stopColor={shade(def.skin, -28)} />
          </radialGradient>
          <linearGradient id={`${uid}_cloth`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={shade(def.clothes, 22)} />
            <stop offset="55%" stopColor={def.clothes} />
            <stop offset="100%" stopColor={shade(def.clothes, -30)} />
          </linearGradient>
          <linearGradient id={`${uid}_hair`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={shade(def.hair, 18)} />
            <stop offset="100%" stopColor={shade(def.hair, -15)} />
          </linearGradient>
          <filter id={`${uid}_soft`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodOpacity="0.35" />
          </filter>
        </defs>

        {isAlive ? (
          <g filter={`url(#${uid}_soft)`}>
            {/* 바닥 그림자 */}
            <ellipse cx="40" cy="74" rx="16" ry="3.5" fill="#000" opacity="0.22" />
            <AliveBody def={def} uid={uid} idx={idx} />
          </g>
        ) : (
          <g filter={`url(#${uid}_soft)`}>
            <ellipse cx="40" cy="70" rx="22" ry="4" fill="#000" opacity="0.28" />
            <DeadBody def={def} uid={uid} idx={idx} />
          </g>
        )}
      </svg>
      {showLabel && (
        <span className="mt-0.5 text-[10px] font-semibold text-white/50">
          {def.label}
        </span>
      )}
    </div>
  );
}

function AliveBody({
  def,
  uid,
  idx,
}: {
  def: ReturnType<typeof getAvatarDef>;
  uid: string;
  idx: number;
}) {
  const female = def.gender === 'F';
  const hairStyle = idx % 8;
  const outfit = Math.floor(idx / 4) % 4;

  return (
    <g>
      {/* 다리 */}
      <path
        d="M30 58c0 0 1 10 2 14h6c0-4-1-10-1-14z"
        fill="#1e293b"
      />
      <path
        d="M42 58c0 0 1 10 2 14h6c0-4-1-10-1-14z"
        fill="#1e293b"
      />
      <ellipse cx="33" cy="72.5" rx="4.5" ry="2" fill="#0f172a" />
      <ellipse cx="47" cy="72.5" rx="4.5" ry="2" fill="#0f172a" />

      {/* 몸통 */}
      <path
        d="M26 38c2-2 8-3 14-3s12 1 14 3c1 2 2 16 1 22-1 3-6 5-15 5s-14-2-15-5c-1-6 0-20 1-22z"
        fill={`url(#${uid}_cloth)`}
      />
      {/* 옷 디테일 */}
      {outfit === 0 && (
        <path d="M39 36v28" stroke="#fff" strokeOpacity="0.35" strokeWidth="2.5" />
      )}
      {outfit === 1 && (
        <path
          d="M28 48h24"
          stroke={def.accent}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.9"
        />
      )}
      {outfit === 2 && (
        <>
          <circle cx="34" cy="46" r="1.6" fill={def.accent} />
          <circle cx="40" cy="48" r="1.6" fill={def.accent} />
          <circle cx="46" cy="46" r="1.6" fill={def.accent} />
        </>
      )}
      {outfit === 3 && (
        <path
          d="M32 40c4 6 12 6 16 0"
          fill="none"
          stroke="#fff"
          strokeOpacity="0.25"
          strokeWidth="2"
        />
      )}

      {/* 팔 */}
      <path
        d="M26 40c-5 2-8 8-7 14 1 2 4 2 5 0 0-4 2-8 5-11z"
        fill={`url(#${uid}_skin)`}
      />
      <path
        d="M54 40c5 2 8 8 7 14-1 2-4 2-5 0 0-4-2-8-5-11z"
        fill={`url(#${uid}_skin)`}
      />

      {/* 목 */}
      <rect x="36" y="30" width="8" height="8" rx="2" fill={`url(#${uid}_skin)`} />

      {/* 머리 */}
      <ellipse cx="40" cy="22" rx="14" ry="15" fill={`url(#${uid}_skin)`} />

      {/* 머리카락 */}
      <Hair female={female} style={hairStyle} uid={uid} accent={def.accent} />

      {/* 얼굴 */}
      <Face idx={idx} />

      {/* 악세서리 */}
      {idx % 5 === 0 && (
        <ellipse
          cx="40"
          cy="20"
          rx="15"
          ry="3"
          fill="none"
          stroke={def.accent}
          strokeWidth="1.5"
          opacity="0.7"
        />
      )}
      {female && idx % 4 === 1 && (
        <>
          <circle cx="26" cy="24" r="2.2" fill={def.accent} />
          <circle cx="54" cy="24" r="2.2" fill={def.accent} />
        </>
      )}
      {!female && idx % 6 === 2 && (
        <path
          d="M33 28c2 3 12 3 14 0"
          fill="none"
          stroke="#5b4636"
          strokeWidth="1.4"
          opacity="0.55"
        />
      )}
    </g>
  );
}

function Hair({
  female,
  style,
  uid,
  accent,
}: {
  female: boolean;
  style: number;
  uid: string;
  accent: string;
}) {
  const fill = `url(#${uid}_hair)`;
  if (!female) {
    // 남자 헤어 8종
    switch (style) {
      case 0:
        return <path d="M26 18c2-10 26-10 28 0-4-6-24-6-28 0z" fill={fill} />;
      case 1:
        return (
          <>
            <path d="M25 20c3-12 27-12 30 0-5-7-25-7-30 0z" fill={fill} />
            <path d="M24 18l4 6M56 18l-4 6" stroke={fill} strokeWidth="3" />
          </>
        );
      case 2:
        return <ellipse cx="40" cy="14" rx="15" ry="8" fill={fill} />;
      case 3:
        return (
          <>
            <path d="M26 16c4-8 24-8 28 0v4c-6-5-22-5-28 0z" fill={fill} />
            <rect x="28" y="8" width="24" height="5" rx="1" fill={accent} />
          </>
        );
      case 4:
        return <path d="M27 22c1-11 25-11 26 0-8-4-18-4-26 0z" fill={fill} />;
      case 5:
        return (
          <path
            d="M25 19c2-9 10-14 15-14s13 5 15 14c-3-5-27-5-30 0z"
            fill={fill}
          />
        );
      case 6:
        return (
          <>
            <path d="M26 18c3-9 25-9 28 0-4-5-24-5-28 0z" fill={fill} />
            <path d="M30 12c3-4 17-4 20 0" stroke={accent} strokeWidth="2" fill="none" />
          </>
        );
      default:
        return (
          <path d="M26 20c4-10 24-10 28 0-6-8-22-8-28 0z" fill={fill} />
        );
    }
  }

  // 여자 헤어 8종
  switch (style) {
    case 0:
      return (
        <>
          <path d="M24 20c3-12 29-12 32 0-4-8-28-8-32 0z" fill={fill} />
          <path d="M22 22c0 10 2 18 4 22h5c-1-8-2-16-1-22z" fill={fill} />
          <path d="M58 22c0 10-2 18-4 22h-5c1-8 2-16 1-22z" fill={fill} />
        </>
      );
    case 1:
      return (
        <>
          <ellipse cx="40" cy="16" rx="16" ry="10" fill={fill} />
          <path d="M24 20c-2 12 0 22 3 26h6c-2-8-3-16-2-26z" fill={fill} />
          <path d="M56 20c2 12 0 22-3 26h-6c2-8 3-16 2-26z" fill={fill} />
        </>
      );
    case 2:
      return (
        <>
          <path d="M25 18c4-11 26-11 30 0-5-7-25-7-30 0z" fill={fill} />
          <circle cx="28" cy="34" r="5" fill={fill} />
          <circle cx="52" cy="34" r="5" fill={fill} />
        </>
      );
    case 3:
      return (
        <>
          <path d="M26 16c3-9 25-9 28 0v6c-8-6-20-6-28 0z" fill={fill} />
          <path d="M30 8h20l2 4H28z" fill={accent} />
        </>
      );
    case 4:
      return (
        <path
          d="M24 22c2-14 30-14 32 0-2-2-4 8-4 14h-5c0-8 1-14 2-16-8-2-16-2-24 0 1 2 2 8 2 16h-5c0-6-2-16-4-14z"
          fill={fill}
        />
      );
    case 5:
      return (
        <>
          <path d="M25 19c3-11 27-11 30 0-6-7-24-7-30 0z" fill={fill} />
          <path d="M23 24c1 14 3 22 5 26h4c-1-10-2-18-1-26z" fill={fill} />
          <path d="M57 24c-1 14-3 22-5 26h-4c1-10 2-18 1-26z" fill={fill} />
          <circle cx="40" cy="12" r="3" fill={accent} />
        </>
      );
    case 6:
      return (
        <>
          <ellipse cx="40" cy="15" rx="15" ry="9" fill={fill} />
          <path d="M26 18c0 8-1 16 2 20h4c-1-6 0-14 0-20z" fill={fill} />
          <path d="M54 18c0 8 1 16-2 20h-4c1-6 0-14 0-20z" fill={fill} />
        </>
      );
    default:
      return (
        <>
          <path d="M24 20c4-12 28-12 32 0-6-8-26-8-32 0z" fill={fill} />
          <path d="M22 21c1 12 3 20 6 24h5c-2-8-3-16-2-24z" fill={fill} />
          <path d="M58 21c-1 12-3 20-6 24h-5c2-8 3-16 2-24z" fill={fill} />
        </>
      );
  }
}

function Face({ idx }: { idx: number }) {
  const eyeY = 22;
  const smile = idx % 3 !== 2;
  return (
    <g>
      {/* 눈흰자 */}
      <ellipse cx="33.5" cy={eyeY} rx="3.2" ry="3.6" fill="#fff" />
      <ellipse cx="46.5" cy={eyeY} rx="3.2" ry="3.6" fill="#fff" />
      {/* 홍채 */}
      <circle cx="34" cy={eyeY + 0.3} r="1.8" fill="#1e293b" />
      <circle cx="47" cy={eyeY + 0.3} r="1.8" fill="#1e293b" />
      {/* 하이라이트 */}
      <circle cx="33.3" cy={eyeY - 0.6} r="0.7" fill="#fff" />
      <circle cx="46.3" cy={eyeY - 0.6} r="0.7" fill="#fff" />
      {/* 눈썹 */}
      <path
        d="M30 17.5c2-1.5 5-1.5 7 0"
        fill="none"
        stroke="#3f2a1e"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M43 17.5c2-1.5 5-1.5 7 0"
        fill="none"
        stroke="#3f2a1e"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* 볼터치 */}
      <ellipse cx="29" cy="27" rx="3" ry="1.8" fill="#f87171" opacity="0.28" />
      <ellipse cx="51" cy="27" rx="3" ry="1.8" fill="#f87171" opacity="0.28" />
      {/* 코 */}
      <path
        d="M40 24v3"
        stroke="#c4785a"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* 입 */}
      {smile ? (
        <path
          d="M35 30c2.5 2.5 7.5 2.5 10 0"
          fill="none"
          stroke="#b4534a"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M36 31h8"
          stroke="#b4534a"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

function DeadBody({
  def,
  uid,
  idx,
}: {
  def: ReturnType<typeof getAvatarDef>;
  uid: string;
  idx: number;
}) {
  const female = def.gender === 'F';
  const hairStyle = idx % 8;

  return (
    <g transform="translate(8 28) rotate(-78 40 40)">
      {/* 다리 */}
      <path d="M30 58c0 0 1 10 2 14h6c0-4-1-10-1-14z" fill="#334155" />
      <path d="M42 58c0 0 1 10 2 14h6c0-4-1-10-1-14z" fill="#334155" />
      {/* 몸 */}
      <path
        d="M26 38c2-2 8-3 14-3s12 1 14 3c1 2 2 16 1 22-1 3-6 5-15 5s-14-2-15-5c-1-6 0-20 1-22z"
        fill={`url(#${uid}_cloth)`}
        opacity="0.85"
      />
      {/* 팔 늘어짐 */}
      <path
        d="M26 42c-6 6-8 14-4 16 2 1 4-1 4-3 0-4 1-8 3-10z"
        fill={`url(#${uid}_skin)`}
        opacity="0.9"
      />
      <path
        d="M54 40c4 8 2 16-2 16-2 0-3-2-2-4 1-4 2-8 1-12z"
        fill={`url(#${uid}_skin)`}
        opacity="0.9"
      />
      <rect x="36" y="30" width="8" height="8" rx="2" fill={`url(#${uid}_skin)`} />
      <ellipse cx="40" cy="22" rx="14" ry="15" fill={`url(#${uid}_skin)`} />
      <Hair female={female} style={hairStyle} uid={uid} accent={def.accent} />
      {/* X 눈 */}
      <g stroke="#7f1d1d" strokeWidth="1.8" strokeLinecap="round">
        <path d="M31 20l5 5M36 20l-5 5" />
        <path d="M44 20l5 5M49 20l-5 5" />
      </g>
      {/* 창백 */}
      <ellipse cx="40" cy="22" rx="14" ry="15" fill="#94a3b8" opacity="0.28" />
      <path
        d="M35 31h10"
        stroke="#64748b"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </g>
  );
}

function shade(hex: string, amount: number): string {
  const n = hex.replace('#', '');
  const num = parseInt(n.length === 3 ? n.split('').map((c) => c + c).join('') : n, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export type { AvatarId };
