import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { buildDouyinTabIcons } from '../scripts/build-tab-icons.mjs';

const directories = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixture() {
  const parent = resolve(import.meta.dirname, '../../../../.tmp/png');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(join(parent, 'douyin-tab-icons-'));
  directories.push(directory);
  return directory;
}

describe('Douyin native tab assets', () => {
  it('generates all six local PNGs using the source tabs and existing theme', async () => {
    const directory = await fixture();
    const config = JSON.parse(await readFile(new URL('../src/app.json', import.meta.url), 'utf8'));
    const theme = JSON.parse(await readFile(new URL('../src/theme.json', import.meta.url), 'utf8'));
    const original = structuredClone(config.tabBar);
    const tabs = await buildDouyinTabIcons(directory, {
      ...config.tabBar, color: theme.light.tabBarColor, selectedColor: theme.light.tabBarSelectedColor,
    });
    expect(config.tabBar).toEqual(original);
    expect(tabs).toHaveLength(3);
    const paths = new Set();
    for (const [index, tab] of tabs.entries()) {
      expect(tab).toMatchObject(original.list[index]);
      const buffers = [];
      for (const path of [tab.iconPath, tab.selectedIconPath]) {
        expect(path).toMatch(/^assets\/tabbar\/[a-z-]+\.png$/);
        paths.add(path);
        const buffer = await readFile(join(directory, path));
        buffers.push(buffer);
        expect(buffer.length).toBeLessThan(40 * 1024);
        expect(await sharp(buffer).metadata()).toMatchObject({ format: 'png', width: 81, height: 81, hasAlpha: true });
        const { channels } = await sharp(buffer).stats();
        expect(channels[3].max).toBeGreaterThan(0);
        expect(channels[3].min).toBe(0);
      }
      expect(buffers[0].equals(buffers[1])).toBe(false);
    }
    expect(paths.size).toBe(6);
    expect(await readFile(join(directory, 'assets/tabbar/LICENSE.txt'), 'utf8')).toContain('ISC');
  });

  it('fails the build for an unmapped tab instead of shipping a broken icon', async () => {
    await expect(buildDouyinTabIcons(await fixture(), { list: [{ pagePath: 'pages/new/index' }] }))
      .rejects.toThrow('Missing Douyin tab icon');
  });
});
