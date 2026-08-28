import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLATFORM_INTERACTION_LOCK_TIMEOUT_MS } from '../src/lib/platform-action-guard';
import accountConfig from '../src/pages/account/index.json';

interface AccountPage {
  data: Record<string, unknown>;
  login(): Promise<void>;
  onHide(): void;
  onPullDownRefresh(): void;
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent;
  onShareTimeline(): WechatMiniprogram.Page.ICustomTimelineContent;
  onShow(): void;
  onUnload(): void;
  refreshAccount(): Promise<void>;
  logout(): void;
  openAccount(): void;
  openPrivacy(): void;
  retrySync(): void;
  setData(data: Record<string, unknown>): void;
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

const storedSession = {
  token: 'valid-miniprogram-session-token',
  user: {
    uid: 42,
    name: 'CubeRoot 用户',
    wcaId: null,
    avatar: '',
  },
};

describe('mini program account page', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('enables native pull-down refresh for account reconciliation', () => {
    expect(accountConfig.enablePullDownRefresh).toBe(true);
  });

  it('shares a neutral account entry without user identity or session data', async () => {
    const showShareMenu = vi.fn();
    const page = await loadPage({
      getStorageSync: () => null,
      showShareMenu,
    });

    page.onShow();

    expect(showShareMenu).toHaveBeenCalledWith({
      menus: ['shareAppMessage', 'shareTimeline'],
    });
    expect(page.onShareAppMessage()).toEqual({
      imageUrl: '/assets/share-cover.png',
      title: 'CubeRoot 魔方根',
      path: '/pages/account/index',
    });
    expect(page.onShareTimeline()).toEqual({
      imageUrl: '/assets/share-cover.png',
      title: 'CubeRoot 魔方根',
    });
  });

  it('reuses account validation and stops pull-down feedback after it settles', async () => {
    const stopPullDownRefresh = vi.fn();
    const request = vi.fn((options: { success(response: unknown): void }) => {
      options.success({ statusCode: 200, data: { user: storedSession.user } });
    });
    const page = await loadPage({
      getStorageSync: () => storedSession,
      removeStorageSync: vi.fn(),
      request,
      setStorageSync: vi.fn(),
      stopPullDownRefresh,
    });

    page.onPullDownRefresh();

    await vi.waitFor(() => expect(page.data.syncState).toBe('ready'));
    expect(request).toHaveBeenCalledOnce();
    expect(stopPullDownRefresh).toHaveBeenCalledOnce();
  });

  it('stops pull-down feedback immediately when there is no local account', async () => {
    const stopPullDownRefresh = vi.fn();
    const page = await loadPage({
      getStorageSync: () => null,
      stopPullDownRefresh,
    });

    page.onPullDownRefresh();

    await vi.waitFor(() => expect(stopPullDownRefresh).toHaveBeenCalledOnce());
    expect(page.data.loggedIn).toBe(false);
    expect(page.data.syncState).toBe('');
  });

  it('distinguishes unavailable storage from a signed-out account', async () => {
    const request = vi.fn();
    const page = await loadPage({
      getStorageSync() {
        throw new Error('storage unavailable');
      },
      request,
    });

    page.onShow();

    expect(page.data.loggedIn).toBe(false);
    expect(page.data.storageUnavailable).toBe(true);
    expect(page.data.syncState).toBe('error');
    expect(page.data.status).toContain('设备存储');
    expect(request).not.toHaveBeenCalled();
  });

  it('retries unavailable storage through the same account refresh flow', async () => {
    let storageReadable = false;
    const request = vi.fn((options: { success(response: unknown): void }) => {
      options.success({ statusCode: 200, data: { user: storedSession.user } });
    });
    const page = await loadPage({
      getStorageSync() {
        if (!storageReadable) throw new Error('storage unavailable');
        return storedSession;
      },
      removeStorageSync: vi.fn(),
      request,
      setStorageSync: vi.fn(),
    });

    page.onShow();
    expect(page.data.storageUnavailable).toBe(true);

    storageReadable = true;
    page.retrySync();

    await vi.waitFor(() => expect(page.data.syncState).toBe('ready'));
    expect(page.data.loggedIn).toBe(true);
    expect(page.data.storageUnavailable).toBe(false);
    expect(page.data.status).toBe('');
    expect(request).toHaveBeenCalledOnce();
  });

  it('surfaces a malformed session that cannot be removed as unavailable storage', async () => {
    const request = vi.fn();
    const page = await loadPage({
      getStorageSync: () => ({
        token: 'short',
        user: { name: 'CubeRoot', wcaId: null },
      }),
      removeStorageSync() {
        throw new Error('storage unavailable');
      },
      request,
    });

    page.onShow();

    expect(page.data.loggedIn).toBe(false);
    expect(page.data.storageUnavailable).toBe(true);
    expect(page.data.syncState).toBe('error');
    expect(page.data.status).toContain('设备存储');
    expect(request).not.toHaveBeenCalled();
  });

  it('stops pull-down feedback after account validation fails', async () => {
    const stopPullDownRefresh = vi.fn();
    const page = await loadPage({
      getStorageSync: () => storedSession,
      removeStorageSync: vi.fn(),
      request: vi.fn((options: { success(response: unknown): void }) => {
        options.success({ statusCode: 200, data: null });
      }),
      setStorageSync: vi.fn(),
      stopPullDownRefresh,
    });

    page.onPullDownRefresh();

    await vi.waitFor(() => expect(page.data.syncState).toBe('error'));
    expect(stopPullDownRefresh).toHaveBeenCalledOnce();
  });

  it('opens the allowlisted website account destination', async () => {
    const navigateTo = vi.fn();
    const page = await loadPage({ navigateTo });
    page.openAccount();

    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=account',
    }));
  });

  it('keeps account navigation failure visible when toast feedback is unavailable', async () => {
    const page = await loadPage({
      navigateTo(options: { fail?(): void }) {
        options.fail?.();
      },
      showToast() {
        throw new Error('toast unavailable');
      },
    });

    page.openAccount();

    expect(page.data.actionStatus).toBe('账号页暂时无法打开');
  });

  it('ignores a pending account navigation failure after the page is hidden', async () => {
    let fail: (() => void) | undefined;
    const showToast = vi.fn();
    const navigateTo = vi.fn((options: { fail?(): void }) => {
      fail = options.fail;
    });
    const page = await loadPage({ navigateTo, showToast });

    page.openAccount();
    page.onHide();
    fail?.();

    expect(showToast).not.toHaveBeenCalled();
    expect(page.data.actionStatus).toBe('');
    page.openAccount();
    expect(navigateTo).toHaveBeenCalledTimes(2);
  });

  it('opens the platform privacy contract when it is available', async () => {
    const navigateTo = vi.fn();
    const openPrivacyContract = vi.fn();
    const page = await loadPage({ navigateTo, openPrivacyContract });

    page.openPrivacy();

    expect(openPrivacyContract).toHaveBeenCalledOnce();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('clears a stale platform error without erasing account sync feedback', async () => {
    const openPrivacyContract = vi.fn();
    const page = await loadPage({ openPrivacyContract });
    page.setData({
      actionStatus: '上一次操作失败',
      status: '账号状态暂时无法更新，请稍后重试',
      statusError: true,
    });

    page.openPrivacy();

    expect(page.data.actionStatus).toBe('');
    expect(page.data.status).toBe('账号状态暂时无法更新，请稍后重试');
    expect(page.data.statusError).toBe(true);
  });

  it('opens only one privacy contract until the platform prompt settles', async () => {
    let contractOptions: { complete(): void } | undefined;
    const openPrivacyContract = vi.fn((options: typeof contractOptions) => {
      contractOptions = options;
    });
    const page = await loadPage({ openPrivacyContract });

    page.openPrivacy();
    page.openPrivacy();

    expect(openPrivacyContract).toHaveBeenCalledOnce();

    contractOptions?.complete();
    page.openPrivacy();

    expect(openPrivacyContract).toHaveBeenCalledTimes(2);
  });

  it('allows retrying the privacy contract when the platform drops every callback', async () => {
    vi.useFakeTimers();
    const openPrivacyContract = vi.fn();
    const page = await loadPage({ openPrivacyContract });

    page.openPrivacy();
    page.openPrivacy();
    expect(openPrivacyContract).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(5_000);
    page.openPrivacy();

    expect(openPrivacyContract).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(PLATFORM_INTERACTION_LOCK_TIMEOUT_MS - 5_000);
    page.openPrivacy();

    expect(openPrivacyContract).toHaveBeenCalledTimes(2);
  });

  it('ignores a privacy failure after the account page has been unloaded', async () => {
    let contractOptions: { fail(): void } | undefined;
    const navigateTo = vi.fn();
    const page = await loadPage({
      navigateTo,
      openPrivacyContract(options: typeof contractOptions) {
        contractOptions = options;
      },
    });

    page.openPrivacy();
    page.onUnload();
    contractOptions?.fail();

    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('falls back to the canonical website policy on unsupported base libraries', async () => {
    const navigateTo = vi.fn();
    const page = await loadPage({ navigateTo });

    page.openPrivacy();

    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=privacy',
    }));
  });

  it('falls back to the canonical website policy when the platform contract cannot open', async () => {
    const navigateTo = vi.fn();
    const openPrivacyContract = vi.fn((options: { fail(): void }) => options.fail());
    const page = await loadPage({ navigateTo, openPrivacyContract });

    page.openPrivacy();

    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=privacy',
    }));
  });

  it('falls back to the website policy when the privacy API throws', async () => {
    const navigateTo = vi.fn();
    const page = await loadPage({
      navigateTo,
      openPrivacyContract() {
        throw new Error('privacy contract unavailable');
      },
    });

    expect(() => page.openPrivacy()).not.toThrow();
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=privacy',
    }));
  });

  it('shows feedback when the privacy interaction cannot establish a recovery guard', async () => {
    const openPrivacyContract = vi.fn();
    const page = await loadPage({ openPrivacyContract });
    const timer = vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => {
      throw new Error('timer unavailable');
    });

    try {
      page.openPrivacy();
      expect(openPrivacyContract).not.toHaveBeenCalled();
      expect(page.data.actionStatus).toContain('隐私说明暂时无法打开');
    } finally {
      timer.mockRestore();
    }
  });

  it('clears the Mini Program session before opening the cross-platform logout route', async () => {
    const removeStorageSync = vi.fn();
    const navigateTo = vi.fn(() => {
      expect(removeStorageSync).toHaveBeenCalledWith('cuberoot:session');
    });
    const page = await loadPage({
      navigateTo,
      removeStorageSync,
      showModal: (options: { success(result: { confirm: boolean }): void }) => {
        options.success({ confirm: true });
      },
    });

    page.logout();

    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=logout',
    }));
    expect(removeStorageSync).toHaveBeenCalledWith('cuberoot:session');
    expect(page.data.loggedIn).toBe(false);
  });

  it('keeps the Mini Program logged out when the website logout route cannot open', async () => {
    const removeStorageSync = vi.fn();
    const showToast = vi.fn();
    const page = await loadPage({
      navigateTo: (options: { fail(): void }) => options.fail(),
      removeStorageSync,
      showModal: (options: { success(result: { confirm: boolean }): void }) => {
        options.success({ confirm: true });
      },
      showToast,
    });

    page.logout();

    expect(removeStorageSync).toHaveBeenCalledWith('cuberoot:session');
    expect(page.data.loggedIn).toBe(false);
    expect(showToast).toHaveBeenCalledWith({
      icon: 'none',
      title: '已退出小程序，网站退出暂未完成',
    });
  });

  it('does not claim logout succeeded when local session removal fails', async () => {
    const navigateTo = vi.fn();
    const page = await loadPage({
      navigateTo,
      removeStorageSync() {
        throw new Error('storage unavailable');
      },
      showModal: (options: { success(result: { confirm: boolean }): void }) => {
        options.success({ confirm: true });
      },
    });
    page.setData({ loggedIn: true });

    page.logout();

    expect(page.data.loggedIn).toBe(true);
    expect(page.data.statusError).toBe(true);
    expect(page.data.status).toContain('本地登录状态无法清除');
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('keeps the session intact when the logout confirmation cannot open', async () => {
    const removeStorageSync = vi.fn();
    const page = await loadPage({
      removeStorageSync,
      showModal() {
        throw new Error('modal unavailable');
      },
    });
    page.setData({ loggedIn: true });

    expect(() => page.logout()).not.toThrow();
    expect(page.data.loggedIn).toBe(true);
    expect(page.data.actionStatus).toContain('退出确认暂时无法打开');
    expect(removeStorageSync).not.toHaveBeenCalled();
  });

  it('shows feedback when logout cannot establish a recovery guard', async () => {
    const showModal = vi.fn();
    const page = await loadPage({ showModal });
    page.setData({ loggedIn: true });
    const timer = vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => {
      throw new Error('timer unavailable');
    });

    try {
      page.logout();
      expect(showModal).not.toHaveBeenCalled();
      expect(page.data.loggedIn).toBe(true);
      expect(page.data.actionStatus).toContain('退出确认暂时无法打开');
    } finally {
      timer.mockRestore();
    }
  });

  it('opens only one logout confirmation until the current prompt settles', async () => {
    let modalOptions: {
      complete(): void;
      success(result: { confirm: boolean }): void;
    } | undefined;
    const showModal = vi.fn((options: typeof modalOptions) => {
      modalOptions = options;
    });
    const page = await loadPage({ showModal });

    page.logout();
    page.logout();

    expect(showModal).toHaveBeenCalledOnce();

    modalOptions?.success({ confirm: false });
    modalOptions?.complete();
    page.logout();

    expect(showModal).toHaveBeenCalledTimes(2);
  });

  it('recovers when the logout confirmation fails asynchronously', async () => {
    const showModal = vi.fn((options: { fail(): void }) => options.fail());
    const page = await loadPage({ showModal });
    page.setData({ loggedIn: true });

    page.logout();
    page.logout();

    expect(page.data.loggedIn).toBe(true);
    expect(page.data.actionStatus).toContain('退出确认暂时无法打开');
    expect(showModal).toHaveBeenCalledTimes(2);
  });

  it('clears a stale logout prompt error when the next prompt is cancelled', async () => {
    let invocation = 0;
    const showModal = vi.fn((options: {
      fail(): void;
      success(result: { confirm: boolean }): void;
    }) => {
      invocation += 1;
      if (invocation === 1) options.fail();
      else options.success({ confirm: false });
    });
    const page = await loadPage({ showModal });
    page.setData({
      loggedIn: true,
      status: '账号状态暂时无法更新，请稍后重试',
      statusError: true,
    });

    page.logout();
    expect(page.data.actionStatus).toContain('退出确认暂时无法打开');

    page.logout();

    expect(page.data.actionStatus).toBe('');
    expect(page.data.status).toBe('账号状态暂时无法更新，请稍后重试');
    expect(page.data.loggedIn).toBe(true);
  });

  it('ignores a logout confirmation after the account page has been unloaded', async () => {
    let modalOptions: {
      complete(): void;
      success(result: { confirm: boolean }): void;
    } | undefined;
    const navigateTo = vi.fn();
    const removeStorageSync = vi.fn();
    const page = await loadPage({
      navigateTo,
      removeStorageSync,
      showModal(options: typeof modalOptions) {
        modalOptions = options;
      },
    });
    page.setData({ loggedIn: true });

    page.logout();
    page.onUnload();
    modalOptions?.success({ confirm: true });
    modalOptions?.complete();

    expect(page.data.loggedIn).toBe(true);
    expect(removeStorageSync).not.toHaveBeenCalled();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('does not let a stale confirmation release a newer confirmation lock', async () => {
    vi.useFakeTimers();
    const modals: Array<{
      complete(): void;
      success(result: { confirm: boolean }): void;
    }> = [];
    const page = await loadPage({
      showModal(options: (typeof modals)[number]) {
        modals.push(options);
      },
    });

    page.logout();
    vi.advanceTimersByTime(5_000);
    page.logout();
    expect(modals).toHaveLength(1);

    vi.advanceTimersByTime(PLATFORM_INTERACTION_LOCK_TIMEOUT_MS - 5_000);
    page.logout();
    expect(modals).toHaveLength(2);

    modals[0]?.complete();
    page.logout();
    expect(modals).toHaveLength(2);

    modals[1]?.success({ confirm: false });
    modals[1]?.complete();
    page.logout();
    expect(modals).toHaveLength(3);
  });

  it('shows cached identity as checking until the server confirms it', async () => {
    let completeRequest: ((response: unknown) => void) | undefined;
    const page = await loadPage({
      getStorageSync: () => storedSession,
      removeStorageSync: vi.fn(),
      request: vi.fn((options: { success(response: unknown): void }) => {
        completeRequest = options.success;
      }),
      setStorageSync: vi.fn(),
    });

    page.onShow();

    expect(page.data.loggedIn).toBe(true);
    expect(page.data.syncLabel).toBe('正在确认');
    expect(page.data.syncState).toBe('checking');

    completeRequest?.({ statusCode: 200, data: { user: storedSession.user } });
    await vi.waitFor(() => expect(page.data.syncState).toBe('ready'));
    expect(page.data.syncLabel).toBe('已就绪');
    expect(page.data.status).toBe('');
  });

  it('settles account checking when storage becomes unreadable after validation', async () => {
    let storageReads = 0;
    const page = await loadPage({
      getStorageSync() {
        storageReads += 1;
        if (storageReads >= 3) throw new Error('storage unavailable');
        return storedSession;
      },
      removeStorageSync: vi.fn(),
      request: vi.fn((options: { success(response: unknown): void }) => {
        options.success({ statusCode: 200, data: { user: storedSession.user } });
      }),
      setStorageSync: vi.fn(),
    });

    page.onShow();

    await vi.waitFor(() => expect(page.data.syncState).toBe('error'));
    expect(page.data.loggedIn).toBe(true);
    expect(page.data.storageUnavailable).toBe(true);
    expect(page.data.status).toContain('设备存储');
  });

  it('does not report ready when a confirmed identity cannot be persisted', async () => {
    const page = await loadPage({
      getStorageSync: () => storedSession,
      removeStorageSync: vi.fn(),
      request: vi.fn((options: { success(response: unknown): void }) => {
        options.success({ statusCode: 200, data: { user: storedSession.user } });
      }),
      setStorageSync() {
        throw new Error('storage unavailable');
      },
    });

    page.onShow();

    await vi.waitFor(() => expect(page.data.syncState).toBe('error'));
    expect(page.data.loggedIn).toBe(true);
    expect(page.data.syncLabel).toBe('待确认');
    expect(page.data.storageUnavailable).toBe(true);
    expect(page.data.status).toContain('设备存储暂时无法更新');
  });

  it('keeps an emoji account initial intact', async () => {
    const emojiSession = {
      ...storedSession,
      user: { ...storedSession.user, name: '🧩 CubeRoot' },
    };
    const page = await loadPage({
      getStorageSync: () => emojiSession,
      removeStorageSync: vi.fn(),
      request: vi.fn(),
    });

    page.onShow();

    expect(page.data.displayName).toBe('🧩 CubeRoot');
    expect(page.data.initial).toBe('🧩');
  });

  it('keeps a cached account but marks its state unconfirmed after a transient error', async () => {
    const page = await loadPage({
      getStorageSync: () => storedSession,
      removeStorageSync: vi.fn(),
      request: vi.fn((options: { success(response: unknown): void }) => {
        options.success({ statusCode: 200, data: null });
      }),
      setStorageSync: vi.fn(),
    });

    page.onShow();

    await vi.waitFor(() => expect(page.data.syncState).toBe('error'));
    expect(page.data.loggedIn).toBe(true);
    expect(page.data.syncLabel).toBe('待确认');
    expect(page.data.statusError).toBe(true);
  });

  it('retries a transient account check through the same validation flow', async () => {
    let requestCount = 0;
    const request = vi.fn((options: { success(response: unknown): void }) => {
      requestCount += 1;
      options.success(requestCount === 1
        ? { statusCode: 200, data: null }
        : { statusCode: 200, data: { user: storedSession.user } });
    });
    const page = await loadPage({
      getStorageSync: () => storedSession,
      removeStorageSync: vi.fn(),
      request,
      setStorageSync: vi.fn(),
    });

    page.onShow();
    await vi.waitFor(() => expect(page.data.syncState).toBe('error'));

    page.retrySync();

    await vi.waitFor(() => expect(page.data.syncState).toBe('ready'));
    expect(request).toHaveBeenCalledTimes(2);
    expect(page.data.syncLabel).toBe('已就绪');
    expect(page.data.status).toBe('');
    expect(page.data.statusError).toBe(false);
  });

  it('ignores an older validation result after a newer check succeeds', async () => {
    const requests: Array<(response: unknown) => void> = [];
    const page = await loadPage({
      getStorageSync: () => storedSession,
      removeStorageSync: vi.fn(),
      request: vi.fn((options: { success(response: unknown): void }) => {
        requests.push(options.success);
      }),
      setStorageSync: vi.fn(),
    });

    page.onShow();
    page.onShow();
    requests[1]?.({ statusCode: 200, data: { user: storedSession.user } });
    await vi.waitFor(() => expect(page.data.syncState).toBe('ready'));

    requests[0]?.({ statusCode: 200, data: null });
    await Promise.resolve();

    expect(page.data.syncState).toBe('ready');
    expect(page.data.syncLabel).toBe('已就绪');
    expect(page.data.statusError).toBe(false);
  });

  it('does not update a page after it has been unloaded', async () => {
    let completeRequest: ((response: unknown) => void) | undefined;
    const page = await loadPage({
      getStorageSync: () => storedSession,
      removeStorageSync: vi.fn(),
      request: vi.fn((options: { success(response: unknown): void }) => {
        completeRequest = options.success;
      }),
      setStorageSync: vi.fn(),
    });

    page.onShow();
    page.onUnload();
    const setData = vi.spyOn(page, 'setData');
    completeRequest?.({ statusCode: 200, data: { user: storedSession.user } });
    await Promise.resolve();

    expect(setData).not.toHaveBeenCalled();
  });

  it('keeps one login request across tab changes and restores the button after a hidden failure', async () => {
    let failLoginRequest: ((error: { errMsg: string }) => void) | undefined;
    const login = vi.fn((options: { success(result: { code: string }): void }) => {
      options.success({ code: 'login-code' });
    });
    const page = await loadPage({
      getStorageSync: () => null,
      login,
      removeStorageSync: vi.fn(),
      request: vi.fn((options: { fail(error: { errMsg: string }): void }) => {
        failLoginRequest = options.fail;
      }),
    });
    page.onShow();

    const firstLogin = page.login();
    page.onHide();
    page.onShow();
    expect(page.data.busy).toBe(true);

    await page.login();
    expect(login).toHaveBeenCalledOnce();

    page.onHide();
    failLoginRequest?.({ errMsg: 'network error' });
    await firstLogin;
    page.onShow();

    expect(page.data.busy).toBe(false);
    expect(login).toHaveBeenCalledOnce();
  });
});
