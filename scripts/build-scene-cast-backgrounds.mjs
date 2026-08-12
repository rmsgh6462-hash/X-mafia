import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const backgroundDir = path.join(root, 'public', 'backgrounds');
const castDir = path.join(root, 'public', 'images', 'scene-cast');

const outputSize = { width: 1536, height: 1024 };

async function loadBackground(name) {
  return sharp(path.join(backgroundDir, name))
    .resize(outputSize.width, outputSize.height, { fit: 'cover' })
    .png()
    .toBuffer();
}

async function castImage(name, width, height) {
  return sharp(path.join(castDir, name))
    .resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function buildWaiting() {
  const base = await loadBackground('village-dusk.png');
  const layout = [
    ['mafia.png', -58],
    ['citizen.png', 168],
    ['spiritualist.png', 390],
    ['police.png', 760],
    ['doctor.png', 986],
    ['reporter.png', 1212],
  ];
  const overlays = [];
  for (const [name, left] of layout) {
    overlays.push({
      input: await castImage(name, 330, 540),
      left,
      top: 470,
    });
  }
  await sharp(base)
    .composite(overlays)
    .png({ compressionLevel: 9 })
    .toFile(path.join(backgroundDir, 'village-dusk-cast.png'));
}

async function buildWide(baseName, castName, outputName, castScale = 1) {
  const base = await loadBackground(baseName);
  const castWidth = Math.round(outputSize.width * castScale);
  const castHeight = Math.round(outputSize.height * castScale);
  const cast = await castImage(castName, castWidth, castHeight);
  const left = Math.round((outputSize.width - castWidth) / 2);
  const top = outputSize.height - castHeight;
  await sharp(base)
    .composite([{ input: cast, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(backgroundDir, outputName));
}

await fs.mkdir(backgroundDir, { recursive: true });
await buildWaiting();
await buildWide('village-day.png', 'discussion-citizens.png', 'village-day-cast.png', 0.88);
await buildWide('village-night.png', 'night-mafia-chase.png', 'village-night-cast.png', 0.84);
console.log('Built scene-cast backgrounds in public/backgrounds/.');
