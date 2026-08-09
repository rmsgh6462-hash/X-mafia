import type { GameState } from '@/types/game';

type PhaseTone = {
  freqs: number[];
  volume: number;
  type: OscillatorType;
};

const PHASE_TONES: Partial<Record<GameState, PhaseTone>> = {
  WAITING: { freqs: [196, 247], volume: 0.03, type: 'sine' },
  DAY_TALK: { freqs: [262, 330, 392], volume: 0.035, type: 'sine' },
  DAY_MATCH: { freqs: [294, 370], volume: 0.04, type: 'triangle' },
  DAY_MISSION: { freqs: [220, 277, 330], volume: 0.04, type: 'sine' },
  DAY_VOTE: { freqs: [185, 233], volume: 0.045, type: 'sawtooth' },
  NIGHT: { freqs: [55, 82, 110], volume: 0.055, type: 'sine' },
  RESULT: { freqs: [330, 415, 494], volume: 0.04, type: 'triangle' },
  ENDED: { freqs: [196, 165], volume: 0.03, type: 'sine' },
};

const TTS_SCRIPTS: Partial<Record<GameState, string>> = {
  WAITING: '방에 입장해 주세요. 큐알 코드 또는 핀 번호로 참가할 수 있습니다.',
  DAY_TALK: '낮이 되었습니다. 자유롭게 토론해 주세요.',
  DAY_MATCH: '일대일 매칭이 시작되었습니다. 삼십 초 동안 휴대폰 채팅으로 파트너와 대화하세요.',
  DAY_MISSION: '미션이 발동되었습니다. 제한 시간 안에 미션을 수행해 주세요.',
  DAY_VOTE: '투표를 시작합니다. 십오 초 안에 의심되는 사람에게 투표해 주세요.',
  NIGHT: '밤이 되었습니다. 눈을 감고 조용히 기다려 주세요.',
  RESULT: '결과가 발표됩니다.',
  ENDED: '게임이 종료되었습니다.',
};

let audioCtx: AudioContext | null = null;
let activeNodes: AudioNode[] = [];
let currentState: GameState | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function stopBgm() {
  activeNodes.forEach((node) => {
    try {
      if ('stop' in node && typeof node.stop === 'function') {
        node.stop();
      }
      node.disconnect();
    } catch {
      /* already stopped */
    }
  });
  activeNodes = [];
}

/** GameState 변경 시 분위기 BGM 전환 (Web Audio 앰비언트) */
export async function playPhaseBgm(state: GameState) {
  if (typeof window === 'undefined') return;
  if (currentState === state && activeNodes.length > 0) return;

  const ctx = getCtx();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  stopBgm();
  currentState = state;

  const tone = PHASE_TONES[state];
  if (!tone) return;

  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  activeNodes.push(master);

  // 페이드 인
  master.gain.linearRampToValueAtTime(tone.volume, ctx.currentTime + 1.2);

  tone.freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type;
    osc.frequency.value = freq;
    gain.gain.value = 1 / tone.freqs.length;
    // 밤: 약간의 떨림
    if (state === 'NIGHT') {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.15 + i * 0.05;
      lfoGain.gain.value = 4;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();
      activeNodes.push(lfo, lfoGain);
    }
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    activeNodes.push(osc, gain);
  });
}

export function speakPhase(state: GameState, customText?: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

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
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ko-KR';
  window.speechSynthesis.speak(utter);
}

export function stopAllAudio() {
  stopBgm();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  currentState = null;
}
