import {
  clearStoredSession,
  getStoredSessionSnapshot,
  isSessionStorageError,
  loginErrorMessage,
  loginWithMiniProgram,
  type SessionData,
} from '../../lib/auth';
import { cancelWebsiteNavigation, openWebsitePageOnce } from '../../lib/navigation';
import { showPublicShareMenu, toTimelineShare } from '../../lib/share';
import { resolveAccountPageShare } from '../../lib/web-routes';
import { tr } from '../../lib/i18n';
import { isDouyinMiniProgram, miniProgramApi } from '../../lib/platform';

const TIMELINE_SCENE = 1154;
const providerName = tr(isDouyinMiniProgram()
  ? { en: 'Douyin', zh: '抖音' }
  : { en: 'WeChat', zh: '微信' });
const ACCOUNT_COPY = {
  agreementLabel: tr({
    en: 'I have read and agree to the terms above',
    zh: '我已阅读并同意以上内容',
  }),
  agreementRequired: tr({
    en: 'Read the User Agreement and Privacy Policy, then confirm your agreement before signing in.',
    zh: '请先阅读用户协议和隐私政策，并手动确认同意后再登录',
  }),
  accountButtonAria: tr({ en: 'CubeRoot account', zh: 'CubeRoot 账号管理' }),
  accountButtonLabel: tr({ en: 'Account', zh: '账号管理' }),
  accountFailure: tr({
    en: 'Account management is temporarily unavailable. Try again later.',
    zh: '账号管理暂时无法打开，请稍后重试',
  }),
  defaultUser: tr({ en: 'CubeRoot user', zh: 'CubeRoot 用户' }),
  entryCopy: tr({
    en: 'Tap the bottom-right button to open CubeRoot',
    zh: '点击右下角进入魔方根',
  }),
  loginButtonBusyLabel: tr({
    en: `Signing in with ${providerName}`,
    zh: `${providerName}登录处理中`,
  }),
  loginButtonLabel: tr({
    en: `Sign in with ${providerName}`,
    zh: `${providerName}登录`,
  }),
  loginIntro: isDouyinMiniProgram()
    ? tr({
      en: 'Sign in to use your CubeRoot account. Your first Douyin sign-in creates a separate account; accounts are not merged by nickname or phone number.',
      zh: '登录后使用 CubeRoot 账号。首次使用抖音登录会创建独立账号，不会按昵称或手机号自动合并。',
    })
    : tr({
      en: 'Sign in with the same CubeRoot account you use on the website. If you have already used WeChat there, the same account is recognized automatically.',
      zh: '登录后使用与网站相同的 CubeRoot 账号。已在网站通过微信登录过时，会自动识别为同一账号。',
    }),
  loginNote: isDouyinMiniProgram()
    ? tr({
      en: 'We do not read your Douyin nickname or phone number. Only your Douyin account identifier is used to sign you in.',
      zh: '不会读取抖音昵称或手机号，仅使用抖音账号标识完成登录。',
    })
    : tr({
      en: 'We do not read your WeChat nickname or phone number. Sign-in stops if UnionID is unavailable, preventing duplicate accounts.',
      zh: '不会读取微信昵称或手机号。无法获得 UnionID 时会停止登录，避免创建重复账号。',
    }),
  logoutFailure: tr({
    en: 'Unable to clear the local sign-in state. Try again.',
    zh: '暂时无法清除本机登录状态，请重试',
  }),
  logoutLabel: tr({ en: 'Sign out on this device', zh: '退出本机账号' }),
  logoutWebsiteFailure: tr({
    en: 'Signed out locally, but website sign-out could not be opened. Try again.',
    zh: '本机已退出，但网站退出页暂时无法打开，请重试',
  }),
  pageTitle: tr({ en: 'Me', zh: '我的' }),
  policyFailure: tr({
    en: 'The User Agreement and Privacy Policy are temporarily unavailable. Try again later.',
    zh: '用户协议与隐私政策暂时无法打开，请稍后重试',
  }),
  privacyLabel: tr({ en: 'Privacy Policy', zh: '《隐私政策》' }),
  retrySessionAria: tr({
    en: 'Read the device sign-in state again',
    zh: '重新读取设备登录状态',
  }),
  retrySessionLabel: tr({ en: 'Try again', zh: '重新读取' }),
  shareNote: isDouyinMiniProgram()
    ? tr({ en: 'Tap "..." in the top-right to share CubeRoot', zh: '点击右上角“...”分享 CubeRoot' })
    : tr({ en: 'Tap "..." in the top-right to share to Moments', zh: '点击右上角“...”分享到朋友圈' }),
  signingInLabel: tr({ en: 'Signing in', zh: '正在登录' }),
  storageUnavailable: tr({
    en: 'Unable to read the sign-in state on this device. Try again.',
    zh: '暂时无法读取设备上的登录状态，请重新读取。',
  }),
  userAgreementLabel: tr({ en: 'User Agreement', zh: '《用户协议》' }),
};
const accountShare = resolveAccountPageShare();

interface AccountPageData {
  accountError: string;
  agreementAccepted: boolean;
  copy: typeof ACCOUNT_COPY;
  displayName: string;
  isTimelineEntry: boolean;
  loginBusy: boolean;
  loginError: string;
  loginRequired: boolean;
  loginStorageUnavailable: boolean;
  loginButtonBusyLabel: string;
  loginButtonLabel: string;
  loginIntro: string;
  loginNote: string;
  requiresAgreement: boolean;
  shareNote: string;
  uidText: string;
  wcaId: string;
}

interface AccountPageInstance {
  data: AccountPageData;
  setData(data: Partial<AccountPageData>): void;
}

function isTimelineSinglePage(): boolean {
  if (isDouyinMiniProgram()) return false;
  try {
    const api = miniProgramApi();
    return typeof api.getLaunchOptionsSync === 'function'
      && api.getLaunchOptionsSync().scene === TIMELINE_SCENE;
  } catch {
    return false;
  }
}

function setNormalNavigationTitle(): void {
  const api = miniProgramApi();
  if (typeof api.setNavigationBarTitle !== 'function') return;
  try {
    api.setNavigationBarTitle({ title: ACCOUNT_COPY.pageTitle });
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
    displayName: session.user.name || ACCOUNT_COPY.defaultUser,
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
      loginError: ACCOUNT_COPY.storageUnavailable,
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
    agreementAccepted: false,
    copy: ACCOUNT_COPY,
    displayName: '',
    isTimelineEntry: false,
    loginBusy: false,
    loginError: '',
    loginRequired: true,
    loginStorageUnavailable: false,
    loginButtonBusyLabel: ACCOUNT_COPY.loginButtonBusyLabel,
    loginButtonLabel: ACCOUNT_COPY.loginButtonLabel,
    loginIntro: ACCOUNT_COPY.loginIntro,
    loginNote: ACCOUNT_COPY.loginNote,
    requiresAgreement: isDouyinMiniProgram(),
    shareNote: ACCOUNT_COPY.shareNote,
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

  async loginWithMiniProgram() {
    if (this.data.isTimelineEntry || this.data.loginBusy) return;
    if (this.data.requiresAgreement && !this.data.agreementAccepted) {
      this.setData({ loginError: ACCOUNT_COPY.agreementRequired });
      return;
    }
    this.setData({ loginBusy: true, loginError: '' });
    try {
      const session = await loginWithMiniProgram();
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

  toggleAgreement() {
    if (!this.data.requiresAgreement || this.data.loginBusy) return;
    this.setData({
      agreementAccepted: !this.data.agreementAccepted,
      loginError: '',
    });
  },

  openPolicy() {
    if (!this.data.requiresAgreement || this.data.loginBusy) return;
    this.setData({ loginError: '' });
    openWebsitePageOnce(this, 'privacy', {
      failureMessage: ACCOUNT_COPY.policyFailure,
      onFailure: (message) => this.setData({ loginError: message }),
    });
  },

  logout() {
    if (!clearStoredSession()) {
      this.setData({ accountError: ACCOUNT_COPY.logoutFailure });
      return;
    }
    this.setData({
      ...sessionView(null),
      accountError: '',
      loginError: '',
      loginStorageUnavailable: false,
    });
    openWebsitePageOnce(this, 'logout', {
      failureMessage: ACCOUNT_COPY.logoutWebsiteFailure,
      onFailure: (message) => this.setData({ accountError: message }),
    });
  },

  openAccount() {
    if (this.data.isTimelineEntry || this.data.loginRequired) return;
    this.setData({ accountError: '' });
    openWebsitePageOnce(this, 'account', {
      failureMessage: ACCOUNT_COPY.accountFailure,
      onFailure: (message) => this.setData({ accountError: message }),
    });
  },
});
