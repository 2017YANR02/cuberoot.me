import {
  ApiError,
  clearStoredSession,
  createWebSessionTicket,
  getStoredSessionSnapshot,
  loginErrorMessage,
  loginWithWechat as exchangeWechatLogin,
} from './auth';
import {
  createWebSessionHandoffUrl,
  resolveWebRoute,
  resolveWebRouteShare,
  WEB_ROUTE_SHARE_IMAGE,
  type WebRouteKey,
} from './web-routes';
import { showFriendShareMenu } from './share';
import {
  clearRuntimeTimeout,
  scheduleRuntimeTimeout,
  type RuntimeTimer,
} from './runtime-timers';

export interface WebViewPageData {
  canRetry: boolean;
  errorMessage: string;
  errorTitle: string;
  loginBusy: boolean;
  loginError: string;
  loginRequired: boolean;
  loginStorageUnavailable: boolean;
  loadingTitle: string;
  routeKey: string;
  src: string;
  viewAttempt: number;
}

export interface WebViewPageContext {
  data: WebViewPageData;
  setData(data: Partial<WebViewPageData>): void;
}

interface WebViewPageMethods {
  handleWebViewError(event: WechatMiniprogram.BaseEvent): void;
  loginWithWechat(): Promise<void>;
  retry(): void;
  retryMiniProgramSession(): void;
}

interface WebViewPageFactoryOptions {
  requireMiniProgramSession?: boolean;
}

const routeAttempts = new WeakMap<WebViewPageContext, number>();
const disposedPages = new WeakSet<WebViewPageContext>();
const visiblePages = new WeakSet<WebViewPageContext>();
const pausedRouteResumes = new WeakSet<WebViewPageContext>();
const sessionRequiredPages = new WeakSet<WebViewPageContext>();
const sessionGateResumes = new WeakSet<WebViewPageContext>();
const loginAttemptCounters = new WeakMap<WebViewPageContext, number>();
const activeLoginAttempts = new WeakMap<WebViewPageContext, number>();
type NetworkStatusCallback = (
  result: WechatMiniprogram.OnNetworkStatusChangeListenerResult
    | WechatMiniprogram.GeneralCallbackResult
) => void;

const networkListeners = new WeakMap<WebViewPageContext, NetworkStatusCallback>();
const RETRY_SCHEDULER_GRACE_MS = 100;

interface RetrySchedule {
  timer?: RuntimeTimer;
}

const retrySchedules = new WeakMap<WebViewPageContext, RetrySchedule>();

function beginRouteAttempt(context: WebViewPageContext): number {
  const attempt = (routeAttempts.get(context) ?? 0) + 1;
  routeAttempts.set(context, attempt);
  return attempt;
}

function beginLoginAttempt(context: WebViewPageContext): number {
  const attempt = (loginAttemptCounters.get(context) ?? 0) + 1;
  loginAttemptCounters.set(context, attempt);
  activeLoginAttempts.set(context, attempt);
  return attempt;
}

function isCurrentLoginAttempt(context: WebViewPageContext, attempt: number): boolean {
  return activeLoginAttempts.get(context) === attempt && !disposedPages.has(context);
}

function cancelLoginAttempt(context: WebViewPageContext): void {
  loginAttemptCounters.set(context, (loginAttemptCounters.get(context) ?? 0) + 1);
  activeLoginAttempts.delete(context);
  sessionGateResumes.delete(context);
}

function isCurrentAttempt(context: WebViewPageContext, attempt: number): boolean {
  return routeAttempts.get(context) === attempt;
}

function cancelScheduledRetry(context: WebViewPageContext): boolean {
  const schedule = retrySchedules.get(context);
  if (!schedule) return false;

  retrySchedules.delete(context);
  if (schedule.timer === undefined) return true;

  clearRuntimeTimeout(schedule.timer);
  return true;
}

function pausePendingRoute(context: WebViewPageContext): void {
  const hadScheduledRetry = cancelScheduledRetry(context);
  const hasPendingRoute = context.data.src === ''
    && context.data.errorTitle === ''
    && Boolean(resolveWebRoute(context.data.routeKey));

  if (!hadScheduledRetry && !hasPendingRoute) return;

  pausedRouteResumes.add(context);
  beginRouteAttempt(context);
}

function stopNetworkRecovery(context: WebViewPageContext): void {
  const listener = networkListeners.get(context);
  if (!listener) return;

  // Delete first so a listener the platform fails to remove becomes inert.
  networkListeners.delete(context);
  try {
    wx.offNetworkStatusChange(listener);
  } catch {
    // Lifecycle state is already closed; optional platform cleanup may fail.
  }
}

function startNetworkRecovery(context: WebViewPageContext): void {
  stopNetworkRecovery(context);

  const listener: NetworkStatusCallback = (result) => {
    if (networkListeners.get(context) !== listener) return;
    if (!('isConnected' in result)) return;
    if (
      !result.isConnected
      || disposedPages.has(context)
      || !visiblePages.has(context)
      || !context.data.canRetry
    ) return;
    retryWebRoute(context);
  };

  try {
    wx.onNetworkStatusChange(listener);
    networkListeners.set(context, listener);
  } catch {
    // Manual retry remains available when network observation is unsupported.
  }
}

function recoverVisibleRouteIfConnected(context: WebViewPageContext): void {
  if (
    disposedPages.has(context)
    || !visiblePages.has(context)
    || !context.data.canRetry
  ) return;

  try {
    wx.getNetworkType({
      success(result) {
        if (
          result.networkType === 'none'
          || disposedPages.has(context)
          || !visiblePages.has(context)
          || !context.data.canRetry
        ) return;
        retryWebRoute(context);
      },
    });
  } catch {
    // The retry button remains available when a network snapshot is unsupported.
  }
}

function updateNavigationTitle(title: string): void {
  try {
    wx.setNavigationBarTitle({ title });
  } catch {
    // The title is cosmetic; a platform API failure must not block web content.
  }
}

function updateShareMenu(key: unknown): void {
  try {
    if (resolveWebRouteShare(key)) {
      showFriendShareMenu();
      return;
    }
    wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
  } catch {
    // Sharing is optional; route loading must survive unsupported menu APIs.
  }
}

function showWebSessionHandoffFailure(context: WebViewPageContext): void {
  context.setData({
    canRetry: true,
    errorMessage: '登录状态暂未同步，请检查网络后重试。为避免账号错位，暂不会以游客身份打开网页。',
    errorTitle: '账号同步失败',
    src: '',
  });
}

function showMiniProgramLoginGate(
  context: WebViewPageContext,
  storageUnavailable = false,
): void {
  context.setData({
    canRetry: false,
    errorMessage: '',
    errorTitle: '',
    loginBusy: false,
    loginError: storageUnavailable
      ? '暂时无法读取设备上的登录状态，请重新读取。'
      : '',
    loginRequired: true,
    loginStorageUnavailable: storageUnavailable,
    src: '',
  });
}

function requireMiniProgramSession(
  context: WebViewPageContext,
  storageUnavailable = false,
): boolean {
  if (!sessionRequiredPages.has(context)) return false;
  showMiniProgramLoginGate(context, storageUnavailable);
  return true;
}

export function createWebViewPageData(): WebViewPageData {
  return {
    canRetry: false,
    errorMessage: '',
    errorTitle: '',
    loginBusy: false,
    loginError: '',
    loginRequired: false,
    loginStorageUnavailable: false,
    loadingTitle: '正在打开',
    routeKey: '',
    src: '',
    viewAttempt: 0,
  };
}

export async function openWebRoute(context: WebViewPageContext, key: unknown): Promise<boolean> {
  if (disposedPages.has(context)) return false;

  const route = resolveWebRoute(key);
  updateShareMenu(key);
  if (!route) {
    const attempt = beginRouteAttempt(context);
    context.setData({
      canRetry: false,
      errorMessage: '该页面地址不在允许列表中。',
      errorTitle: '无法打开',
      routeKey: '',
      src: '',
      viewAttempt: attempt,
    });
    return false;
  }

  const attempt = beginRouteAttempt(context);
  updateNavigationTitle(route.title);
  context.setData({
    canRetry: false,
    errorMessage: '',
    errorTitle: '',
    loginError: '',
    loginRequired: false,
    loginStorageUnavailable: false,
    loadingTitle: `正在打开${route.title}`,
    routeKey: String(key),
    src: '',
    viewAttempt: attempt,
  });

  const stored = getStoredSessionSnapshot();
  if (route.sessionHandoff && stored.status === 'unavailable') {
    if (isCurrentAttempt(context, attempt)
      && !requireMiniProgramSession(context, true)) {
      showWebSessionHandoffFailure(context);
    }
    return true;
  }
  const session = stored.session;
  if (!session || !route.sessionHandoff) {
    if (isCurrentAttempt(context, attempt)
      && (!route.sessionHandoff || !requireMiniProgramSession(context))) {
      context.setData({ src: route.url });
    }
    return true;
  }

  try {
    const { ticket } = await createWebSessionTicket(session);
    if (isCurrentAttempt(context, attempt)) {
      const current = getStoredSessionSnapshot();
      if (current.status === 'unavailable') {
        if (!requireMiniProgramSession(context, true)) showWebSessionHandoffFailure(context);
      } else if (current.session?.token !== session.token
        && sessionRequiredPages.has(context)) {
        if (current.session) {
          void openWebRoute(context, key);
        } else {
          showMiniProgramLoginGate(context);
        }
      } else {
        context.setData({
          src: current.session?.token === session.token
            ? createWebSessionHandoffUrl(route.path, ticket)
            : route.url,
        });
      }
    }
  } catch (error) {
    if (!isCurrentAttempt(context, attempt)) return true;

    const current = getStoredSessionSnapshot();
    const sessionWasReplaced = current.status === 'available'
      && current.session?.token !== session.token;
    const sessionExpired = error instanceof ApiError && error.status === 401;
    if (sessionExpired && current.status === 'available'
      && current.session?.token === session.token) {
      clearStoredSession();
    }
    if (sessionExpired || sessionWasReplaced) {
      if (sessionRequiredPages.has(context)) {
        if (sessionWasReplaced && current.session) {
          void openWebRoute(context, key);
        } else {
          showMiniProgramLoginGate(context);
        }
      } else {
        context.setData({ src: route.url });
      }
    } else {
      showWebSessionHandoffFailure(context);
    }
  }
  return true;
}

export function markWebRouteFailed(
  context: WebViewPageContext,
  reportedAttempt?: unknown,
): void {
  if (disposedPages.has(context)) return;

  if (reportedAttempt !== undefined) {
    const attempt = Number(reportedAttempt);
    if (!Number.isInteger(attempt) || attempt <= 0 || !isCurrentAttempt(context, attempt)) return;
  }

  beginRouteAttempt(context);
  const route = resolveWebRoute(context.data.routeKey);
  context.setData({
    canRetry: Boolean(route),
    errorMessage: route?.loadFailureMessage
      ?? '请检查网络后重试。网站内容和账号数据不会因此被删除。',
    errorTitle: '网页加载失败',
    src: '',
  });
}

export function cancelWebRoute(context: WebViewPageContext): void {
  visiblePages.delete(context);
  pausedRouteResumes.delete(context);
  cancelScheduledRetry(context);
  stopNetworkRecovery(context);
  cancelLoginAttempt(context);
  sessionRequiredPages.delete(context);
  disposedPages.add(context);
  beginRouteAttempt(context);
}

async function loginToOpenWebRoute(context: WebViewPageContext): Promise<void> {
  if (
    disposedPages.has(context)
    || !context.data.loginRequired
    || activeLoginAttempts.has(context)
  ) return;

  const attempt = beginLoginAttempt(context);
  context.setData({ loginBusy: true, loginError: '' });
  try {
    await exchangeWechatLogin();
    if (!isCurrentLoginAttempt(context, attempt)) return;
    if (visiblePages.has(context)) {
      await openWebRoute(context, context.data.routeKey);
    } else {
      sessionGateResumes.add(context);
    }
  } catch (error) {
    if (isCurrentLoginAttempt(context, attempt)) {
      context.setData({ loginError: loginErrorMessage(error) });
    }
  } finally {
    if (isCurrentLoginAttempt(context, attempt)) {
      activeLoginAttempts.delete(context);
      context.setData({ loginBusy: false });
    }
  }
}

export function retryWebRoute(context: WebViewPageContext): void {
  if (disposedPages.has(context)) return;
  if (retrySchedules.has(context)) return;

  const key = context.data.routeKey;
  const schedule: RetrySchedule = {};
  retrySchedules.set(context, schedule);
  context.setData({ canRetry: false, errorMessage: '', errorTitle: '', src: '' });

  let reopened = false;
  const reopenOnce = () => {
    if (reopened || retrySchedules.get(context) !== schedule) return;
    reopened = true;
    cancelScheduledRetry(context);
    if (disposedPages.has(context)) return;
    void openWebRoute(context, key);
  };
  const timer = scheduleRuntimeTimeout(reopenOnce, RETRY_SCHEDULER_GRACE_MS);
  if (timer === null) {
    // A missing timer must not leave the page blank and retry-locked.
    reopenOnce();
    return;
  }
  schedule.timer = timer;

  try {
    wx.nextTick(reopenOnce);
  } catch {
    // Retry immediately when the scheduling API is unavailable or broken.
    reopenOnce();
  }
}

/**
 * Keep every web-backed page as a thin route adapter. Loading, session handoff,
 * errors and retries must stay in this shared controller instead of page files.
 */
export function createWebViewPageOptions(
  fixedRouteKey?: WebRouteKey,
  factoryOptions: WebViewPageFactoryOptions = {},
): WechatMiniprogram.Page.Options<WebViewPageData, WebViewPageMethods> {
  return {
    data: createWebViewPageData(),

    onLoad(options) {
      cancelScheduledRetry(this);
      pausedRouteResumes.delete(this);
      disposedPages.delete(this);
      cancelLoginAttempt(this);
      if (factoryOptions.requireMiniProgramSession) {
        sessionRequiredPages.add(this);
      } else {
        sessionRequiredPages.delete(this);
      }
      void openWebRoute(this, fixedRouteKey ?? options.key);
    },

    onShow() {
      if (disposedPages.has(this)) return;
      visiblePages.add(this);
      startNetworkRecovery(this);
      if (sessionGateResumes.delete(this)) {
        void openWebRoute(this, this.data.routeKey);
        return;
      }
      if (pausedRouteResumes.delete(this)) {
        retryWebRoute(this);
        return;
      }
      recoverVisibleRouteIfConnected(this);
    },

    onHide() {
      visiblePages.delete(this);
      if (!this.data.loginRequired) pausePendingRoute(this);
      stopNetworkRecovery(this);
    },

    onUnload() {
      cancelWebRoute(this);
    },

    onShareAppMessage() {
      return resolveWebRouteShare(this.data.routeKey) ?? {
        imageUrl: WEB_ROUTE_SHARE_IMAGE,
        title: 'CubeRoot 魔方根',
        path: '/pages/timer/index',
      };
    },

    handleWebViewError(event) {
      markWebRouteFailed(this, event.currentTarget.dataset.attempt);
    },

    async loginWithWechat() {
      await loginToOpenWebRoute(this);
    },

    retry() {
      retryWebRoute(this);
    },

    retryMiniProgramSession() {
      void openWebRoute(this, this.data.routeKey);
    },
  };
}
