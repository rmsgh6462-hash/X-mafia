/** 캐릭터 ID: 남자 M0–M15, 여자 F0–F15 */
export type AvatarGender = 'M' | 'F';
export type AvatarId = `${AvatarGender}${number}`;

export interface AvatarDef {
  id: AvatarId;
  gender: AvatarGender;
  label: string;
  /** 피부 */
  skin: string;
  /** 머리/모자 */
  hair: string;
  /** 옷 */
  clothes: string;
  /** 포인트 악세서리 */
  accent: string;
}

const MALE_PALETTES: Omit<AvatarDef, 'id' | 'gender' | 'label'>[] = [
  { skin: '#E8B898', hair: '#2C1810', clothes: '#3B82C4', accent: '#1E3A5F' },
  { skin: '#F5C6A0', hair: '#1A1A1A', clothes: '#22C55E', accent: '#14532D' },
  { skin: '#D4A574', hair: '#4A3728', clothes: '#EF4444', accent: '#7F1D1D' },
  { skin: '#C68642', hair: '#0F0F0F', clothes: '#8B5CF6', accent: '#4C1D95' },
  { skin: '#E0B090', hair: '#6B4423', clothes: '#F59E0B', accent: '#78350F' },
  { skin: '#F2C4A0', hair: '#3D2914', clothes: '#06B6D4', accent: '#164E63' },
  { skin: '#DBA67B', hair: '#111827', clothes: '#64748B', accent: '#1E293B' },
  { skin: '#E8C4A8', hair: '#92400E', clothes: '#EC4899', accent: '#831843' },
  { skin: '#C4A484', hair: '#1C1917', clothes: '#14B8A6', accent: '#134E4A' },
  { skin: '#F0D0B0', hair: '#44403C', clothes: '#6366F1', accent: '#312E81' },
  { skin: '#DDB892', hair: '#292524', clothes: '#84CC16', accent: '#365314' },
  { skin: '#E5B887', hair: '#57534E', clothes: '#F97316', accent: '#7C2D12' },
  { skin: '#C9956C', hair: '#0C0A09', clothes: '#0EA5E9', accent: '#0C4A6E' },
  { skin: '#F5D0B0', hair: '#78716C', clothes: '#A855F7', accent: '#581C87' },
  { skin: '#E8B88A', hair: '#451A03', clothes: '#10B981', accent: '#064E3B' },
  { skin: '#D2A679', hair: '#171717', clothes: '#E11D48', accent: '#881337' },
];

const FEMALE_PALETTES: Omit<AvatarDef, 'id' | 'gender' | 'label'>[] = [
  { skin: '#F5C6A0', hair: '#7C2D12', clothes: '#F472B6', accent: '#9D174D' },
  { skin: '#E8B898', hair: '#1C1917', clothes: '#A78BFA', accent: '#5B21B6' },
  { skin: '#F0D0B0', hair: '#B45309', clothes: '#34D399', accent: '#065F46' },
  { skin: '#D4A574', hair: '#44403C', clothes: '#FB7185', accent: '#9F1239' },
  { skin: '#E0B090', hair: '#0F172A', clothes: '#38BDF8', accent: '#075985' },
  { skin: '#C68642', hair: '#292524', clothes: '#FBBF24', accent: '#92400E' },
  { skin: '#F2C4A0', hair: '#831843', clothes: '#4ADE80', accent: '#166534' },
  { skin: '#DBA67B', hair: '#3B0764', clothes: '#F9A8D4', accent: '#9D174D' },
  { skin: '#E8C4A8', hair: '#1E3A5F', clothes: '#67E8F9', accent: '#155E75' },
  { skin: '#C4A484', hair: '#7F1D1D', clothes: '#C4B5FD', accent: '#5B21B6' },
  { skin: '#F5D0B0', hair: '#365314', clothes: '#FDA4AF', accent: '#BE123C' },
  { skin: '#DDB892', hair: '#0C4A6E', clothes: '#86EFAC', accent: '#14532D' },
  { skin: '#E5B887', hair: '#4C1D95', clothes: '#FCD34D', accent: '#B45309' },
  { skin: '#C9956C', hair: '#134E4A', clothes: '#E879F9', accent: '#86198F' },
  { skin: '#E8B88A', hair: '#9A3412', clothes: '#7DD3FC', accent: '#0369A1' },
  { skin: '#D2A679', hair: '#18181B', clothes: '#FCA5A5', accent: '#B91C1C' },
];

function buildDefs(
  gender: AvatarGender,
  palettes: Omit<AvatarDef, 'id' | 'gender' | 'label'>[],
  prefix: string,
): AvatarDef[] {
  return palettes.map((p, i) => ({
    id: `${gender}${i}` as AvatarId,
    gender,
    label: `${prefix}${i + 1}`,
    ...p,
  }));
}

export const MALE_AVATARS = buildDefs('M', MALE_PALETTES, '남');
export const FEMALE_AVATARS = buildDefs('F', FEMALE_PALETTES, '여');
export const ALL_AVATARS: AvatarDef[] = [...MALE_AVATARS, ...FEMALE_AVATARS];

export function getAvatarDef(id: string | null | undefined): AvatarDef {
  const found = ALL_AVATARS.find((a) => a.id === id);
  return found ?? MALE_AVATARS[0];
}

export function isAvatarId(id: string): id is AvatarId {
  return ALL_AVATARS.some((a) => a.id === id);
}

/** 이미 사용 중인 캐릭터 ID 목록 */
export function takenAvatarIds(
  players: Record<string, { avatarId?: string }> | undefined,
  exceptPlayerId?: string,
): Set<string> {
  const taken = new Set<string>();
  Object.entries(players ?? {}).forEach(([pid, p]) => {
    if (exceptPlayerId && pid === exceptPlayerId) return;
    if (p.avatarId && isAvatarId(p.avatarId)) taken.add(p.avatarId);
  });
  return taken;
}

export function firstFreeAvatarId(
  players: Record<string, { avatarId?: string }> | undefined,
): AvatarId {
  const taken = takenAvatarIds(players);
  const free = ALL_AVATARS.find((a) => !taken.has(a.id));
  return free?.id ?? 'M0';
}
