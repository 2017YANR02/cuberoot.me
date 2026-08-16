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
const sourceFiles = import.meta.glob('../src/**/*.{ts,wxml}', {
  eager: true,
  import: 'default',
  query: '?raw',
});

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

  it('keeps web-backed pages on the shared controller', () => {
    const timerPage = pageFiles['../src/pages/timer/index.ts'];
    const genericWebPage = pageFiles['../src/pages/web/index.ts'];

    expect(timerPage).toContain("createWebViewPageOptions('timer')");
    expect(genericWebPage).toContain('createWebViewPageOptions()');
    expect(timerPage).not.toMatch(/timer-store|setInterval|setTimeout/);
  });

  it('does not carry an abandoned native timer implementation', () => {
    expect(sourceFiles['../src/lib/timer-store.ts']).toBeUndefined();
    for (const [path, source] of Object.entries(sourceFiles)) {
      expect(source, path).not.toMatch(/@cuberoot\/shared\/timer/);
    }
  });

  it('keeps website addresses out of page adapters and templates', () => {
    for (const [path, source] of Object.entries(pageFiles)) {
      if (!/\.(?:ts|wxml)$/.test(path)) continue;
      expect(source, path).not.toMatch(/https?:\/\/|cuberoot\.me|\/zh\//);
    }
  });
});
