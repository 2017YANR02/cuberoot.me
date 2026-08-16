import { resolveWebRoute } from './web-routes';

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

export function createWebViewPageData(): WebViewPageData {
  return {
    canRetry: false,
    errorMessage: '',
    errorTitle: '',
    routeKey: '',
    src: '',
  };
}

export function openWebRoute(context: WebViewPageContext, key: unknown): boolean {
  const route = resolveWebRoute(key);
  if (!route) {
    context.setData({
      canRetry: false,
      errorMessage: '该页面地址不在允许列表中。',
      errorTitle: '无法打开',
      routeKey: '',
      src: '',
    });
    return false;
  }

  wx.setNavigationBarTitle({ title: route.title });
  context.setData({
    canRetry: false,
    errorMessage: '',
    errorTitle: '',
    routeKey: String(key),
    src: route.url,
  });
  return true;
}

export function markWebRouteFailed(context: WebViewPageContext): void {
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
    openWebRoute(context, key);
  });
}
