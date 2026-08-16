import {
  ApiError,
  clearStoredSession,
  getStoredSession,
  loginErrorMessage,
  loginWithWechat,
  validateStoredSession,
  type SessionData,
} from '../../lib/auth';

const activePages = new WeakSet<object>();
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
    this.setData({ status: '', statusError: false });
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
        clearStoredSession();
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
      initial: name.slice(0, 1).toUpperCase(),
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

  async login() {
    if (this.data.busy) return;
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
      if (activePages.has(this)) this.setData({ busy: false });
    }
  },

  openAccount() {
    wx.navigateTo({
      url: '/pages/web/index?key=account',
      fail: () => {
        wx.showToast({ icon: 'none', title: '账号页暂时无法打开' });
      },
    });
  },

  openPrivacy() {
    const openWebsitePrivacy = () => {
      wx.navigateTo({
        url: '/pages/web/index?key=privacy',
        fail: () => {
          wx.showToast({ icon: 'none', title: '隐私说明暂时无法打开' });
        },
      });
    };

    if (typeof wx.openPrivacyContract !== 'function') {
      openWebsitePrivacy();
      return;
    }

    wx.openPrivacyContract({
      fail: openWebsitePrivacy,
    });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '将同时退出小程序和网站账号，本机计时记录不会被删除。',
      success: (result) => {
        if (!result.confirm) return;
        wx.navigateTo({
          url: '/pages/web/index?key=logout',
          success: () => {
            clearStoredSession();
            this.showSession(null);
            this.showSyncState('');
            this.setData({ status: '', statusError: false });
          },
          fail: () => {
            wx.showToast({ icon: 'none', title: '退出失败，请重试' });
          },
        });
      },
    });
  },
});
