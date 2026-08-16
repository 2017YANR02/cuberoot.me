import {
  ApiError,
  clearStoredSession,
  createWebSessionTicket,
  getStoredSession,
} from './auth';
import { createWebSessionHandoffUrl, resolveWebRoute } from './web-routes';

export interface WebViewPageData {
  canRetry: boolean;
  errorMessage: string;
  errorTitle: string;
  routeKey: string;
  src: string;
}

export interface WebViewPageContext {
  data: WebViewPageData;
  setData(data: Partial<WebViewPageData>): void;
}

const routeAttempts = new WeakMap<WebViewPageContext, number>();
const WEB_SESSION_HANDOFF_TIMEOUT_MS = 6_000;

function createWebSessionTicketWithTimeout(session: Parameters<typeof createWebSessionTicket>[0]) {
  return new Promise<Awaited<ReturnType<typeof createWebSessionTicket>>>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new ApiError(0, 'web session handoff timed out'));
    }, WEB_SESSION_HANDOFF_TIMEOUT_MS);

    void createWebSessionTicket(session).then(
      (ticket) => {
        clearTimeout(timeout);
        resolve(ticket);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function beginRouteAttempt(context: WebViewPageContext): number {
  const attempt = (routeAttempts.get(context) ?? 0) + 1;
  routeAttempts.set(context, attempt);
  return attempt;
}

function isCurrentAttempt(context: WebViewPageContext, attempt: number): boolean {
  return routeAttempts.get(context) === attempt;
}

export function createWebViewPageData(): WebViewPageData {
  return {
    canRetry: false,
    errorMessage: '',
    errorTitle: '',
    routeKey: '',
    src: '',
  };
}

export async function openWebRoute(context: WebViewPageContext, key: unknown): Promise<boolean> {
  const route = resolveWebRoute(key);
  if (!route) {
    beginRouteAttempt(context);
    context.setData({
      canRetry: false,
      errorMessage: '该页面地址不在允许列表中。',
      errorTitle: '无法打开',
      routeKey: '',
      src: '',
    });
    return false;
  }

  const attempt = beginRouteAttempt(context);
  wx.setNavigationBarTitle({ title: route.title });
  context.setData({
    canRetry: false,
    errorMessage: '',
    errorTitle: '',
    routeKey: String(key),
    src: '',
  });

  const session = getStoredSession();
  if (!session) {
    if (isCurrentAttempt(context, attempt)) context.setData({ src: route.url });
    return true;
  }

  try {
    const { ticket } = await createWebSessionTicketWithTimeout(session);
    if (isCurrentAttempt(context, attempt)) {
      context.setData({ src: createWebSessionHandoffUrl(route.path, ticket) });
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) clearStoredSession();
    if (isCurrentAttempt(context, attempt)) context.setData({ src: route.url });
  }
  return true;
}

export function markWebRouteFailed(context: WebViewPageContext): void {
  beginRouteAttempt(context);
  context.setData({
    canRetry: Boolean(resolveWebRoute(context.data.routeKey)),
    errorMessage: '请检查网络后重试。网站内容和账号数据不会因此被删除。',
    errorTitle: '网页加载失败',
    src: '',
  });
}

export function retryWebRoute(context: WebViewPageContext): void {
  const key = context.data.routeKey;
  context.setData({ canRetry: false, errorMessage: '', errorTitle: '', src: '' });
  wx.nextTick(() => {
    void openWebRoute(context, key);
  });
}
