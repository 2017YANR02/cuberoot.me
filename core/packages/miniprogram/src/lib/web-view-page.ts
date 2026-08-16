import {
  ApiError,
  clearStoredSession,
  createWebSessionTicket,
  getStoredSession,
} from './auth';
import {
  createWebSessionHandoffUrl,
  resolveWebRoute,
  resolveWebRouteShare,
  WEB_ROUTE_SHARE_IMAGE,
  type WebRouteKey,
} from './web-routes';
import {
  clearRuntimeTimeout,
  scheduleRuntimeTimeout,
  type RuntimeTimer,
} from './runtime-timers';

export interface WebViewPageData {
  canRetry: boolean;
  errorMessage: string;
  errorTitle: string;
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
  retry(): void;
}

const routeAttempts = new WeakMap<WebViewPageContext, number>();
const disposedPages = new WeakSet<WebViewPageContext>();
const visiblePages = new WeakSet<WebViewPageContext>();
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
      wx.showShareMenu({ menus: ['shareAppMessage'] });
      return;
    }
    wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
  } catch {
    // Sharing is optional; route loading must survive unsupported menu APIs.
  }
}

export function createWebViewPageData(): WebViewPageData {
  return {
    canRetry: false,
    errorMessage: '',
    errorTitle: '',
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
    loadingTitle: `正在打开${route.title}`,
    routeKey: String(key),
    src: '',
    viewAttempt: attempt,
  });

  const session = getStoredSession();
  if (!session || !route.sessionHandoff) {
    if (isCurrentAttempt(context, attempt)) context.setData({ src: route.url });
    return true;
  }

  try {
    const { ticket } = await createWebSessionTicket(session);
    if (isCurrentAttempt(context, attempt)) {
      const currentSession = getStoredSession();
      context.setData({
        src: currentSession?.token === session.token
          ? createWebSessionHandoffUrl(route.path, ticket)
          : route.url,
      });
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const currentSession = getStoredSession();
      if (currentSession?.token === session.token) clearStoredSession();
    }
    if (isCurrentAttempt(context, attempt)) context.setData({ src: route.url });
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
  cancelScheduledRetry(context);
  stopNetworkRecovery(context);
  disposedPages.add(context);
  beginRouteAttempt(context);
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
): WechatMiniprogram.Page.Options<WebViewPageData, WebViewPageMethods> {
  return {
    data: createWebViewPageData(),

    onLoad(options) {
      cancelScheduledRetry(this);
      disposedPages.delete(this);
      void openWebRoute(this, fixedRouteKey ?? options.key);
    },

    onShow() {
      if (disposedPages.has(this)) return;
      visiblePages.add(this);
      startNetworkRecovery(this);
      recoverVisibleRouteIfConnected(this);
    },

    onHide() {
      visiblePages.delete(this);
      if (cancelScheduledRetry(this)) markWebRouteFailed(this);
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

    retry() {
      retryWebRoute(this);
    },
  };
}
