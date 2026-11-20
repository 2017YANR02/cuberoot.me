import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** Same 4:3 flag-icons art and WCA Chinese Taipei SVG as the React renderer. */
export async function countryFlagBuildAssets() {
  const packageUrl = import.meta.resolve('flag-icons/package.json');
  const directory = new URL('./flags/4x3/', packageUrl);
  const license = fileURLToPath(new URL('./LICENSE', packageUrl));
  const flags = (await readdir(directory)).filter(name => /^[a-z]{2}\.svg$/.test(name)).sort().map(name => ({
    code: name.slice(0, 2),
    path: fileURLToPath(name === 'tw.svg' ? new URL('./assets/ChineseTaipei.svg', import.meta.url) : new URL(name, directory)),
  }));
  return { flags, license };
}
