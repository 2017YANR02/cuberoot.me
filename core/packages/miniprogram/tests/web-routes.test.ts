import { describe, expect, it } from 'vitest';

import { createWebSessionHandoffUrl, listWebTools, resolveWebRoute } from '../src/lib/web-routes';

const TICKET = 'A'.repeat(43);

describe('mini program web routes', () => {
  it('resolves the website timer route', () => {
    expect(resolveWebRoute('timer')).toEqual({
      title: '计时器',
      path: '/zh/timer',
      url: 'https://cuberoot.me/zh/timer',
    });
  });

  it('keeps account and privacy destinations in the registry without showing them as discovery tools', () => {
    expect(resolveWebRoute('account')).toEqual({
      title: '账号管理',
      path: '/zh/account',
      url: 'https://cuberoot.me/zh/account',
    });
    expect(resolveWebRoute('privacy')).toEqual({
      title: '隐私说明',
      path: '/zh/privacy',
      url: 'https://cuberoot.me/zh/privacy',
    });
    expect(listWebTools().some((tool) => tool.key === 'account')).toBe(false);
    expect(listWebTools().some((tool) => tool.key === 'privacy')).toBe(false);
  });

  it('resolves only allowlisted website destinations', () => {
    expect(resolveWebRoute('alg')).toEqual({
      title: '公式库',
      path: '/zh/alg',
      url: 'https://cuberoot.me/zh/alg',
    });
    expect(resolveWebRoute('https://example.com')).toBeNull();
    expect(resolveWebRoute('__proto__')).toBeNull();
    expect(resolveWebRoute(null)).toBeNull();
  });

  it('keeps the one-time ticket in a fragment outside server logs and referrers', () => {
    expect(createWebSessionHandoffUrl('/zh/timer', TICKET)).toBe(
      `https://cuberoot.me/auth/miniprogram#ticket=${TICKET}&next=%2Fzh%2Ftimer`,
    );
    expect(() => createWebSessionHandoffUrl('//evil.example', TICKET)).toThrow();
    expect(() => createWebSessionHandoffUrl('/zh/timer', 'short')).toThrow();
  });

  it('derives the discovery list from the route registry', () => {
    expect(listWebTools()).toEqual([
      { key: 'alg', title: '公式库', description: 'OLL、PLL、ZBLL 等公式查询与训练' },
      { key: 'competitions', title: 'WCA 比赛', description: '查比赛、赛程与成绩' },
      { key: 'wiki', title: '魔方百科', description: '教程、术语与方法资料' },
      { key: 'courses', title: '课程', description: '系统学习与试学内容' },
    ]);
  });
});
