import { afterEach, describe, expect, it, vi } from 'vitest';

interface SharePageData {
  canShare: boolean;
  description: string;
  errorMessage: string;
  routeKey: string;
  title: string;
}

interface SharePage {
  data: SharePageData;
  onLoad(options: Record<string, string>): void;
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent;
  onShareTimeline(): WechatMiniprogram.Page.ICustomTimelineContent;
  openRoute(): void;
  setData(data: Partial<SharePageData>): void;
}

async function loadPage(wxApi: Record<string, unknown>): Promise<SharePage> {
  let page: SharePage | undefined;
  vi.stubGlobal('wx', wxApi);
  vi.stubGlobal('Page', (options: SharePage) => {
    page = options;
  });
  await import('../src/pages/share/index');
  if (!page) throw new Error('share page was not registered');
  page.setData = function setData(data) {
    this.data = { ...this.data, ...data };
  };
  return page;
}

describe('native timeline share page', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('shares a public route to friends and Moments without a web view', async () => {
    const navigateTo = vi.fn();
    const showShareMenu = vi.fn();
    const page = await loadPage({ navigateTo, showShareMenu, showToast: vi.fn() });

    page.onLoad({ key: 'alg' });

    expect(page.data).toMatchObject({
      canShare: true,
      description: '计时、公式、模拟、复盘与打乱。',
      routeKey: 'alg',
      title: '公式',
    });
    expect(showShareMenu).toHaveBeenCalledWith({
      menus: ['shareAppMessage', 'shareTimeline'],
    });
    expect(page.onShareAppMessage()).toEqual({
      imageUrl: '/assets/share-cover.png',
      title: 'CubeRoot 魔方根：公式',
      path: '/pages/web/index?key=alg',
    });
    expect(page.onShareTimeline()).toEqual({
      imageUrl: '/assets/share-cover.png',
      query: 'key=alg',
      title: 'CubeRoot 魔方根：公式',
    });

    page.openRoute();
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=alg',
    }));
  });

  it('hides both menus for private or unknown routes', async () => {
    const hideShareMenu = vi.fn();
    const showShareMenu = vi.fn();
    const page = await loadPage({ hideShareMenu, showShareMenu });

    page.onLoad({ key: 'account' });

    expect(page.data).toMatchObject({
      canShare: false,
      errorMessage: '该页面不支持分享到朋友圈。',
      routeKey: '',
      title: '无法分享',
    });
    expect(hideShareMenu).toHaveBeenCalledWith({
      menus: ['shareAppMessage', 'shareTimeline'],
    });
    expect(showShareMenu).not.toHaveBeenCalled();
  });
});
