import { describe, expect, it } from 'vitest';

import appConfig from '../src/app.json';

declare global {
  interface ImportMeta {
    glob(
      pattern: string,
      options: { eager: true; import: 'default'; query: '?raw' },
    ): Record<string, string>;
  }
}

const pageFiles = import.meta.glob('../src/pages/**/*.{ts,json,wxml,wxss}', {
  eager: true,
  import: 'default',
  query: '?raw',
});
const pageFilePaths = new Set(Object.keys(pageFiles));

describe('mini program app structure', () => {
  it('keeps every declared page complete', () => {
    expect(appConfig.pages.length).toBeGreaterThan(0);
    for (const pagePath of appConfig.pages) {
      for (const extension of ['.ts', '.json', '.wxml', '.wxss']) {
        expect(pageFilePaths.has(`../src/${pagePath}${extension}`)).toBe(true);
      }
    }
  });

  it('only points tab bar entries at declared pages', () => {
    const pagePaths = new Set(appConfig.pages);

    for (const item of appConfig.tabBar?.list ?? []) {
      expect(item.text.trim()).not.toBe('');
      expect(pagePaths.has(item.pagePath)).toBe(true);
    }
  });
});
