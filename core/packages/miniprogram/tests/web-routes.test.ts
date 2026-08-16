import { describe, expect, it } from 'vitest';

import {
  WEB_ROUTES,
  WEB_ROUTE_SHARE_IMAGE,
  createWebSessionHandoffUrl,
  listWebTools,
  resolveWebRoute,
  resolveWebRouteShare,
  resolveToolsPageShare,
} from '../src/lib/web-routes';

const TICKET = 'A'.repeat(43);
const websitePageFiles = import.meta.glob('../../client/app/**/page.tsx', {
  eager: true,
  import: 'default',
  query: '?raw',
});
const websiteConfigFiles = import.meta.glob('../../client/next.config.ts', {
  eager: true,
  import: 'default',
  query: '?raw',
});
const websiteConfigSource = websiteConfigFiles['../../client/next.config.ts'];

describe('mini program web routes', () => {
  it('resolves the website timer route', () => {
    expect(resolveWebRoute('timer')).toEqual({
      title: '计时器',
      path: '/zh/timer',
      sessionHandoff: true,
      url: 'https://cuberoot.me/zh/timer',
    });
  });

  it('keeps account and privacy destinations in the registry without showing them as discovery tools', () => {
    expect(resolveWebRoute('account')).toEqual({
      title: '账号管理',
      path: '/zh/account',
      sessionHandoff: true,
      url: 'https://cuberoot.me/zh/account',
    });
    expect(resolveWebRoute('privacy')).toEqual({
      title: '隐私说明',
      path: '/zh/privacy',
      sessionHandoff: true,
      url: 'https://cuberoot.me/zh/privacy',
    });
    expect(listWebTools().some((tool) => tool.key === 'account')).toBe(false);
    expect(listWebTools().some((tool) => tool.key === 'privacy')).toBe(false);
    expect(listWebTools().some((tool) => tool.key === 'logout')).toBe(false);
  });

  it('resolves only allowlisted website destinations', () => {
    expect(resolveWebRoute('alg')).toEqual({
      title: '公式库',
      path: '/zh/alg',
      sessionHandoff: true,
      url: 'https://cuberoot.me/zh/alg',
    });
    expect(resolveWebRoute('https://example.com')).toBeNull();
    expect(resolveWebRoute('__proto__')).toBeNull();
    expect(resolveWebRoute(null)).toBeNull();
  });

  it('keeps cross-platform logout in the allowlist without creating another login handoff', () => {
    expect(resolveWebRoute('logout')).toEqual({
      title: '退出登录',
      path: '/auth/miniprogram#action=logout&next=%2Fzh%2Faccount',
      sessionHandoff: false,
      loadFailureMessage: '小程序已退出，网站退出暂未完成。请检查网络后重试。',
      url: 'https://cuberoot.me/auth/miniprogram#action=logout&next=%2Fzh%2Faccount',
    });
  });

  it('keeps the one-time ticket in a fragment outside server logs and referrers', () => {
    expect(createWebSessionHandoffUrl('/zh/timer?mode=333#history', TICKET)).toBe(
      `https://cuberoot.me/auth/miniprogram#ticket=${TICKET}&next=%2Fzh%2Ftimer%3Fmode%3D333%23history`,
    );
    expect(() => createWebSessionHandoffUrl('//evil.example', TICKET)).toThrow();
    expect(() => createWebSessionHandoffUrl('/\\evil.example', TICKET)).toThrow();
    expect(() => createWebSessionHandoffUrl('/zh/\ntimer', TICKET)).toThrow();
    expect(() => createWebSessionHandoffUrl('/zh/timer', 'short')).toThrow();
  });

  it('derives the discovery list from the route registry', () => {
    expect(listWebTools()).toEqual([
      { key: 'alg', title: '公式库', description: 'OLL、PLL、ZBLL 等公式查询与训练' },
      { key: 'competitions', title: 'WCA 比赛', description: '查比赛、赛程与成绩' },
      { key: 'wiki', title: '魔方百科', description: '教程、术语与方法资料' },
      { key: 'courses', title: '课程', description: '系统学习与试学内容' },
    ]);
    expect(Object.values(WEB_ROUTES).filter((route) => 'showInTools' in route)).toHaveLength(4);
  });

  it('derives share targets from public entries without exposing account routes', () => {
    expect(resolveToolsPageShare()).toEqual({
      imageUrl: WEB_ROUTE_SHARE_IMAGE,
      title: 'CubeRoot 魔方根：魔方工具',
      path: '/pages/tools/index',
    });
    expect(resolveWebRouteShare('timer')).toEqual({
      imageUrl: WEB_ROUTE_SHARE_IMAGE,
      title: 'CubeRoot 魔方根：计时器',
      path: '/pages/timer/index',
    });
    expect(resolveWebRouteShare('alg')).toEqual({
      imageUrl: WEB_ROUTE_SHARE_IMAGE,
      title: 'CubeRoot 魔方根：公式库',
      path: '/pages/web/index?key=alg',
    });
    expect(listWebTools().map(({ key }) => resolveWebRouteShare(key)?.path)).toEqual([
      '/pages/web/index?key=alg',
      '/pages/web/index?key=competitions',
      '/pages/web/index?key=wiki',
      '/pages/web/index?key=courses',
    ]);
    expect(resolveWebRouteShare('account')).toBeNull();
    expect(resolveWebRouteShare('privacy')).toBeNull();
    expect(resolveWebRouteShare('logout')).toBeNull();
    expect(resolveWebRouteShare('unknown')).toBeNull();
  });

  it('only registers destinations backed by canonical website pages or redirects', () => {
    for (const [key, route] of Object.entries(WEB_ROUTES)) {
      if (key === 'logout') {
        expect(route.path).toBe('/auth/miniprogram#action=logout&next=%2Fzh%2Faccount');
        expect(websitePageFiles).toHaveProperty('../../client/app/auth/miniprogram/page.tsx');
        continue;
      }
      expect(route.path, key).toMatch(/^\/zh\//);
      const relativePagePath = route.path.replace(/^\/zh\//, '');
      const unlocalizedPath = route.path.replace(/^\/zh/, '');
      const hasPage = Object.hasOwn(
        websitePageFiles,
        `../../client/app/[lang]/${relativePagePath}/page.tsx`,
      );
      const hasRedirect = websiteConfigSource.includes(`source: "${unlocalizedPath}"`)
        || websiteConfigSource.includes(`source: '${unlocalizedPath}'`);
      expect(
        hasPage || hasRedirect,
        `${key}: ${route.path}`,
      ).toBe(true);
    }
  });
});
