import {
  ApiError,
  clearStoredSession,
  getStoredSessionSnapshot,
  isSessionStorageError,
  loginErrorMessage,
  loginWithWechat,
  validateStoredSession,
  type SessionData,
} from '../../lib/auth';
import {
  cancelWebsiteNavigation,
  openWebsitePageOnce,
} from '../../lib/navigation';
import {
  createPlatformActionGuard,
  PLATFORM_INTERACTION_LOCK_TIMEOUT_MS,
} from '../../lib/platform-action-guard';
import { SITE_HOST } from '../../lib/runtime-config';
import { resolveAccountPageShare } from '../../lib/web-routes';
import { showPublicShareMenu, toTimelineShare } from '../../lib/share';

const activePages = new WeakSet<object>();
const activeLogins = new WeakSet<object>();
const validationAttempts = new WeakMap<object, number>();
const logoutConfirmations = createPlatformActionGuard(
  PLATFORM_INTERACTION_LOCK_TIMEOUT_MS,
);
const privacyContracts = createPlatformActionGuard(
  PLATFORM_INTERACTION_LOCK_TIMEOUT_MS,
);

function beginValidation(page: object): number {
  const attempt = (validationAttempts.get(page) ?? 0) + 1;
  validationAttempts.set(page, attempt);
  return attempt;
}

function validationIsCurrent(page: object, attempt: number): boolean {
  return activePages.has(page) && validationAttempts.get(page) === attempt;
}

function pausePage(page: object): void {
  activePages.delete(page);
  beginValidation(page);
  cancelWebsiteNavigation(page);
  logoutConfirmations.cancel(page);
  privacyContracts.cancel(page);
}

function accountInitial(name: string): string {
  return Array.from(name)[0]?.toUpperCase() || 'C';
}

function stopPullDownRefresh(): void {
  if (typeof wx.stopPullDownRefresh !== 'function') return;
  try {
    wx.stopPullDownRefresh();
  } catch {
    // Refresh feedback is cosmetic; account state has already settled.
  }
}

Page({
  data: {
    actionStatus: '',
    busy: false,
    displayName: '',
    initial: 'C',
    loggedIn: false,
    status: '',
    statusError: false,
    siteHost: SITE_HOST,
    syncLabel: '',
    syncState: '',
    storageUnavailable: false,
    wcaId: '',
  },

  onShow() {
    showPublicShareMenu();
    void this.refreshAccount();
  },

  onShareAppMessage() {
    return resolveAccountPageShare();
  },

  onShareTimeline() {
    return toTimelineShare(resolveAccountPageShare());
  },

  async refreshAccount() {
    activePages.add(this);
    const validationAttempt = beginValidation(this);
    this.setData({
      actionStatus: '',
      busy: activeLogins.has(this),
      status: '',
      statusError: false,
      storageUnavailable: false,
    });
    const stored = getStoredSessionSnapshot();
    if (stored.status === 'unavailable') {
      this.showStorageUnavailable();
      return;
    }
    const { session } = stored;
    this.showSession(session);
    if (!session) {
      this.showSyncState('');
      return;
    }
    this.showSyncState('checking');
    try {
      const next = await validateStoredSession(session);
      if (!validationIsCurrent(this, validationAttempt)) return;
      const current = getStoredSessionSnapshot();
      if (current.status === 'unavailable') {
        this.showStorageUnavailable('账号已确认，但设备存储暂时无法读取，请稍后重试');
        return;
      }
      if (current.session?.token !== session.token) return;
      this.showSession(next);
      this.showSyncState('ready');
      this.setData({ status: '', statusError: false });
    } catch (error: unknown) {
      if (!validationIsCurrent(this, validationAttempt)) return;
      const current = getStoredSessionSnapshot();
      if (current.status === 'unavailable') {
        this.showStorageUnavailable();
        return;
      }
      if (current.session?.token !== session.token) return;
      if (isSessionStorageError(error)) {
        this.showStorageUnavailable('账号已确认，但设备存储暂时无法更新，请清理空间后重试');
        return;
      }
      if (error instanceof ApiError && error.status === 401) {
        if (!clearStoredSession()) {
          this.showSyncState('error');
          this.setData({
            status: '登录已过期，但本地状态无法清除，请清理空间后重试',
            statusError: true,
          });
          return;
        }
        this.showSession(null);
        this.showSyncState('');
        this.setData({ status: '登录已过期，请重新登录', statusError: true });
        return;
      }
      this.showSyncState('error');
      this.setData({ status: '账号状态暂时无法更新，请稍后重试', statusError: true });
    }
  },

  onPullDownRefresh() {
    void this.refreshAccount().finally(stopPullDownRefresh);
  },

  onHide() {
    pausePage(this);
  },

  onUnload() {
    pausePage(this);
  },

  showSession(session: SessionData | null) {
    const name = session?.user.name ?? 'CubeRoot 用户';
    this.setData({
      displayName: name,
      initial: accountInitial(name),
      loggedIn: session !== null,
      wcaId: session?.user.wcaId ?? '',
    });
  },

  showSyncState(state: '' | 'checking' | 'ready' | 'error') {
    const labels = {
      '': '',
      checking: '正在确认',
      error: '待确认',
      ready: '已就绪',
    };
    this.setData({ syncLabel: labels[state], syncState: state });
  },

  showStorageUnavailable(status = '设备存储暂时无法读取，请稍后重试') {
    this.showSyncState('error');
    this.setData({ status, statusError: true, storageUnavailable: true });
  },

  retrySync() {
    if (this.data.syncState !== 'error') return;
    void this.refreshAccount();
  },

  async login() {
    if (activeLogins.has(this)) return;
    activeLogins.add(this);
    activePages.add(this);
    this.setData({
      actionStatus: '',
      busy: true,
      status: '',
      statusError: false,
    });
    try {
      const session = await loginWithWechat();
      if (!activePages.has(this)) return;
      this.showSession(session);
      this.showSyncState('ready');
      this.setData({
        status: session.isNew ? '账号已创建并登录' : '登录成功',
        statusError: false,
      });
    } catch (error) {
      if (!activePages.has(this)) return;
      this.setData({ status: loginErrorMessage(error), statusError: true });
    } finally {
      activeLogins.delete(this);
      if (activePages.has(this)) this.setData({ busy: false });
    }
  },

  openAccount() {
    this.openWebsiteAction('account', '账号页暂时无法打开');
  },

  openSupport() {
    this.openWebsiteAction('support', '网站暂时无法打开');
  },

  openWebsiteAction(key: 'account' | 'logout' | 'privacy' | 'support', failureMessage: string) {
    this.setData({ actionStatus: '' });
    openWebsitePageOnce(this, key, {
      failureMessage,
      onFailure: (actionStatus) => this.setData({ actionStatus }),
    });
  },

  openPrivacy() {
    if (typeof wx.openPrivacyContract !== 'function') {
      this.openWebsiteAction('privacy', '隐私说明暂时无法打开');
      return;
    }

    if (privacyContracts.isActive(this)) return;
    this.setData({ actionStatus: '' });
    const privacyAttempt = privacyContracts.begin(this);
    if (privacyAttempt === null) {
      this.setData({ actionStatus: '隐私说明暂时无法打开，请重试' });
      return;
    }
    const openWebsitePrivacy = () => {
      if (!privacyContracts.settle(this, privacyAttempt)) return;
      this.openWebsiteAction('privacy', '隐私说明暂时无法打开');
    };

    try {
      wx.openPrivacyContract({
        success: () => {
          privacyContracts.settle(this, privacyAttempt);
        },
        fail: openWebsitePrivacy,
        complete: () => {
          privacyContracts.settle(this, privacyAttempt);
        },
      });
    } catch {
      openWebsitePrivacy();
    }
  },

  logout() {
    if (logoutConfirmations.isActive(this)) return;
    this.setData({ actionStatus: '' });
    const confirmationAttempt = logoutConfirmations.begin(this);
    if (confirmationAttempt === null) {
      this.setData({ actionStatus: '退出确认暂时无法打开，请重试' });
      return;
    }
    try {
      wx.showModal({
        title: '退出登录',
        content: '将退出小程序，并尝试同时退出网站账号。本机计时记录不会被删除。',
        success: (result) => {
          if (!logoutConfirmations.settle(this, confirmationAttempt)) return;
          if (!result.confirm) return;

          if (!clearStoredSession()) {
            this.setData({
              status: '本地登录状态无法清除，请清理空间后重试',
              statusError: true,
            });
            return;
          }
          this.showSession(null);
          this.showSyncState('');
          this.setData({ status: '', statusError: false });

          this.openWebsiteAction('logout', '已退出小程序，网站退出暂未完成');
        },
        fail: () => {
          if (!logoutConfirmations.settle(this, confirmationAttempt)) return;
          this.setData({ actionStatus: '退出确认暂时无法打开，请重试' });
        },
        complete: () => {
          logoutConfirmations.settle(this, confirmationAttempt);
        },
      });
    } catch {
      if (logoutConfirmations.settle(this, confirmationAttempt)) {
        this.setData({ actionStatus: '退出确认暂时无法打开，请重试' });
      }
    }
  },
});
