import {
  getStoredSessionSnapshot,
  isSessionStorageError,
  loginErrorMessage,
  loginWithWechat as performWechatLogin,
  type SessionData,
} from '../../lib/auth';
import { cancelWebsiteNavigation, openWebsitePageOnce } from '../../lib/navigation';
import { showPublicShareMenu, toTimelineShare } from '../../lib/share';
import { resolveAccountPageShare } from '../../lib/web-routes';

const TIMELINE_SCENE = 1154;
const accountShare = resolveAccountPageShare();

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

interface AccountPageInstance {
  data: AccountPageData;
  setData(data: Partial<AccountPageData>): void;
}

function isTimelineSinglePage(): boolean {
  try {
    return typeof wx.getLaunchOptionsSync === 'function'
      && wx.getLaunchOptionsSync().scene === TIMELINE_SCENE;
  } catch {
    return false;
  }
}

function setNormalNavigationTitle(): void {
  if (typeof wx.setNavigationBarTitle !== 'function') return;
  try {
    wx.setNavigationBarTitle({ title: '我的' });
  } catch {
    // A navigation title failure must not block account access.
  }
}

function sessionView(session: SessionData | null): Pick<
  AccountPageData,
  'displayName' | 'loginRequired' | 'uidText' | 'wcaId'
> {
  if (!session) {
    return {
      displayName: '',
      loginRequired: true,
      uidText: '',
      wcaId: '',
    };
  }
  return {
    displayName: session.user.name || 'CubeRoot 用户',
    loginRequired: false,
    uidText: session.user.uid === undefined ? '' : String(session.user.uid),
    wcaId: session.user.wcaId ?? '',
  };
}

function refreshStoredSession(page: AccountPageInstance): void {
  const snapshot = getStoredSessionSnapshot();
  if (snapshot.status === 'unavailable') {
    page.setData({
      ...sessionView(null),
      loginError: '暂时无法读取设备上的登录状态，请重新读取。',
      loginStorageUnavailable: true,
    });
    return;
  }
  page.setData({
    ...sessionView(snapshot.session),
    loginError: '',
    loginStorageUnavailable: false,
  });
}

Page<AccountPageData, WechatMiniprogram.Page.CustomOption>({
  data: {
    accountError: '',
    displayName: '',
    isTimelineEntry: false,
    loginBusy: false,
    loginError: '',
    loginRequired: true,
    loginStorageUnavailable: false,
    uidText: '',
    wcaId: '',
  },

  onLoad() {
    if (isTimelineSinglePage()) {
      this.setData({ isTimelineEntry: true });
      return;
    }
    setNormalNavigationTitle();
    showPublicShareMenu();
    refreshStoredSession(this as unknown as AccountPageInstance);
  },

  onShow() {
    if (this.data.isTimelineEntry) return;
    showPublicShareMenu();
    refreshStoredSession(this as unknown as AccountPageInstance);
  },

  onUnload() {
    cancelWebsiteNavigation(this);
  },

  onShareAppMessage() {
    return accountShare;
  },

  onShareTimeline() {
    return toTimelineShare(accountShare);
  },

  async loginWithWechat() {
    if (this.data.isTimelineEntry || this.data.loginBusy) return;
    this.setData({ loginBusy: true, loginError: '' });
    try {
      const session = await performWechatLogin();
      this.setData({
        ...sessionView(session),
        loginBusy: false,
        loginError: '',
        loginStorageUnavailable: false,
      });
    } catch (error) {
      this.setData({
        loginBusy: false,
        loginError: loginErrorMessage(error),
        loginStorageUnavailable: isSessionStorageError(error),
      });
    }
  },

  retryMiniProgramSession() {
    if (this.data.isTimelineEntry) return;
    refreshStoredSession(this as unknown as AccountPageInstance);
  },

  openAccount() {
    if (this.data.isTimelineEntry || this.data.loginRequired) return;
    this.setData({ accountError: '' });
    openWebsitePageOnce(this, 'account', {
      failureMessage: '账号管理暂时无法打开，请稍后重试',
      onFailure: (message) => this.setData({ accountError: message }),
    });
  },
});
