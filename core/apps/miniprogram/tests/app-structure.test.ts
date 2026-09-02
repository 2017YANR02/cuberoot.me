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

  it('enables official on-demand code injection', () => {
    expect(appConfig.lazyCodeLoading).toBe('requiredComponents');
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

  it('keeps web-backed pages on the shared controller and account sharing native', () => {
    const timerPage = pageFiles['../src/pages/timer/index.ts'];
    const toolsPage = pageFiles['../src/pages/tools/index.ts'];
    const accountPage = pageFiles['../src/pages/account/index.ts'];
    const genericWebPage = pageFiles['../src/pages/web/index.ts'];
    const timerTemplate = pageFiles['../src/pages/timer/index.wxml'];
    const toolsTemplate = pageFiles['../src/pages/tools/index.wxml'];
    const accountTemplate = pageFiles['../src/pages/account/index.wxml'];
    const genericWebTemplate = pageFiles['../src/pages/web/index.wxml'];
    const timerStyles = pageFiles['../src/pages/timer/index.wxss'];
    const toolsStyles = pageFiles['../src/pages/tools/index.wxss'];
    const accountStyles = pageFiles['../src/pages/account/index.wxss'];
    const genericWebStyles = pageFiles['../src/pages/web/index.wxss'];
    const sharedTemplate = sourceFiles['../src/templates/web-route-view.wxml'];

    expect(timerPage).toContain("createWebViewPageOptions('timer', { requireMiniProgramSession: true })");
    expect(toolsPage).toContain("createWebViewPageOptions('home', { requireMiniProgramSession: true })");
    expect(accountPage).not.toContain('createWebViewPageOptions');
    expect(accountPage).toContain('showPublicShareMenu');
    expect(accountPage).toContain('onShareTimeline');
    expect(accountPage).toContain('resumeRequiredSessionDestination');
    expect(genericWebPage).toContain('createWebViewPageOptions(undefined, { requireMiniProgramSession: true })');
    expect(timerPage).not.toMatch(/timer-store|setInterval|setTimeout/);
    expect(timerTemplate).toContain('templates/web-route-view.wxml');
    expect(toolsTemplate).toContain('templates/web-route-view.wxml');
    expect(accountTemplate).not.toContain('templates/web-route-view.wxml');
    expect(genericWebTemplate).toContain('templates/web-route-view.wxml');
    expect(sharedTemplate).toContain('<web-view');
    expect(sharedTemplate).toContain('data-attempt="{{viewAttempt}}"');
    expect(sharedTemplate).toContain('wx:elif="{{loginRequired}}"');
    expect(sharedTemplate).toContain('bindtap="loginWithMiniProgram"');
    expect(timerTemplate).not.toContain('<web-view');
    expect(toolsTemplate).not.toContain('<web-view');
    expect(accountTemplate).not.toContain('<web-view');
    expect(genericWebTemplate).not.toContain('<web-view');
    expect(timerTemplate).toContain('viewAttempt: viewAttempt');
    expect(toolsTemplate).toContain('viewAttempt: viewAttempt');
    expect(genericWebTemplate).toContain('viewAttempt: viewAttempt');
    expect(timerTemplate).toBe(genericWebTemplate);
    expect(toolsTemplate).toBe(genericWebTemplate);
    expect(accountTemplate).toContain('bindtap="loginWithMiniProgram"');
    expect(accountTemplate).toContain('bindtap="toggleAgreement"');
    expect(accountTemplate).toContain('bindtap="openPolicy"');
    expect(accountTemplate).not.toContain('bindtap="logout"');
    expect(accountTemplate).toContain('wx:if="{{isTimelineEntry}}"');
    expect(accountTemplate).toContain('{{copy.entryCopy}}');
    expect(accountPage).toContain("zh: '点击右下角进入魔方根'");
    expect(accountTemplate).not.toContain('<text class="eyebrow">CUBEROOT</text>');
    expect(accountTemplate).not.toContain('<text class="page-title">CubeRoot 登录入口</text>');
    expect(accountTemplate).not.toContain('朋友圈单页不提供登录能力');
    expect(accountTemplate).toContain('aria-busy="{{loginBusy}}"');
    expect(accountTemplate).toContain('aria-label="{{copy.retrySessionAria}}"');
    expect(accountTemplate).toContain('aria-role="status"');
    expect(accountTemplate).toContain('{{release.version}}');
    expect(accountTemplate).toContain('{{release.notesTitle}}');
    expect(timerStyles.trim()).toBe('');
    expect(toolsStyles.trim()).toBe('');
    expect(accountStyles).toContain('var(--cr-muted)');
    expect(genericWebStyles.trim()).toBe('');
  });

  it('keeps timeline sharing on the native account tab outside every web view', () => {
    const controller = sourceFiles['../src/lib/web-view-page.ts'];
    const accountPage = pageFiles['../src/pages/account/index.ts'];
    const accountTemplate = pageFiles['../src/pages/account/index.wxml'];

    expect(controller).toContain('showFriendShareMenu');
    expect(controller).not.toContain('onShareTimeline');
    expect(accountPage).toContain('showPublicShareMenu');
    expect(accountPage).toContain('onShareTimeline');
    expect(accountPage).toContain('TIMELINE_SCENE = 1154');
    expect(accountTemplate).not.toContain('<web-view');
    expect(accountTemplate).toContain('{{copy.entryCopy}}');
    expect(accountPage).toContain("zh: '点击右下角进入魔方根'");
    expect(pageFiles['../src/pages/share/index.ts']).toBeUndefined();
  });

  it('starts smart-cube discovery on page load without a second search action', () => {
    const page = pageFiles['../src/pages/smart-cube/index.ts'];
    const template = pageFiles['../src/pages/smart-cube/index.wxml'];

    expect(page).toContain('void startConnection(page);');
    expect(page).toContain('getStoredSessionSnapshot');
    expect(page).toContain('openRequiredSessionLogin');
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

  it('keeps shared web status accessible', () => {
    const sharedTemplate = sourceFiles['../src/templates/web-route-view.wxml'];

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

    expect(appStyles).toMatch(/page\s*\{[\s\S]*?text-size-adjust:\s*100%;/);
    expect(appStyles).toMatch(/\.page-intro\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/);
    expect(appStyles).toMatch(/\.status-text\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/);
  });
});
