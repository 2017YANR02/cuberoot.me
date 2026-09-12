import {
  CONTACT_DIRECT_DETAILS,
  CONTACT_GROUP_SECTIONS,
  CONTACT_JOIN_INSTRUCTION,
  CONTACT_SOCIAL_PLATFORMS,
  CONTACT_WEBSITE,
  CONTACT_WECHAT_ID,
  type ContactDirectDetailId,
  type ContactPlatformId,
} from '@cuberoot/shared/contact';
import type { PendingIdentity } from '@cuberoot/shared/auth/web-session';
import {
  ApiError,
  approveWechatBrowserLogin,
  completeMiniProgramIdentity,
  getStoredSessionSnapshot,
  isSessionStorageError,
  loginErrorMessage,
  loginWithMiniProgram,
  previewIdentityLinkCode,
  type SessionData,
} from '../../lib/auth';
import { cancelWebsiteNavigation, openWebsitePageOnce } from '../../lib/navigation';
import { showPublicShareMenu, toTimelineShare } from '../../lib/share';
import { resolveAccountPageShare } from '../../lib/web-routes';
import { getMiniProgramLocale, tr } from '../../lib/i18n';
import { isDouyinMiniProgram, miniProgramApi } from '../../lib/platform';
import {
  getMiniProgramReleaseView,
  type MiniProgramReleaseView,
} from '../../lib/release-info';
import { resumeRequiredSessionDestination } from '../../lib/required-session';

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
  accountLinkFailure: tr({
    en: 'The account linking page is temporarily unavailable. Try again later.',
    zh: '账号绑定页面暂时无法打开，请稍后重试',
  }),
  contactCopyFailure: tr({
    en: 'Unable to copy this contact detail. Try again.',
    zh: '暂时无法复制这项联系信息，请重试',
  }),
  contactPageFailure: tr({
    en: 'The contact page is temporarily unavailable. Try again later.',
    zh: '联系页面暂时无法打开，请稍后重试',
  }),
  copiedLabel: tr({ en: 'Copied', zh: '已复制' }),
  createAccountLabel: tr({ en: 'Create a new account', zh: '创建新账号' }),
  accountChoiceTitle: tr({ en: 'Do you have a CubeRoot account?', zh: '你有 CubeRoot 账号吗？' }),
  accountChoiceNote: tr({ en: 'Keep your existing membership and profile.', zh: '保留原账号的会员和资料。' }),
  phoneTitle: tr({ en: 'Use your existing account', zh: '使用原来的账号' }),
  phoneHint: tr({ en: 'Authorize your phone number to find your account. Nothing is linked or created without your confirmation.', zh: '授权手机号查找原账号。未经确认，不会绑定或创建账号。' }),
  phoneAuthorize: tr({ en: 'Authorize phone number', zh: '授权手机号' }),
  phoneOtherLogin: tr({ en: 'Use another sign-in method', zh: '使用其他方式登录' }),
  phoneDeclined: tr({ en: 'Phone authorization was not completed. Try again or use another sign-in method.', zh: '尚未完成手机号授权，可重试或使用其他方式登录。' }),
  phoneUnsupported: tr({ en: 'Update WeChat to authorize your phone number, or use another sign-in method.', zh: '请更新微信后授权手机号，或使用其他方式登录。' }),
  phoneFoundTitle: tr({ en: 'Your existing account', zh: '找到原账号' }),
  phoneFoundHint: tr({ en: 'This phone number belongs to the account below. Confirm to link WeChat and sign in, keeping your membership and data.', zh: '此手机号已绑定下方账号。确认后绑定微信并登录，保留原会员和数据。' }),
  cancelLabel: tr({ en: 'Cancel', zh: '取消' }),
  clearCodeLabel: tr({ en: 'Clear linking code', zh: '清除绑定码' }),
  linkCodeLabel: tr({ en: 'Mini Program linking code', zh: '小程序绑定码' }),
  linkCodeHint: tr({ en: 'Sign in to your existing account on the website, then generate a Mini Program linking code in account settings.', zh: '在网站登录原账号，再到账号设置获取「小程序绑定码」。' }),
  openLinkCodeWebsiteLabel: tr({ en: 'Open account settings', zh: '打开账号设置' }),
  previewLinkCodeLabel: tr({ en: 'Check account', zh: '查看绑定账号' }),
  confirmLinkCodeLabel: tr({ en: 'Link and sign in', zh: '确认绑定并登录' }),
  linkCodeInvalid: tr({ en: 'Enter the Mini Program linking code from your account settings.', zh: '请输入原账号设置中的小程序绑定码。' }),
  choiceExpired: tr({ en: 'This sign-in request expired. Start again.', zh: '本次登录已过期，请重新开始。' }),
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
  linkExistingAccountLabel: tr({ en: 'Sign in to an existing account', zh: '登录已有账号' }),
  loginIntro: isDouyinMiniProgram()
    ? tr({
      en: 'Sign in to use your CubeRoot account. If this Douyin account is not linked yet, choose whether to use an existing account or create a new one.',
      zh: '登录后使用 CubeRoot 账号。抖音尚未绑定时，先选择登录已有账号或创建新账号。',
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
      en: 'Phone numbers are only read with your authorization to find or link your account. Linked WeChat accounts sign in directly next time.',
      zh: '仅在你授权后读取手机号，用于查找或绑定账号。微信绑定后，下次直接登录。',
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
  signingInLabel: tr({ en: 'Signing in', zh: '正在登录' }),
  storageUnavailable: tr({
    en: 'Unable to read the sign-in state on this device. Try again.',
    zh: '暂时无法读取设备上的登录状态，请重新读取。',
  }),
  userAgreementLabel: tr({ en: 'User Agreement', zh: '《用户协议》' }),
  browserLoginFailure: tr({
    en: 'Website sign-in could not be confirmed. Return to Safari and try again.',
    zh: '未能确认网页登录，请返回 Safari 重试',
  }),
  existingAccountRequired: tr({
    en: 'This WeChat account is not linked. Return to your browser and use your existing sign-in method.',
    zh: '此微信尚未绑定，请返回浏览器，使用原账号的登录方式。',
  }),
  browserLoginConfirmContent: tr({
    en: 'Safari is requesting access to this CubeRoot account.',
    zh: 'Safari 正在请求登录此魔方根账号',
  }),
  browserLoginConfirmTitle: tr({ en: 'Confirm website sign-in', zh: '确认网页登录' }),
  browserLoginSuccess: tr({
    en: 'Signed in. Returning to Safari',
    zh: '登录成功，正在返回 Safari',
  }),
};
const accountShare = resolveAccountPageShare();
const contactLocale = getMiniProgramLocale();
const joinInstruction = tr(CONTACT_JOIN_INSTRUCTION, contactLocale);
const [joinInstructionBefore, joinInstructionAfter = ''] = joinInstruction.split(CONTACT_WECHAT_ID);
const CONTACT_PLATFORM_ICON_PATHS: Record<ContactPlatformId, string> = {
  youtube: '/assets/contact/youtube.png',
  tiktok: '/assets/contact/tiktok.png',
  instagram: '/assets/contact/instagram.png',
  bilibili: '/assets/contact/bilibili.png',
  douyin: '/assets/contact/douyin.png',
  xiaohongshu: '/assets/contact/xiaohongshu.png',
  kuaishou: '/assets/contact/kuaishou.png',
  'wechat-official': '/assets/contact/wechat.png',
};
const CONTACT_DETAIL_ICON_PATHS: Record<ContactDirectDetailId, string> = {
  author: '/assets/contact/author.png',
  wechat: '/assets/contact/wechat.png',
  qq: '/assets/contact/qq.png',
  email: '/assets/contact/email.png',
  discord: '/assets/contact/discord.png',
};
const CONTACT_VIEW = {
  eyebrow: tr({ en: 'CONTACT & COMMUNITY', zh: '联系与社群' }, contactLocale),
  joinInstructionAfter,
  joinInstructionBefore,
  joinInstructionValue: CONTACT_WECHAT_ID,
  joinTitle: tr({ en: 'How to join', zh: '进群方法' }, contactLocale),
  qrAria: tr({ en: 'View WeChat QR code', zh: '查看微信二维码' }, contactLocale),
  qrPath: '/assets/contact/ruimin-wechat-qr.jpg',
  title: tr({ en: 'Contact', zh: '联系方式' }, contactLocale),
  websiteLabel: tr({ en: 'Website', zh: '网站' }, contactLocale),
  website: CONTACT_WEBSITE,
  platforms: [...CONTACT_SOCIAL_PLATFORMS]
    .sort((a, b) => Number(b.language === contactLocale) - Number(a.language === contactLocale))
    .map((platform) => ({
      account: platform.account,
      count: platform.count ? tr(platform.count, contactLocale) : '',
      href: platform.href ?? '',
      icon: CONTACT_PLATFORM_ICON_PATHS[platform.id],
      id: platform.id,
      label: tr(platform.label, contactLocale),
    })),
  details: CONTACT_DIRECT_DETAILS.map((detail) => {
    const value = detail.value ? tr(detail.value, contactLocale) : '';
    return {
      action: detail.action,
      actionValue: detail.action === 'link' ? detail.href ?? '' : value,
      icon: CONTACT_DETAIL_ICON_PATHS[detail.id],
      id: detail.id,
      label: tr(detail.label, contactLocale),
      showQr: detail.showQr,
      value,
    };
  }),
  sections: CONTACT_GROUP_SECTIONS.map((section, sectionIndex) => ({
    blocks: section.blocks.map((block) => ({
      groups: block.groups.map((group) => ({
        name: tr(group, contactLocale),
        secondaryName: contactLocale === 'en' ? group.zh : '',
      })),
      title: tr(block.title, contactLocale),
    })),
    description: tr(section.description, contactLocale),
    id: section.id,
    index: String(sectionIndex + 1).padStart(2, '0'),
    title: tr(section.title, contactLocale),
  })),
};

interface ContactCopyEvent {
  currentTarget: {
    dataset: {
      value?: unknown;
    };
  };
}

interface AccountPageData {
  accountError: string;
  accountLinkPending: boolean;
  accountLinkRequired: boolean;
  accountLinkCodeMode: boolean;
  accountCanCreate: boolean;
  wechatPhoneRequired: boolean;
  wechatPhoneSupported: boolean;
  phoneAccountFound: boolean;
  existingOnly: boolean;
  accountLinkCode: string;
  accountLinkTargetId: number | null;
  accountLinkTargetName: string;
  agreementAccepted: boolean;
  contact: typeof CONTACT_VIEW;
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
  release: MiniProgramReleaseView;
  requiresAgreement: boolean;
  uidText: string;
  wcaId: string;
  browserLoginPending: boolean;
}

interface AccountPageInstance {
  browserLoginApproval?: string;
  browserLoginExistingOnly?: boolean;
  data: AccountPageData;
  setData(data: Partial<AccountPageData>): void;
}

type PagePendingIdentity = PendingIdentity & { expiresAt: number; sessionToken: string | undefined };
const pendingIdentities = new WeakMap<AccountPageInstance, PagePendingIdentity>();
const disposedPages = new WeakSet<AccountPageInstance>();
const phonePrompts = new WeakMap<AccountPageInstance, object>();
const phoneAuthorizations = new WeakMap<AccountPageInstance, { prompt: object; sessionToken: string | undefined }>();
const EMPTY_LINK_CODE = { accountLinkCode: '', accountLinkTargetId: null, accountLinkTargetName: '' };

function clearPendingIdentity(page: AccountPageInstance): void {
  pendingIdentities.delete(page);
  phonePrompts.delete(page);
  phoneAuthorizations.delete(page);
  page.setData({ ...EMPTY_LINK_CODE, accountCanCreate: false, phoneAccountFound: false, wechatPhoneRequired: false, accountLinkRequired: false, accountLinkCodeMode: false, loginBusy: false });
}

function currentPendingIdentity(page: AccountPageInstance): PagePendingIdentity | null {
  const pending = pendingIdentities.get(page);
  if (!pending) return null;
  if (pending.expiresAt <= Date.now()) {
    clearPendingIdentity(page);
    page.setData({ loginError: ACCOUNT_COPY.choiceExpired });
    return null;
  }
  return pending;
}

async function completePendingIdentity(page: AccountPageInstance, action: 'create' | 'link_with_code' | 'link_verified_phone'): Promise<void> {
  if (page.data.loginBusy || page.data.isTimelineEntry) return;
  const pending = currentPendingIdentity(page);
  if (!pending) return;
  if (action === 'create' && (page.browserLoginExistingOnly || pending.phoneAccount)) return;
  if (action === 'link_verified_phone' && !pending.phoneAccount) return;
  if (page.data.requiresAgreement && !page.data.agreementAccepted) {
    page.setData({ loginError: ACCOUNT_COPY.agreementRequired }); return;
  }
  if (action === 'link_with_code' && !page.data.accountLinkTargetId) return;
  const originalSession = getStoredSessionSnapshot();
  if (originalSession.status === 'unavailable') { page.setData({ loginError: ACCOUNT_COPY.storageUnavailable }); return; }
  if (originalSession.session?.token !== pending.sessionToken) {
    clearPendingIdentity(page);
    refreshStoredSession(page);
    return;
  }
  const linkCode = page.data.accountLinkCode;
  page.setData({ loginBusy: true, loginError: '' });
  try {
    const session = await completeMiniProgramIdentity(pending.ticket, action, {
      ...(action === 'link_with_code' ? { linkCode, expectedUid: page.data.accountLinkTargetId! } : {}),
      ...(action === 'link_verified_phone' ? { expectedUid: pending.phoneAccount!.id } : {}),
      isCurrent: () => {
        const currentSession = getStoredSessionSnapshot();
        return !disposedPages.has(page) && pendingIdentities.get(page) === pending
          && currentSession.status === 'available'
          && currentSession.session?.token === originalSession.session?.token;
      },
    });
    await finishMiniProgramLogin(page, session);
  } catch (error) {
    if (disposedPages.has(page) || pendingIdentities.get(page) !== pending) return;
    if (error instanceof ApiError && error.code === 'INVALID_IDENTITY_TICKET') clearPendingIdentity(page);
    page.setData({ loginBusy: false, loginError: loginErrorMessage(error),
      ...(!pending.phoneAccount ? { accountLinkTargetId: null, accountLinkTargetName: '' } : {}),
    });
  }
}

async function finishMiniProgramLogin(page: AccountPageInstance, session: SessionData): Promise<void> {
  clearPendingIdentity(page);
  page.setData({ ...sessionView(session), loginBusy: !!page.browserLoginApproval, loginError: '', loginStorageUnavailable: false });
  try {
    if (await approvePendingBrowserLogin(page, session)) return;
  } catch {
    if (!disposedPages.has(page)) {
      refreshStoredSession(page);
      page.setData({ loginBusy: false, browserLoginPending: false, accountError: ACCOUNT_COPY.browserLoginFailure });
    }
    return;
  }
  if (disposedPages.has(page)) return;
  page.setData({ loginBusy: false });
  resumeRequiredSessionDestination();
}

const BROWSER_LOGIN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

async function approvePendingBrowserLogin(
  page: AccountPageInstance,
  session: SessionData,
): Promise<boolean> {
  const approval = page.browserLoginApproval;
  if (!approval) return false;
  const assertCurrentSession = () => {
    const current = getStoredSessionSnapshot();
    if (disposedPages.has(page) || current.status !== 'available' || current.session?.token !== session.token) {
      page.browserLoginApproval = undefined;
      throw new ApiError(409, 'browser approval account changed', 'ACCOUNT_CHANGED');
    }
  };
  assertCurrentSession();
  const api = miniProgramApi();
  const approved = await new Promise<boolean>((resolve, reject) => {
    api.showModal({
      title: ACCOUNT_COPY.browserLoginConfirmTitle,
      content: ACCOUNT_COPY.browserLoginConfirmContent,
      confirmText: tr({ en: 'Sign in', zh: '确认登录' }),
      success: (result) => resolve(result.confirm),
      fail: reject,
    });
  });
  assertCurrentSession();
  await approveWechatBrowserLogin(session, approval, approved);
  page.browserLoginApproval = undefined;
  if (approved && typeof api.showToast === 'function') {
    api.showToast({ icon: 'none', title: ACCOUNT_COPY.browserLoginSuccess });
  }
  api.exitMiniProgram({
    fail: () => page.setData({
      ...sessionView(session),
      accountError: approved ? ACCOUNT_COPY.browserLoginSuccess : '',
      browserLoginPending: false,
      loginBusy: false,
    }),
  });
  return true;
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
  if (snapshot.session) clearPendingIdentity(page);
  page.setData({
    ...sessionView(snapshot.session),
    ...(snapshot.session ? { accountLinkRequired: false, wechatPhoneRequired: false } : {}),
    loginError: '',
    loginStorageUnavailable: false,
  });
}

async function completeMiniProgramLogin(
  page: AccountPageInstance,
  phoneAuthorization?: { code: string; prompt: object; sessionToken: string | undefined },
): Promise<void> {
  if (page.data.isTimelineEntry || page.data.loginBusy) return;
  if (currentPendingIdentity(page)) {
    page.setData({ accountLinkRequired: true }); return;
  }
  if (page.data.requiresAgreement && !page.data.agreementAccepted) {
    page.setData({ loginError: ACCOUNT_COPY.agreementRequired });
    return;
  }
  const originalSession = getStoredSessionSnapshot();
  if (originalSession.status === 'unavailable') {
    page.setData({ loginError: ACCOUNT_COPY.storageUnavailable, loginStorageUnavailable: true });
    return;
  }
  const sessionUnchanged = () => {
    const current = getStoredSessionSnapshot();
    return current.status === 'available' && current.session?.token === originalSession.session?.token;
  };
  if (phoneAuthorization && (originalSession.session?.token !== phoneAuthorization.sessionToken
    || phonePrompts.get(page) !== phoneAuthorization.prompt)) return;
  const isCurrent = () => !disposedPages.has(page) && sessionUnchanged()
    && (!phoneAuthorization || phonePrompts.get(page) === phoneAuthorization.prompt);
  page.setData({ accountLinkRequired: false, loginBusy: true, loginError: '' });
  try {
    const session = await loginWithMiniProgram({ phoneCode: phoneAuthorization?.code, isCurrent });
    await finishMiniProgramLogin(page, session);
  } catch (error) {
    if (disposedPages.has(page) || (phoneAuthorization && phonePrompts.get(page) !== phoneAuthorization.prompt)) return;
    if (!sessionUnchanged()) {
      refreshStoredSession(page);
      page.setData({ loginBusy: false });
      return;
    }
    if (error instanceof ApiError && error.code === 'WECHAT_PHONE_REQUIRED' && !isDouyinMiniProgram()) {
      phonePrompts.set(page, {});
      let supported = false;
      try { supported = miniProgramApi().canIUse('button.open-type.getRealtimePhoneNumber'); } catch { /* Keep other sign-in available. */ }
      page.setData({ wechatPhoneRequired: true, wechatPhoneSupported: supported, loginBusy: false, loginError: supported ? '' : ACCOUNT_COPY.phoneUnsupported });
      return;
    }
    if (error instanceof ApiError && error.pending?.provider === (isDouyinMiniProgram() ? 'douyin' : 'wechat')) {
      if (!disposedPages.has(page) && !pendingIdentities.has(page)) {
        pendingIdentities.set(page, { ...error.pending, expiresAt: Date.now() + error.pending.expiresInSeconds * 1000, sessionToken: originalSession.session?.token });
        phonePrompts.delete(page);
        phoneAuthorizations.delete(page);
        page.setData({ accountCanCreate: !error.pending.phoneAccount && !page.browserLoginExistingOnly, wechatPhoneRequired: false, phoneAccountFound: !!error.pending.phoneAccount, accountLinkRequired: true, accountLinkCodeMode: false, ...EMPTY_LINK_CODE,
          ...(error.pending.phoneAccount ? { accountLinkTargetId: error.pending.phoneAccount.id, accountLinkTargetName: error.pending.phoneAccount.displayName || ACCOUNT_COPY.defaultUser } : {}),
          loginBusy: false, loginError: '', loginStorageUnavailable: false });
      }
      return;
    }
    page.setData({
      accountCanCreate: false,
      accountLinkRequired: error instanceof ApiError
        && error.code === 'WECHAT_ACCOUNT_LINK_REQUIRED' && !page.browserLoginExistingOnly,
      loginBusy: false,
      loginError: page.browserLoginExistingOnly && error instanceof ApiError
        && error.code === 'WECHAT_ACCOUNT_LINK_REQUIRED'
        ? ACCOUNT_COPY.existingAccountRequired : loginErrorMessage(error),
      loginStorageUnavailable: isSessionStorageError(error),
      browserLoginPending: false,
    });
  }
}

Page<AccountPageData, WechatMiniprogram.Page.CustomOption>({
  data: {
    accountError: '',
    accountLinkPending: false,
    accountLinkRequired: false,
    accountLinkCodeMode: false,
    accountCanCreate: false,
    wechatPhoneRequired: false,
    wechatPhoneSupported: false,
    phoneAccountFound: false,
    existingOnly: false,
    ...EMPTY_LINK_CODE,
    agreementAccepted: false,
    contact: CONTACT_VIEW,
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
    release: getMiniProgramReleaseView(contactLocale),
    requiresAgreement: isDouyinMiniProgram(),
    uidText: '',
    wcaId: '',
    browserLoginPending: false,
  },

  onLoad(options: Record<string, unknown> = {}) {
    disposedPages.delete(this as unknown as AccountPageInstance);
    if (isTimelineSinglePage()) {
      this.setData({ isTimelineEntry: true });
      return;
    }
    setNormalNavigationTitle();
    showPublicShareMenu();
    const browserLogin = typeof options.browserLogin === 'string'
      && BROWSER_LOGIN_PATTERN.test(options.browserLogin)
      && !isDouyinMiniProgram()
      ? options.browserLogin
      : '';
    if (browserLogin) {
      this.browserLoginApproval = browserLogin;
      this.browserLoginExistingOnly = options.existingOnly === '1';
      this.setData({ existingOnly: this.browserLoginExistingOnly, browserLoginPending: true, loginBusy: true, loginError: '' });
      const snapshot = getStoredSessionSnapshot();
      if (snapshot.status === 'available' && snapshot.session) {
        void finishMiniProgramLogin(this as unknown as AccountPageInstance, snapshot.session);
      } else {
        this.setData({ loginBusy: false });
        // Opening a browser handoff is not consent to create a new account.
        void completeMiniProgramLogin(this as unknown as AccountPageInstance);
      }
      return;
    }
    refreshStoredSession(this as unknown as AccountPageInstance);
  },

  onShow() {
    if (this.data.isTimelineEntry || (this.data.browserLoginPending && !this.data.accountLinkPending)) return;
    const shouldRetryAccountLink = this.data.accountLinkPending;
    if (shouldRetryAccountLink) clearPendingIdentity(this as unknown as AccountPageInstance);
    showPublicShareMenu();
    refreshStoredSession(this as unknown as AccountPageInstance);
    currentPendingIdentity(this as unknown as AccountPageInstance);
    this.setData({
      accountLinkPending: false,
      release: getMiniProgramReleaseView(contactLocale),
    });
    if (shouldRetryAccountLink) {
      void completeMiniProgramLogin(this as unknown as AccountPageInstance);
    }
  },

  onUnload() {
    disposedPages.add(this as unknown as AccountPageInstance);
    pendingIdentities.delete(this as unknown as AccountPageInstance);
    phonePrompts.delete(this as unknown as AccountPageInstance);
    phoneAuthorizations.delete(this as unknown as AccountPageInstance);
    cancelWebsiteNavigation(this);
  },

  onShareAppMessage() {
    return accountShare;
  },

  onShareTimeline() {
    return toTimelineShare(accountShare);
  },

  async loginWithMiniProgram() {
    await completeMiniProgramLogin(this as unknown as AccountPageInstance);
  },

  async createAccount() {
    await completePendingIdentity(this as unknown as AccountPageInstance, 'create');
  },

  linkExistingAccount() {
    if (this.data.isTimelineEntry || this.data.loginBusy) return;
    if (currentPendingIdentity(this as unknown as AccountPageInstance)) {
      this.setData({ accountLinkCodeMode: true, loginError: '' });
      return;
    }
    if (isDouyinMiniProgram()) return;
    clearPendingIdentity(this as unknown as AccountPageInstance);
    this.setData({ accountLinkPending: true, loginError: '' });
    openWebsitePageOnce(this, 'account-link', {
      failureMessage: ACCOUNT_COPY.accountLinkFailure,
      onFailure: (message) => this.setData({
        accountLinkPending: false,
        loginError: message,
      }),
    });
  },

  beginPhoneAuthorization() {
    const page = this as unknown as AccountPageInstance;
    if (isDouyinMiniProgram() || this.data.loginBusy || !this.data.wechatPhoneRequired || !this.data.wechatPhoneSupported) return;
    const prompt = phonePrompts.get(page);
    const snapshot = getStoredSessionSnapshot();
    if (!prompt || snapshot.status !== 'available') { this.setData({ loginError: ACCOUNT_COPY.storageUnavailable }); return; }
    phoneAuthorizations.set(page, { prompt, sessionToken: snapshot.session?.token });
  },

  async authorizePhone(event: { detail?: { code?: unknown; errMsg?: unknown } }) {
    const page = this as unknown as AccountPageInstance;
    const attempt = phoneAuthorizations.get(page);
    phoneAuthorizations.delete(page);
    if (!attempt || disposedPages.has(page) || isDouyinMiniProgram() || this.data.loginBusy
      || !this.data.wechatPhoneRequired || phonePrompts.get(page) !== attempt.prompt) return;
    const code = typeof event.detail?.code === 'string' ? event.detail.code.trim() : '';
    const failed = typeof event.detail?.errMsg === 'string' && !event.detail.errMsg.endsWith(':ok');
    if (failed || !code || code.length > 512 || /[\u0000-\u001f\u007f]/.test(code)) {
      this.setData({ loginError: ACCOUNT_COPY.phoneDeclined }); return;
    }
    await completeMiniProgramLogin(page, { ...attempt, code });
  },

  async confirmPhoneAccount() {
    await completePendingIdentity(this as unknown as AccountPageInstance, 'link_verified_phone');
  },

  openLinkCodeWebsite() {
    if (this.data.loginBusy || !currentPendingIdentity(this as unknown as AccountPageInstance)) return;
    openWebsitePageOnce(this, 'account-link', { failureMessage: ACCOUNT_COPY.accountLinkFailure, onFailure: (message) => this.setData({ loginError: message }) });
  },

  onLinkCodeInput(event: WechatMiniprogram.Input) {
    if (this.data.loginBusy) return;
    this.setData({ accountLinkCode: event.detail.value.trim().toUpperCase(), accountLinkTargetId: null, accountLinkTargetName: '', loginError: '' });
  },

  clearLinkCode() {
    if (!this.data.loginBusy) this.setData({ ...EMPTY_LINK_CODE, loginError: '' });
  },

  async previewLinkCode() {
    if (this.data.loginBusy) return;
    const page = this as unknown as AccountPageInstance;
    const pending = currentPendingIdentity(page);
    if (!pending) return;
    const linkCode = this.data.accountLinkCode;
    if (!/^L[1-9]\d{0,15}-\d{6}$/.test(linkCode)) { this.setData({ loginError: ACCOUNT_COPY.linkCodeInvalid }); return; }
    this.setData({ loginBusy: true, loginError: '' });
    try {
      const target = await previewIdentityLinkCode(pending.ticket, linkCode);
      if (disposedPages.has(page) || pendingIdentities.get(page) !== pending || this.data.accountLinkCode !== linkCode) return;
      this.setData({ accountLinkTargetId: target.id, accountLinkTargetName: target.displayName || ACCOUNT_COPY.defaultUser, loginBusy: false });
    } catch (error) {
      if (!disposedPages.has(page) && pendingIdentities.get(page) === pending) this.setData({ loginBusy: false, loginError: loginErrorMessage(error) });
    }
  },

  async confirmLinkCode() {
    await completePendingIdentity(this as unknown as AccountPageInstance, 'link_with_code');
  },

  cancelIdentityChoice() {
    if (this.data.loginBusy) return;
    clearPendingIdentity(this as unknown as AccountPageInstance);
    this.setData({ loginError: '' });
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
    if ((!this.data.requiresAgreement && !this.data.wechatPhoneRequired) || this.data.loginBusy) return;
    this.setData({ loginError: '' });
    openWebsitePageOnce(this, 'privacy', {
      failureMessage: ACCOUNT_COPY.policyFailure,
      onFailure: (message) => this.setData({ loginError: message }),
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

  openContactWebsite() {
    if (this.data.isTimelineEntry || this.data.loginRequired) return;
    this.setData({ accountError: '' });
    openWebsitePageOnce(this, 'contact', {
      failureMessage: ACCOUNT_COPY.contactPageFailure,
      onFailure: (message) => this.setData({ accountError: message }),
    });
  },

  previewWechatQr() {
    if (this.data.isTimelineEntry || this.data.loginRequired) return;
    const path = CONTACT_VIEW.qrPath;
    try {
      const api = miniProgramApi();
      if (typeof api.previewImage === 'function') {
        api.previewImage({ current: path, urls: [path] });
      }
    } catch {
      // QR preview is optional; copying the WeChat ID remains available.
    }
  },

  copyContactValue(event: ContactCopyEvent) {
    const value = event.currentTarget.dataset.value;
    if (typeof value !== 'string' || value.length === 0) return;

    const copyFailed = () => {
      this.setData({ accountError: ACCOUNT_COPY.contactCopyFailure });
    };

    this.setData({ accountError: '' });
    try {
      const api = miniProgramApi();
      api.setClipboardData({
        data: value,
        fail: copyFailed,
        success: () => {
          if (typeof api.showToast === 'function') {
            api.showToast({ icon: 'none', title: ACCOUNT_COPY.copiedLabel });
          }
        },
      });
    } catch {
      copyFailed();
    }
  },
});
