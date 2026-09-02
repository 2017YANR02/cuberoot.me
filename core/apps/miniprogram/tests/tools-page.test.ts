import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WebViewPageData } from '../src/lib/web-view-page';

interface ToolsPage {
  data: WebViewPageData;
  onLoad(options: Record<string, unknown>): void;
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent;
  setData(data: Partial<WebViewPageData>): void;
}

async function loadPage(wxApi: Record<string, unknown>): Promise<ToolsPage> {
  let page: ToolsPage | undefined;
  vi.stubGlobal('wx', wxApi);
  vi.stubGlobal('Page', (options: ToolsPage) => {
    page = options;
  });
  await import('../src/pages/tools/index');
  if (!page) throw new Error('tools page was not registered');
  page.setData = function setData(data) {
    this.data = { ...this.data, ...data };
  };
  return page;
}

describe('mini program tools page', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('keeps the canonical tools route behind the shared login gate', async () => {
    const setNavigationBarTitle = vi.fn();
    const showShareMenu = vi.fn();
    const page = await loadPage({
      getStorageSync: () => null,
      setNavigationBarTitle,
      showShareMenu,
    });

    page.onLoad({ key: 'alg' });
    await Promise.resolve();

    expect(page.data).toMatchObject({
      errorTitle: '',
      loginRequired: true,
      loadingTitle: '正在打开魔方工具',
      routeKey: 'home',
      src: '',
    });
    expect(setNavigationBarTitle).toHaveBeenCalledWith({ title: '魔方工具' });
    expect(showShareMenu).toHaveBeenCalledWith({
      menus: ['shareAppMessage'],
    });
    expect(page).not.toHaveProperty('onShareTimeline');
  });

  it('shares the tools tab instead of a nested generic web page', async () => {
    const page = await loadPage({
      getStorageSync: () => null,
      setNavigationBarTitle: vi.fn(),
      showShareMenu: vi.fn(),
    });

    page.onLoad({});
    await Promise.resolve();

    expect(page.onShareAppMessage()).toEqual({
      imageUrl: '/assets/share-cover.png',
      title: '魔方根CubeRoot：魔方工具',
      path: '/pages/tools/index',
    });
  });
});
