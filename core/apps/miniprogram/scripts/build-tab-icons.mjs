import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const projectIconSources = [
  ['event', '333.svg', ''],
  ['unofficial', 'ivy.svg', 'unofficial-'],
  ['puzzle', 'sphere.svg', 'puzzle-'],
].flatMap(([kind, sample, prefix]) => {
  const directory = dirname(require.resolve(`@cuberoot/event-icon/svg/${kind}/${sample}`));
  return readdirSync(directory).filter(filename => filename.endsWith('.svg')).map(filename => ({
    name: `${prefix}${basename(filename, '.svg')}`,
    path: require.resolve(`@cuberoot/event-icon/svg/${kind}/${filename}`),
  }));
});
export const TIMER_PROJECT_ICONS = projectIconSources.map(({ path }) => path);
const iconsByPage = new Map([
  ['pages/timer/index', 'clock-3'],
  ['pages/tools/index', 'grid-2x2'],
  ['pages/training/index', 'graduation-cap'],
  ['pages/account/index', 'user-round'],
]);

/** Both native tab bars use local PNGs generated from the same Lucide artwork. */
export async function buildTabIcons(outputRoot, tabBar, suffix = '') {
  const directory = join(outputRoot, 'assets', 'tabbar');
  await mkdir(directory, { recursive: true });
  await copyFile(require.resolve('lucide-static/LICENSE'), join(directory, 'LICENSE.txt'));
  return Promise.all(tabBar.list.map(async (tab) => {
    const icon = iconsByPage.get(tab.pagePath);
    if (!icon) throw new Error(`Missing tab icon: ${tab.pagePath}`);
    const svg = await readFile(require.resolve(`lucide-static/icons/${icon}.svg`), 'utf8');
    const iconPath = `assets/tabbar/${icon}${suffix}.png`;
    const selectedIconPath = `assets/tabbar/${icon}${suffix}-selected.png`;
    for (const [path, color] of [[iconPath, tabBar.color], [selectedIconPath, tabBar.selectedColor]]) {
      if (!/^#[\da-f]{6}$/i.test(color)) throw new Error(`Invalid resolved tab color: ${color}`);
      await sharp(Buffer.from(svg.replaceAll('currentColor', color)), { density: 243 })
        .resize(81, 81).png().toFile(join(outputRoot, path));
    }
    return { ...tab, iconPath, selectedIconPath };
  }));
}

export async function buildDouyinTimerIcons(outputRoot, selectedColor) {
  const directory = join(outputRoot, 'assets', 'tabbar');
  if (!/^#[\da-f]{6}$/i.test(selectedColor)) throw new Error('Invalid resolved icon color');
  await Promise.all(projectIconSources.map(async ({ name, path }) => {
    const svg = await readFile(path, 'utf8');
    const tinted = svg.replaceAll('currentColor', selectedColor).replace(/<svg\b([^>]*)>/, (tag, attributes) => (
      /\sfill\s*=/.test(attributes) ? tag : `<svg fill="${selectedColor}"${attributes}>`
    ));
    await sharp(Buffer.from(tinted)).resize(81, 81).png().toFile(join(directory, `project-${name}.png`));
  }));
  const toolbarColors = { bluetooth: '#0082fc', 'chevron-left': selectedColor, 'chevron-right': selectedColor };
  for (const icon of ['settings', 'lightbulb', 'layout-template', 'grip-horizontal', 'move-diagonal-2', 'rotate-ccw', 'check',
    'layout-dashboard', 'calendar-days', 'bar-chart-3', 'layers', 'x', 'chevron-left', 'chevron-right', 'chevron-down', 'bluetooth', 'timer', 'mic', 'arrow-left', 'arrow-right', 'pencil', 'sliders-horizontal', 'skip-back', 'skip-forward', 'play', 'pause',
    'dices', 'trophy', 'palette', 'volume-2', 'database', 'keyboard', 'download', 'info', 'circle-help', 'copy', 'target', 'circle-check', 'flame', 'arrow-right-left',
    'search', 'ellipsis', 'refresh-cw', 'loader-circle']) {
    toolbarColors[`${icon}-light`] = '#171717';
    toolbarColors[`${icon}-dark`] = '#f5f5f5';
  }
  for (const [name, color] of Object.entries(toolbarColors)) {
    const icon = name.replace(/-(light|dark)$/, '');
    const svg = await readFile(require.resolve(`lucide-static/icons/${icon}.svg`), 'utf8');
    await sharp(Buffer.from(svg.replaceAll('currentColor', color)), { density: 243 })
      .resize(81, 81).png().toFile(join(directory, `${name}.png`));
  }
}
