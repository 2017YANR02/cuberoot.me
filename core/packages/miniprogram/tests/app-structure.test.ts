import { describe, expect, it } from 'vitest';

import appConfig from '../src/app.json';
import sitemapConfig from '../src/sitemap.json';
import themeConfig from '../src/theme.json';

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
const sourceFiles = import.meta.glob('../src/**/*.{ts,wxml,wxss}', {
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

  it('keeps native chrome synchronized with the system color scheme', () => {
    expect(appConfig.darkmode).toBe(true);
    expect(appConfig.themeLocation).toBe('theme.json');
    expect(themeConfig).toEqual({
      light: {
        backgroundColor: '#fafafa',
        backgroundTextStyle: 'dark',
        navigationBarBackgroundColor: '#fafafa',
        navigationBarTextStyle: 'black',
        tabBarColor: '#737373',
        tabBarSelectedColor: '#c15f3c',
        tabBarBackgroundColor: '#fafafa',
        tabBarBorderStyle: 'white',
      },
      dark: {
        backgroundColor: '#111111',
        backgroundTextStyle: 'light',
        navigationBarBackgroundColor: '#111111',
        navigationBarTextStyle: 'white',
        tabBarColor: '#a3a3a3',
        tabBarSelectedColor: '#d47a58',
        tabBarBackgroundColor: '#111111',
        tabBarBorderStyle: 'black',
      },
    });
    expect(appConfig.window).toMatchObject({
      backgroundColor: '@backgroundColor',
      backgroundTextStyle: '@backgroundTextStyle',
      navigationBarBackgroundColor: '@navigationBarBackgroundColor',
      navigationBarTextStyle: '@navigationBarTextStyle',
    });
    expect(appConfig.tabBar).toMatchObject({
      color: '@tabBarColor',
      selectedColor: '@tabBarSelectedColor',
      backgroundColor: '@tabBarBackgroundColor',
      borderStyle: '@tabBarBorderStyle',
    });
  });

  it('only exposes public entry pages to WeChat search', () => {
    const publicIndexedPages = ['pages/timer/index', 'pages/tools/index'];

    expect(sitemapConfig.rules).toEqual([
      ...publicIndexedPages.map((page) => ({ action: 'allow', page })),
      { action: 'disallow', page: '*' },
    ]);
    expect(publicIndexedPages).toEqual(
      expect.arrayContaining(appConfig.tabBar.list.slice(0, 2).map((item) => item.pagePath)),
    );
    expect(publicIndexedPages).not.toContain('pages/account/index');
    expect(publicIndexedPages).not.toContain('pages/web/index');
  });

  it('keeps web-backed pages on the shared controller', () => {
    const timerPage = pageFiles['../src/pages/timer/index.ts'];
    const genericWebPage = pageFiles['../src/pages/web/index.ts'];
    const timerTemplate = pageFiles['../src/pages/timer/index.wxml'];
    const genericWebTemplate = pageFiles['../src/pages/web/index.wxml'];
    const sharedTemplate = sourceFiles['../src/templates/web-route-view.wxml'];

    expect(timerPage).toContain("createWebViewPageOptions('timer')");
    expect(genericWebPage).toContain('createWebViewPageOptions()');
    expect(timerPage).not.toMatch(/timer-store|setInterval|setTimeout/);
    expect(timerTemplate).toContain('templates/web-route-view.wxml');
    expect(genericWebTemplate).toContain('templates/web-route-view.wxml');
    expect(sharedTemplate).toContain('<web-view');
    expect(timerTemplate).not.toContain('<web-view');
    expect(genericWebTemplate).not.toContain('<web-view');
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

  it('opens internal web pages only through the shared navigation helper', () => {
    for (const [path, source] of Object.entries(sourceFiles)) {
      if (!path.endsWith('.ts') || path.endsWith('/lib/navigation.ts')) continue;
      expect(source, path).not.toMatch(/wx\.navigateTo\s*\(/);
    }
  });

  it('uses one visible press state for every native button', () => {
    for (const [path, source] of Object.entries(sourceFiles)) {
      if (!path.endsWith('.wxml')) continue;
      for (const button of source.match(/<button\b[\s\S]*?>/g) ?? []) {
        expect(button, path).toContain('hover-class="press-feedback"');
      }
    }
  });

  it('gives navigation rows a readable name without exposing decorative glyphs', () => {
    const toolsTemplate = pageFiles['../src/pages/tools/index.wxml'];
    const accountTemplate = pageFiles['../src/pages/account/index.wxml'];
    const sharedTemplate = sourceFiles['../src/templates/web-route-view.wxml'];

    expect(toolsTemplate).toContain('aria-label="{{item.title}}，{{item.description}}"');
    expect(toolsTemplate).toMatch(/class="tool-arrow"\s+aria-hidden="true"/);
    expect(accountTemplate).toMatch(/class="identity-mark"\s+aria-hidden="true"/);
    expect(accountTemplate).toMatch(/class="account-sync-dot"\s+aria-hidden="true"/);
    expect(accountTemplate).toMatch(/class="account-link-arrow"\s+aria-hidden="true"/);
    expect(sharedTemplate).toMatch(/class="web-status-spinner"[^>]*aria-hidden="true"/);
  });

  it('keeps shared native buttons large enough for touch', () => {
    const appStyles = sourceFiles['../src/app.wxss'];

    expect(appStyles).toMatch(/\.primary-button\s*\{[\s\S]*?min-height:\s*88rpx;/);
    expect(appStyles).toMatch(/\.text-button\s*\{[\s\S]*?min-height:\s*88rpx;/);
  });

  it('lets long tool labels shrink without colliding with their arrow', () => {
    const toolStyles = pageFiles['../src/pages/tools/index.wxss'];

    expect(toolStyles).toMatch(/\.tool-copy\s*\{[\s\S]*?flex:\s*1;/);
    expect(toolStyles).toMatch(/\.tool-copy\s*\{[\s\S]*?min-width:\s*0;/);
    expect(toolStyles).not.toMatch(/\.tool-row\s*\{[\s\S]*?justify-content:\s*space-between;/);
  });
});
