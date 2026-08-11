import { get, onValue, ref, set } from 'firebase/database';
import { getFirebaseDatabase, isFirebaseConfigured } from '@/lib/firebase';

export type HostAccessConfig = {
  /** 방 생성 시 비밀번호 입력 필요 여부 */
  passwordRequired: boolean;
  /** 방 생성용 비밀번호 (passwordRequired가 true일 때만 사용) */
  password: string;
  updatedAt: number;
};

const CONFIG_PATH = 'appConfig/hostAccess';

export function defaultHostAccessConfig(): HostAccessConfig {
  return {
    passwordRequired: false,
    password: '',
    updatedAt: 0,
  };
}

export function normalizeHostAccessConfig(
  raw: Partial<HostAccessConfig> | null | undefined,
): HostAccessConfig {
  const defaults = defaultHostAccessConfig();
  if (!raw || typeof raw !== 'object') return defaults;
  return {
    passwordRequired: raw.passwordRequired === true,
    password: typeof raw.password === 'string' ? raw.password : '',
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
  };
}

export async function loadHostAccessConfig(): Promise<HostAccessConfig> {
  if (!isFirebaseConfigured()) return defaultHostAccessConfig();
  const db = getFirebaseDatabase();
  const snap = await get(ref(db, CONFIG_PATH));
  if (!snap.exists()) return defaultHostAccessConfig();
  return normalizeHostAccessConfig(snap.val() as Partial<HostAccessConfig>);
}

export async function saveHostAccessConfig(
  config: Pick<HostAccessConfig, 'passwordRequired' | 'password'>,
): Promise<HostAccessConfig> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  const next: HostAccessConfig = {
    passwordRequired: config.passwordRequired === true,
    password: config.passwordRequired ? config.password.trim() : '',
    updatedAt: Date.now(),
  };
  if (next.passwordRequired && next.password.length < 4) {
    throw new Error('비밀번호는 4자 이상이어야 합니다.');
  }
  const db = getFirebaseDatabase();
  await set(ref(db, CONFIG_PATH), next);
  return next;
}

export function subscribeHostAccessConfig(
  callback: (config: HostAccessConfig) => void,
): () => void {
  if (!isFirebaseConfigured()) {
    callback(defaultHostAccessConfig());
    return () => undefined;
  }
  const db = getFirebaseDatabase();
  const configRef = ref(db, CONFIG_PATH);
  return onValue(configRef, (snap) => {
    callback(
      snap.exists()
        ? normalizeHostAccessConfig(snap.val() as Partial<HostAccessConfig>)
        : defaultHostAccessConfig(),
    );
  });
}

export function verifyHostCreatePassword(
  config: HostAccessConfig,
  input: string,
): boolean {
  if (!config.passwordRequired) return true;
  return input.trim() === config.password;
}
