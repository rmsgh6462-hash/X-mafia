/**
 * 게임 사운드scape · 효과음 중앙 관리.
 * HTML5 Audio 레이어 스택 + 파일(mp3/wav) 우선, 없으면 Web Audio 합성 fallback.
 */

type BgmBed = 'day' | 'night';

const BGM_VOLUME: Record<BgmBed, number> = {
  day: 0.42,
  night: 0.48,
};

const AMBIENT_VOLUME = {
  birds: 0.2,
  stream: 0.24,
  crow: 0.22,
  rain: 0.34,
} as const;

const CROSSFADE_MS = 1400;

const SOUND_PATHS = {
  gunshot: ['/sounds/gunshot.mp3', '/sounds/gunshot.wav'],
  cameraShutter: ['/sounds/camera_shutter.mp3', '/sounds/camera-shutter.wav'],
  newspaperRustle: ['/sounds/newspaper_rustle.mp3', '/sounds/newspaper-rustle.wav'],
  bgmDay: ['/sounds/bgm_day.mp3', '/sounds/bgm-day.wav'],
  bgmNight: ['/sounds/bgm_night.mp3', '/sounds/bgm-night.wav'],
  envBirds: ['/sounds/env_birds.mp3', '/sounds/env-birds.wav'],
  envStream: ['/sounds/env_stream.mp3', '/sounds/env-stream.wav'],
  envCrow: ['/sounds/env_crow.mp3', '/sounds/env-crow.wav'],
  envRain: ['/sounds/env_rain.mp3', '/sounds/env-rain.wav'],
} as const;

let audioCtx: AudioContext | null = null;
let sfxBlocked = false;
let currentBed: BgmBed | null = null;
let mainBgm: HTMLAudioElement | null = null;
let ambientLayers: HTMLAudioElement[] = [];
let fadingOut: HTMLAudioElement[] = [];
let nightRainActive = false;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

async function resumeCtx(): Promise<AudioContext> {
  const ctx = getCtx();
  if (ctx.state === 'suspended') await ctx.resume();
  return ctx;
}

export function setSfxBlocked(blocked: boolean): void {
  sfxBlocked = blocked;
}

export function isSfxBlocked(): boolean {
  return sfxBlocked;
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
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

function stopAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  try {
    audio.pause();
    audio.src = '';
  } catch {
    /* ignore */
  }
}

async function playFromPaths(
  paths: readonly string[],
  volume: number,
  loop = false,
): Promise<HTMLAudioElement | null> {
  if (typeof window === 'undefined') return null;

  for (const src of paths) {
    const audio = new Audio(src);
    audio.loop = loop;
    audio.preload = 'auto';
    audio.volume = loop ? 0 : Math.min(1, Math.max(0, volume));
    try {
      await audio.play();
      if (loop) audio.volume = volume;
      return audio;
    } catch {
      /* 다음 경로 시도 */
    }
  }
  return null;
}

async function startLayer(
  paths: readonly string[],
  volume: number,
): Promise<HTMLAudioElement | null> {
  const audio = await playFromPaths(paths, volume, true);
  if (!audio) return null;
  const target = volume;
  audio.volume = 0;
  void fadeAudioVolume(audio, 0, target, CROSSFADE_MS);
  return audio;
}

export function stopSoundscape(): void {
  fadingOut.forEach(stopAudio);
  fadingOut = [];
  ambientLayers.forEach((layer) => {
    const from = layer.volume;
    void fadeAudioVolume(layer, from, 0, CROSSFADE_MS).then(() => stopAudio(layer));
  });
  ambientLayers = [];

  if (mainBgm) {
    const previous = mainBgm;
    mainBgm = null;
    const from = previous.volume;
    void fadeAudioVolume(previous, from, 0, CROSSFADE_MS).then(() => stopAudio(previous));
  }

  currentBed = null;
  nightRainActive = false;
}

async function switchMainBgm(bed: BgmBed, paths: readonly string[]): Promise<void> {
  const next = await playFromPaths(paths, 0, true);
  if (!next) return;

  const previous = mainBgm;
  mainBgm = next;
  currentBed = bed;

  const target = BGM_VOLUME[bed];
  void fadeAudioVolume(next, 0, target, CROSSFADE_MS);

  if (previous && previous !== next) {
    fadingOut.push(previous);
    const from = previous.volume;
    void fadeAudioVolume(previous, from, 0, CROSSFADE_MS).then(() => {
      stopAudio(previous);
      fadingOut = fadingOut.filter((a) => a !== previous);
    });
  }
}

/** 낮 BGM + 새소리·시냇물 환경음 오버레이 */
export async function playDayBgm(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (currentBed === 'day' && mainBgm && !mainBgm.paused) return;

  await resumeCtx().catch(() => undefined);

  if (currentBed !== 'day') {
    ambientLayers.forEach(stopAudio);
    ambientLayers = [];
    nightRainActive = false;
  }

  await switchMainBgm('day', SOUND_PATHS.bgmDay);

  if (ambientLayers.length === 0) {
    const birds = await startLayer(SOUND_PATHS.envBirds, AMBIENT_VOLUME.birds);
    const stream = await startLayer(SOUND_PATHS.envStream, AMBIENT_VOLUME.stream);
    if (birds) ambientLayers.push(birds);
    if (stream) ambientLayers.push(stream);
  }
}

/** 밤 BGM + 까마귀 환경음, 30% 확률으로 비 소리 추가 */
export async function playNightBgm(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (currentBed === 'night' && mainBgm && !mainBgm.paused) return;

  await resumeCtx().catch(() => undefined);

  const switchingBed = currentBed !== 'night';
  if (switchingBed) {
    ambientLayers.forEach(stopAudio);
    ambientLayers = [];
    nightRainActive = false;
  }

  await switchMainBgm('night', SOUND_PATHS.bgmNight);

  if (switchingBed || ambientLayers.length === 0) {
    const crow = await startLayer(SOUND_PATHS.envCrow, AMBIENT_VOLUME.crow);
    if (crow) ambientLayers.push(crow);

    if (!nightRainActive && Math.random() < 0.3) {
      const rain = await startLayer(SOUND_PATHS.envRain, AMBIENT_VOLUME.rain);
      if (rain) {
        ambientLayers.push(rain);
        nightRainActive = true;
      }
    }
  }
}

async function playGunshotSynth(volume = 0.52): Promise<void> {
  const ctx = await resumeCtx();
  const now = ctx.currentTime;
  const duration = 0.24;
  const buffer = ctx.createBuffer(
    1,
    Math.floor(ctx.sampleRate * duration),
    ctx.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) {
    const fade = 1 - i / samples.length;
    samples[i] = (Math.random() * 2 - 1) * fade * fade;
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

/**
 * 마피아 습격 총소리. `onFlash`는 총소리와 동시에 호출하여 화면 플래시를 맞춘다.
 */
export async function playGunshot(options?: { onFlash?: () => void }): Promise<void> {
  if (typeof window === 'undefined' || sfxBlocked) return;

  options?.onFlash?.();

  const played = await playFromPaths(SOUND_PATHS.gunshot, 0.52, false);
  if (played) return;

  try {
    await playGunshotSynth(0.52);
  } catch {
    /* 시각 연출만 진행 */
  }
}

/** 기자 신문: 셔터 → 0.3초 후 신문 펼치는 소리 */
export async function playReporterNewsSound(): Promise<void> {
  if (typeof window === 'undefined' || sfxBlocked) return;

  const shutterPlayed = await playFromPaths(SOUND_PATHS.cameraShutter, 0.55, false);
  if (!shutterPlayed) {
    try {
      const ctx = await resumeCtx();
      const now = ctx.currentTime;
      [0, 0.09].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1850, now + offset);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.045, now + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.07);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.08);
      });
    } catch {
      /* ignore */
    }
  }

  window.setTimeout(() => {
    void playFromPaths(SOUND_PATHS.newspaperRustle, 0.5, false).then((rustle) => {
      if (rustle) return;
      try {
        const ctx = getCtx();
        const now = ctx.currentTime;
        const duration = 0.45;
        const buffer = ctx.createBuffer(
          1,
          Math.floor(ctx.sampleRate * duration),
          ctx.sampleRate,
        );
        const data = buffer.getChannelData(0);
        let noise = 0;
        for (let i = 0; i < data.length; i += 1) {
          noise = noise * 0.92 + (Math.random() * 2 - 1) * 0.08;
          const env = Math.sin(Math.PI * (i / data.length)) ** 0.8;
          data[i] = noise * env;
        }
        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        source.buffer = buffer;
        filter.type = 'highpass';
        filter.frequency.value = 900;
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start(now);
        source.stop(now + duration + 0.02);
      } catch {
        /* ignore */
      }
    });
  }, 300);
}
