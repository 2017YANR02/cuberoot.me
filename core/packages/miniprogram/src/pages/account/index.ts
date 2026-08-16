import {
  ApiError,
  clearStoredSession,
  getStoredSession,
  loginErrorMessage,
  loginWithWechat,
  validateStoredSession,
  type SessionData,
} from '../../lib/auth';

Page({
  data: {
    busy: false,
    displayName: '',
    initial: 'C',
    loggedIn: false,
    status: '',
    statusError: false,
    wcaId: '',
  },

  onShow() {
    const session = getStoredSession();
    this.showSession(session);
    if (!session) return;
    void validateStoredSession(session).then((next) => {
      if (getStoredSession()?.token !== session.token) return;
      this.showSession(next);
    }).catch((error: unknown) => {
      if (getStoredSession()?.token !== session.token) return;
      if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
        this.showSession(null);
        this.setData({ status: '登录已过期，请重新登录', statusError: true });
      }
    });
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

  async login() {
    if (this.data.busy) return;
    this.setData({ busy: true, status: '', statusError: false });
    try {
      const session = await loginWithWechat();
      this.showSession(session);
      this.setData({
        status: session.isNew ? '账号已创建并登录' : '登录成功',
        statusError: false,
      });
    } catch (error) {
      this.setData({ status: loginErrorMessage(error), statusError: true });
    } finally {
      this.setData({ busy: false });
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
      content: '本机计时记录不会被删除。',
      success: (result) => {
        if (!result.confirm) return;
        clearStoredSession();
        this.showSession(null);
        this.setData({ status: '', statusError: false });
      },
    });
  },
});
