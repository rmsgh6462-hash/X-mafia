import {
  playDayBgm,
  playGunshot,
  playNightBgm,
  playReporterNewsSound,
  setSfxBlocked,
  stopSoundscape,
} from '@/lib/audioManager';
import type { GameState, MorningEvent, Role } from '@/types/game';

type BgmBed = 'day' | 'night';

const STATE_TO_BED: Partial<Record<GameState, BgmBed>> = {
  WAITING: 'day',
  DAY_TALK: 'day',
  DAY_MATCH: 'day',
  DAY_MISSION: 'day',
  DAY_VOTE: 'day',
  VOTE_RESULT: 'day',
  RESULT: 'day',
  NIGHT: 'night',
  ENDED: 'day',
};

const TTS_SCRIPTS: Partial<Record<GameState, string>> = {
  WAITING: '방에 입장해 주세요. 큐알 코드 또는 핀 번호로 참가할 수 있습니다.',
  DAY_TALK: '낮이 되었습니다. 자유롭게 토론해 주세요.',
  DAY_MATCH: '일대일 매칭이 시작되었습니다. 삼십 초 동안 휴대폰 채팅으로 파트너와 대화하세요.',
  DAY_MISSION: '미션은 밤 세션의 퀴즈로 진행됩니다.',
  DAY_VOTE: '투표를 시작합니다. 십오 초 안에 의심되는 사람에게 투표해 주세요.',
  VOTE_RESULT: '투표 결과를 발표합니다. 결과를 확인한 뒤 밤으로 이동합니다.',
  NIGHT: '밤이 되었습니다. 퀴즈를 풀고, 특수 직업은 능력도 사용해 주세요.',
  RESULT: '결과가 발표됩니다.',
  ENDED: '게임이 종료되었습니다.',
};

let audioCtx: AudioContext | null = null;
let currentState: GameState | null = null;
/** 교사 화면에서 명시적으로 켠 뒤에만 단계 BGM을 재생한다. */
let bgmEnabled = false;
/** 교사 화면에서 명시적으로 끈 경우에만 효과음까지 막는다. 학생 기기는 기본이라 연출음이 난다. */
let bgmForcedOff = false;
let narrationEnabled = false;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

async function resumeCtx(): Promise<AudioContext> {
  const ctx = getCtx();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx;
}

function bedForState(state: GameState): BgmBed {
  return STATE_TO_BED[state] ?? 'day';
}

export function isBgmEnabled(): boolean {
  return bgmEnabled && !bgmForcedOff;
}

export function isNarrationEnabled(): boolean {
  return narrationEnabled;
}

/** 배경음 켜기/끄기. 켜면 AudioContext를 깨우고 현재 단계 BGM을 재생한다. */
export async function setBgmEnabled(
  enabled: boolean,
  state?: GameState | null,
): Promise<void> {
  bgmEnabled = enabled;
  bgmForcedOff = !enabled;
  setSfxBlocked(!enabled);
  if (!enabled) {
    stopSoundscape();
    currentState = null;
    return;
  }
  await resumeCtx();
  if (state) {
    currentState = null;
    await playPhaseBgm(state);
  }
}

/** 나레이션(TTS) 켜기/끄기. 끄면 진행 중인 음성도 즉시 중단한다. */
export async function setNarrationEnabled(enabled: boolean): Promise<void> {
  narrationEnabled = enabled;
  if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    return;
  }
  if (enabled) {
    await resumeCtx().catch(() => {
      /* TTS만 쓸 때도 제스처로 컨텍스트를 열어 둔다 */
    });
  }
}

/** GameState 변경 시 분위기 BGM + 환경음 soundscape 전환 */
export async function playPhaseBgm(state: GameState) {
  if (typeof window === 'undefined') return;
  if (!bgmEnabled || bgmForcedOff) return;
  if (currentState === state) return;

  await resumeCtx().catch(() => {
    /* HTMLAudio만으로도 재생 가능 */
  });

  currentState = state;
  const bed = bedForState(state);
  if (bed === 'night') {
    await playNightBgm();
  } else {
    await playDayBgm();
  }
}

export function speakPhase(state: GameState, customText?: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!narrationEnabled) return;

  const text = customText ?? TTS_SCRIPTS[state];
  if (!text) return;

  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ko-KR';
  utter.rate = 1;
  utter.pitch = state === 'NIGHT' ? 0.85 : 1.05;
  window.speechSynthesis.speak(utter);
}

export function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!narrationEnabled) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ko-KR';
  window.speechSynthesis.speak(utter);
}

/** 아침 결과 팝업 효과음 (마피아 습격·기자 신문은 전용 연출에서 처리) */
export async function playMorningEventSound(
  event: MorningEvent,
  options: { success?: boolean } = {},
) {
  if (typeof window === 'undefined' || bgmForcedOff) return;

  if (event === 'MAFIA_KILL' || event === 'REPORTER_NEWS') return;

  if (event === 'DOCTOR_DEFEND' && options.success !== true) {
    try {
      const ctx = await resumeCtx();
      const now = ctx.currentTime;
      [
        { freq: 620, offset: 0, duration: 0.1 },
        { freq: 430, offset: 0.12, duration: 0.12 },
        { freq: 250, offset: 0.27, duration: 0.2 },
      ].forEach(({ freq, offset, duration }) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(freq, now + offset);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.035, now + offset + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + duration + 0.02);
      });
      return;
    } catch {
      /* 자동 재생이 차단된 경우에도 시각 연출은 계속 진행한다. */
    }
  }

  try {
    const ctx = await resumeCtx();

    const now = ctx.currentTime;
    const notes: Record<
      MorningEvent,
      { freq: number; offset: number; duration: number; type: OscillatorType }[]
    > = {
      REPORTER_NEWS: [],
      REPORTER_IDLE: [
        { freq: 460, offset: 0, duration: 0.16, type: 'triangle' },
        { freq: 360, offset: 0.18, duration: 0.22, type: 'triangle' },
      ],
      MAFIA_KILL: [],
      DOCTOR_DEFEND: [
        { freq: 392, offset: 0, duration: 0.18, type: 'triangle' },
        { freq: 523, offset: 0.12, duration: 0.24, type: 'triangle' },
      ],
      DOCTOR_IDLE: [
        { freq: 540, offset: 0, duration: 0.12, type: 'sine' },
        { freq: 420, offset: 0.16, duration: 0.22, type: 'sine' },
      ],
    };

    const sequence = notes[event];
    if (!sequence?.length) return;

    sequence.forEach(({ freq, offset, duration, type }) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.055, now + offset + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + duration + 0.02);
    });
  } catch {
    /* 자동 재생이 차단된 브라우저에서는 시각 효과만 표시한다. */
  }
}

/** 마피아 체포 후 감옥 컷씬의 짧은 사이렌·철창 효과음. */
export async function playMafiaJailSound(): Promise<void> {
  if (typeof window === 'undefined' || bgmForcedOff) return;

  try {
    const ctx = await resumeCtx();
    const now = ctx.currentTime;
    const siren = [
      { freq: 540, offset: 0, duration: 0.28 },
      { freq: 760, offset: 0.28, duration: 0.32 },
      { freq: 540, offset: 0.62, duration: 0.28 },
      { freq: 760, offset: 0.9, duration: 0.32 },
    ];

    siren.forEach(({ freq, offset, duration }) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(freq, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.06, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + duration + 0.03);
    });

    const clang = ctx.createOscillator();
    const clangGain = ctx.createGain();
    clang.type = 'square';
    clang.frequency.setValueAtTime(180, now + 0.78);
    clang.frequency.exponentialRampToValueAtTime(72, now + 1.04);
    clangGain.gain.setValueAtTime(0.0001, now + 0.78);
    clangGain.gain.exponentialRampToValueAtTime(0.08, now + 0.8);
    clangGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.08);
    clang.connect(clangGain);
    clangGain.connect(ctx.destination);
    clang.start(now + 0.78);
    clang.stop(now + 1.1);
  } catch {
    /* 자동 재생 정책에 막히면 시각 연출만 계속한다. */
  }
}

/** 학생 역할 공개 카드가 뒤집히는 순간의 역할별 짧은 팡파르. */
export async function playRoleRevealSound(role: Role): Promise<void> {
  if (typeof window === 'undefined' || bgmForcedOff) return;

  const notesByRole: Record<Role, number[]> = {
    MAFIA: [196, 147, 98, 73],
    DOCTOR: [392, 523, 659, 784],
    POLICE: [330, 494, 659, 988],
    REPORTER: [523, 659, 784, 1046],
    SPIRITUALIST: [220, 330, 440, 660],
    CITIZEN: [330, 392, 523, 659],
  };

  try {
    const ctx = await resumeCtx();
    const now = ctx.currentTime;
    notesByRole[role].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const offset = index * 0.075;
      const duration = 0.23;
      oscillator.type = role === 'MAFIA' ? 'sawtooth' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.07, now + offset + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + duration + 0.02);
    });
  } catch {
    /* 브라우저 자동 재생이 차단되어도 카드 뒤집기 연출은 계속한다. */
  }
}

export { playGunshot, playReporterNewsSound };

export function stopAllAudio() {
  stopSoundscape();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  currentState = null;
}
