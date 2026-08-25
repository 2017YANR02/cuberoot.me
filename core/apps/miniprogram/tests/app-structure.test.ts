import { describe, expect, it } from 'vitest';

import packageConfig from '../package.json';
import appConfig from '../src/app.json';
import sitemapConfig from '../src/sitemap.json';
import themeConfig from '../src/theme.json';
import {
  EXPECTED_APP_PAGES,
  EXPECTED_TAB_BAR,
  MIN_TEXT_CONTRAST_RATIO,
  PUBLIC_INDEXED_PAGES,
  colorContrastRatio,
} from '../scripts/release-check-lib.mjs';

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
  it('keeps release checks coupled to type and regression verification', () => {
    expect(packageConfig.scripts.verify).toBe('tsc --noEmit && vitest run');
    expect(packageConfig.scripts.check).toContain('pnpm verify');
    expect(packageConfig.scripts['release:check']).toContain('pnpm verify');
  });

  it('keeps every declared page complete', () => {
    expect(appConfig.pages).toEqual(EXPECTED_APP_PAGES);
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

    expect(appConfig.tabBar.list).toEqual(EXPECTED_TAB_BAR);
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
        tabBarSelectedColor: '#a94f31',
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

  it('keeps shared text colors readable and native chrome visually aligned', () => {
    const appStyles = sourceFiles['../src/app.wxss'];
    const pageBlocks = [...appStyles.matchAll(/^\s*page\s*\{([^}]+)\}/gm)]
      .map((match) => match[1]);
    expect(pageBlocks).toHaveLength(2);

    const readToken = (block: string, token: string) => {
      const match = block.match(new RegExp(`--cr-${token}:\\s*(#[0-9a-f]{6})`, 'i'));
      expect(match, `missing --cr-${token}`).not.toBeNull();
      return match?.[1].toLowerCase() ?? '';
    };
    const light = Object.fromEntries(
      ['bg', 'text', 'muted', 'accent', 'accent-soft', 'ready', 'danger']
        .map((token) => [token, readToken(pageBlocks[0], token)]),
    );
    const dark = Object.fromEntries(
      ['bg', 'text', 'muted', 'accent', 'accent-soft', 'ready', 'danger']
        .map((token) => [token, readToken(pageBlocks[1], token)]),
    );

    expect(light.accent).toBe(themeConfig.light.tabBarSelectedColor);
    expect(dark.accent).toBe(themeConfig.dark.tabBarSelectedColor);
    for (const palette of [light, dark]) {
      for (const [foreground, background] of [
        ['text', 'bg'],
        ['muted', 'bg'],
        ['accent', 'bg'],
        ['accent', 'accent-soft'],
        ['ready', 'bg'],
        ['danger', 'bg'],
      ]) {
        expect(
          colorContrastRatio(palette[foreground], palette[background]),
          `${foreground}/${background}`,
        ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST_RATIO);
      }
    }
  });

  it('only exposes public entry pages to WeChat search', () => {
    expect(appConfig.sitemapLocation).toBe('sitemap.json');
    expect(sitemapConfig.rules).toEqual([
      ...PUBLIC_INDEXED_PAGES.map((page) => ({ action: 'allow', page })),
      { action: 'disallow', page: '*' },
    ]);
    expect(PUBLIC_INDEXED_PAGES).toEqual(
      expect.arrayContaining(appConfig.tabBar.list.slice(0, 2).map((item) => item.pagePath)),
    );
    expect(PUBLIC_INDEXED_PAGES).not.toContain('pages/account/index');
    expect(PUBLIC_INDEXED_PAGES).not.toContain('pages/web/index');
  });

  it('keeps web-backed pages on the shared controller', () => {
    const timerPage = pageFiles['../src/pages/timer/index.ts'];
    const genericWebPage = pageFiles['../src/pages/web/index.ts'];
    const timerTemplate = pageFiles['../src/pages/timer/index.wxml'];
    const genericWebTemplate = pageFiles['../src/pages/web/index.wxml'];
    const timerStyles = pageFiles['../src/pages/timer/index.wxss'];
    const genericWebStyles = pageFiles['../src/pages/web/index.wxss'];
    const sharedTemplate = sourceFiles['../src/templates/web-route-view.wxml'];

    expect(timerPage).toContain("createWebViewPageOptions('timer')");
    expect(genericWebPage).toContain('createWebViewPageOptions()');
    expect(timerPage).not.toMatch(/timer-store|setInterval|setTimeout/);
    expect(timerTemplate).toContain('templates/web-route-view.wxml');
    expect(genericWebTemplate).toContain('templates/web-route-view.wxml');
    expect(sharedTemplate).toContain('<web-view');
    expect(sharedTemplate).toContain('data-attempt="{{viewAttempt}}"');
    expect(timerTemplate).not.toContain('<web-view');
    expect(genericWebTemplate).not.toContain('<web-view');
    expect(timerTemplate).toContain('viewAttempt: viewAttempt');
    expect(genericWebTemplate).toContain('viewAttempt: viewAttempt');
    expect(timerTemplate).toBe(genericWebTemplate);
    expect(timerStyles.trim()).toBe('');
    expect(genericWebStyles.trim()).toBe('');
  });

  it('starts smart-cube discovery on page load without a second search action', () => {
    const page = pageFiles['../src/pages/smart-cube/index.ts'];
    const template = pageFiles['../src/pages/smart-cube/index.wxml'];

    expect(page).toContain('void startConnection(page);');
    expect(page).toContain('else await smartCubeSession.connectAutomatically();');
    expect(template).not.toContain('bindtap="connectCube"');
    expect(template).not.toContain('data-driver=');
    expect(template).not.toContain('driver-list');
    expect(template).toContain("phase === 'error' || phase === 'disconnected'");
    expect(template).toContain('bindtap="retryConnection"');
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
    expect(accountTemplate).toMatch(
      /class="account-sync-state[^>]*aria-role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"[^>]*aria-busy="{{syncState === 'checking'}}"/,
    );
    expect(accountTemplate).toMatch(
      /class="primary-button login-button"[^>]*aria-busy="{{busy}}"[^>]*aria-label="{{busy \? '微信登录处理中' : '微信登录'}}"/,
    );
    expect(accountTemplate).toContain(
      "aria-label=\"{{storageUnavailable ? '重新读取设备登录状态' : '重新确认账号状态'}}\"",
    );
    expect(accountTemplate.match(/aria-role="status"/g)).toHaveLength(3);
    expect(accountTemplate.match(/aria-live="polite"/g)).toHaveLength(3);
    expect(accountTemplate.match(/aria-atomic="true"/g)).toHaveLength(3);
    expect(toolsTemplate).toMatch(
      /class="status-text status-text--error tools-status"[^>]*aria-role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/,
    );
    expect(sharedTemplate).toMatch(/class="web-status-spinner"[^>]*aria-hidden="true"/);
    expect(sharedTemplate).toContain('aria-role="status"');
    expect(sharedTemplate).toContain('aria-live="polite"');
    expect(sharedTemplate).toContain('aria-atomic="true"');
    expect(sharedTemplate).toContain('aria-busy="{{!errorTitle}}"');
  });

  it('keeps shared native buttons large enough for touch', () => {
    const appStyles = sourceFiles['../src/app.wxss'];

    expect(appStyles).toMatch(/\.primary-button\s*\{[\s\S]*?min-height:\s*88rpx;/);
    expect(appStyles).toMatch(/\.text-button\s*\{[\s\S]*?min-height:\s*88rpx;/);
  });

  it('keeps native copy readable when WeChat enlarges text', () => {
    const appStyles = sourceFiles['../src/app.wxss'];
    const accountStyles = pageFiles['../src/pages/account/index.wxss'];
    const toolStyles = pageFiles['../src/pages/tools/index.wxss'];

    expect(appStyles).toMatch(/page\s*\{[\s\S]*?text-size-adjust:\s*100%;/);
    expect(appStyles).toMatch(/\.page-intro\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/);
    expect(appStyles).toMatch(/\.status-text\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/);
    expect(accountStyles).toMatch(/\.login-button\s*\{[\s\S]*?display:\s*inline-flex;/);
    expect(accountStyles).toMatch(/\.login-button\s*\{[\s\S]*?min-width:\s*260rpx;/);
    expect(accountStyles).not.toMatch(/\.login-button\s*\{[\s\S]*?\n\s*width:\s*260rpx;/);
    expect(accountStyles).toMatch(/\.account-link-title\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/);
    expect(toolStyles).toMatch(/\.tool-name\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/);
    expect(toolStyles).toMatch(/\.tool-description\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/);
  });

  it('lets long tool labels shrink without colliding with their arrow', () => {
    const toolStyles = pageFiles['../src/pages/tools/index.wxss'];

    expect(toolStyles).toMatch(/\.tool-copy\s*\{[\s\S]*?flex:\s*1;/);
    expect(toolStyles).toMatch(/\.tool-copy\s*\{[\s\S]*?min-width:\s*0;/);
    expect(toolStyles).not.toMatch(/\.tool-row\s*\{[\s\S]*?justify-content:\s*space-between;/);
  });
});
