import { afterEach, describe, expect, it, vi } from 'vitest';

interface ToolsPage {
  onHide(): void;
  onUnload(): void;
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent;
  openTool(event: { currentTarget: { dataset: { key?: unknown } } }): void;
}

async function loadPage(wxApi: Record<string, unknown>): Promise<ToolsPage> {
  let page: ToolsPage | undefined;
  vi.stubGlobal('wx', wxApi);
  vi.stubGlobal('Page', (options: ToolsPage) => {
    page = options;
  });
  await import('../src/pages/tools/index');
  if (!page) throw new Error('tools page was not registered');
  return page;
}

function toolEvent(key: unknown) {
  return { currentTarget: { dataset: { key } } };
}

describe('mini program tools page', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('opens an allowlisted website tool', async () => {
    const navigateTo = vi.fn();
    const page = await loadPage({ navigateTo, showToast: vi.fn() });

    page.openTool(toolEvent('alg'));

    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=alg',
    }));
  });

  it('shares the public tools entry with the canonical brand image', async () => {
    const page = await loadPage({});

    expect(page.onShareAppMessage()).toEqual({
      imageUrl: '/assets/share-cover.png',
      title: 'CubeRoot 魔方根：魔方工具',
      path: '/pages/tools/index',
    });
  });

  it('rejects an unknown destination', async () => {
    const navigateTo = vi.fn();
    const showToast = vi.fn();
    const page = await loadPage({ navigateTo, showToast });

    page.openTool(toolEvent('https://example.com'));

    expect(navigateTo).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({ icon: 'none', title: '该功能暂不可用' });
  });

  it('shows feedback when navigation fails', async () => {
    const showToast = vi.fn();
    const navigateTo = vi.fn((options: { fail?(): void }) => options.fail?.());
    const page = await loadPage({ navigateTo, showToast });

    page.openTool(toolEvent('wiki'));

    expect(showToast).toHaveBeenCalledWith({ icon: 'none', title: '页面暂时无法打开' });
  });

  it('ignores a pending navigation failure after the page is hidden', async () => {
    let fail: (() => void) | undefined;
    const showToast = vi.fn();
    const navigateTo = vi.fn((options: { fail?(): void }) => {
      fail = options.fail;
    });
    const page = await loadPage({ navigateTo, showToast });

    page.openTool(toolEvent('wiki'));
    page.onHide();
    fail?.();

    expect(showToast).not.toHaveBeenCalled();
    page.openTool(toolEvent('alg'));
    expect(navigateTo).toHaveBeenCalledTimes(2);
  });
});
