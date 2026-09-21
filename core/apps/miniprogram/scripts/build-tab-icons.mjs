import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const iconsByPage = new Map([
  ['pages/timer/index', 'timer'],
  ['pages/tools/index', 'layout-grid'],
  ['pages/account/index', 'user-round'],
]);

/** Native Douyin tabs use local PNGs; reuse Lucide artwork and the resolved tab theme. */
export async function buildDouyinTabIcons(outputRoot, tabBar) {
  const icons = tabBar.list.map((tab) => {
    const icon = iconsByPage.get(tab.pagePath);
    if (!icon) throw new Error(`Missing Douyin tab icon: ${tab.pagePath}`);
    return icon;
  });
  const directory = join(outputRoot, 'assets', 'tabbar');
  await mkdir(directory, { recursive: true });
  await copyFile(require.resolve('lucide-static/LICENSE'), join(directory, 'LICENSE.txt'));
  return Promise.all(tabBar.list.map(async (tab, index) => {
    const icon = icons[index];
    const svg = await readFile(require.resolve(`lucide-static/icons/${icon}.svg`), 'utf8');
    const iconPath = `assets/tabbar/${icon}.png`;
    const selectedIconPath = `assets/tabbar/${icon}-selected.png`;
    for (const [path, color] of [[iconPath, tabBar.color], [selectedIconPath, tabBar.selectedColor]]) {
      if (!/^#[\da-f]{6}$/i.test(color)) throw new Error(`Invalid resolved tab color: ${color}`);
      await sharp(Buffer.from(svg.replaceAll('currentColor', color)), { density: 243 })
        .resize(81, 81).png().toFile(join(outputRoot, path));
    }
    return { ...tab, iconPath, selectedIconPath };
  }));
}
