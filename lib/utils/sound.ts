import type { WinnerSide } from '@/types/game';

let soundContext: AudioContext | null = null;

const OPTIONAL_ASSETS = {
  gunshot: '/sounds/gunshot.mp3',
} as const;

function getSoundContext(): AudioContext {
  if (!soundContext) soundContext = new AudioContext();
  return soundContext;
}

/**
 * 마피아 습격 총격음.
 * 실제 gunshot.mp3가 추가되면 파일을 우선 사용하고, 파일이 없거나
 * 자동 재생이 차단되면 Web Audio 합성음으로 조용히 대체한다.
 */
export async function playGunshotSound(volume = 0.48): Promise<void> {
  if (typeof window === 'undefined') return;

  const audio = new Audio(OPTIONAL_ASSETS.gunshot);
  audio.volume = Math.min(1, Math.max(0, volume));
  audio.currentTime = 0;

  try {
    await audio.play();
    return;
  } catch {
    // 파일 미존재·자동 재생 차단 시 합성음으로 fallback한다.
  }

  try {
    await playGunshotSynth(volume);
  } catch {
    // 오디오를 재생할 수 없는 환경에서도 시각 연출은 계속 보여 준다.
  }
}

/** 게임 종료 시 승리 팀별 짧은 테마 팡파르. 자동재생이 막혀도 화면은 계속 진행된다. */
export async function playVictorySound(side: WinnerSide): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const ctx = getSoundContext();
    if (ctx.state === 'suspended') await ctx.resume();

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.075, now + 0.04);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.75);
    master.connect(ctx.destination);

    const notes = side === 'MAFIA'
      ? [
          { freq: 147, offset: 0, duration: 0.28, type: 'sawtooth' as OscillatorType },
          { freq: 196, offset: 0.24, duration: 0.34, type: 'triangle' as OscillatorType },
          { freq: 233, offset: 0.52, duration: 0.62, type: 'triangle' as OscillatorType },
        ]
      : [
          { freq: 392, offset: 0, duration: 0.22, type: 'triangle' as OscillatorType },
          { freq: 494, offset: 0.18, duration: 0.22, type: 'triangle' as OscillatorType },
          { freq: 659, offset: 0.36, duration: 0.72, type: 'sine' as OscillatorType },
        ];

    notes.forEach(({ freq, offset, duration, type }) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.8, now + offset + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + duration + 0.03);
    });

    window.setTimeout(() => {
      try {
        master.disconnect();
      } catch {
        /* already disconnected */
      }
    }, 1900);
  } catch {
    // 브라우저 오디오 정책에 막혀도 승리 화면은 정상 노출한다.
  }
}

async function playGunshotSynth(volume: number): Promise<void> {
  const ctx = getSoundContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const now = ctx.currentTime;
  const duration = 0.24;
  const buffer = ctx.createBuffer(
    1,
    Math.floor(ctx.sampleRate * duration),
    ctx.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    const fade = 1 - index / samples.length;
    samples[index] = (Math.random() * 2 - 1) * fade * fade;
  }

  const noise = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const noiseGain = ctx.createGain();
  noise.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1050, now);
  filter.Q.setValueAtTime(0.7, now);
  noiseGain.gain.setValueAtTime(Math.min(0.9, volume * 1.5), now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + duration);

  const thump = ctx.createOscillator();
  const thumpGain = ctx.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(125, now);
  thump.frequency.exponentialRampToValueAtTime(45, now + 0.18);
  thumpGain.gain.setValueAtTime(Math.min(0.65, volume), now);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  thump.connect(thumpGain);
  thumpGain.connect(ctx.destination);
  thump.start(now);
  thump.stop(now + 0.22);
}
