import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { SITE_DIRECTORY_GROUPS } from '@cuberoot/shared/site-directory';

import { resolveWorkspacePath } from '../../../scripts/resolve-workspace-path.mjs';

import {
  WEB_ROUTES,
  WEB_ROUTE_SHARE_IMAGE,
  createWebSessionHandoffUrl,
  listWebToolGroups,
  listWebTools,
  resolveWebRoute,
  resolveWebRouteShare,
  resolveAccountPageShare,
  resolveToolsPageShare,
  resolveWebTool,
} from '../src/lib/web-routes';

const TICKET = 'A'.repeat(43);
const coreRoot = resolve(import.meta.dirname, '..', '..', '..');
const websiteRoot = resolve(coreRoot, resolveWorkspacePath('@cuberoot/client'));
const websiteConfigSource = readFileSync(join(websiteRoot, 'next.config.ts'), 'utf8');
const trackingSource = readFileSync(join(coreRoot, 'docs', 'MINIPROGRAM.md'), 'utf8');

describe('mini program web routes', () => {
  it('resolves the website timer route', () => {
    expect(resolveWebRoute('timer')).toEqual({
      title: '计时',
      path: '/zh/timer',
      sessionHandoff: true,
      url: 'https://cuberoot.me/zh/timer#wechat_redirect',
    });
  });

  it('resolves the tools tab to the canonical website homepage', () => {
    expect(resolveWebRoute('home')).toEqual({
      title: '魔方工具',
      path: '/zh',
      sessionHandoff: true,
      url: 'https://cuberoot.me/zh#wechat_redirect',
    });
    expect(resolveWebRouteShare('home')).toEqual({
      imageUrl: WEB_ROUTE_SHARE_IMAGE,
      title: 'CubeRoot 魔方根：魔方工具',
      path: '/pages/tools/index',
    });
  });

  it('keeps account and privacy destinations outside the homepage directory', () => {
    expect(resolveWebRoute('account')).toEqual({
      title: '账号管理',
      path: '/zh/account',
      sessionHandoff: true,
      url: 'https://cuberoot.me/zh/account#wechat_redirect',
    });
    expect(resolveWebRoute('privacy')).toEqual({
      title: '隐私说明',
      path: '/zh/privacy',
      sessionHandoff: false,
      url: 'https://cuberoot.me/zh/privacy#wechat_redirect',
    });
    expect(listWebTools().some((tool) => tool.key === 'account')).toBe(false);
    expect(listWebTools().some((tool) => tool.key === 'privacy')).toBe(false);
    expect(listWebTools().some((tool) => tool.key === 'logout')).toBe(false);
  });

  it('resolves only allowlisted website destinations', () => {
    expect(resolveWebRoute('alg')).toEqual({
      title: '公式',
      path: '/zh/alg',
      sessionHandoff: true,
      url: 'https://cuberoot.me/zh/alg#wechat_redirect',
    });
    expect(resolveWebRoute('https://example.com')).toBeNull();
    expect(resolveWebRoute('__proto__')).toBeNull();
    expect(resolveWebRoute(null)).toBeNull();
  });

  it('opens the blog through the canonical main-domain redirect without a session ticket', () => {
    expect(resolveWebRoute('blog')).toEqual({
      title: '博客',
      path: '/zh/blog',
      sessionHandoff: false,
      url: 'https://cuberoot.me/zh/blog#wechat_redirect',
    });
  });

  it('keeps cross-platform logout in the allowlist without creating another login handoff', () => {
    expect(resolveWebRoute('logout')).toEqual({
      title: '退出登录',
      path: '/auth/miniprogram#action=logout&next=%2Fzh%2Faccount',
      sessionHandoff: false,
      loadFailureMessage: '小程序已退出，网站退出暂未完成。请检查网络后重试。',
      url: 'https://cuberoot.me/auth/miniprogram#wechat_redirect&action=logout&next=%2Fzh%2Faccount',
    });
  });

  it('keeps the one-time ticket in a fragment outside server logs and referrers', () => {
    expect(createWebSessionHandoffUrl('/zh/timer?mode=333#history', TICKET)).toBe(
      `https://cuberoot.me/auth/miniprogram#wechat_redirect&ticket=${TICKET}&next=%2Fzh%2Ftimer%3Fmode%3D333%23history`,
    );
    expect(() => createWebSessionHandoffUrl('//evil.example', TICKET)).toThrow();
    expect(() => createWebSessionHandoffUrl('/\\evil.example', TICKET)).toThrow();
    expect(() => createWebSessionHandoffUrl('/zh/\ntimer', TICKET)).toThrow();
    expect(() => createWebSessionHandoffUrl('/zh/timer', 'short')).toThrow();
  });

  it('marks every web-view src for reliable iOS JSSDK calls', () => {
    for (const key of Object.keys(WEB_ROUTES)) {
      expect(resolveWebRoute(key)?.url, key).toMatch(/#wechat_redirect(?:&|$)/);
    }
  });

  it('derives all 53 homepage destinations from the shared ordered catalog', () => {
    expect(SITE_DIRECTORY_GROUPS.map((group) => group.entries.length)).toEqual([5, 4, 6, 9, 16, 10, 3]);
    expect(listWebToolGroups().map((group) => group.tools.length)).toEqual([5, 4, 6, 9, 16, 10, 3]);
    expect(listWebTools()).toHaveLength(53);
    expect(new Set(listWebTools().map((tool) => tool.id))).toHaveProperty('size', 53);
    expect(Object.values(WEB_ROUTES).filter((route) => route.publicEntry)).toHaveLength(52);
    expect(resolveWebTool('algdb')).toMatchObject({ id: 'algdb', key: 'alg', action: 'web' });
    expect(resolveWebTool('timer')).toMatchObject({ id: 'timer', key: 'timer', action: 'native' });
    expect(resolveWebTool('alg')).toMatchObject({ id: 'alg', key: null, action: 'disabled' });
    expect(resolveWebTool('github')).toMatchObject({ id: 'github', key: null, action: 'copy' });
    expect(resolveWebTool('__proto__')).toBeNull();
  });

  it('keeps every shared destination visible in the audited tracking checklist', () => {
    for (const tool of listWebTools()) {
      expect(trackingSource, tool.id).toContain(`| \`${tool.id}\` |`);
    }
    expect(trackingSource).toContain(
      '共 53 项：网站首页直接渲染它们，工具 tab 通过一个固定白名单路由复用整个首页',
    );
  });

  it('searches Chinese, English, ids and paths while preserving groups', () => {
    expect(listWebToolGroups('纪录').map((group) => group.tools.map((tool) => tool.id))).toEqual([
      ['wca-records'],
      ['wb'],
    ]);
    expect(listWebToolGroups('Ruimin').map((group) => group.tools.map((tool) => tool.id))).toEqual([
      ['creator'],
      ['github'],
    ]);
    expect(listWebToolGroups('/teachers').flatMap((group) => group.tools.map((tool) => tool.id))).toEqual([
      'teachers',
      'live-scripts',
    ]);
    expect(listWebToolGroups('not-a-cuberoot-entry')).toEqual([]);
  });

  it('derives share targets from public entries without exposing account routes', () => {
    expect(resolveAccountPageShare()).toEqual({
      imageUrl: WEB_ROUTE_SHARE_IMAGE,
      title: 'CubeRoot 魔方根',
      path: '/pages/account/index',
    });
    expect(resolveToolsPageShare()).toEqual({
      imageUrl: WEB_ROUTE_SHARE_IMAGE,
      title: 'CubeRoot 魔方根：魔方工具',
      path: '/pages/tools/index',
    });
    expect(resolveWebRouteShare('timer')).toEqual({
      imageUrl: WEB_ROUTE_SHARE_IMAGE,
      title: 'CubeRoot 魔方根：计时',
      path: '/pages/timer/index',
    });
    expect(resolveWebRouteShare('alg')).toEqual({
      imageUrl: WEB_ROUTE_SHARE_IMAGE,
      title: 'CubeRoot 魔方根：公式',
      path: '/pages/web/index?key=alg',
    });
    const routeBackedTools = listWebTools().filter((tool) => tool.key !== null);
    expect(routeBackedTools).toHaveLength(51);
    expect(routeBackedTools.every((tool) => resolveWebRouteShare(tool.key) !== null)).toBe(true);
    expect(resolveWebRouteShare('account')).toBeNull();
    expect(resolveWebRouteShare('privacy')).toBeNull();
    expect(resolveWebRouteShare('logout')).toBeNull();
    expect(resolveWebRouteShare('unknown')).toBeNull();
  });

  it('only registers destinations backed by canonical website pages or redirects', () => {
    for (const [key, route] of Object.entries(WEB_ROUTES)) {
      if (key === 'home') {
        expect(route.path).toBe('/zh');
        expect(existsSync(join(websiteRoot, 'app', '[lang]', 'page.tsx'))).toBe(true);
        continue;
      }
      if (key === 'logout') {
        expect(route.path).toBe('/auth/miniprogram#action=logout&next=%2Fzh%2Faccount');
        expect(existsSync(join(websiteRoot, 'app', 'auth', 'miniprogram', 'page.tsx'))).toBe(true);
        continue;
      }
      expect(route.path, key).toMatch(/^\/zh\//);
      const relativePagePath = route.path.replace(/^\/zh\//, '');
      const unlocalizedPath = route.path.replace(/^\/zh/, '');
      const hasPage = existsSync(join(websiteRoot, 'app', '[lang]', relativePagePath, 'page.tsx'));
      const hasRedirect = websiteConfigSource.includes(`source: "${unlocalizedPath}"`)
        || websiteConfigSource.includes(`source: '${unlocalizedPath}'`);
      expect(
        hasPage || hasRedirect,
        `${key}: ${route.path}`,
      ).toBe(true);
    }
  });
});
