// Generate Android launcher and splash assets from the website's existing
// CubeRoot icon set. The brand SVG remains the single source of truth; run the
// client icon generator first after changing it.
//
//   pnpm --filter @cuberoot/mobile assets:android

import { mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE = join(HERE, '..', '..', '..');
const BRAND_ICONS = join(HERE, '..', '..', 'client', 'public', 'icons');
const RES = join(HERE, '..', 'android', 'app', 'src', 'main', 'res');

function loadSharp() {
  const req = createRequire(join(CORE, 'noop.js'));
  try { return req('sharp'); } catch { /* Fall through to the pnpm store. */ }
  const store = join(CORE, 'node_modules', '.pnpm');
  const directory = readdirSync(store).find((entry) => /^sharp@/.test(entry));
  if (!directory) throw new Error('sharp is unavailable; run pnpm install in core');
  return req(join(store, directory, 'node_modules', 'sharp'));
}

const sharp = loadSharp();
const regularIcon = join(BRAND_ICONS, 'icon-512.png');
const safeIcon = join(BRAND_ICONS, 'icon-maskable-512.png');
const lightMark = join(BRAND_ICONS, 'CubeRoot-mark.svg');
const darkMark = join(BRAND_ICONS, 'CubeRoot-mark-dark.svg');

const densities = {
  mdpi: 1,
  hdpi: 1.5,
  xhdpi: 2,
  xxhdpi: 3,
  xxxhdpi: 4,
};

for (const [density, scale] of Object.entries(densities)) {
  const directory = join(RES, `mipmap-${density}`);
  const launcherSize = Math.round(48 * scale);
  const foregroundSize = Math.round(108 * scale);

  await sharp(regularIcon).resize(launcherSize, launcherSize).png().toFile(join(directory, 'ic_launcher.png'));
  await sharp(safeIcon).resize(launcherSize, launcherSize).png().toFile(join(directory, 'ic_launcher_round.png'));
  await sharp(safeIcon).resize(foregroundSize, foregroundSize).png().toFile(join(directory, 'ic_launcher_foreground.png'));
}

// Android's system splash expects a 288dp canvas with artwork inside the
// central 192dp safe circle. An unqualified drawable is treated as mdpi and
// scaled by Android, so one generated bitmap per theme is sufficient.
for (const [directoryName, source] of [['drawable', lightMark], ['drawable-night', darkMark]]) {
  const directory = join(RES, directoryName);
  mkdirSync(directory, { recursive: true });
  const art = await sharp(source, { density: 512 })
    .resize({ width: 192, height: 192, fit: 'contain' })
    .png()
    .toBuffer();
  await sharp({ create: { width: 288, height: 288, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: art, left: 48, top: 48 }])
    .png()
    .toFile(join(directory, 'splash_icon.png'));
}

console.log('Generated CubeRoot Android launcher and system splash assets.');
