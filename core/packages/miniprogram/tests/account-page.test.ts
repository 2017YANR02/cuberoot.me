import { afterEach, describe, expect, it, vi } from 'vitest';

interface AccountPage {
  data: Record<string, unknown>;
  login(): Promise<void>;
  onHide(): void;
  onShow(): void;
  onUnload(): void;
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
    id: 42,
    name: 'CubeRoot 用户',
    wcaId: null,
  },
};

describe('mini program account page', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('opens the allowlisted website account destination', async () => {
    const navigateTo = vi.fn();
    const page = await loadPage({ navigateTo });
    page.openAccount();

    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=account',
    }));
  });

  it('opens the platform privacy contract when it is available', async () => {
    const navigateTo = vi.fn();
    const openPrivacyContract = vi.fn();
    const page = await loadPage({ navigateTo, openPrivacyContract });

    page.openPrivacy();

    expect(openPrivacyContract).toHaveBeenCalledOnce();
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
