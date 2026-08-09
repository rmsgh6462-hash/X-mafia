'use client';

import {
  getAvatarDef,
  type AccessoryStyle,
  type AvatarDef,
  type AvatarId,
  type FaceStyle,
  type HairStyle,
  type OutfitStyle,
} from '@/lib/game/avatars';

/** 초등학교 고학년 학생을 위한 32종의 밝은 치비 캐릭터 렌더러. */
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
  const uid = `avatar_${def.id}`;

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        className="overflow-visible drop-shadow-md"
        role={showLabel ? 'img' : undefined}
        aria-label={showLabel ? def.label : undefined}
      >
        <defs>
          <radialGradient id={`${uid}_skin`} cx="35%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.38" />
            <stop offset="45%" stopColor={def.skin} />
            <stop offset="100%" stopColor={shade(def.skin, -28)} />
          </radialGradient>
          <linearGradient id={`${uid}_cloth`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={shade(def.clothes, 24)} />
            <stop offset="52%" stopColor={def.clothes} />
            <stop offset="100%" stopColor={shade(def.clothes, -30)} />
          </linearGradient>
          <linearGradient id={`${uid}_hair`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={shade(def.hair, 22)} />
            <stop offset="100%" stopColor={shade(def.hair, -18)} />
          </linearGradient>
          <filter id={`${uid}_soft`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodOpacity="0.35" />
          </filter>
        </defs>

        {isAlive ? (
          <g filter={`url(#${uid}_soft)`}>
            <ellipse cx="40" cy="75" rx="17" ry="3.5" fill="#000" opacity="0.23" />
            <AliveBody def={def} uid={uid} />
          </g>
        ) : (
          <g filter={`url(#${uid}_soft)`}>
            <ellipse cx="40" cy="70" rx="22" ry="4" fill="#000" opacity="0.28" />
            <DeadBody def={def} uid={uid} />
          </g>
        )}
      </svg>
      {showLabel && (
        <span className="mt-0.5 text-[10px] font-semibold text-white/60">
          {def.label}
        </span>
      )}
    </div>
  );
}

function AliveBody({ def, uid }: { def: AvatarDef; uid: string }) {
  return (
    <g>
      {/* 다리와 운동화 */}
      <path d="M30 58c0 5 1 10 2 14h7c0-5-1-10-1-14z" fill="#25324A" />
      <path d="M42 58c0 5 1 10 2 14h7c0-5-1-10-1-14z" fill="#25324A" />
      <path d="M28 72h13c0 3-2.5 4-7 4-4 0-6-1-6-4z" fill="#111827" />
      <path d="M40 72h13c0 3-2.5 4-7 4-4 0-6-1-6-4z" fill="#111827" />
      <path d="M30 73h9" stroke="#E2E8F0" strokeWidth="1.2" strokeLinecap="round" opacity="0.75" />
      <path d="M42 73h9" stroke="#E2E8F0" strokeWidth="1.2" strokeLinecap="round" opacity="0.75" />

      {/* 팔은 몸통 뒤에 두어 옷 실루엣을 살린다 */}
      <path
        d="M27 41c-5 2-8 8-7 14 .4 2.2 3.3 2.6 4.6.5.7-4.1 2.2-7.9 5.3-10.7z"
        fill={`url(#${uid}_skin)`}
      />
      <path
        d="M53 41c5 2 8 8 7 14-.4 2.2-3.3 2.6-4.6.5-.7-4.1-2.2-7.9-5.3-10.7z"
        fill={`url(#${uid}_skin)`}
      />

      {/* 몸통 */}
      <path
        d="M27 39c3-3 8-4 13-4s10 1 13 4c2 5 2 16 1 23-2 3-7 4-14 4s-12-1-14-4c-1-7-1-18 1-23z"
        fill={`url(#${uid}_cloth)`}
      />
      <rect x="36" y="31" width="8" height="10" rx="3" fill={`url(#${uid}_skin)`} />
      <Outfit style={def.outfitStyle} uid={uid} accent={def.accent} />

      {/* 얼굴 */}
      <ellipse cx="40" cy="23" rx="14.5" ry="15.5" fill={`url(#${uid}_skin)`} />
      <Hair style={def.hairStyle} uid={uid} accent={def.accent} />
      <Face style={def.face} />
      <Accessory style={def.accessory} accent={def.accent} />
    </g>
  );
}

function Outfit({
  style,
  uid,
  accent,
}: {
  style: OutfitStyle;
  uid: string;
  accent: string;
}) {
  const cloth = `url(#${uid}_cloth)`;
  switch (style) {
    case 'varsity':
      return (
        <>
          <path d="M40 38v26" stroke="#fff" strokeOpacity="0.75" strokeWidth="2.4" />
          <path d="M28 46h24" stroke={accent} strokeWidth="3" strokeLinecap="round" />
          <path d="M33 40l7 5 7-5" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.4" />
          <circle cx="34" cy="54" r="1.3" fill={accent} />
          <circle cx="46" cy="54" r="1.3" fill={accent} />
        </>
      );
    case 'hoodie':
      return (
        <>
          <path d="M30 40c1-5 5-7 10-7s9 2 10 7" fill="none" stroke={accent} strokeWidth="2.8" />
          <path d="M33 58h14v6H33z" fill={accent} opacity="0.4" />
          <path d="M36 43v7M44 43v7" stroke={accent} strokeWidth="1.2" strokeLinecap="round" />
        </>
      );
    case 'tee':
      return (
        <>
          <path d="M34 45h12l-3 8h-6z" fill={accent} opacity="0.9" />
          <path d="M40 46v6M37 49h6" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.3" strokeLinecap="round" />
        </>
      );
    case 'sweater':
      return (
        <>
          <path d="M28 48h24M29 52h22" stroke={accent} strokeOpacity="0.75" strokeWidth="1.7" />
          <path d="M36 40h8" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case 'overalls':
      return (
        <>
          <path d="M32 39v25h16V39" fill={accent} opacity="0.8" />
          <path d="M33 40l7 6 7-6" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.8" />
          <rect x="37" y="52" width="6" height="5" rx="1" fill={cloth} opacity="0.9" />
          <circle cx="35" cy="46" r="1" fill="#fff" />
          <circle cx="45" cy="46" r="1" fill="#fff" />
        </>
      );
    case 'dress':
      return (
        <>
          <path d="M31 42h18l5 22H26z" fill={cloth} opacity="0.95" />
          <path d="M32 43c3 4 13 4 16 0" fill="none" stroke={accent} strokeWidth="2" />
          <path d="M29 58h22" stroke={accent} strokeOpacity="0.75" strokeWidth="2" />
        </>
      );
    case 'striped':
      return (
        <>
          <path d="M27 46h26v4H27zM27 55h26v4H27z" fill={accent} opacity="0.86" />
          <path d="M36 39h8" stroke="#fff" strokeOpacity="0.65" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'jacket':
      return (
        <>
          <path d="M28 40l7 5v19h-8zM52 40l-7 5v19h8z" fill={accent} opacity="0.72" />
          <path d="M40 44v20" stroke="#fff" strokeOpacity="0.78" strokeWidth="1.8" />
          <path d="M31 54h5M44 54h5" stroke={accent} strokeWidth="2" strokeLinecap="round" />
        </>
      );
  }
}

function Hair({
  style,
  uid,
  accent,
}: {
  style: HairStyle;
  uid: string;
  accent: string;
}) {
  const fill = `url(#${uid}_hair)`;
  switch (style) {
    case 'crop':
      return <path d="M25 21c1-12 29-14 30 0-6-6-24-7-30 0z" fill={fill} />;
    case 'spiky':
      return <path d="M25 21l2-11 5 4 5-8 4 8 7-6 1 10 6 3c-8-4-22-4-30 0z" fill={fill} />;
    case 'curly':
      return (
        <>
          <path d="M25 23c-1-12 29-15 30 0-8-7-22-7-30 0z" fill={fill} />
          {[27, 33, 40, 47, 53].map((x, i) => (
            <circle key={x} cx={x} cy={14 + (i % 2) * 2} r="5.4" fill={fill} />
          ))}
        </>
      );
    case 'side':
      return (
        <>
          <path d="M24 22c2-13 30-15 32-1-8-7-18-7-29-1z" fill={fill} />
          <path d="M25 17c6-6 17-8 26-3-5 5-13 7-25 7z" fill={fill} />
        </>
      );
    case 'buzz':
      return <path d="M27 20c1-9 25-10 26 0-7-4-19-4-26 0z" fill={fill} />;
    case 'wave':
      return (
        <>
          <path d="M24 22c2-12 29-15 32 0-6-6-10-3-15-5-6-3-11 1-17 5z" fill={fill} />
          <path d="M28 14c4-4 10-6 15-4" fill="none" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
    case 'mop':
      return (
        <>
          <path d="M24 23c0-14 31-17 32 0-9-5-21-6-32 0z" fill={fill} />
          <path d="M27 18c0 7-2 12-1 16M35 13c-1 7-1 12-1 16M45 13c2 6 1 11 0 16M53 18c-1 5-2 8-2 12" fill="none" stroke={fill} strokeWidth="3.2" strokeLinecap="round" />
        </>
      );
    case 'textured':
      return (
        <>
          <path d="M25 22c1-12 28-14 30 0-7-6-21-6-30 0z" fill={fill} />
          <path d="M29 15l3-4M36 13l2-5M44 13l2-5M51 16l3-4" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
    case 'bob':
      return (
        <>
          <path d="M23 23c2-14 32-15 34 0-7-7-25-8-34 0z" fill={fill} />
          <path d="M23 22c-1 10 1 18 4 24h6c-2-8-2-16-1-24zM57 22c1 10-1 18-4 24h-6c2-8 2-16 1-24z" fill={fill} />
        </>
      );
    case 'long':
      return (
        <>
          <path d="M23 23c2-14 32-15 34 0-7-7-25-8-34 0z" fill={fill} />
          <path d="M23 22c-1 14 1 27 5 34h6c-2-12-2-23-1-34zM57 22c1 14-1 27-5 34h-6c2-12 2-23 1-34z" fill={fill} />
        </>
      );
    case 'twin':
      return (
        <>
          <path d="M24 22c2-14 30-15 32 0-8-7-24-8-32 0z" fill={fill} />
          <circle cx="23" cy="32" r="8" fill={fill} />
          <circle cx="57" cy="32" r="8" fill={fill} />
          <circle cx="24" cy="26" r="2" fill={accent} />
          <circle cx="56" cy="26" r="2" fill={accent} />
        </>
      );
    case 'ponytail':
      return (
        <>
          <path d="M24 23c2-14 31-15 33 0-8-7-24-8-33 0z" fill={fill} />
          <path d="M53 14c11 1 12 13 5 19-4-3-5-8-5-19z" fill={fill} />
          <path d="M53 17c3 1 6 2 8 4" stroke={accent} strokeWidth="2" fill="none" />
        </>
      );
    case 'curly-long':
      return (
        <>
          <path d="M23 22c2-14 31-15 34 0-8-7-26-8-34 0z" fill={fill} />
          {[25, 31, 50, 56].map((x, i) => (
            <circle key={x} cx={x} cy={31 + (i % 2) * 8} r="5" fill={fill} />
          ))}
          <path d="M27 42c0 8 1 12 3 16M53 42c0 8-1 12-3 16" stroke={fill} strokeWidth="5" strokeLinecap="round" />
        </>
      );
    case 'braids':
      return (
        <>
          <path d="M24 23c2-14 31-15 33 0-8-7-25-8-33 0z" fill={fill} />
          <path d="M25 25c-7 3-6 16 0 22M55 25c7 3 6 16 0 22" stroke={fill} strokeWidth="5" strokeLinecap="round" />
          <path d="M22 31l6 3M22 37l6 3M58 31l-6 3M58 37l-6 3" stroke={accent} strokeWidth="1.3" />
        </>
      );
    case 'short':
      return (
        <>
          <path d="M24 22c2-14 31-15 33 0-8-7-25-8-33 0z" fill={fill} />
          <path d="M24 21c-1 8 0 14 3 19h5c-1-7-1-13 0-19z" fill={fill} />
          <path d="M56 21c1 8 0 14-3 19h-5c1-7 1-13 0-19z" fill={fill} />
        </>
      );
    case 'side-long':
      return (
        <>
          <path d="M24 22c2-14 31-15 33 0-8-7-25-8-33 0z" fill={fill} />
          <path d="M25 22c-1 15 1 28 5 36h6c-3-14-3-25-1-36z" fill={fill} />
          <path d="M51 19c3 5 5 10 5 17" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" />
        </>
      );
  }
}

function Face({ style }: { style: FaceStyle }) {
  const eyeY = 24;
  return (
    <g>
      {style === 'surprised' ? (
        <>
          <ellipse cx="33.5" cy={eyeY} rx="3.2" ry="4" fill="#fff" />
          <ellipse cx="46.5" cy={eyeY} rx="3.2" ry="4" fill="#fff" />
          <circle cx="34" cy={eyeY + 0.8} r="1.7" fill="#1e293b" />
          <circle cx="47" cy={eyeY + 0.8} r="1.7" fill="#1e293b" />
        </>
      ) : style === 'wink' ? (
        <>
          <path d="M30 24c2 2 5 2 7 0" fill="none" stroke="#1e293b" strokeWidth="1.6" strokeLinecap="round" />
          <ellipse cx="46.5" cy={eyeY} rx="3.2" ry="3.6" fill="#fff" />
          <circle cx="47" cy={eyeY + 0.4} r="1.8" fill="#1e293b" />
          <circle cx="46.3" cy={eyeY - 0.5} r="0.65" fill="#fff" />
        </>
      ) : style === 'calm' ? (
        <>
          <path d="M30 24c2-1.8 5-1.8 7 0M43 24c2-1.8 5-1.8 7 0" fill="none" stroke="#1e293b" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="34" cy={eyeY + 0.5} r="1.2" fill="#1e293b" />
          <circle cx="47" cy={eyeY + 0.5} r="1.2" fill="#1e293b" />
        </>
      ) : (
        <>
          <ellipse cx="33.5" cy={eyeY} rx="3.2" ry="3.6" fill="#fff" />
          <ellipse cx="46.5" cy={eyeY} rx="3.2" ry="3.6" fill="#fff" />
          <circle cx="34" cy={eyeY + 0.4} r="1.8" fill="#1e293b" />
          <circle cx="47" cy={eyeY + 0.4} r="1.8" fill="#1e293b" />
          <circle cx="33.4" cy={eyeY - 0.5} r="0.7" fill="#fff" />
          <circle cx="46.4" cy={eyeY - 0.5} r="0.7" fill="#fff" />
        </>
      )}

      <path d="M30 18.5c2-1.4 5-1.4 7 0M43 18.5c2-1.4 5-1.4 7 0" fill="none" stroke="#3F2A1E" strokeWidth="1.1" strokeLinecap="round" opacity="0.5" />
      <ellipse cx="29" cy="29" rx="3" ry="1.8" fill="#F87171" opacity="0.27" />
      <ellipse cx="51" cy="29" rx="3" ry="1.8" fill="#F87171" opacity="0.27" />
      <path d="M40 25v3" stroke="#C4785A" strokeWidth="1.1" strokeLinecap="round" opacity="0.55" />

      {style === 'surprised' ? (
        <ellipse cx="40" cy="33" rx="3" ry="2.5" fill="none" stroke="#B4534A" strokeWidth="1.4" />
      ) : style === 'grin' ? (
        <path d="M34 31c3 5 9 5 12 0-3 1.8-9 1.8-12 0z" fill="#fff" stroke="#B4534A" strokeWidth="1.2" />
      ) : style === 'curious' ? (
        <path d="M36 32c2 1 5 1 8 0" fill="none" stroke="#B4534A" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        <path d="M35 31c2.5 2.8 7.5 2.8 10 0" fill="none" stroke="#B4534A" strokeWidth="1.6" strokeLinecap="round" />
      )}
      {style === 'blush' && (
        <>
          <path d="M27 30l4 1M28 32l4 1M49 31l4-1M49 33l4-1" stroke="#FB7185" strokeWidth="1.1" strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

function Accessory({
  style,
  accent,
}: {
  style: AccessoryStyle;
  accent: string;
}) {
  switch (style) {
    case 'glasses':
      return (
        <g fill="none" stroke="#334155" strokeWidth="1.5">
          <rect x="29" y="21" width="9" height="7" rx="2" />
          <rect x="42" y="21" width="9" height="7" rx="2" />
          <path d="M38 23.5h4M29 23l-3-1M51 23l3-1" />
        </g>
      );
    case 'headphones':
      return (
        <g fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round">
          <path d="M27 24c0-14 26-14 26 0" />
          <path d="M26 24v7M54 24v7" />
          <rect x="23.5" y="27" width="5" height="8" rx="2" fill={accent} stroke="none" />
          <rect x="51.5" y="27" width="5" height="8" rx="2" fill={accent} stroke="none" />
        </g>
      );
    case 'cap':
      return (
        <g>
          <path d="M25 19c3-9 27-10 30 0-8-4-21-4-30 0z" fill={accent} />
          <path d="M24 19c7-2 16-2 25 0 4 1 6 2 7 3-10 2-22 1-32-2z" fill={shade(accent, -18)} />
        </g>
      );
    case 'bow':
      return (
        <g fill={accent} stroke="#fff" strokeOpacity="0.35" strokeWidth="0.8">
          <path d="M28 17c-6-4-9 1-7 5 2 3 6 1 11-2z" />
          <path d="M30 20c6-4 9 1 7 5-2 3-6 1-10-2z" />
          <circle cx="29" cy="20" r="2.2" />
        </g>
      );
    case 'hairclip':
      return (
        <g>
          <path d="M49 13l7 4-7 4z" fill={accent} />
          <path d="M50 14l5 3-5 3" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="0.9" />
        </g>
      );
    case 'necklace':
      return (
        <g fill="none" stroke={accent} strokeWidth="1.5">
          <path d="M33 36c2 7 12 7 14 0" />
          <path d="M40 41l-2 3 2 2 2-2z" fill={accent} />
        </g>
      );
    case 'freckles':
      return (
        <g fill={accent} opacity="0.9">
          <circle cx="29" cy="28" r="0.8" /><circle cx="32" cy="30" r="0.7" /><circle cx="27" cy="30" r="0.6" />
          <circle cx="51" cy="28" r="0.8" /><circle cx="48" cy="30" r="0.7" /><circle cx="53" cy="30" r="0.6" />
        </g>
      );
    case 'scarf':
      return (
        <g>
          <path d="M29 35c4 4 18 4 22 0l1 5c-5 4-19 4-24 0z" fill={accent} />
          <path d="M46 39l6 11-5 2-5-10z" fill={accent} opacity="0.9" />
          <path d="M31 38h18" stroke="#fff" strokeOpacity="0.65" strokeWidth="1" />
        </g>
      );
    case 'badge':
      return (
        <g>
          <circle cx="48" cy="48" r="3.1" fill={accent} stroke="#fff" strokeOpacity="0.7" strokeWidth="1" />
          <path d="M47 48h2M48 47v2" stroke="#fff" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      );
    case 'earrings':
      return (
        <g fill={accent} stroke="#fff" strokeOpacity="0.7" strokeWidth="0.7">
          <circle cx="26" cy="33" r="1.7" /><circle cx="54" cy="33" r="1.7" />
        </g>
      );
    case 'bandana':
      return (
        <g>
          <path d="M25 18c8-3 22-3 30 0v4c-9-2-21-2-30 0z" fill={accent} />
          <path d="M51 20l7 4-6 3z" fill={accent} />
        </g>
      );
    case 'none':
      return null;
  }
}

function DeadBody({ def, uid }: { def: AvatarDef; uid: string }) {
  return (
    <g transform="translate(8 28) rotate(-78 40 40)">
      <AliveBody def={def} uid={uid} />
      <ellipse cx="40" cy="24" rx="15" ry="16" fill="#94A3B8" opacity="0.3" />
      <g stroke="#7F1D1D" strokeWidth="2" strokeLinecap="round">
        <path d="M31 21l5 5M36 21l-5 5M44 21l5 5M49 21l-5 5" />
      </g>
      <path d="M35 33h10" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  );
}

function shade(hex: string, amount: number): string {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const num = parseInt(expanded, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export type { AvatarId };
