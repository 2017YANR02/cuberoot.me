import {
  ApiError,
  clearStoredSession,
  getStoredSession,
  loginErrorMessage,
  loginWithWechat,
  validateStoredSession,
  type SessionData,
} from '../../lib/auth';
import { openWebsitePageOnce } from '../../lib/navigation';

const activePages = new WeakSet<object>();
const activeLogins = new WeakSet<object>();
const validationAttempts = new WeakMap<object, number>();

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
}

function accountInitial(name: string): string {
  return Array.from(name)[0]?.toUpperCase() || 'C';
}

Page({
  data: {
    busy: false,
    displayName: '',
    initial: 'C',
    loggedIn: false,
    status: '',
    statusError: false,
    syncLabel: '',
    syncState: '',
    wcaId: '',
  },

  onShow() {
    activePages.add(this);
    const validationAttempt = beginValidation(this);
    this.setData({
      busy: activeLogins.has(this),
      status: '',
      statusError: false,
    });
    const session = getStoredSession();
    this.showSession(session);
    if (!session) {
      this.showSyncState('');
      return;
    }
    this.showSyncState('checking');
    void validateStoredSession(session).then((next) => {
      if (!validationIsCurrent(this, validationAttempt)) return;
      if (getStoredSession()?.token !== session.token) return;
      this.showSession(next);
      this.showSyncState('ready');
      this.setData({ status: '', statusError: false });
    }).catch((error: unknown) => {
      if (!validationIsCurrent(this, validationAttempt)) return;
      if (getStoredSession()?.token !== session.token) return;
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
    });
  },

  onHide() {
    pausePage(this);
  },

  onUnload() {
    pausePage(this);
  },

  showSession(session: SessionData | null) {
    const name = session?.user.name.trim() || 'CubeRoot 用户';
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

  retrySync() {
    if (this.data.syncState !== 'error') return;
    this.onShow();
  },

  async login() {
    if (activeLogins.has(this)) return;
    activeLogins.add(this);
    activePages.add(this);
    this.setData({ busy: true, status: '', statusError: false });
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
    openWebsitePageOnce(this, 'account', {
      failureMessage: '账号页暂时无法打开',
    });
  },

  openPrivacy() {
    const openWebsitePrivacy = () => {
      openWebsitePageOnce(this, 'privacy', {
        failureMessage: '隐私说明暂时无法打开',
      });
    };

    if (typeof wx.openPrivacyContract !== 'function') {
      openWebsitePrivacy();
      return;
    }

    try {
      wx.openPrivacyContract({
        fail: openWebsitePrivacy,
      });
    } catch {
      openWebsitePrivacy();
    }
  },

  logout() {
    try {
      wx.showModal({
        title: '退出登录',
        content: '将退出小程序，并尝试同时退出网站账号。本机计时记录不会被删除。',
        success: (result) => {
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

          openWebsitePageOnce(this, 'logout', {
            failureMessage: '已退出小程序，网站退出暂未完成',
          });
        },
      });
    } catch {
      this.setData({ status: '退出确认暂时无法打开，请重试', statusError: true });
    }
  },
});
