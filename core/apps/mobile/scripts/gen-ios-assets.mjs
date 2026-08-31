// Generate the iOS App Icon and light/dark launch images from CubeRoot's
// canonical brand SVG. Keep native image catalogs generated, not hand-edited.
//
//   pnpm --filter @cuberoot/mobile assets:ios

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

await import('../../../scripts/gen-brand-assets.mjs');

const HERE = dirname(fileURLToPath(import.meta.url));
const BRAND_ASSETS = join(HERE, '..', '..', '..', 'assets', 'brand');
const IOS_ASSETS = join(HERE, '..', 'ios', 'App', 'App', 'Assets.xcassets');
const APP_ICON = join(IOS_ASSETS, 'AppIcon.appiconset', 'AppIcon-512@2x.png');
const SPLASH_SET = join(IOS_ASSETS, 'Splash.imageset');

const LIGHT_BACKGROUND = '#faf9f7';
const DARK_BACKGROUND = '#181716';
const DARK_FOREGROUND = '#f0eeeb';
const SPLASH_SIZE = 2732;
const SPLASH_MARK_WIDTH = 900;

const brandMark = readFileSync(join(BRAND_ASSETS, 'CubeRoot-mark.svg'), 'utf8');
const darkBrandMark = brandMark.replaceAll('#3f3f3f', DARK_FOREGROUND);

// App Store icons must be opaque. The canonical Web/PWA icon already applies
// the same white field and 7% brand-safe inset, so iOS only scales that source.
await sharp(join(BRAND_ASSETS, 'icon-512.png'))
  .resize(1024, 1024)
  .flatten({ background: '#ffffff' })
  .png({ compressionLevel: 9 })
  .toFile(APP_ICON);

async function renderSplash(source, background, output) {
  const mark = await sharp(Buffer.from(source), { density: 512 })
    .resize({ width: SPLASH_MARK_WIDTH, fit: 'inside' })
    .png()
    .toBuffer();
  const metadata = await sharp(mark).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width === 0 || height === 0) throw new Error('Could not size CubeRoot launch mark');

  await sharp({
    create: {
      width: SPLASH_SIZE,
      height: SPLASH_SIZE,
      channels: 3,
      background,
    },
  })
    .composite([{
      input: mark,
      left: Math.round((SPLASH_SIZE - width) / 2),
      top: Math.round((SPLASH_SIZE - height) / 2),
    }])
    .png({ compressionLevel: 9 })
    .toFile(output);
}

for (const suffix of ['-2', '-1', '']) {
  await renderSplash(
    brandMark,
    LIGHT_BACKGROUND,
    join(SPLASH_SET, `splash-2732x2732${suffix}.png`),
  );
  await renderSplash(
    darkBrandMark,
    DARK_BACKGROUND,
    join(SPLASH_SET, `splash-dark-2732x2732${suffix}.png`),
  );
}

console.log('Generated CubeRoot iOS App Icon and light/dark launch assets.');
