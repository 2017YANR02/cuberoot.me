import { describe, expect, it } from 'vitest';

import { listWebTools, resolveWebRoute } from '../src/lib/web-routes';

describe('mini program web routes', () => {
  it('resolves the website timer route', () => {
    expect(resolveWebRoute('timer')).toEqual({
      title: '计时器',
      url: 'https://cuberoot.me/zh/timer',
    });
  });

  it('resolves only allowlisted website destinations', () => {
    expect(resolveWebRoute('alg')).toEqual({
      title: '公式库',
      url: 'https://cuberoot.me/zh/alg',
    });
    expect(resolveWebRoute('https://example.com')).toBeNull();
    expect(resolveWebRoute('__proto__')).toBeNull();
    expect(resolveWebRoute(null)).toBeNull();
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
