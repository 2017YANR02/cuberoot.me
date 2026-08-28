import { afterEach, describe, expect, it, vi } from 'vitest';

import { showPublicShareMenu, toTimelineShare } from '../src/lib/share';

describe('mini program sharing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('enables friend and timeline sharing together', () => {
    const showShareMenu = vi.fn();
    vi.stubGlobal('wx', { showShareMenu });

    showPublicShareMenu();

    expect(showShareMenu).toHaveBeenCalledWith({
      menus: ['shareAppMessage', 'shareTimeline'],
    });
  });

  it('keeps only the current-page query in timeline share content', () => {
    expect(toTimelineShare({
      imageUrl: '/assets/share-cover.png',
      title: 'CubeRoot 魔方根：公式库',
      path: '/pages/web/index?key=alg',
    })).toEqual({
      imageUrl: '/assets/share-cover.png',
      query: 'key=alg',
      title: 'CubeRoot 魔方根：公式库',
    });
  });
});
