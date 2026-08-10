/**
 * Classroom-friendly ambient BGM loops (day / night).
 * Pure Node PCM → 16-bit stereo WAV. No external deps.
 *
 * Day: soft folk pad + gentle melody + birds + brook
 * Night: minor pad + sparse dissonant motif + crow calls + wind
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'sounds');
const SAMPLE_RATE = 44100;
const DURATION_SEC = 36;

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function midiToHz(m) {
  return 440 * 2 ** ((m - 69) / 12);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function softClip(x) {
  return Math.tanh(x * 1.2);
}

function writeWavStereo(path, left, right, sampleRate) {
  const n = left.length;
  const dataSize = n * 4;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < n; i += 1) {
    const l = clamp(Math.round(softClip(left[i]) * 32767), -32768, 32767);
    const r = clamp(Math.round(softClip(right[i]) * 32767), -32768, 32767);
    buffer.writeInt16LE(l, 44 + i * 4);
    buffer.writeInt16LE(r, 44 + i * 4 + 2);
  }
  writeFileSync(path, buffer);
}

function applyLoopCrossfade(left, right, fadeSamples) {
  const n = left.length;
  for (let i = 0; i < fadeSamples; i += 1) {
    const t = i / fadeSamples;
    const a = 0.5 - 0.5 * Math.cos(Math.PI * t);
    const head = i;
    const tail = n - fadeSamples + i;
    left[head] = left[head] * a + left[tail] * (1 - a);
    right[head] = right[head] * a + right[tail] * (1 - a);
    left[tail] = left[head];
    right[tail] = right[head];
  }
}

function normalizeStereo(left, right, peakTarget) {
  let peak = 1e-6;
  for (let i = 0; i < left.length; i += 1) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const g = peakTarget / peak;
  for (let i = 0; i < left.length; i += 1) {
    left[i] *= g;
    right[i] *= g;
  }
}

function envADSR(t, dur, a, d, s, r) {
  if (t < 0 || t > dur) return 0;
  if (t < a) return t / Math.max(1e-6, a);
  if (t < a + d) return 1 - (1 - s) * ((t - a) / Math.max(1e-6, d));
  if (t < dur - r) return s;
  return s * Math.max(0, (dur - t) / Math.max(1e-6, r));
}

function padVoice(phase, bright) {
  return (
    Math.sin(phase) * 0.62 +
    Math.sin(phase * 2) * (0.2 * bright) +
    Math.sin(phase * 3) * (0.09 * bright) +
    Math.sin(phase * 4.01) * (0.035 * bright)
  );
}

function fluteVoice(phase) {
  const breath = 1 + 0.012 * Math.sin(phase * 0.41);
  return (
    (Math.sin(phase) * 0.72 +
      Math.sin(phase * 2.005) * 0.16 +
      Math.sin(phase * 3.01) * 0.07) *
    breath
  );
}

function renderPadPass(left, right, samples, sr, chords, chordSec, amp, bright, rand, dark = false) {
  const chordLen = Math.floor(sr * chordSec);
  const passes = Math.ceil(samples / (chordLen * chords.length));
  for (let cycle = 0; cycle < passes; cycle += 1) {
    for (let c = 0; c < chords.length; c += 1) {
      const start = cycle * chords.length * chordLen + c * chordLen;
      if (start >= samples) return;
      const notes = chords[c];
      notes.forEach((midi, ni) => {
        const freq = midiToHz(midi);
        const pan = ni / Math.max(1, notes.length - 1);
        let phase = rand() * Math.PI * 2;
        const baseInc = (2 * Math.PI * freq) / sr;
        for (let i = 0; i < chordLen && start + i < samples; i += 1) {
          const local = i / sr;
          const fadeIn = Math.min(1, local / (dark ? 2.4 : 1.5));
          const fadeOut = Math.min(1, (chordLen / sr - local) / (dark ? 2.6 : 1.7));
          const trem =
            0.93 + 0.07 * Math.sin(((start + i) / sr) * (0.35 + ni * 0.06) + ni);
          const wobble = dark
            ? 1 + 0.0035 * Math.sin(((start + i) / sr) * (0.18 + ni * 0.04))
            : 1;
          phase += baseInc * wobble;
          const tone = dark
            ? Math.sin(phase) * 0.58 +
              Math.sin(phase * 2) * 0.1 +
              Math.sin(phase * 3) * 0.2 +
              Math.sin(phase * 5) * 0.05
            : padVoice(phase, bright);
          const s = tone * fadeIn * fadeOut * trem * amp;
          left[start + i] += s * (1 - pan * 0.68);
          right[start + i] += s * (0.32 + pan * 0.68);
        }
      });
    }
  }
}

function renderDayLoop(samples, sr, rand) {
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);

  // Brook / soft water bed
  let slow = 0;
  let mid = 0;
  let sparkle = 0;
  for (let i = 0; i < samples; i += 1) {
    const t = i / sr;
    const white = rand() * 2 - 1;
    slow = slow * 0.9985 + white * 0.0015;
    mid = mid * 0.985 + white * 0.015;
    sparkle = sparkle * 0.92 + white * 0.08;
    const flow =
      0.5 +
      0.35 * Math.sin(t * 0.31) +
      0.15 * Math.sin(t * 0.79 + 1.7);
    const water = (slow * 0.55 + mid * 0.35 + sparkle * 0.12) * 0.2 * flow;
    const pan = 0.5 + 0.2 * Math.sin(t * 0.19);
    left[i] += water * (1 - pan);
    right[i] += water * pan;
  }

  // Warm major pads
  renderPadPass(
    left,
    right,
    samples,
    sr,
    [
      [48, 55, 60, 67], // C
      [53, 60, 65, 72], // F
      [50, 57, 62, 69], // Dm
      [47, 55, 62, 71], // G
    ],
    6,
    0.052,
    0.42,
    rand,
    false,
  );

  // Gentle lead melody (C major pentatonic phrases)
  const phrases = [
    [72, 74, 76, 79, 76, 74],
    [79, 81, 79, 76, 74, 72],
    [67, 69, 72, 74, 72, 69],
    [76, 74, 72, 69, 71, 72],
  ];
  const noteDur = Math.floor(sr * 0.85);
  let phraseIdx = 0;
  let noteIdx = 0;
  for (let step = 0; step < Math.floor(samples / noteDur); step += 1) {
    const phrase = phrases[phraseIdx % phrases.length];
    if (noteIdx >= phrase.length) {
      phraseIdx += 1;
      noteIdx = 0;
      if (rand() < 0.45) continue; // breath between phrases
    }
    if (rand() < 0.12) {
      noteIdx += 1;
      continue;
    }
    const midi = phrase[noteIdx];
    noteIdx += 1;
    const start = step * noteDur + Math.floor(rand() * sr * 0.05);
    const dur = Math.floor(sr * lerp(0.6, 1.05, rand()));
    let phase = 0;
    const inc = (2 * Math.PI * midiToHz(midi)) / sr;
    const pan = 0.38 + rand() * 0.24;
    for (let i = 0; i < dur && start + i < samples; i += 1) {
      const e = envADSR(i / sr, dur / sr, 0.05, 0.16, 0.58, 0.32);
      const vib = 1 + 0.0035 * Math.sin((i / sr) * 5.2);
      phase += inc * vib;
      const s = fluteVoice(phase) * e * 0.068;
      left[start + i] += s * (1 - pan);
      right[start + i] += s * pan;
    }
  }

  // Birdsong — short motifs, not noise bursts
  const birdMotifs = [
    [
      [0, 2800, 3400, 0.07],
      [0.09, 3200, 2600, 0.06],
    ],
    [[0, 2100, 3900, 0.1]],
    [
      [0, 3600, 4100, 0.05],
      [0.07, 4000, 3000, 0.08],
      [0.17, 3300, 3700, 0.05],
    ],
    [
      [0, 1800, 2400, 0.08],
      [0.1, 2400, 1900, 0.07],
    ],
  ];
  for (let b = 0; b < 28; b += 1) {
    const start = Math.floor(rand() * (samples - sr));
    const motif = birdMotifs[Math.floor(rand() * birdMotifs.length)];
    const pan = rand();
    const amp = lerp(0.04, 0.085, rand());
    for (const [offsetSec, f0, f1, lenSec] of motif) {
      const localStart = start + Math.floor(offsetSec * sr);
      const len = Math.floor(lenSec * sr);
      let phase = 0;
      for (let i = 0; i < len && localStart + i < samples; i += 1) {
        const u = i / len;
        const freq = lerp(f0, f1, u * u);
        phase += (2 * Math.PI * freq) / sr;
        const env = Math.sin(Math.PI * u) ** 1.35;
        const grain = (rand() * 2 - 1) * 0.05 * (1 - u);
        const s = (Math.sin(phase) * 0.9 + grain) * env * amp;
        left[localStart + i] += s * (1 - pan);
        right[localStart + i] += s * pan;
      }
    }
  }

  // Light stereo slap for space
  const delay = Math.floor(sr * 0.16);
  for (let i = samples - 1; i >= delay; i -= 1) {
    left[i] += right[i - delay] * 0.14;
    right[i] += left[i - delay] * 0.14;
  }

  applyLoopCrossfade(left, right, Math.floor(sr * 2.4));
  normalizeStereo(left, right, 0.76);
  return { left, right };
}

function renderNightLoop(samples, sr, rand) {
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);

  // Cold wind bed
  let brown = 0;
  let air = 0;
  for (let i = 0; i < samples; i += 1) {
    const t = i / sr;
    const white = rand() * 2 - 1;
    brown = clamp(brown + white * 0.018, -1, 1);
    air = air * 0.975 + brown * 0.025;
    const gust =
      0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.15 + Math.sin(t * 0.06) * 1.4));
    const wind = air * 0.15 * gust;
    const pan = 0.5 + 0.28 * Math.sin(t * 0.08);
    left[i] += wind * (1 - pan);
    right[i] += wind * pan;
  }

  // Dark minor pads
  renderPadPass(
    left,
    right,
    samples,
    sr,
    [
      [38, 45, 50, 57], // Dm
      [34, 41, 46, 53], // Bb
      [33, 40, 45, 52], // A
      [35, 42, 47, 54], // Gm
    ],
    7.5,
    0.068,
    0.25,
    rand,
    true,
  );

  // Sparse eerie motif
  const motif = [57, 60, 58, 53, 50, 57, 55, 48, 50, 45];
  const beat = Math.floor(sr * 1.4);
  for (let step = 0; step < Math.floor(samples / beat); step += 1) {
    if (rand() < 0.38) continue;
    const midi = motif[step % motif.length];
    const start = step * beat + Math.floor(rand() * sr * 0.18);
    const dur = Math.floor(sr * lerp(1.1, 2.3, rand()));
    let phase = 0;
    const inc = (2 * Math.PI * midiToHz(midi)) / sr;
    const pan = 0.22 + rand() * 0.56;
    for (let i = 0; i < dur && start + i < samples; i += 1) {
      const e = envADSR(i / sr, dur / sr, 0.28, 0.45, 0.38, 0.75);
      const vib = 1 + 0.007 * Math.sin((i / sr) * 2.8);
      phase += inc * vib;
      const tone =
        Math.sin(phase) * 0.5 +
        Math.sin(phase * 2.01) * 0.22 +
        Math.sin(phase * 3.02) * 0.12;
      const s = tone * e * 0.05;
      left[start + i] += s * (1 - pan);
      right[start + i] += s * pan;
    }
  }

  // Crow calls — multi-formant "caw"
  for (let c = 0; c < 10; c += 1) {
    const start = Math.floor(sr * (2.5 + rand() * (DURATION_SEC - 7)));
    const syllables = 1 + Math.floor(rand() * 3);
    let cursor = start;
    const pan = clamp(0.15 + rand() * 0.7, 0, 1);
    for (let s = 0; s < syllables; s += 1) {
      const len = Math.floor(sr * lerp(0.2, 0.42, rand()));
      const f0 = lerp(420, 680, rand());
      const f1 = f0 * lerp(0.52, 0.72, rand());
      let phase1 = 0;
      let phase2 = 0;
      let noise = 0;
      for (let i = 0; i < len && cursor + i < samples; i += 1) {
        const u = i / len;
        const freq = lerp(f0, f1, u ** 0.65);
        phase1 += (2 * Math.PI * freq) / sr;
        phase2 += (2 * Math.PI * freq * 1.85) / sr;
        noise = noise * 0.88 + (rand() * 2 - 1) * 0.12;
        const carrier =
          Math.sin(phase1) * 0.55 + Math.sin(phase2) * 0.28 + noise * 0.45;
        const rasp = carrier * (0.5 + 0.5 * Math.abs(Math.sin(phase1 * 0.5)));
        const env = Math.sin(Math.PI * Math.min(1, u * 1.12)) ** 1.05;
        const sample = rasp * env * 0.11;
        left[cursor + i] += sample * (1 - pan);
        right[cursor + i] += sample * pan;
      }
      cursor += len + Math.floor(sr * lerp(0.06, 0.18, rand()));
    }
  }

  // Very soft low pulse
  for (let i = 0; i < samples; i += 1) {
    const t = i / sr;
    const pulse = Math.max(0, Math.sin(t * Math.PI * 0.8)) ** 10;
    const thump = Math.sin(2 * Math.PI * 46 * t) * pulse * 0.024;
    left[i] += thump;
    right[i] += thump;
  }

  const delay = Math.floor(sr * 0.34);
  for (let i = samples - 1; i >= delay; i -= 1) {
    left[i] += right[i - delay] * 0.26;
    right[i] += left[i - delay] * 0.26;
  }

  applyLoopCrossfade(left, right, Math.floor(sr * 3));
  normalizeStereo(left, right, 0.8);
  return { left, right };
}

mkdirSync(OUT_DIR, { recursive: true });
const samples = Math.floor(SAMPLE_RATE * DURATION_SEC);

function renderDayMusic(samples, sr, rand) {
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);
  renderPadPass(
    left,
    right,
    samples,
    sr,
    [
      [48, 55, 60, 67],
      [53, 60, 65, 72],
      [50, 57, 62, 69],
      [47, 55, 62, 71],
    ],
    6,
    0.052,
    0.42,
    rand,
    false,
  );
  const phrases = [
    [72, 74, 76, 79, 76, 74],
    [79, 81, 79, 76, 74, 72],
    [67, 69, 72, 74, 72, 69],
    [76, 74, 72, 69, 71, 72],
  ];
  const noteDur = Math.floor(sr * 0.85);
  let phraseIdx = 0;
  let noteIdx = 0;
  for (let step = 0; step < Math.floor(samples / noteDur); step += 1) {
    const phrase = phrases[phraseIdx % phrases.length];
    if (noteIdx >= phrase.length) {
      phraseIdx += 1;
      noteIdx = 0;
      if (rand() < 0.45) continue;
    }
    if (rand() < 0.12) {
      noteIdx += 1;
      continue;
    }
    const midi = phrase[noteIdx];
    noteIdx += 1;
    const start = step * noteDur + Math.floor(rand() * sr * 0.05);
    const dur = Math.floor(sr * lerp(0.6, 1.05, rand()));
    let phase = 0;
    const inc = (2 * Math.PI * midiToHz(midi)) / sr;
    const pan = 0.38 + rand() * 0.24;
    for (let i = 0; i < dur && start + i < samples; i += 1) {
      const e = envADSR(i / sr, dur / sr, 0.05, 0.16, 0.58, 0.32);
      const vib = 1 + 0.0035 * Math.sin((i / sr) * 5.2);
      phase += inc * vib;
      const s = fluteVoice(phase) * e * 0.068;
      left[start + i] += s * (1 - pan);
      right[start + i] += s * pan;
    }
  }
  const delay = Math.floor(sr * 0.16);
  for (let i = samples - 1; i >= delay; i -= 1) {
    left[i] += right[i - delay] * 0.14;
    right[i] += left[i - delay] * 0.14;
  }
  applyLoopCrossfade(left, right, Math.floor(sr * 2.4));
  normalizeStereo(left, right, 0.76);
  return { left, right };
}

function renderStreamEnv(samples, sr, rand) {
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);
  let slow = 0;
  let mid = 0;
  let sparkle = 0;
  for (let i = 0; i < samples; i += 1) {
    const t = i / sr;
    const white = rand() * 2 - 1;
    slow = slow * 0.9985 + white * 0.0015;
    mid = mid * 0.985 + white * 0.015;
    sparkle = sparkle * 0.92 + white * 0.08;
    const flow =
      0.5 +
      0.35 * Math.sin(t * 0.31) +
      0.15 * Math.sin(t * 0.79 + 1.7);
    const water = (slow * 0.55 + mid * 0.35 + sparkle * 0.12) * 0.2 * flow;
    const pan = 0.5 + 0.2 * Math.sin(t * 0.19);
    left[i] += water * (1 - pan);
    right[i] += water * pan;
  }
  applyLoopCrossfade(left, right, Math.floor(sr * 2.4));
  normalizeStereo(left, right, 0.55);
  return { left, right };
}

function renderBirdsEnv(samples, sr, rand) {
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);
  const birdMotifs = [
    [
      [0, 2800, 3400, 0.07],
      [0.09, 3200, 2600, 0.06],
    ],
    [[0, 2100, 3900, 0.1]],
    [
      [0, 3600, 4100, 0.05],
      [0.07, 4000, 3000, 0.08],
      [0.17, 3300, 3700, 0.05],
    ],
    [
      [0, 1800, 2400, 0.08],
      [0.1, 2400, 1900, 0.07],
    ],
  ];
  for (let b = 0; b < 28; b += 1) {
    const start = Math.floor(rand() * (samples - sr));
    const motif = birdMotifs[Math.floor(rand() * birdMotifs.length)];
    const pan = rand();
    const amp = lerp(0.04, 0.085, rand());
    for (const [offsetSec, f0, f1, lenSec] of motif) {
      const localStart = start + Math.floor(offsetSec * sr);
      const len = Math.floor(lenSec * sr);
      let phase = 0;
      for (let i = 0; i < len && localStart + i < samples; i += 1) {
        const u = i / len;
        const freq = lerp(f0, f1, u * u);
        phase += (2 * Math.PI * freq) / sr;
        const env = Math.sin(Math.PI * u) ** 1.35;
        const grain = (rand() * 2 - 1) * 0.05 * (1 - u);
        const s = (Math.sin(phase) * 0.9 + grain) * env * amp;
        left[localStart + i] += s * (1 - pan);
        right[localStart + i] += s * pan;
      }
    }
  }
  applyLoopCrossfade(left, right, Math.floor(sr * 2.4));
  normalizeStereo(left, right, 0.65);
  return { left, right };
}

function renderNightMusic(samples, sr, rand) {
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);
  let brown = 0;
  let air = 0;
  for (let i = 0; i < samples; i += 1) {
    const t = i / sr;
    const white = rand() * 2 - 1;
    brown = clamp(brown + white * 0.018, -1, 1);
    air = air * 0.975 + brown * 0.025;
    const gust =
      0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.15 + Math.sin(t * 0.06) * 1.4));
    const wind = air * 0.15 * gust;
    const pan = 0.5 + 0.28 * Math.sin(t * 0.08);
    left[i] += wind * (1 - pan);
    right[i] += wind * pan;
  }
  renderPadPass(
    left,
    right,
    samples,
    sr,
    [
      [38, 45, 50, 57],
      [34, 41, 46, 53],
      [33, 40, 45, 52],
      [35, 42, 47, 54],
    ],
    7.5,
    0.068,
    0.25,
    rand,
    true,
  );
  const motif = [57, 60, 58, 53, 50, 57, 55, 48, 50, 45];
  const beat = Math.floor(sr * 1.4);
  for (let step = 0; step < Math.floor(samples / beat); step += 1) {
    if (rand() < 0.38) continue;
    const midi = motif[step % motif.length];
    const start = step * beat + Math.floor(rand() * sr * 0.18);
    const dur = Math.floor(sr * lerp(1.1, 2.3, rand()));
    let phase = 0;
    const inc = (2 * Math.PI * midiToHz(midi)) / sr;
    const pan = 0.22 + rand() * 0.56;
    for (let i = 0; i < dur && start + i < samples; i += 1) {
      const e = envADSR(i / sr, dur / sr, 0.28, 0.45, 0.38, 0.75);
      const vib = 1 + 0.007 * Math.sin((i / sr) * 2.8);
      phase += inc * vib;
      const tone =
        Math.sin(phase) * 0.5 +
        Math.sin(phase * 2.01) * 0.22 +
        Math.sin(phase * 3.02) * 0.12;
      const s = tone * e * 0.05;
      left[start + i] += s * (1 - pan);
      right[start + i] += s * pan;
    }
  }
  const delay = Math.floor(sr * 0.34);
  for (let i = samples - 1; i >= delay; i -= 1) {
    left[i] += right[i - delay] * 0.26;
    right[i] += left[i - delay] * 0.26;
  }
  applyLoopCrossfade(left, right, Math.floor(sr * 3));
  normalizeStereo(left, right, 0.8);
  return { left, right };
}

function renderCrowEnv(samples, sr, rand) {
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);
  for (let c = 0; c < 10; c += 1) {
    const start = Math.floor(sr * (2.5 + rand() * (DURATION_SEC - 7)));
    const syllables = 1 + Math.floor(rand() * 3);
    let cursor = start;
    const pan = clamp(0.15 + rand() * 0.7, 0, 1);
    for (let s = 0; s < syllables; s += 1) {
      const len = Math.floor(sr * lerp(0.2, 0.42, rand()));
      const f0 = lerp(420, 680, rand());
      const f1 = f0 * lerp(0.52, 0.72, rand());
      let phase1 = 0;
      let phase2 = 0;
      let noise = 0;
      for (let i = 0; i < len && cursor + i < samples; i += 1) {
        const u = i / len;
        const freq = lerp(f0, f1, u ** 0.65);
        phase1 += (2 * Math.PI * freq) / sr;
        phase2 += (2 * Math.PI * freq * 1.85) / sr;
        noise = noise * 0.88 + (rand() * 2 - 1) * 0.12;
        const carrier =
          Math.sin(phase1) * 0.55 + Math.sin(phase2) * 0.28 + noise * 0.45;
        const rasp = carrier * (0.5 + 0.5 * Math.abs(Math.sin(phase1 * 0.5)));
        const env = Math.sin(Math.PI * Math.min(1, u * 1.12)) ** 1.05;
        const sample = rasp * env * 0.11;
        left[cursor + i] += sample * (1 - pan);
        right[cursor + i] += sample * pan;
      }
      cursor += len + Math.floor(sr * lerp(0.06, 0.18, rand()));
    }
  }
  applyLoopCrossfade(left, right, Math.floor(sr * 3));
  normalizeStereo(left, right, 0.7);
  return { left, right };
}

function renderRainEnv(samples, sr, rand) {
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);
  let noiseL = 0;
  let noiseR = 0;
  for (let i = 0; i < samples; i += 1) {
    const t = i / sr;
    const white = rand() * 2 - 1;
    noiseL = noiseL * 0.96 + white * 0.04;
    noiseR = noiseR * 0.965 + white * 0.035;
    const drip = 0.85 + 0.15 * Math.sin(t * 2.1 + Math.sin(t * 0.37) * 2.8);
    const pan = 0.48 + 0.12 * Math.sin(t * 0.23);
    left[i] = noiseL * 0.14 * drip * (1 - pan);
    right[i] = noiseR * 0.14 * drip * pan;
  }
  applyLoopCrossfade(left, right, Math.floor(sr * 2.5));
  normalizeStereo(left, right, 0.62);
  return { left, right };
}

function renderGunshotSfx(sr, rand) {
  const duration = 0.38;
  const samples = Math.floor(sr * duration);
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const t = i / sr;
    const env = Math.exp(-t * 14);
    const noise = (rand() * 2 - 1) * env;
    const thump = Math.sin(2 * Math.PI * lerp(140, 48, t / duration) * t) * env * 0.55;
    const s = noise * 0.75 + thump;
    left[i] = s;
    right[i] = s * 0.92;
  }
  normalizeStereo(left, right, 0.9);
  return { left, right };
}

function renderShutterSfx(sr) {
  const duration = 0.22;
  const samples = Math.floor(sr * duration);
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);
  [0, 0.09].forEach((offsetSec) => {
    const start = Math.floor(offsetSec * sr);
    const len = Math.floor(0.07 * sr);
    for (let i = 0; i < len && start + i < samples; i += 1) {
      const env = Math.exp(-i / (sr * 0.025));
      const click = Math.sin((i / sr) * 18000 * Math.PI * 2) * env;
      left[start + i] += click * 0.35;
      right[start + i] += click * 0.32;
    }
  });
  normalizeStereo(left, right, 0.85);
  return { left, right };
}

function renderRustleSfx(sr, rand) {
  const duration = 0.55;
  const samples = Math.floor(sr * duration);
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);
  let noiseL = 0;
  let noiseR = 0;
  for (let i = 0; i < samples; i += 1) {
    const u = i / samples;
    const env = Math.sin(Math.PI * u) ** 0.75;
    const white = rand() * 2 - 1;
    noiseL = noiseL * 0.9 + white * 0.1;
    noiseR = noiseR * 0.88 + white * 0.12;
    left[i] = noiseL * env * 0.22;
    right[i] = noiseR * env * 0.2;
  }
  normalizeStereo(left, right, 0.8);
  return { left, right };
}

console.log('Generating day BGM (music)…');
const dayMusic = renderDayMusic(samples, SAMPLE_RATE, mulberry32(0xda42));
writeWavStereo(join(OUT_DIR, 'bgm-day.wav'), dayMusic.left, dayMusic.right, SAMPLE_RATE);

console.log('Generating night BGM (music)…');
const nightMusic = renderNightMusic(samples, SAMPLE_RATE, mulberry32(0x71a8));
writeWavStereo(join(OUT_DIR, 'bgm-night.wav'), nightMusic.left, nightMusic.right, SAMPLE_RATE);

console.log('Generating environment loops…');
const stream = renderStreamEnv(samples, SAMPLE_RATE, mulberry32(0x51f2));
writeWavStereo(join(OUT_DIR, 'env-stream.wav'), stream.left, stream.right, SAMPLE_RATE);
const birds = renderBirdsEnv(samples, SAMPLE_RATE, mulberry32(0x9a11));
writeWavStereo(join(OUT_DIR, 'env-birds.wav'), birds.left, birds.right, SAMPLE_RATE);
const crow = renderCrowEnv(samples, SAMPLE_RATE, mulberry32(0xcc90));
writeWavStereo(join(OUT_DIR, 'env-crow.wav'), crow.left, crow.right, SAMPLE_RATE);
const rain = renderRainEnv(samples, SAMPLE_RATE, mulberry32(0x2f4a));
writeWavStereo(join(OUT_DIR, 'env-rain.wav'), rain.left, rain.right, SAMPLE_RATE);

console.log('Generating one-shot SFX…');
const gun = renderGunshotSfx(SAMPLE_RATE, mulberry32(0xb007));
writeWavStereo(join(OUT_DIR, 'gunshot.wav'), gun.left, gun.right, SAMPLE_RATE);
const shutter = renderShutterSfx(SAMPLE_RATE);
writeWavStereo(join(OUT_DIR, 'camera-shutter.wav'), shutter.left, shutter.right, SAMPLE_RATE);
const rustle = renderRustleSfx(SAMPLE_RATE, mulberry32(0x705176));
writeWavStereo(join(OUT_DIR, 'newspaper-rustle.wav'), rustle.left, rustle.right, SAMPLE_RATE);

console.log('Generating legacy full-mix loops…');
console.log('Generating legacy full-mix loops…');
const day = renderDayLoop(samples, SAMPLE_RATE, mulberry32(0xda42));
writeWavStereo(join(OUT_DIR, 'bgm-day-full.wav'), day.left, day.right, SAMPLE_RATE);

console.log('Generating night full-mix…');
const night = renderNightLoop(samples, SAMPLE_RATE, mulberry32(0x71a8));
writeWavStereo(join(OUT_DIR, 'bgm-night-full.wav'), night.left, night.right, SAMPLE_RATE);

console.log('Done.');
