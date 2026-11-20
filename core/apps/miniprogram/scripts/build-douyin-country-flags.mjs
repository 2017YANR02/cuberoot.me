import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countryFlagBuildAssets } from '@cuberoot/timer-ui/country-flag-assets';
import sharp from 'sharp';

export async function buildDouyinCountryFlags(outputRoot) {
  const { flags, license } = await countryFlagBuildAssets();
  const directory = join(outputRoot, 'assets', 'country-flags');
  await mkdir(directory, { recursive: true });
  await Promise.all([
    copyFile(license, join(directory, 'LICENSE.txt')),
    ...flags.map(({ code, path }) => sharp(path).resize(40, 30).png({ palette: true }).toFile(join(directory, `${code}.png`))),
  ]);
  return [fileURLToPath(import.meta.resolve('@cuberoot/timer-ui/country-flag-assets')), license, ...flags.map(flag => flag.path)];
}
