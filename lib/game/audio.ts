import type { GameState, MorningEvent, Role } from '@/types/game';
import { playGunshotSound } from '@/lib/utils/sound';

type BgmBed = 'day' | 'night';

const BGM_ASSETS: Record<BgmBed, string> = {
  day: '/sounds/bgm-day.wav',
  night: '/sounds/bgm-night.wav',
};

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

const BGM_VOLUME: Record<BgmBed, number> = {
  day: 0.42,
  night: 0.48,
};

const CROSSFADE_MS = 1400;

let audioCtx: AudioContext | null = null;
let currentState: GameState | null = null;
let currentBed: BgmBed | null = null;
let activeBedAudio: HTMLAudioElement | null = null;
let fadingOut: HTMLAudioElement[] = [];
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

function fadeAudioVolume(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  ms: number,
): Promise<void> {
  return new Promise((resolve) => {
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / ms);
      const curved = t * t * (3 - 2 * t);
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * curved));
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

function stopBedAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  try {
    audio.pause();
    audio.src = '';
  } catch {
    /* ignore */
  }
}

function stopBgm() {
  fadingOut.forEach(stopBedAudio);
  fadingOut = [];
  stopBedAudio(activeBedAudio);
  activeBedAudio = null;
  currentBed = null;
}

async function startBed(bed: BgmBed) {
  if (currentBed === bed && activeBedAudio && !activeBedAudio.paused) {
    return;
  }

  const next = new Audio(BGM_ASSETS[bed]);
  next.loop = true;
  next.preload = 'auto';
  next.volume = 0;

  const previous = activeBedAudio;
  activeBedAudio = next;
  currentBed = bed;

  try {
    await next.play();
  } catch {
    // 자동재생이 막히면 조용히 포기 (교사 토글 제스처 후 재시도됨)
    if (activeBedAudio === next) {
      activeBedAudio = null;
      currentBed = null;
    }
    stopBedAudio(next);
    return;
  }

  const target = BGM_VOLUME[bed];
  void fadeAudioVolume(next, 0, target, CROSSFADE_MS);

  if (previous) {
    fadingOut.push(previous);
    const from = previous.volume;
    void fadeAudioVolume(previous, from, 0, CROSSFADE_MS).then(() => {
      stopBedAudio(previous);
      fadingOut = fadingOut.filter((a) => a !== previous);
    });
  }
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
  if (!enabled) {
    stopBgm();
    currentState = null;
    return;
  }
  await resumeCtx();
  if (state) {
    currentState = null;
    currentBed = null;
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

/** GameState 변경 시 분위기 BGM 전환 (아침·낮 = 새/물, 밤 = 까마귀) */
export async function playPhaseBgm(state: GameState) {
  if (typeof window === 'undefined') return;
  if (!bgmEnabled || bgmForcedOff) return;
  if (currentState === state && activeBedAudio && !activeBedAudio.paused) return;

  await resumeCtx().catch(() => {
    /* HTMLAudio만으로도 재생 가능 */
  });

  currentState = state;
  await startBed(bedForState(state));
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

/** 아침 결과 팝업의 짧은 효과음. 브라우저 오디오 정책에 막혀도 게임은 계속 진행된다. */
export async function playMorningEventSound(
  event: MorningEvent,
  options: { success?: boolean } = {},
) {
  if (typeof window === 'undefined') return;
  if (bgmForcedOff) return;

  if (event === 'MAFIA_KILL') {
    await playGunshotSound(0.52);
    return;
  }

  // 의사 허탕은 구조 성공음보다 짧고 가벼운 하강음으로 구분한다.
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
      // 자동 재생이 차단된 경우에도 시각 연출은 계속 진행한다.
    }
  }

  try {
    const ctx = await resumeCtx();

    const now = ctx.currentTime;
    const notes: Record<MorningEvent, { freq: number; offset: number; duration: number; type: OscillatorType }[]> = {
      REPORTER_NEWS: [
        { freq: 1850, offset: 0, duration: 0.07, type: 'square' },
        { freq: 1250, offset: 0.09, duration: 0.1, type: 'square' },
        { freq: 920, offset: 0.34, duration: 0.035, type: 'square' },
        { freq: 1040, offset: 0.41, duration: 0.035, type: 'square' },
        { freq: 920, offset: 0.48, duration: 0.035, type: 'square' },
        { freq: 1040, offset: 0.55, duration: 0.035, type: 'square' },
      ],
      REPORTER_IDLE: [
        { freq: 460, offset: 0, duration: 0.16, type: 'triangle' },
        { freq: 360, offset: 0.18, duration: 0.22, type: 'triangle' },
      ],
      MAFIA_KILL: [
        { freq: 120, offset: 0, duration: 0.24, type: 'sawtooth' },
        { freq: 78, offset: 0.06, duration: 0.3, type: 'sine' },
      ],
      DOCTOR_DEFEND: [
        { freq: 392, offset: 0, duration: 0.18, type: 'triangle' },
        { freq: 523, offset: 0.12, duration: 0.24, type: 'triangle' },
      ],
      DOCTOR_IDLE: [
        { freq: 540, offset: 0, duration: 0.12, type: 'sine' },
        { freq: 420, offset: 0.16, duration: 0.22, type: 'sine' },
      ],
    };

    notes[event].forEach(({ freq, offset, duration, type }) => {
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
    // 자동 재생이 차단된 브라우저에서는 시각 효과만 표시한다.
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
    // 브라우저 자동 재생이 차단되어도 카드 뒤집기 연출은 계속한다.
  }
}

export function stopAllAudio() {
  stopBgm();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  currentState = null;
}
