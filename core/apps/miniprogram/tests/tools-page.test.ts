import { afterEach, describe, expect, it, vi } from 'vitest';

interface ToolsPage {
  data: Record<string, unknown>;
  onHide(): void;
  onShow(): void;
  onUnload(): void;
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent;
  onShareTimeline(): WechatMiniprogram.Page.ICustomTimelineContent;
  clearSearch(): void;
  handleSearchInput(event: { detail: { value: unknown } }): void;
  openTool(event: { currentTarget: { dataset: { id?: unknown } } }): void;
  setData(data: Record<string, unknown>): void;
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

function toolEvent(id: unknown) {
  return { currentTarget: { dataset: { id } } };
}

describe('mini program tools page', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('opens an allowlisted website tool', async () => {
    const navigateTo = vi.fn();
    const page = await loadPage({ navigateTo, showToast: vi.fn() });

    page.openTool(toolEvent('algdb'));

    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=alg',
    }));
  });

  it('shows all shared groups and filters by Chinese or English names', async () => {
    const page = await loadPage({});

    expect(page.data.totalCount).toBe(53);
    expect(page.data.resultCount).toBe(53);
    expect((page.data.groups as { tools: unknown[] }[]).map((group) => group.tools.length)).toEqual([
      5, 4, 6, 9, 16, 10, 3,
    ]);

    page.handleSearchInput({ detail: { value: '纪录' } });
    expect(page.data.query).toBe('纪录');
    expect(page.data.resultCount).toBe(2);

    page.handleSearchInput({ detail: { value: 'Ruimin' } });
    expect(page.data.resultCount).toBe(2);

    page.clearSearch();
    expect(page.data.query).toBe('');
    expect(page.data.resultCount).toBe(53);
  });

  it('opens the native timer tab without creating a web-view', async () => {
    const navigateTo = vi.fn();
    const switchTab = vi.fn();
    const page = await loadPage({ navigateTo, switchTab });

    page.openTool(toolEvent('timer'));

    expect(switchTab).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/timer/index',
    }));
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('copies the external GitHub destination instead of passing it to web-view', async () => {
    const setClipboardData = vi.fn((options: { success?(): void }) => options.success?.());
    const page = await loadPage({ setClipboardData });

    page.openTool(toolEvent('github'));

    expect(setClipboardData).toHaveBeenCalledWith(expect.objectContaining({
      data: 'https://github.com/RuiminYan/cuberoot.me',
    }));
    expect(page.data.status).toBe('GitHub 地址已复制');
    expect(page.data.statusTone).toBe('ready');
  });

  it('preserves the website tutorial maintenance state', async () => {
    const navigateTo = vi.fn();
    const page = await loadPage({ navigateTo });

    page.openTool(toolEvent('alg'));

    expect(navigateTo).not.toHaveBeenCalled();
    expect(page.data.status).toBe('管理员维护中');
  });

  it('shares the public tools entry with the canonical brand image', async () => {
    const showShareMenu = vi.fn();
    const page = await loadPage({ showShareMenu });

    page.onShow();

    expect(showShareMenu).toHaveBeenCalledWith({
      menus: ['shareAppMessage', 'shareTimeline'],
    });

    expect(page.onShareAppMessage()).toEqual({
      imageUrl: '/assets/share-cover.png',
      title: 'CubeRoot 魔方根：魔方工具',
      path: '/pages/tools/index',
    });
    expect(page.onShareTimeline()).toEqual({
      imageUrl: '/assets/share-cover.png',
      title: 'CubeRoot 魔方根：魔方工具',
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
    expect(page.data.status).toBe('页面暂时无法打开');
  });

  it('keeps navigation failure visible when toast feedback is unavailable', async () => {
    const page = await loadPage({
      navigateTo(options: { fail?(): void }) {
        options.fail?.();
      },
      showToast() {
        throw new Error('toast unavailable');
      },
    });

    page.openTool(toolEvent('wiki'));

    expect(page.data.status).toBe('页面暂时无法打开');
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
    expect(page.data.status).toBe('');
    page.openTool(toolEvent('algdb'));
    expect(navigateTo).toHaveBeenCalledTimes(2);
  });
});
