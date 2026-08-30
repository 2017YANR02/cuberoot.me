import { afterEach, describe, expect, it, vi } from 'vitest';

import accountConfig from '../src/pages/account/index.json';

interface AccountPageData {
  accountError: string;
  displayName: string;
  isTimelineEntry: boolean;
  loginBusy: boolean;
  loginError: string;
  loginRequired: boolean;
  loginStorageUnavailable: boolean;
  uidText: string;
  wcaId: string;
}

interface AccountPage {
  data: AccountPageData;
  loginWithWechat(): Promise<void>;
  onLoad(): void;
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent;
  onShareTimeline(): WechatMiniprogram.Page.ICustomTimelineContent;
  onShow(): void;
  openAccount(): void;
  retryMiniProgramSession(): void;
  setData(data: Partial<AccountPageData>): void;
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

function normalLaunchOptions() {
  return { scene: 1001 };
}

describe('mini program account page', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('shows native WeChat login and enables both share targets', async () => {
    const setNavigationBarTitle = vi.fn();
    const showShareMenu = vi.fn();
    const page = await loadPage({
      getLaunchOptionsSync: normalLaunchOptions,
      getStorageSync: () => null,
      setNavigationBarTitle,
      showShareMenu,
    });

    page.onLoad();

    expect(accountConfig).toEqual({ navigationBarTitleText: 'CubeRoot 登录入口' });
    expect(page.data).toMatchObject({
      isTimelineEntry: false,
      loginRequired: true,
      loginStorageUnavailable: false,
    });
    expect(showShareMenu).toHaveBeenCalledWith({
      menus: ['shareAppMessage', 'shareTimeline'],
    });
    expect(setNavigationBarTitle).toHaveBeenCalledWith({ title: '我的' });
  });

  it('renders the Moments login landing without using unavailable single-page APIs', async () => {
    const getStorageSync = vi.fn();
    const login = vi.fn();
    const navigateTo = vi.fn();
    const request = vi.fn();
    const setNavigationBarTitle = vi.fn();
    const showShareMenu = vi.fn();
    const page = await loadPage({
      getLaunchOptionsSync: () => ({ scene: 1154 }),
      getStorageSync,
      login,
      navigateTo,
      request,
      setNavigationBarTitle,
      showShareMenu,
    });

    page.onLoad();
    page.onShow();
    await page.loginWithWechat();
    page.openAccount();

    expect(page.data).toMatchObject({
      isTimelineEntry: true,
      loginBusy: false,
      loginRequired: true,
    });
    expect(getStorageSync).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();
    expect(navigateTo).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    expect(setNavigationBarTitle).not.toHaveBeenCalled();
    expect(showShareMenu).not.toHaveBeenCalled();
    expect(page.onShareTimeline()).toEqual({
      imageUrl: '/assets/share-cover.png',
      title: 'CubeRoot 魔方根',
    });
  });

  it('treats scene 1155 from the Moments forward action as the full Mini Program', async () => {
    const getStorageSync = vi.fn(() => null);
    const showShareMenu = vi.fn();
    const page = await loadPage({
      getLaunchOptionsSync: () => ({ scene: 1155 }),
      getStorageSync,
      showShareMenu,
    });

    page.onLoad();

    expect(page.data).toMatchObject({
      isTimelineEntry: false,
      loginRequired: true,
    });
    expect(getStorageSync).toHaveBeenCalledOnce();
    expect(showShareMenu).toHaveBeenCalledWith({
      menus: ['shareAppMessage', 'shareTimeline'],
    });
  });

  it('shows an existing session natively without opening a web view or creating a ticket', async () => {
    const request = vi.fn();
    const page = await loadPage({
      getLaunchOptionsSync: normalLaunchOptions,
      getStorageSync: () => ({
        token: 't'.repeat(20),
        user: {
          uid: 42,
          name: 'Ruimin Yan (颜瑞民)',
          wcaId: '2017YANR02',
          avatar: '',
        },
      }),
      request,
      showShareMenu: vi.fn(),
    });

    page.onLoad();

    expect(page.data).toMatchObject({
      displayName: 'Ruimin Yan (颜瑞民)',
      loginRequired: false,
      uidText: '42',
      wcaId: '2017YANR02',
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('logs in with WeChat and keeps the user on the shareable native account page', async () => {
    const token = 'n'.repeat(20);
    let storedSession: unknown = null;
    const request = vi.fn((options: {
      data?: { code?: string };
      success(response: unknown): void;
      url: string;
    }) => {
      expect(options.url).toBe('https://api.cuberoot.me/v1/auth/wechat/miniprogram');
      expect(options.data).toEqual({ code: 'login-code' });
      options.success({
        statusCode: 200,
        data: {
          token,
          user: { uid: 52, name: '', wcaId: null, avatar: '' },
          isNew: true,
        },
      });
    });
    const page = await loadPage({
      getLaunchOptionsSync: normalLaunchOptions,
      getStorageSync: () => storedSession,
      login(options: { success(result: { code: string }): void }) {
        options.success({ code: ' login-code ' });
      },
      removeStorageSync: vi.fn(),
      request,
      setStorageSync(_key: string, value: unknown) {
        storedSession = value;
      },
      showShareMenu: vi.fn(),
    });

    page.onLoad();
    await page.loginWithWechat();

    expect(request).toHaveBeenCalledOnce();
    expect(page.data).toMatchObject({
      displayName: 'CubeRoot 用户',
      loginBusy: false,
      loginError: '',
      loginRequired: false,
      uidText: '52',
      wcaId: '',
    });
  });

  it('keeps the native login gate actionable when WeChat login fails', async () => {
    const page = await loadPage({
      getLaunchOptionsSync: normalLaunchOptions,
      getStorageSync: () => null,
      login(options: { fail(result: { errMsg: string }): void }) {
        options.fail({ errMsg: 'login failed' });
      },
      showShareMenu: vi.fn(),
    });

    page.onLoad();
    await page.loginWithWechat();

    expect(page.data).toMatchObject({
      loginBusy: false,
      loginError: '网络连接失败，请检查网络',
      loginRequired: true,
    });
  });

  it('offers a local-session retry when device storage cannot be read', async () => {
    let storageAvailable = false;
    const page = await loadPage({
      getLaunchOptionsSync: normalLaunchOptions,
      getStorageSync() {
        if (!storageAvailable) throw new Error('storage unavailable');
        return null;
      },
      showShareMenu: vi.fn(),
    });

    page.onLoad();

    expect(page.data).toMatchObject({
      loginError: '暂时无法读取设备上的登录状态，请重新读取。',
      loginRequired: true,
      loginStorageUnavailable: true,
    });

    storageAvailable = true;
    page.retryMiniProgramSession();

    expect(page.data).toMatchObject({
      loginError: '',
      loginRequired: true,
      loginStorageUnavailable: false,
    });
  });

  it('opens canonical website account management only after native login', async () => {
    const navigateTo = vi.fn((options: { complete?(): void }) => options.complete?.());
    const page = await loadPage({
      getLaunchOptionsSync: normalLaunchOptions,
      getStorageSync: () => ({
        token: 't'.repeat(20),
        user: { uid: 42, name: 'CubeRoot 用户', wcaId: null, avatar: '' },
      }),
      navigateTo,
      showShareMenu: vi.fn(),
    });

    page.onLoad();
    page.openAccount();

    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=account',
    }));
    expect(page.onShareAppMessage()).toEqual({
      imageUrl: '/assets/share-cover.png',
      path: '/pages/account/index',
      title: 'CubeRoot 魔方根',
    });
  });
});
