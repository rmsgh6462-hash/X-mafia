/** 학생 캐릭터 카탈로그. 기존 ID는 유지하고 외형 정의만 새 세트로 교체한다. */
export type AvatarGender = 'M' | 'F';
export type AvatarId = `${AvatarGender}${number}`;

export type HairStyle =
  | 'crop'
  | 'spiky'
  | 'curly'
  | 'side'
  | 'buzz'
  | 'wave'
  | 'mop'
  | 'textured'
  | 'bob'
  | 'long'
  | 'twin'
  | 'ponytail'
  | 'curly-long'
  | 'braids'
  | 'short'
  | 'side-long';

export type OutfitStyle =
  | 'varsity'
  | 'hoodie'
  | 'tee'
  | 'sweater'
  | 'overalls'
  | 'dress'
  | 'striped'
  | 'jacket';

export type AccessoryStyle =
  | 'none'
  | 'glasses'
  | 'headphones'
  | 'cap'
  | 'bow'
  | 'hairclip'
  | 'necklace'
  | 'freckles'
  | 'scarf'
  | 'badge'
  | 'earrings'
  | 'bandana';

export type FaceStyle =
  | 'smile'
  | 'grin'
  | 'bright'
  | 'calm'
  | 'wink'
  | 'surprised'
  | 'blush'
  | 'curious';

export interface AvatarDef {
  id: AvatarId;
  gender: AvatarGender;
  label: string;
  skin: string;
  hair: string;
  clothes: string;
  accent: string;
  hairStyle: HairStyle;
  outfitStyle: OutfitStyle;
  accessory: AccessoryStyle;
  face: FaceStyle;
}

type AvatarSeed = Omit<AvatarDef, 'id' | 'gender'>;

const MALE_SEEDS: AvatarSeed[] = [
  {
    label: '민준',
    skin: '#F2C5A5', hair: '#2F261F', clothes: '#3B82F6', accent: '#FDE68A',
    hairStyle: 'crop', outfitStyle: 'varsity', accessory: 'badge', face: 'bright',
  },
  {
    label: '도윤',
    skin: '#D9A17B', hair: '#18181B', clothes: '#22C55E', accent: '#BBF7D0',
    hairStyle: 'spiky', outfitStyle: 'hoodie', accessory: 'headphones', face: 'grin',
  },
  {
    label: '시우',
    skin: '#C68B64', hair: '#5B3824', clothes: '#F97316', accent: '#FFEDD5',
    hairStyle: 'curly', outfitStyle: 'tee', accessory: 'glasses', face: 'smile',
  },
  {
    label: '준호',
    skin: '#F5D0B5', hair: '#713F12', clothes: '#8B5CF6', accent: '#FEF08A',
    hairStyle: 'side', outfitStyle: 'jacket', accessory: 'cap', face: 'calm',
  },
  {
    label: '현우',
    skin: '#E5B287', hair: '#0F172A', clothes: '#EF4444', accent: '#FECACA',
    hairStyle: 'buzz', outfitStyle: 'sweater', accessory: 'freckles', face: 'bright',
  },
  {
    label: '건우',
    skin: '#A85E3D', hair: '#171717', clothes: '#06B6D4', accent: '#CFFAFE',
    hairStyle: 'wave', outfitStyle: 'overalls', accessory: 'scarf', face: 'grin',
  },
  {
    label: '태오',
    skin: '#F0C7A4', hair: '#92400E', clothes: '#EAB308', accent: '#FEF3C7',
    hairStyle: 'mop', outfitStyle: 'striped', accessory: 'glasses', face: 'curious',
  },
  {
    label: '유찬',
    skin: '#8F5139', hair: '#27272A', clothes: '#64748B', accent: '#E2E8F0',
    hairStyle: 'textured', outfitStyle: 'hoodie', accessory: 'bandana', face: 'calm',
  },
  {
    label: '재민',
    skin: '#F0D0B3', hair: '#7C2D12', clothes: '#EC4899', accent: '#FCE7F3',
    hairStyle: 'curly', outfitStyle: 'jacket', accessory: 'necklace', face: 'smile',
  },
  {
    label: '서준',
    skin: '#D19A73', hair: '#064E3B', clothes: '#14B8A6', accent: '#CCFBF1',
    hairStyle: 'crop', outfitStyle: 'varsity', accessory: 'headphones', face: 'bright',
  },
  {
    label: '은찬',
    skin: '#E8BB98', hair: '#78350F', clothes: '#84CC16', accent: '#ECFCCB',
    hairStyle: 'wave', outfitStyle: 'overalls', accessory: 'freckles', face: 'wink',
  },
  {
    label: '우진',
    skin: '#6F3F2C', hair: '#1C1917', clothes: '#F59E0B', accent: '#FFFBEB',
    hairStyle: 'spiky', outfitStyle: 'sweater', accessory: 'cap', face: 'grin',
  },
  {
    label: '민재',
    skin: '#F5D4B9', hair: '#A16207', clothes: '#0EA5E9', accent: '#DBEAFE',
    hairStyle: 'mop', outfitStyle: 'tee', accessory: 'glasses', face: 'curious',
  },
  {
    label: '지호',
    skin: '#C37E56', hair: '#111827', clothes: '#A855F7', accent: '#EDE9FE',
    hairStyle: 'side', outfitStyle: 'jacket', accessory: 'bandana', face: 'calm',
  },
  {
    label: '정우',
    skin: '#DDB18B', hair: '#365314', clothes: '#10B981', accent: '#D1FAE5',
    hairStyle: 'buzz', outfitStyle: 'hoodie', accessory: 'badge', face: 'bright',
  },
  {
    label: '하준',
    skin: '#A96540', hair: '#450A0A', clothes: '#E11D48', accent: '#FFE4E6',
    hairStyle: 'curly', outfitStyle: 'striped', accessory: 'scarf', face: 'smile',
  },
];

const FEMALE_SEEDS: AvatarSeed[] = [
  {
    label: '서아',
    skin: '#F5C7AA', hair: '#7C2D12', clothes: '#F472B6', accent: '#FCE7F3',
    hairStyle: 'bob', outfitStyle: 'dress', accessory: 'bow', face: 'bright',
  },
  {
    label: '지윤',
    skin: '#E1AA81', hair: '#1C1917', clothes: '#8B5CF6', accent: '#EDE9FE',
    hairStyle: 'long', outfitStyle: 'tee', accessory: 'glasses', face: 'calm',
  },
  {
    label: '하은',
    skin: '#C8906B', hair: '#B45309', clothes: '#34D399', accent: '#D1FAE5',
    hairStyle: 'twin', outfitStyle: 'varsity', accessory: 'hairclip', face: 'grin',
  },
  {
    label: '유나',
    skin: '#F0C4A3', hair: '#44403C', clothes: '#FB7185', accent: '#FFE4E6',
    hairStyle: 'ponytail', outfitStyle: 'jacket', accessory: 'earrings', face: 'smile',
  },
  {
    label: '채원',
    skin: '#DBA27C', hair: '#0F172A', clothes: '#38BDF8', accent: '#E0F2FE',
    hairStyle: 'curly-long', outfitStyle: 'sweater', accessory: 'freckles', face: 'bright',
  },
  {
    label: '수빈',
    skin: '#BB754D', hair: '#292524', clothes: '#FBBF24', accent: '#FEF3C7',
    hairStyle: 'braids', outfitStyle: 'overalls', accessory: 'bandana', face: 'grin',
  },
  {
    label: '나연',
    skin: '#F2CFB2', hair: '#831843', clothes: '#4ADE80', accent: '#DCFCE7',
    hairStyle: 'short', outfitStyle: 'hoodie', accessory: 'headphones', face: 'wink',
  },
  {
    label: '다은',
    skin: '#CE8D64', hair: '#3B0764', clothes: '#F9A8D4', accent: '#FCE7F3',
    hairStyle: 'long', outfitStyle: 'striped', accessory: 'bow', face: 'smile',
  },
  {
    label: '아린',
    skin: '#E9BEA0', hair: '#1E3A5F', clothes: '#67E8F9', accent: '#CFFAFE',
    hairStyle: 'bob', outfitStyle: 'varsity', accessory: 'glasses', face: 'curious',
  },
  {
    label: '예린',
    skin: '#A96E4C', hair: '#7F1D1D', clothes: '#C4B5FD', accent: '#EDE9FE',
    hairStyle: 'ponytail', outfitStyle: 'dress', accessory: 'necklace', face: 'calm',
  },
  {
    label: '소율',
    skin: '#F5D2B4', hair: '#365314', clothes: '#FDA4AF', accent: '#FFE4E6',
    hairStyle: 'curly-long', outfitStyle: 'jacket', accessory: 'hairclip', face: 'bright',
  },
  {
    label: '가은',
    skin: '#D39568', hair: '#0C4A6E', clothes: '#86EFAC', accent: '#DCFCE7',
    hairStyle: 'twin', outfitStyle: 'sweater', accessory: 'badge', face: 'grin',
  },
  {
    label: '시아',
    skin: '#E8BC95', hair: '#4C1D95', clothes: '#FCD34D', accent: '#FEF3C7',
    hairStyle: 'braids', outfitStyle: 'tee', accessory: 'earrings', face: 'smile',
  },
  {
    label: '예서',
    skin: '#C47D57', hair: '#134E4A', clothes: '#E879F9', accent: '#FAE8FF',
    hairStyle: 'short', outfitStyle: 'overalls', accessory: 'scarf', face: 'curious',
  },
  {
    label: '다인',
    skin: '#F0C8AA', hair: '#9A3412', clothes: '#7DD3FC', accent: '#E0F2FE',
    hairStyle: 'side-long', outfitStyle: 'hoodie', accessory: 'bow', face: 'bright',
  },
  {
    label: '혜원',
    skin: '#A86344', hair: '#18181B', clothes: '#FCA5A5', accent: '#FFE4E6',
    hairStyle: 'ponytail', outfitStyle: 'varsity', accessory: 'freckles', face: 'smile',
  },
];

function buildDefs(
  gender: AvatarGender,
  seeds: AvatarSeed[],
): AvatarDef[] {
  return seeds.map((seed, i) => ({
    id: `${gender}${i}` as AvatarId,
    gender,
    ...seed,
  }));
}

export const MALE_AVATARS = buildDefs('M', MALE_SEEDS);
export const FEMALE_AVATARS = buildDefs('F', FEMALE_SEEDS);
export const ALL_AVATARS: AvatarDef[] = [...MALE_AVATARS, ...FEMALE_AVATARS];

export function getAvatarDef(id: string | null | undefined): AvatarDef {
  const found = ALL_AVATARS.find((a) => a.id === id);
  return found ?? MALE_AVATARS[0];
}

export interface AvatarSprite {
  src: string;
  column: number;
  row: number;
  backgroundPosition: string;
}

/**
 * The roster art is stored as two 4x4 sprite sheets. Keeping the existing
 * M0–M15/F0–F15 IDs means saved rooms and realtime payloads stay compatible.
 */
export function getAvatarSprite(id: string | null | undefined): AvatarSprite {
  const avatar = getAvatarDef(id);
  const index = Number.parseInt(avatar.id.slice(1), 10);
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.min(15, index)) : 0;
  const column = safeIndex % 4;
  const row = Math.floor(safeIndex / 4);

  return {
    src: avatar.gender === 'M' ? '/avatar-assets/roster-boys.png' : '/avatar-assets/roster-girls.png',
    column,
    row,
    backgroundPosition: `${(column * 100) / 3}% ${(row * 100) / 3}%`,
  };
}

/** 플레이어 화면에서 사용할 성별로 아바타 성별을 변환한다. */
export function playerGenderFromAvatarId(id: string | null | undefined): 'boy' | 'girl' {
  return getAvatarDef(id).gender === 'F' ? 'girl' : 'boy';
}

export function isAvatarId(id: string): id is AvatarId {
  return ALL_AVATARS.some((a) => a.id === id);
}

/** 현재 사용 중인 캐릭터 ID 목록. */
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
