import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTACT_GROUP_COUNT } from '@cuberoot/shared/contact';

import accountConfig from '../src/pages/account/index.json';

interface AccountPageData {
  accountError: string;
  accountLinkPending: boolean;
  accountLinkRequired: boolean;
  agreementAccepted: boolean;
  contact: {
    details: Array<{
      action: 'none' | 'copy' | 'link';
      actionValue: string;
      icon: string;
      id: string;
      label: string;
      showQr: boolean;
      value: string;
    }>;
    platforms: Array<{ href: string; icon: string; id: string }>;
    qrPath: string;
    sections: Array<{
      blocks: Array<{ groups: Array<{ name: string; secondaryName: string }> }>;
      id: string;
    }>;
  };
  displayName: string;
  isTimelineEntry: boolean;
  loginBusy: boolean;
  loginError: string;
  loginRequired: boolean;
  loginStorageUnavailable: boolean;
  release: {
    channel: string;
    notes: string[];
    notesTitle: string;
    version: string;
    versionLabel: string;
  };
  requiresAgreement: boolean;
  uidText: string;
  wcaId: string;
}

interface AccountPage {
  copyContactValue(event: { currentTarget: { dataset: { value?: unknown } } }): void;
  createAccount(): Promise<void>;
  data: AccountPageData;
  linkExistingAccount(): void;
  loginWithMiniProgram(): Promise<void>;
  onLoad(): void;
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent;
  onShareTimeline(): WechatMiniprogram.Page.ICustomTimelineContent;
  onShow(): void;
  openAccount(): void;
  openContactWebsite(): void;
  openPolicy(): void;
  previewWechatQr(): void;
  retryMiniProgramSession(): void;
  setData(data: Partial<AccountPageData>): void;
  toggleAgreement(): void;
}

async function loadPage(
  api: Record<string, unknown>,
  target: 'wechat' | 'douyin' = 'wechat',
): Promise<AccountPage> {
  let page: AccountPage | undefined;
  vi.stubGlobal('__MINI_PROGRAM_TARGET__', target);
  vi.stubGlobal(target === 'douyin' ? 'tt' : 'wx', api);
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
      getAccountInfoSync: () => ({
        miniProgram: { envVersion: 'release', version: '1.2.1' },
      }),
      getLaunchOptionsSync: normalLaunchOptions,
      getStorageSync: () => null,
      setNavigationBarTitle,
      showShareMenu,
    });

    page.onLoad();

    expect(accountConfig).toEqual({ navigationBarTitleText: '' });
    expect(page.data).toMatchObject({
      isTimelineEntry: false,
      loginRequired: true,
      loginStorageUnavailable: false,
      release: {
        channel: '正式版',
        notes: [
          '打开任一功能页前都会先检查登录状态',
          '新增运行版本与更新日志',
          '优化账号与联系信息展示',
        ],
        notesTitle: '更新日志',
        version: '1.2.1',
        versionLabel: '版本',
      },
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
    await page.loginWithMiniProgram();
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
      title: '魔方根CubeRoot',
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

  it('requires manual consent before starting Douyin sign-in', async () => {
    const token = 'd'.repeat(20);
    const login = vi.fn((options: {
      force?: boolean;
      success(result: { code: string; isLogin: boolean }): void;
    }) => {
      expect(options.force).toBe(true);
      options.success({ code: 'douyin-code', isLogin: true });
    });
    const request = vi.fn((options: {
      data?: { code?: string };
      success(response: unknown): void;
      url: string;
    }) => {
      expect(options.url).toBe('https://api.cuberoot.me/v1/auth/douyin/miniprogram');
      expect(options.data).toEqual({ code: 'douyin-code' });
      options.success({
        statusCode: 200,
        data: {
          token,
          user: { uid: 62, name: '', wcaId: null, avatar: '' },
          isNew: true,
        },
      });
    });
    const page = await loadPage({
      getStorageSync: () => null,
      login,
      removeStorageSync: vi.fn(),
      request,
      setStorageSync: vi.fn(),
      showShareMenu: vi.fn(),
    }, 'douyin');

    page.onLoad();
    await page.loginWithMiniProgram();

    expect(page.data).toMatchObject({
      agreementAccepted: false,
      loginError: '请先阅读用户协议和隐私政策，并手动确认同意后再登录',
      loginRequired: true,
      requiresAgreement: true,
    });
    expect(login).not.toHaveBeenCalled();

    page.toggleAgreement();
    await page.loginWithMiniProgram();

    expect(login).toHaveBeenCalledOnce();
    expect(page.data).toMatchObject({
      agreementAccepted: true,
      displayName: 'CubeRoot 用户',
      loginError: '',
      loginRequired: false,
    });
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
    await page.loginWithMiniProgram();

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

  it('requires an unknown WeChat identity to link or explicitly create an account', async () => {
    const token = 'n'.repeat(20);
    let requestCount = 0;
    let storedSession: unknown = null;
    const navigateTo = vi.fn((options: { complete?(): void }) => options.complete?.());
    const request = vi.fn((options: {
      data?: { code?: string };
      success(response: unknown): void;
    }) => {
      requestCount += 1;
      if (requestCount === 1) {
        options.success({
          statusCode: 409,
          data: {
            code: 'WECHAT_ACCOUNT_LINK_REQUIRED',
            message: 'link required',
            error: 'link required',
          },
        });
        return;
      }
      options.success({
        statusCode: 200,
        data: {
          token,
          user: { uid: 66, name: 'Existing user', wcaId: null, avatar: '' },
          isNew: false,
        },
      });
    });
    const page = await loadPage({
      getLaunchOptionsSync: normalLaunchOptions,
      getStorageSync: () => storedSession,
      login(options: { success(result: { code: string }): void }) {
        options.success({ code: `login-code-${requestCount + 1}` });
      },
      navigateTo,
      removeStorageSync: vi.fn(),
      request,
      setStorageSync(_key: string, value: unknown) {
        storedSession = value;
      },
      showShareMenu: vi.fn(),
    });

    page.onLoad();
    await page.loginWithMiniProgram();

    expect(page.data).toMatchObject({
      accountLinkRequired: true,
      loginRequired: true,
    });

    page.linkExistingAccount();
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=account-link',
    }));

    page.onShow();
    await vi.waitFor(() => {
      expect(page.data).toMatchObject({
        accountLinkRequired: false,
        displayName: 'Existing user',
        loginRequired: false,
        uidText: '66',
      });
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
    await page.loginWithMiniProgram();

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
      title: '魔方根CubeRoot',
    });
  });

  it('uses the shared contact directory and copies native contact actions', async () => {
    const navigateTo = vi.fn((options: { complete?(): void }) => options.complete?.());
    const setClipboardData = vi.fn((options: { success?(): void }) => options.success?.());
    const showToast = vi.fn();
    const previewImage = vi.fn();
    const page = await loadPage({
      getLaunchOptionsSync: normalLaunchOptions,
      getStorageSync: () => ({
        token: 't'.repeat(20),
        user: { uid: 66, name: 'Ruimin Yan (颜瑞民)', wcaId: null, avatar: '' },
      }),
      navigateTo,
      previewImage,
      setClipboardData,
      showShareMenu: vi.fn(),
      showToast,
    });

    page.onLoad();

    const groupCount = page.data.contact.sections.reduce(
      (total, section) => total + section.blocks.reduce(
        (sectionTotal, block) => sectionTotal + block.groups.length,
        0,
      ),
      0,
    );
    expect(page.data.contact.platforms).toHaveLength(8);
    expect(page.data.contact.details).toHaveLength(5);
    expect(page.data.contact.platforms.every((platform) => platform.icon.startsWith('/assets/contact/')))
      .toBe(true);
    expect(page.data.contact.details.every((detail) => detail.icon.startsWith('/assets/contact/')))
      .toBe(true);
    expect(groupCount).toBe(CONTACT_GROUP_COUNT);

    page.copyContactValue({ currentTarget: { dataset: { value: 'mofanggen' } } });
    expect(setClipboardData).toHaveBeenCalledWith(expect.objectContaining({ data: 'mofanggen' }));
    expect(showToast).toHaveBeenCalledWith({ icon: 'none', title: '已复制' });

    page.openContactWebsite();
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=contact',
    }));

    page.previewWechatQr();
    expect(previewImage).toHaveBeenCalledWith({
      current: '/assets/contact/ruimin-wechat-qr.jpg',
      urls: ['/assets/contact/ruimin-wechat-qr.jpg'],
    });
  });
});
