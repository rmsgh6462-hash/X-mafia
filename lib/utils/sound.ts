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

