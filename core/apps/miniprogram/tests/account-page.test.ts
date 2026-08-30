import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WebViewPageData } from '../src/lib/web-view-page';
import accountConfig from '../src/pages/account/index.json';

interface AccountPage {
  data: WebViewPageData;
  loginWithWechat(): Promise<void>;
  onLoad(options: Record<string, unknown>): void;
  onShow(): void;
  retryMiniProgramSession(): void;
  setData(data: Partial<WebViewPageData>): void;
}

async function loadPage(wxApi: Record<string, unknown>): Promise<AccountPage> {
  let page: AccountPage | undefined;
  vi.stubGlobal('wx', wxApi);
  vi.stubGlobal('Page', (options: AccountPage) => {
    page = options;
  });
  await import('../src/pages/account/index');
  if (!page) throw new Error('account page was not registered');
  page.setData = function setData(data) {
    this.data = { ...this.data, ...data };
  };
  return page;
}

describe('mini program account page', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('requires native WeChat login instead of opening the generic website login page', async () => {
    const hideShareMenu = vi.fn();
    const request = vi.fn();
    const setNavigationBarTitle = vi.fn();
    const page = await loadPage({
      getStorageSync: () => null,
      hideShareMenu,
      request,
      setNavigationBarTitle,
    });

    page.onLoad({ key: 'home' });
    await Promise.resolve();

    expect('enablePullDownRefresh' in accountConfig).toBe(false);
    expect(page.data).toMatchObject({
      errorTitle: '',
      loginRequired: true,
      loginStorageUnavailable: false,
      loadingTitle: '正在打开账号管理',
      routeKey: 'account',
      src: '',
    });
    expect(request).not.toHaveBeenCalled();
    expect(setNavigationBarTitle).toHaveBeenCalledWith({ title: '账号管理' });
    expect(hideShareMenu).toHaveBeenCalledWith({
      menus: ['shareAppMessage', 'shareTimeline'],
    });
  });

  it('hands an existing Mini Program session to the website account page once', async () => {
    const ticket = 'A'.repeat(43);
    const token = 't'.repeat(20);
    const request = vi.fn((options: {
      header: Record<string, string>;
      success(response: unknown): void;
    }) => {
      expect(options.header.Authorization).toBe(`Bearer ${token}`);
      options.success({ statusCode: 200, data: { ticket, expiresIn: 90 } });
    });
    const page = await loadPage({
      getStorageSync: () => ({
        token,
        user: {
          uid: 42,
          name: 'CubeRoot 用户',
          wcaId: null,
          avatar: '',
        },
      }),
      hideShareMenu: vi.fn(),
      removeStorageSync: vi.fn(),
      request,
      setNavigationBarTitle: vi.fn(),
    });

    page.onLoad({});
    await vi.waitFor(() => expect(page.data.src).toContain('/auth/miniprogram#'));

    expect(request).toHaveBeenCalledOnce();
    expect(page.data.src).toBe(
      `https://cuberoot.me/auth/miniprogram#ticket=${ticket}&next=%2Fzh%2Faccount`,
    );
  });

  it('returns an expired Mini Program session to native WeChat login', async () => {
    const token = 'x'.repeat(20);
    let storedSession: unknown = {
      token,
      user: { uid: 42, name: 'CubeRoot 用户', wcaId: null, avatar: '' },
    };
    const page = await loadPage({
      getStorageSync: () => storedSession,
      hideShareMenu: vi.fn(),
      removeStorageSync() {
        storedSession = null;
      },
      request(options: { success(response: unknown): void }) {
        options.success({ statusCode: 401, data: { error: 'expired' } });
      },
      setNavigationBarTitle: vi.fn(),
    });

    page.onLoad({});
    await vi.waitFor(() => expect(page.data.loginRequired).toBe(true));

    expect(page.data.src).toBe('');
    expect(storedSession).toBeNull();
  });

  it('logs in with WeChat and hands the new session to the website account page', async () => {
    const ticket = 'B'.repeat(43);
    const token = 'n'.repeat(20);
    let storedSession: unknown = null;
    const request = vi.fn((options: {
      data?: { code?: string };
      header?: Record<string, string>;
      success(response: unknown): void;
      url: string;
    }) => {
      if (options.url.endsWith('/auth/wechat/miniprogram')) {
        expect(options.data).toEqual({ code: 'login-code' });
        options.success({
          statusCode: 200,
          data: {
            token,
            user: { uid: 52, name: '', wcaId: null, avatar: '' },
            isNew: true,
          },
        });
        return;
      }
      expect(options.url).toBe('https://api.cuberoot.me/v1/auth/web-session/ticket');
      expect(options.header?.Authorization).toBe(`Bearer ${token}`);
      options.success({ statusCode: 200, data: { ticket, expiresIn: 90 } });
    });
    const page = await loadPage({
      getStorageSync: () => storedSession,
      hideShareMenu: vi.fn(),
      login(options: { success(result: { code: string }): void }) {
        options.success({ code: ' login-code ' });
      },
      onNetworkStatusChange: vi.fn(),
      removeStorageSync: vi.fn(),
      request,
      setNavigationBarTitle: vi.fn(),
      setStorageSync(_key: string, value: unknown) {
        storedSession = value;
      },
    });

    page.onLoad({});
    page.onShow();
    await page.loginWithWechat();

    expect(request).toHaveBeenCalledTimes(2);
    expect(page.data).toMatchObject({
      loginBusy: false,
      loginError: '',
      loginRequired: false,
      src: `https://cuberoot.me/auth/miniprogram#ticket=${ticket}&next=%2Fzh%2Faccount`,
    });
  });

  it('keeps the native login gate actionable when WeChat login fails', async () => {
    const page = await loadPage({
      getStorageSync: () => null,
      hideShareMenu: vi.fn(),
      login(options: { fail(result: { errMsg: string }): void }) {
        options.fail({ errMsg: 'login failed' });
      },
      onNetworkStatusChange: vi.fn(),
      setNavigationBarTitle: vi.fn(),
    });

    page.onLoad({});
    page.onShow();
    await page.loginWithWechat();

    expect(page.data).toMatchObject({
      loginBusy: false,
      loginError: '网络连接失败，请检查网络',
      loginRequired: true,
      src: '',
    });
  });

  it('offers a local-session retry when device storage cannot be read', async () => {
    let storageAvailable = false;
    const page = await loadPage({
      getStorageSync() {
        if (!storageAvailable) throw new Error('storage unavailable');
        return null;
      },
      hideShareMenu: vi.fn(),
      setNavigationBarTitle: vi.fn(),
    });

    page.onLoad({});
    await Promise.resolve();

    expect(page.data).toMatchObject({
      loginError: '暂时无法读取设备上的登录状态，请重新读取。',
      loginRequired: true,
      loginStorageUnavailable: true,
      src: '',
    });

    storageAvailable = true;
    page.retryMiniProgramSession();
    await Promise.resolve();

    expect(page.data).toMatchObject({
      loginError: '',
      loginRequired: true,
      loginStorageUnavailable: false,
      src: '',
    });
  });
});
